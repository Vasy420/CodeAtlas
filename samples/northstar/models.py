"""Domain records for users, products, and orders."""

from dataclasses import dataclass
from typing import Optional

from db import execute


@dataclass
class User:
    id: int
    email: str
    role: str


@dataclass
class Product:
    id: int
    name: str
    price_cents: int
    stock: int


@dataclass
class Order:
    id: int
    user_id: int
    total_cents: int
    status: str


def get_user(user_id: int) -> Optional[User]:
    row = execute("SELECT id, email, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    return User(id=row["id"], email=row["email"], role=row["role"])


def get_product(product_id: int) -> Optional[Product]:
    row = execute(
        "SELECT id, name, price_cents, stock FROM products WHERE id = ?",
        (product_id,),
    ).fetchone()
    if row is None:
        return None
    return Product(
        id=row["id"],
        name=row["name"],
        price_cents=row["price_cents"],
        stock=row["stock"],
    )
