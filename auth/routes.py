from flask import Blueprint, render_template, request, redirect, session
from auth.auth_utils import verify_user

auth = Blueprint("auth", __name__)

@auth.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        user = verify_user(email, password)
        if user:
            session["user_email"] = email
            return redirect("/chat")

       
    return render_template("login.html")
