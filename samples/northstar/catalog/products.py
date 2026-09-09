"""Product listing and lookup."""

from flask import Blueprint, jsonify

from catalog.inventory import remaining_stock
from models import get_product
from db import execute

catalog_bp = Blueprint("catalog", __name__)


@catalog_bp.get("/")
def list_products():
    rows = execute("SELECT id, name, price_cents FROM products").fetchall()
    return jsonify([{"id": r["id"], "name": r["name"], "price_cents": r["price_cents"]} for r in rows])


@catalog_bp.get("/<int:product_id>")
def show_product(product_id: int):
    product = get_product(product_id)
    if product is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(
        {
            "id": product.id,
            "name": product.name,
            "price_cents": product.price_cents,
            "stock": remaining_stock(product_id),
        }
    )
