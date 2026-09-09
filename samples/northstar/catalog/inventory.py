"""Stock mutations used when an order is placed."""

from db import execute
from models import get_product


class OutOfStock(Exception):
    pass


def remaining_stock(product_id: int) -> int:
    product = get_product(product_id)
    return 0 if product is None else product.stock


def decrement_stock(product_id: int, qty: int) -> None:
    product = get_product(product_id)
    if product is None or product.stock < qty:
        raise OutOfStock(f"product {product_id}")
    execute(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        (qty, product_id),
    )
