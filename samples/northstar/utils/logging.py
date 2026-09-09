"""Process logging setup."""

import logging

from config import DEBUG


def setup_logging() -> None:
    level = logging.DEBUG if DEBUG else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
