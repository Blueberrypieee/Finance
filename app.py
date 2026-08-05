from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/register")
def register():
    return render_template("register.html")


@app.route("/menu")
def menu():
    return render_template("menu.html")


@app.route("/statistics")
def statistics():
    return render_template("statistics.html")


if __name__ == "__main__":
    # host 0.0.0.0 supaya bisa diakses dari browser HP yang sama di Termux
    app.run(host="0.0.0.0", port=5000, debug=True)

