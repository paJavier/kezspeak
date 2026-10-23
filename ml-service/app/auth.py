"""Two ways in:

- Browser calls carry the user's Supabase session (Bearer token). We check who
  they are and whether they may touch the submission.
- Server-to-server calls (the Supabase Edge Function) carry the shared
  KEZSPEAK_API_KEY in an `access_token` header. Never ship this key to a browser.
"""

import secrets
from dataclasses import dataclass

from fastapi import Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app import db
from app.config import settings

_api_key_header = APIKeyHeader(name="access_token", auto_error=False)


def require_api_key(key: str | None = Security(_api_key_header)) -> None:
    if not settings.api_key:
        # Fail closed: an unset key must not leave /evaluate open.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Server-to-server access is not configured.")
    if not key or not secrets.compare_digest(key.encode(), settings.api_key.encode()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid or missing API key.")


@dataclass(frozen=True)
class CurrentUser:
    id: str
    role: str | None

    @property
    def is_admin(self) -> bool:
        # A super admin has every admin permission (mirrors kez_role() in SQL).
        return self.role in ("admin", "super_admin")

    @property
    def is_staff(self) -> bool:
        return self.role == "tutor" or self.is_admin


def get_current_user(authorization: str = Header(default="")) -> CurrentUser:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token.")

    try:
        response = db.get_client().auth.get_user(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session.")

    user = getattr(response, "user", None)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session.")

    return CurrentUser(id=user.id, role=db.get_role(user.id))
