import os
from functools import wraps

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

import db

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")
db.init_db()


def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login"))
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
    return render_template("menu.html")


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


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"success": False, "error": "Username dan password wajib diisi."}), 400

    user = db.get_user_by_username(username)
    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"success": False, "error": "Username atau password salah."}), 401

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
def api_put_state():
    data = request.get_json(silent=True) or {}
    balance = data.get("balance")
    transactions = data.get("transactions")

    if not isinstance(balance, (int, float)):
        return jsonify({"success": False, "error": "Saldo tidak valid."}), 400
    if not isinstance(transactions, list):
        return jsonify({"success": False, "error": "Data transaksi tidak valid."}), 400

    user_id = session["user_id"]

    # Full replace: simplest way to keep the frontend's existing
    # "mutate local state, save the whole thing" pattern working.
    db.delete_all_transactions(user_id)
    for tx in transactions:
        tx_type = tx.get("type")
        amount = tx.get("amount")
        category = (tx.get("category") or "").strip()
        notes = tx.get("notes") or ""
        date = tx.get("date")
        created_at = tx.get("createdAt") or 0

        if tx_type not in ("income", "expense"):
            continue
        if not isinstance(amount, (int, float)) or amount <= 0:
            continue
        if not category or not date:
            continue

        db.create_transaction(user_id, tx_type, amount, category, notes, date, created_at)

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

