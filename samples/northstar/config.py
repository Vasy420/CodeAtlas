"""Runtime configuration for the Northstar shop."""

import os

SECRET_KEY = os.environ.get("NORTHSTAR_SECRET", "dev-secret")
DATABASE_PATH = os.environ.get("NORTHSTAR_DB", "northstar.db")
DEBUG = os.environ.get("NORTHSTAR_DEBUG", "1") == "1"
PAYMENT_API = os.environ.get("NORTHSTAR_PAYMENTS", "https://payments.example.test")
