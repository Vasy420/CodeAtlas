"""HTTP routes for placing orders."""

from flask import Blueprint, jsonify, request

from auth.permissions import require_user
from orders.service import OrderError, place_order

orders_bp = Blueprint("orders", __name__)


@orders_bp.post("/")
def create_order():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    try:
        require_user(token)
        payload = request.get_json(force=True)
        order_id = place_order(token, int(payload["product_id"]), int(payload.get("qty", 1)))
    except OrderError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"order_id": order_id}), 201
