"""Northstar shop application entry point."""

from flask import Flask

from auth.routes import auth_bp
from catalog.products import catalog_bp
from config import SECRET_KEY, DEBUG
from orders.routes import orders_bp
from utils.logging import setup_logging


def create_app() -> Flask:
    setup_logging()
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["DEBUG"] = DEBUG
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(catalog_bp, url_prefix="/catalog")
    app.register_blueprint(orders_bp, url_prefix="/orders")
    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=DEBUG)
