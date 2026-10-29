from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app import auth, db, main
from app.pipeline import run

LEARNER = "11111111-1111-1111-1111-111111111111"
OTHER_LEARNER = "22222222-2222-2222-2222-222222222222"
TUTOR = "33333333-3333-3333-3333-333333333333"
SUBMISSION = {"id": "sub-1", "learner_id": LEARNER, "audio_path": f"{LEARNER}/sub-1.webm"}


@pytest.fixture
def client(monkeypatch):
    state = {"claimed_from": None, "claim_ok": True, "processed": [], "tutor_link": False}

    monkeypatch.setattr(db, "get_submission", lambda sid: SUBMISSION if sid == "sub-1" else None)

    def fake_claim(sid, statuses):
        state["claimed_from"] = statuses
        return state["claim_ok"]

    monkeypatch.setattr(db, "claim_submission", fake_claim)
    monkeypatch.setattr(main, "_tutor_has_learner", lambda t, l: state["tutor_link"])
    monkeypatch.setattr(run, "process_submission", lambda sid: state["processed"].append(sid))

    # Without a `with` block TestClient skips the lifespan, so Whisper isn't loaded.
    test_client = TestClient(main.app)
    test_client.state = state
    yield test_client
    main.app.dependency_overrides.clear()


def as_user(user_id, role):
    main.app.dependency_overrides[auth.get_current_user] = lambda: auth.CurrentUser(user_id, role)


def test_requires_bearer_token(client):
    assert client.post("/submissions/sub-1/process").status_code == 401


def test_owner_can_start_processing(client):
    as_user(LEARNER, "student")
    response = client.post("/submissions/sub-1/process")
    assert response.status_code == 202
    assert client.state["claimed_from"] == ["pending"]
    assert client.state["processed"] == ["sub-1"]


def test_other_learner_is_forbidden(client):
    as_user(OTHER_LEARNER, "student")
    assert client.post("/submissions/sub-1/process").status_code == 403
    assert client.state["processed"] == []


def test_unassigned_tutor_is_forbidden(client):
    as_user(TUTOR, "tutor")
    assert client.post("/submissions/sub-1/retry").status_code == 403


def test_assigned_tutor_can_retry(client):
    client.state["tutor_link"] = True
    as_user(TUTOR, "tutor")
    assert client.post("/submissions/sub-1/retry").status_code == 202
    assert client.state["claimed_from"] == ["failed"]


def test_double_submit_is_rejected(client):
    client.state["claim_ok"] = False
    as_user(LEARNER, "student")
    assert client.post("/submissions/sub-1/process").status_code == 409
    assert client.state["processed"] == []


def test_unknown_submission_is_404(client):
    as_user(LEARNER, "student")
    assert client.post("/submissions/nope/process").status_code == 404


# ---------------------------------------------------------------------------
# POST /evaluate (server-to-server, API key)
# ---------------------------------------------------------------------------

API_KEY = "test-key-0123456789abcdef"
AUDIO = {"file": ("clip.webm", b"fake-audio", "audio/webm")}


@pytest.fixture
def keyed(monkeypatch, client):
    monkeypatch.setattr(auth, "settings", replace(auth.settings, api_key=API_KEY))
    calls = []

    def fake_evaluate(raw):
        calls.append(raw)
        return {"transcript": "hello", "predicted_score": 80.0}

    monkeypatch.setattr(run, "evaluate_bytes", fake_evaluate)
    client.state["evaluate_calls"] = calls
    return client


def test_evaluate_rejects_missing_key(keyed):
    assert keyed.post("/evaluate", files=AUDIO).status_code == 403
    assert keyed.state["evaluate_calls"] == []


def test_evaluate_rejects_wrong_key(keyed):
    response = keyed.post("/evaluate", files=AUDIO, headers={"access_token": "nope"})
    assert response.status_code == 403


def test_evaluate_ignores_user_session_without_key(keyed):
    # A logged-in learner's bearer token is not a substitute for the server key.
    as_user(LEARNER, "student")
    response = keyed.post("/evaluate", files=AUDIO, headers={"Authorization": "Bearer x"})
    assert response.status_code == 403


def test_evaluate_disabled_when_key_not_configured(client, monkeypatch):
    monkeypatch.setattr(auth, "settings", replace(auth.settings, api_key=""))
    response = client.post("/evaluate", files=AUDIO, headers={"access_token": "anything"})
    assert response.status_code == 503


def test_evaluate_with_key_returns_result(keyed):
    response = keyed.post("/evaluate", files=AUDIO, headers={"access_token": API_KEY})
    assert response.status_code == 200
    assert response.json()["predicted_score"] == 80.0
    assert keyed.state["evaluate_calls"] == [b"fake-audio"]


# --- /submissions/{id}/ai-comparison (tutor/admin research aid) ---

COMPLETED = {**SUBMISSION, "status": "completed", "task_id": "task-1", "mime_type": "audio/webm"}


@pytest.fixture
def comparing(monkeypatch, client):
    from app import gemini

    calls = []
    monkeypatch.setattr(db, "get_submission", lambda sid: COMPLETED if sid == "sub-1" else None)
    monkeypatch.setattr(db, "get_evaluation", lambda sid: {"predicted_score": 81.97, "model_version": "v1"})
    monkeypatch.setattr(db, "get_ai_comparison", lambda sid: None)
    monkeypatch.setattr(db, "download_audio", lambda path: b"audio")
    monkeypatch.setattr(db, "get_task_prompt", lambda tid: "Describe a place")
    monkeypatch.setattr(db, "save_ai_comparison", lambda row: row)

    def fake_compare(raw, mime, prompt):
        calls.append(prompt)
        return {"provider": "gemini", "model": "m", "ai_score": 75.0, "transcript": "", "summary": "ok",
                "strengths": [], "improvements": []}

    monkeypatch.setattr(gemini, "compare", fake_compare)
    client.state["gemini_calls"] = calls
    return client


def test_learner_cannot_request_ai_comparison(comparing):
    as_user(LEARNER, "student")
    assert comparing.post("/submissions/sub-1/ai-comparison").status_code == 403
    assert comparing.state["gemini_calls"] == []


def test_unassigned_tutor_cannot_request_ai_comparison(comparing):
    as_user(TUTOR, "tutor")
    assert comparing.post("/submissions/sub-1/ai-comparison").status_code == 403


def test_assigned_tutor_gets_both_scores(comparing):
    comparing.state["tutor_link"] = True
    as_user(TUTOR, "tutor")
    response = comparing.post("/submissions/sub-1/ai-comparison")
    assert response.status_code == 200
    body = response.json()
    assert body["ai_score"] == 75.0
    assert body["model_score"] == 81.97
    assert body["requested_by"] == TUTOR


def test_existing_comparison_is_reused(comparing, monkeypatch):
    monkeypatch.setattr(db, "get_ai_comparison", lambda sid: {"id": "c1", "ai_score": 70})
    as_user("admin-1", "admin")
    assert comparing.post("/submissions/sub-1/ai-comparison").json()["id"] == "c1"
    assert comparing.state["gemini_calls"] == []


def test_comparison_waits_for_model_result(comparing, monkeypatch):
    monkeypatch.setattr(db, "get_submission", lambda sid: {**COMPLETED, "status": "evaluating"})
    as_user("admin-1", "admin")
    assert comparing.post("/submissions/sub-1/ai-comparison").status_code == 409


# --- /activities/generate (draft a speaking task from reference material) ---

DRAFT = {"provider": "gemini", "model": "m", "title": "My city", "prompt": "Describe your city.",
         "follow_up_questions": ["What do you like?"], "skill_focus": "describing places", "duration_seconds": 90}


def docx_bytes(*paragraphs):
    import io
    import zipfile

    ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", f'<w:document xmlns:w="{ns}"><w:body>{body}</w:body></w:document>')
    return buffer.getvalue()


@pytest.fixture
def drafting(monkeypatch, client):
    from app import gemini

    calls = []

    def fake_generate(document, skill_focus, exam_style=None):
        calls.append((document, skill_focus))
        return DRAFT

    monkeypatch.setattr(gemini, "generate_activity", fake_generate)
    client.state["draft_calls"] = calls
    return client


def upload(client, name, data, **form):
    return client.post("/activities/generate", files={"file": (name, data)}, data=form)


def test_learner_cannot_generate_activity(drafting):
    as_user(LEARNER, "student")
    assert upload(drafting, "notes.txt", b"hello").status_code == 403
    assert drafting.state["draft_calls"] == []


def test_tutor_gets_draft_from_txt(drafting):
    as_user(TUTOR, "tutor")
    response = upload(drafting, "notes.txt", b"Cities change over time.", skill_focus="fluency")
    assert response.status_code == 200
    assert response.json()["title"] == "My city"
    document, focus = drafting.state["draft_calls"][0]
    assert document == {"text": "Cities change over time."}
    assert focus == "fluency"


def test_docx_text_is_extracted(drafting):
    as_user("admin-1", "admin")
    assert upload(drafting, "lesson.docx", docx_bytes("First idea", "Second idea")).status_code == 200
    assert drafting.state["draft_calls"][0][0] == {"text": "First idea\nSecond idea"}


def test_pdf_is_sent_inline(drafting):
    as_user(TUTOR, "tutor")
    assert upload(drafting, "reading.pdf", b"%PDF-1.4 fake").status_code == 200
    assert drafting.state["draft_calls"][0][0]["inline_data"]["mime_type"] == "application/pdf"


@pytest.mark.parametrize(
    "name,data",
    [("run.exe", b"MZ"), ("notes.txt", b""), ("fake.pdf", b"not a pdf"), ("broken.docx", b"nope")],
)
def test_bad_reference_files_are_rejected(drafting, name, data):
    as_user(TUTOR, "tutor")
    assert upload(drafting, name, data).status_code == 422
    assert drafting.state["draft_calls"] == []


def test_oversized_reference_is_rejected(drafting):
    from app import reference

    as_user(TUTOR, "tutor")
    assert upload(drafting, "big.txt", b"a" * (reference.MAX_REFERENCE_BYTES + 1)).status_code == 422


def test_gemini_failure_is_502(drafting, monkeypatch):
    from app import gemini

    def boom(document, skill_focus, exam_style=None):
        raise gemini.GeminiError("down")

    monkeypatch.setattr(gemini, "generate_activity", boom)
    as_user(TUTOR, "tutor")
    assert upload(drafting, "notes.txt", b"text").status_code == 502


def test_missing_gemini_key_is_503(drafting, monkeypatch):
    from app import gemini

    def unset(document, skill_focus, exam_style=None):
        raise gemini.GeminiNotConfigured("unset")

    monkeypatch.setattr(gemini, "generate_activity", unset)
    as_user(TUTOR, "tutor")
    assert upload(drafting, "notes.txt", b"text").status_code == 503


def test_generated_draft_is_clamped_and_trimmed(monkeypatch):
    from app import gemini

    answer = {"title": " Travel ", "prompt": "Talk about a trip.", "follow_up_questions": ["a", " ", "b", "c", "d", "e"],
              "skill_focus": "narrating", "duration_seconds": 999}
    monkeypatch.setattr(gemini, "_generate", lambda parts, schema, temperature: ("m", answer))
    draft = gemini.generate_activity({"text": "x"})
    assert draft["title"] == "Travel"
    assert draft["duration_seconds"] == 300
    assert draft["follow_up_questions"] == ["a", "b", "c"]


def test_activity_prompt_keeps_one_topic(monkeypatch):
    from app import gemini

    sent = {}

    def fake_generate(parts, schema, temperature):
        sent["parts"] = parts
        return "m", {"title": "T", "prompt": "P", "follow_up_questions": [], "skill_focus": "", "duration_seconds": 60}

    monkeypatch.setattr(gemini, "_generate", fake_generate)
    gemini.generate_activity({"text": "material"}, "giving opinions")
    instructions = sent["parts"][0]["text"]
    assert "Choose ONE coherent topic" in instructions
    assert "do not copy its questions" in instructions
    assert '"giving opinions"' in instructions
    assert sent["parts"][-1] == {"text": "material"}


def test_exam_style_is_passed_to_gemini(drafting, monkeypatch):
    from app import gemini

    styles = []

    def fake_generate(document, skill_focus, exam_style=None):
        styles.append(exam_style)
        return DRAFT

    monkeypatch.setattr(gemini, "generate_activity", fake_generate)
    as_user(TUTOR, "tutor")
    assert upload(drafting, "notes.txt", b"text", exam_style="ielts_part2").status_code == 200
    assert styles == ["ielts_part2"]


def test_unknown_exam_style_is_rejected(drafting):
    as_user(TUTOR, "tutor")
    assert upload(drafting, "notes.txt", b"text", exam_style="made_up").status_code == 422
    assert drafting.state["draft_calls"] == []


def test_exam_style_hint_reaches_the_prompt(monkeypatch):
    from app import gemini

    sent = {}

    def fake_generate(parts, schema, temperature):
        sent["parts"] = parts
        return "m", {"title": "T", "prompt": "P", "follow_up_questions": [], "skill_focus": "", "duration_seconds": 120}

    monkeypatch.setattr(gemini, "_generate", fake_generate)
    gemini.generate_activity({"text": "material"}, None, "ielts_part2")
    assert "IELTS Speaking Part 2 cue card" in sent["parts"][0]["text"]
