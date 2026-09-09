"""Place an order: auth, stock, payment, persistence."""

from auth.session import get_current_user
from catalog.inventory import decrement_stock
from db import execute
from models import get_product
from orders.payments import charge


class OrderError(Exception):
    pass


def place_order(token: str, product_id: int, qty: int) -> int:
    user = get_current_user(token)
    if user is None:
        raise OrderError("not authenticated")
    product = get_product(product_id)
    if product is None:
        raise OrderError("unknown product")
    decrement_stock(product_id, qty)
    total = product.price_cents * qty
    charge(user.id, total)
    cur = execute(
        "INSERT INTO orders (user_id, total_cents, status) VALUES (?, ?, ?)",
        (user.id, total, "paid"),
    )
    return int(cur.lastrowid)
