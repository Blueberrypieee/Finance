"""
Database layer for Finance Tracker.

Uses plain sqlite3 (Python standard library) — no extra packages needed,
so this runs on Termux without pip installing anything new.

Every public function opens its own short-lived connection and always
closes it (even on error) via try/finally, so one failed insert can't
leave the database locked for the next request.
"""

import sqlite3
import os
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "instance", "database.db")


def get_db():
    """Open a new connection with row access by column name."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db():
    """Create tables if they don't exist yet. Safe to call every startup."""
    os.makedirs(os.path.join(BASE_DIR, "instance"), exist_ok=True)
    conn = get_db()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                balance REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                notes TEXT,
                date TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------
# Users
# ---------------------------------------------------------------

def get_user_by_username(username):
    conn = get_db()
    try:
        return conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
    finally:
        conn.close()


def get_user_by_id(user_id):
    conn = get_db()
    try:
        return conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    finally:
        conn.close()


def create_user(username, password_hash):
    """Returns the new user's id, or None if the username is already taken."""
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, balance, created_at) VALUES (?, ?, 0, ?)",
            (username, password_hash, datetime.utcnow().isoformat()),
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def update_balance(user_id, new_balance):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET balance = ? WHERE id = ?", (new_balance, user_id)
        )
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------

def get_transactions(user_id):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def create_transaction(user_id, tx_type, amount, category, notes, date, created_at):
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO transactions (user_id, type, amount, category, notes, date, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user_id, tx_type, amount, category, notes, date, created_at),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def update_transaction(tx_id, user_id, tx_type, amount, category, notes, date):
    conn = get_db()
    try:
        conn.execute(
            """UPDATE transactions
               SET type = ?, amount = ?, category = ?, notes = ?, date = ?
               WHERE id = ? AND user_id = ?""",
            (tx_type, amount, category, notes, date, tx_id, user_id),
        )
        conn.commit()
    finally:
        conn.close()


def delete_transaction(tx_id, user_id):
    conn = get_db()
    try:
        conn.execute(
            "DELETE FROM transactions WHERE id = ? AND user_id = ?", (tx_id, user_id)
        )
        conn.commit()
    finally:
        conn.close()


def delete_all_transactions(user_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()


def get_transaction_by_id(tx_id, user_id):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ? AND user_id = ?", (tx_id, user_id)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

