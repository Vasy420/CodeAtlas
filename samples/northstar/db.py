"""SQLite connection helpers used across the shop."""

import sqlite3

from config import DATABASE_PATH


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def execute(sql: str, params: tuple = ()) -> sqlite3.Cursor:
    conn = get_connection()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur
    finally:
        conn.close()
