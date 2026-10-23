import pytest
from fastapi.testclient import TestClient

from app import admin, auth, main

SUPER = "99999999-9999-9999-9999-999999999999"
OTHER = "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(admin, "_profile", lambda uid: {"id": uid, "role": "student"})
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def as_user(user_id, role):
    main.app.dependency_overrides[auth.get_current_user] = lambda: auth.CurrentUser(user_id, role)


@pytest.mark.parametrize("role", ["student", "tutor", "admin", None])
def test_only_super_admin_can_manage_accounts(client, role):
    as_user(OTHER, role)
    assert client.get("/admin/users").status_code == 403
    assert client.delete(f"/admin/users/{SUPER}").status_code == 403
    assert client.patch(f"/admin/users/{SUPER}", json={"role": "student"}).status_code == 403
    response = client.post(
        "/admin/users", json={"email": "a@b.co", "full_name": "A", "password": "longenough", "role": "admin"}
    )
    assert response.status_code == 403


def test_super_admin_cannot_delete_self(client):
    as_user(SUPER, "super_admin")
    assert client.delete(f"/admin/users/{SUPER}").status_code == 400


def test_super_admin_cannot_demote_self(client):
    as_user(SUPER, "super_admin")
    assert client.patch(f"/admin/users/{SUPER}", json={"role": "tutor"}).status_code == 400


def test_create_validates_input(client):
    as_user(SUPER, "super_admin")
    bad_email = {"email": "nope", "full_name": "A", "password": "longenough", "role": "student"}
    assert client.post("/admin/users", json=bad_email).status_code == 422
    short_password = {"email": "a@b.co", "full_name": "A", "password": "short", "role": "student"}
    assert client.post("/admin/users", json=short_password).status_code == 422
    bad_role = {"email": "a@b.co", "full_name": "A", "password": "longenough", "role": "lecturer"}
    assert client.post("/admin/users", json=bad_role).status_code == 422


def test_super_admin_can_run_ai_comparison(monkeypatch):
    from app import db

    submission = {"id": "sub-1", "learner_id": OTHER, "status": "completed", "task_id": "t", "audio_path": "x"}
    monkeypatch.setattr(db, "get_submission", lambda sid: submission)
    monkeypatch.setattr(db, "get_evaluation", lambda sid: {"predicted_score": 80.0, "model_version": "v1"})
    monkeypatch.setattr(db, "get_ai_comparison", lambda sid: {"id": "c1", "ai_score": 70})
    as_user(SUPER, "super_admin")
    response = TestClient(main.app).post("/submissions/sub-1/ai-comparison")
    main.app.dependency_overrides.clear()
    assert response.status_code == 200


def test_only_super_admin_can_send_password_email(client):
    as_user(OTHER, "admin")
    assert client.post(f"/admin/users/{OTHER}/password-email", json={}).status_code == 403


def test_invite_rejects_foreign_redirect(client):
    as_user(SUPER, "super_admin")
    body = {"email": "a@b.co", "full_name": "A", "role": "student", "redirect_to": "https://evil.example"}
    assert client.post("/admin/users", json=body).status_code == 400


def test_password_email_uses_allowed_redirect(client, monkeypatch):
    from app import db

    sent = {}

    class FakeAuth:
        def reset_password_for_email(self, email, options):
            sent.update(email=email, **options)

    class FakeClient:
        auth = FakeAuth()

    monkeypatch.setattr(admin, "_profile", lambda uid: {"id": uid, "email": "learner@kez.test"})
    monkeypatch.setattr(db, "get_client", lambda: FakeClient())
    as_user(SUPER, "super_admin")
    origin = admin.settings.allowed_origins[0]
    response = client.post(f"/admin/users/{OTHER}/password-email", json={"redirect_to": origin + "/"})
    assert response.status_code == 202
    assert sent == {"email": "learner@kez.test", "redirect_to": origin}
