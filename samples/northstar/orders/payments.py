"""Charge a customer's card through the payments provider."""

from config import PAYMENT_API


class PaymentError(Exception):
    pass


def charge(user_id: int, amount_cents: int) -> str:
    if amount_cents <= 0:
        raise PaymentError("invalid amount")
    # Fake provider call — the URL is the dependency we care about.
    return f"pay_{user_id}_{amount_cents}_{PAYMENT_API[-6:]}"
