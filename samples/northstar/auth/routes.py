"""HTTP routes for login and logout."""

from flask import Blueprint, jsonify, request

from auth.session import create_session, destroy_session, get_current_user
from db import execute

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    payload = request.get_json(force=True)
    email = payload.get("email")
    row = execute(
        "SELECT id FROM users WHERE email = ? AND password_hash = ?",
        (email, payload.get("password_hash")),
    ).fetchone()
    if row is None:
        return jsonify({"error": "invalid credentials"}), 401
    token = create_session(row["id"])
    return jsonify({"token": token})


@auth_bp.post("/logout")
def logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    destroy_session(token)
    return jsonify({"ok": True})


@auth_bp.get("/me")
def me():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user = get_current_user(token)
    if user is None:
        return jsonify({"error": "not authenticated"}), 401
    return jsonify({"id": user.id, "email": user.email, "role": user.role})
