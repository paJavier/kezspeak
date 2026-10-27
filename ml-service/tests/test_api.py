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
