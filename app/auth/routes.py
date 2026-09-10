from flask import Blueprint, jsonify, redirect, request, url_for

from app.auth.jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
    jwt_required,
)
from app.auth.oauth import oauth
from app.models import User, db
from app.security.validators import validate_email_address, validate_password

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")

    valid, result = validate_email_address(email)
    if not valid:
        return jsonify({"error": result}), 400

    valid_pw, pw_error = validate_password(password)
    if not valid_pw:
        return jsonify({"error": pw_error}), 400

    if User.query.filter_by(email=result).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(email=result, role="user")
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify(
        {
            "message": "Registration successful",
            "user": user.to_dict(),
            "access_token": create_access_token(user.id, user.role),
            "refresh_token": create_refresh_token(user.id),
        }
    ), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")

    valid, result = validate_email_address(email)
    if not valid:
        return jsonify({"error": "Invalid email or password"}), 401

    user = User.query.filter_by(email=result).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.is_active:
        return jsonify({"error": "Account is disabled"}), 403

    return jsonify(
        {
            "message": "Login successful",
            "user": user.to_dict(),
            "access_token": create_access_token(user.id, user.role),
            "refresh_token": create_refresh_token(user.id),
        }
    )


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    data = request.get_json(silent=True) or {}
    refresh_token = data.get("refresh_token", "")
    payload = decode_token(refresh_token)

    if not payload or payload.get("type") != "refresh":
        return jsonify({"error": "Invalid refresh token"}), 401

    user = db.session.get(User, payload["sub"])
    if not user or not user.is_active:
        return jsonify({"error": "User not found"}), 401

    return jsonify(
        {
            "access_token": create_access_token(user.id, user.role),
            "refresh_token": create_refresh_token(user.id),
        }
    )


@auth_bp.route("/me", methods=["GET"])
@jwt_required
def me(current_user):
    return jsonify({"user": current_user.to_dict()})


@auth_bp.route("/oauth/google")
def google_login():
    if "google" not in oauth._clients:
        return jsonify({"error": "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"}), 503
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route("/oauth/google/callback")
def google_callback():
    if "google" not in oauth._clients:
        return redirect("/?error=oauth_not_configured")

    token = oauth.google.authorize_access_token()
    user_info = token.get("userinfo")
    if not user_info:
        return redirect("/?error=oauth_failed")

    email = user_info["email"].lower()
    oauth_id = user_info["sub"]

    user = User.query.filter_by(oauth_provider="google", oauth_id=oauth_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.oauth_provider = "google"
            user.oauth_id = oauth_id
        else:
            user = User(email=email, oauth_provider="google", oauth_id=oauth_id, role="user")
            db.session.add(user)
        db.session.commit()

    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id)
    return redirect(f"/?access_token={access}&refresh_token={refresh}")
