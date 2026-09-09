"""Role checks built on top of the session module."""

from typing import Optional

from auth.session import get_current_user
from models import User


class PermissionError(Exception):
    pass


def require_user(token: str) -> User:
    user = get_current_user(token)
    if user is None:
        raise PermissionError("not authenticated")
    return user


def require_admin(token: str) -> User:
    user = require_user(token)
    if user.role != "admin":
        raise PermissionError("admin only")
    return user


def is_admin(token: Optional[str]) -> bool:
    if not token:
        return False
    user = get_current_user(token)
    return bool(user and user.role == "admin")
