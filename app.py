import os
import secrets
from functools import wraps
from datetime import timedelta, datetime

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

import db

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
db.init_db()


def ensure_csrf_token():
    """Every logged-in session gets a random token the frontend must echo
    back (via the X-CSRF-Token header) on state-changing requests."""
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(16)
    return session["csrf_token"]


def csrf_protect(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        sent_token = request.headers.get("X-CSRF-Token")
        if not sent_token or sent_token != session.get("csrf_token"):
            return jsonify({"success": False, "error": "Permintaan ditolak (CSRF token tidak valid)."}), 403
        return view_func(*args, **kwargs)
    return wrapped


def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login"))
        ensure_csrf_token()
        return view_func(*args, **kwargs)
    return wrapped


# ---------------------------------------------------------------
# Pages
# ---------------------------------------------------------------

@app.route("/")
@app.route("/login")
def login():
    if session.get("user_id"):
        return redirect(url_for("menu"))
    return render_template("login.html")


@app.route("/register")
def register():
    if session.get("user_id"):
        return redirect(url_for("menu"))
    return render_template("register.html")


@app.route("/menu")
@login_required
def menu():
    return render_template("menu.html", csrf_token=session.get("csrf_token", ""))


@app.route("/statistics")
@login_required
def statistics():
    return render_template("statistics.html")


@app.route("/profile")
@login_required
def profile():
    return render_template("profile.html")


# ---------------------------------------------------------------
# Auth API
# ---------------------------------------------------------------

MAX_LEN = 6  # matches the register page's maxlength="6" on username & password


@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"success": False, "error": "Username dan password wajib diisi."}), 400

    if len(username) > MAX_LEN or len(password) > MAX_LEN:
        return jsonify({"success": False, "error": "Username dan password maksimal 6 karakter."}), 400

    user_id = db.create_user(username, generate_password_hash(password))
    if user_id is None:
        return jsonify({"success": False, "error": "Username sudah dipakai."}), 409

    session["user_id"] = user_id
    session["username"] = username
    return jsonify({"success": True, "redirect": url_for("menu")})


MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

MAX_CATEGORY_LEN = 50
MAX_NOTES_LEN = 200
MAX_AMOUNT = 999_999_999_999
MAX_TRANSACTIONS_PER_SAVE = 5000


def validate_transaction_payload(tx):
    """Returns an error string if invalid, or None if the transaction is
    safe to store. Never trust maxlength/type='number' from the browser —
    a direct API request can send anything."""
    if not isinstance(tx, dict):
        return "Format transaksi tidak valid."

    if tx.get("type") not in ("income", "expense"):
        return "Tipe transaksi harus 'income' atau 'expense'."

    amount = tx.get("amount")
    if isinstance(amount, bool) or not isinstance(amount, (int, float)):
        return "Jumlah harus berupa angka."
    if amount <= 0:
        return "Jumlah harus lebih dari 0."
    if amount > MAX_AMOUNT:
        return "Jumlah melebihi batas maksimum."

    category = (tx.get("category") or "").strip()
    if not category:
        return "Kategori wajib diisi."
    if len(category) > MAX_CATEGORY_LEN:
        return "Kategori maksimal {} karakter.".format(MAX_CATEGORY_LEN)

    notes = tx.get("notes") or ""
    if not isinstance(notes, str):
        return "Catatan tidak valid."
    if len(notes) > MAX_NOTES_LEN:
        return "Catatan maksimal {} karakter.".format(MAX_NOTES_LEN)

    date = tx.get("date")
    if not isinstance(date, str):
        return "Tanggal tidak valid."
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return "Format tanggal harus YYYY-MM-DD."

    return None


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    remember = bool(data.get("remember"))

    if not username or not password:
        return jsonify({"success": False, "error": "Username dan password wajib diisi."}), 400

    user = db.get_user_by_username(username)

    # Check lockout BEFORE verifying the password — an attacker shouldn't
    # get more password guesses just because the account is locked.
    if user is not None and user["locked_until"]:
        locked_until = datetime.fromisoformat(user["locked_until"])
        if datetime.utcnow() < locked_until:
            remaining_seconds = (locked_until - datetime.utcnow()).total_seconds()
            remaining_minutes = max(1, int(remaining_seconds // 60) + 1)
            return jsonify({
                "success": False,
                "error": "Terlalu banyak percobaan gagal. Coba lagi dalam {} menit.".format(remaining_minutes)
            }), 429

    if user is None or not check_password_hash(user["password_hash"], password):
        if user is not None:
            db.record_failed_login(username)
            attempts_now = user["failed_attempts"] + 1
            if attempts_now >= MAX_LOGIN_ATTEMPTS:
                locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
                db.set_lockout(username, locked_until.isoformat())
                return jsonify({
                    "success": False,
                    "error": "Terlalu banyak percobaan gagal. Akun dikunci selama {} menit.".format(LOCKOUT_MINUTES)
                }), 429
        return jsonify({"success": False, "error": "Username atau password salah."}), 401

    db.reset_login_attempts(username)

    # "Ingat saya" dicentang -> session bertahan 30 hari (lihat
    # PERMANENT_SESSION_LIFETIME di atas). Tidak dicentang -> session cookie
    # biasa, hilang begitu browser ditutup.
    session.permanent = remember
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    return jsonify({"success": True, "redirect": url_for("menu")})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"success": True, "redirect": url_for("login")})


# ---------------------------------------------------------------
# Transactions & balance API
# ---------------------------------------------------------------

def serialize_transaction(row):
    """DB row -> JSON-friendly dict. id is kept as a string on purpose,
    since the frontend was originally built around string ids
    (e.g. 'tx_169...') — this way none of the existing JS comparisons
    (dataset.id, input.value, etc.) need to change."""
    return {
        "id": str(row["id"]),
        "type": row["type"],
        "amount": row["amount"],
        "category": row["category"],
        "notes": row["notes"] or "",
        "date": row["date"],
        "createdAt": row["created_at"],
    }


@app.route("/api/state", methods=["GET"])
@login_required
def api_get_state():
    user = db.get_user_by_id(session["user_id"])
    transactions = db.get_transactions(session["user_id"])
    return jsonify({
        "balance": user["balance"],
        "transactions": [serialize_transaction(t) for t in transactions]
    })


@app.route("/api/state", methods=["PUT"])
@login_required
@csrf_protect
def api_put_state():
    data = request.get_json(silent=True) or {}
    balance = data.get("balance")
    transactions = data.get("transactions")

    if isinstance(balance, bool) or not isinstance(balance, (int, float)):
        return jsonify({"success": False, "error": "Saldo tidak valid."}), 400
    if abs(balance) > MAX_AMOUNT:
        return jsonify({"success": False, "error": "Saldo melebihi batas maksimum."}), 400

    if not isinstance(transactions, list):
        return jsonify({"success": False, "error": "Data transaksi tidak valid."}), 400
    if len(transactions) > MAX_TRANSACTIONS_PER_SAVE:
        return jsonify({"success": False, "error": "Terlalu banyak transaksi dalam satu permintaan."}), 400

    # Validate EVERYTHING before touching the database. Doing this after
    # deleting old rows would risk wiping a user's data on a bad request.
    for tx in transactions:
        error = validate_transaction_payload(tx)
        if error:
            return jsonify({"success": False, "error": error}), 400

    user_id = session["user_id"]

    # Full replace: simplest way to keep the frontend's existing
    # "mutate local state, save the whole thing" pattern working.
    db.delete_all_transactions(user_id)
    for tx in transactions:
        db.create_transaction(
            user_id,
            tx["type"],
            tx["amount"],
            tx["category"].strip(),
            (tx.get("notes") or "").strip(),
            tx["date"],
            tx.get("createdAt") or 0
        )

    db.update_balance(user_id, balance)

    user = db.get_user_by_id(user_id)
    fresh_transactions = db.get_transactions(user_id)
    return jsonify({
        "balance": user["balance"],
        "transactions": [serialize_transaction(t) for t in fresh_transactions]
    })


if __name__ == "__main__":
    # host 0.0.0.0 supaya bisa diakses dari browser HP yang sama di Termux
    app.run(host="0.0.0.0", port=5000, debug=True)

