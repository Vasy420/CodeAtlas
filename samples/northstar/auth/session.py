"""Session create / read / destroy. High fan-in: many modules import this."""

import hashlib
import secrets
from typing import Optional

from db import execute
from models import User, get_user


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(24)
    execute(
        "INSERT INTO sessions (user_id, token_hash) VALUES (?, ?)",
        (user_id, _hash_token(token)),
    )
    return token


def get_current_user(token: str) -> Optional[User]:
    row = execute(
        "SELECT user_id FROM sessions WHERE token_hash = ?",
        (_hash_token(token),),
    ).fetchone()
    if row is None:
        return None
    return get_user(row["user_id"])


def destroy_session(token: str) -> None:
    execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))
