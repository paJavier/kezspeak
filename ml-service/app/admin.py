"""Super-admin account management. Needs the service-role key, so it lives
server-side; every route requires profiles.role == 'super_admin'.

Tasks and assignments don't need this: super admins manage them straight from
the browser under RLS (kez_role() treats super_admin as admin).
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import db
from app.auth import CurrentUser, get_current_user
from app.config import settings

log = logging.getLogger(__name__)

Role = Literal["student", "tutor", "admin", "super_admin"]
PROFILE_FIELDS = "id, full_name, email, role, created_at"

# Display names (match src/lib/admin.ts). The role values themselves don't change.
ROLE_LABELS = {"student": "Learner", "tutor": "Tutor / Teacher", "admin": "Moderator", "super_admin": "Administrator"}
ROLE_INTROS = {
    "student": (
        "Kez Tutorial Service has created a KezSpeak learner account for you. KezSpeak is where you will "
        "record your speaking assessments and practice activities, and receive feedback from your tutor."
    ),
    "tutor": (
        "Kez Tutorial Service has created a KezSpeak tutor account for you. You will be able to review your "
        "assigned learners' recorded speaking assessments, provide feedback, and follow their progress."
    ),
    "admin": (
        "Kez Tutorial Service has created a KezSpeak staff account for you. You will be able to "
        "oversee learners, tutors and speaking assessments across the platform."
    ),
    "super_admin": (
        "Kez Tutorial Service has created a KezSpeak administrator account for you. You will be able to "
        "manage user accounts, each student's tutor and speaking tasks, in addition to all staff functions."
    ),
}


def require_super_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an administrator can manage accounts.")
    return user


router = APIRouter(prefix="/admin", tags=["admin"])


class NewUser(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    full_name: str = Field(min_length=1, max_length=120)
    # Omit to send an invite email; the user then chooses their own password.
    password: str | None = Field(default=None, min_length=8, max_length=72)
    role: Role = "student"
    # Where the email link lands (the app's origin); must be an allowed origin.
    redirect_to: str | None = None


class EmailLink(BaseModel):
    redirect_to: str | None = None


def _redirect(url: str | None) -> str | None:
    """Only send users back to the app's own origins, never an arbitrary URL."""
    if not url:
        return None
    url = url.rstrip("/")
    if url not in settings.allowed_origins:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That redirect address isn't allowed.")
    return url


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)


def _profile(user_id: str) -> dict:
    result = db.get_client().table("profiles").select(PROFILE_FIELDS).eq("id", user_id).maybe_single().execute()
    if not result or not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    return result.data


@router.get("/users")
def list_users(_: CurrentUser = Depends(require_super_admin)) -> list[dict]:
    return db.get_client().table("profiles").select(PROFILE_FIELDS).order("created_at").execute().data


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(body: NewUser, _: CurrentUser = Depends(require_super_admin)) -> dict:
    client = db.get_client()
    redirect_to = _redirect(body.redirect_to)
    try:
        if body.password:
            created = client.auth.admin.create_user(
                {
                    "email": body.email,
                    "password": body.password,
                    # Created by an admin with a password, so skip the confirmation email.
                    "email_confirm": True,
                    "user_metadata": {"full_name": body.full_name},
                }
            )
        else:
            # Supabase emails an invite link; the user sets their password on arrival.
            # role_label/role_intro fill the formal invite template
            # (supabase/templates/invite.html). Display text only: access is
            # decided by profiles.role, never by user metadata.
            created = client.auth.admin.invite_user_by_email(
                body.email,
                {
                    "data": {
                        "full_name": body.full_name,
                        "role_label": ROLE_LABELS[body.role],
                        "role_intro": ROLE_INTROS[body.role],
                    },
                    "redirect_to": redirect_to,
                },
            )
    except Exception as exc:
        message = str(exc)
        if "already" in message.lower():
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
        if not body.password:
            raise _email_error(exc)
        log.warning("create_user failed: %s", message)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not create the account: {message}")

    user_id = created.user.id
    # The sign-up trigger usually creates the profile as 'student'; upsert sets
    # the chosen role either way (service role passes the role guard).
    client.table("profiles").upsert(
        {"id": user_id, "email": body.email, "full_name": body.full_name, "role": body.role}
    ).execute()
    return _profile(user_id)


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate, me: CurrentUser = Depends(require_super_admin)) -> dict:
    _profile(user_id)
    if user_id == me.id and body.role is not None and body.role != "super_admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't remove your own administrator role.")

    client = db.get_client()
    auth_changes: dict = {}
    if body.password:
        auth_changes["password"] = body.password
    if body.full_name:
        auth_changes["user_metadata"] = {"full_name": body.full_name}
    if auth_changes:
        client.auth.admin.update_user_by_id(user_id, auth_changes)

    profile_changes = {k: v for k, v in {"full_name": body.full_name, "role": body.role}.items() if v is not None}
    if profile_changes:
        client.table("profiles").update(profile_changes).eq("id", user_id).execute()
    return _profile(user_id)


@router.post("/users/{user_id}/password-email", status_code=status.HTTP_202_ACCEPTED)
def send_password_email(user_id: str, body: EmailLink, _: CurrentUser = Depends(require_super_admin)) -> dict:
    """Email the user a link to set a new password (resend an invite, or a reset)."""
    profile = _profile(user_id)
    try:
        db.get_client().auth.reset_password_for_email(profile["email"], {"redirect_to": _redirect(body.redirect_to)})
    except Exception as exc:
        raise _email_error(exc)
    return {"sent_to": profile["email"]}


def _email_error(exc: Exception) -> HTTPException:
    message = str(exc)
    log.warning("Auth email failed: %s", message)
    if "rate limit" in message.lower():
        return HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Supabase's email limit was reached. Wait a while, or set up custom SMTP in the Supabase dashboard.",
        )
    return HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not send the email: {message}")


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, me: CurrentUser = Depends(require_super_admin)) -> None:
    if user_id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't delete your own account.")
    _profile(user_id)
    client = db.get_client()

    # Recordings live in storage under {user_id}/; remove them with the account.
    bucket = client.storage.from_(settings.recordings_bucket)
    try:
        files = [f"{user_id}/{item['name']}" for item in bucket.list(user_id)]
        if files:
            bucket.remove(files)
    except Exception as exc:
        log.warning("Could not remove recordings for %s: %s", user_id, exc)

    client.auth.admin.delete_user(user_id)
    # Covers projects where profiles has no ON DELETE CASCADE to auth.users.
    client.table("profiles").delete().eq("id", user_id).execute()
