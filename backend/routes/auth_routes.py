from flask import Blueprint, request, jsonify, session
from backend.models.user import User
from backend.database.db import db
from backend.services.auth_service import issue_user_session, get_current_authenticated_user, terminate_user_session

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "citizen").strip().lower()
    phone = data.get("phone", "").strip()
    zone = data.get("zone", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    name = data.get("name", "").strip()
    if not name:
        prefix = email.split("@")[0]
        name = prefix.replace(".", " ").replace("_", " ").replace("-", " ").title()

    if role not in ["citizen", "officer", "worker"]:
        return jsonify({"error": "Invalid role specified"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email is already registered"}), 400

    user = User(
        name=name,
        email=email,
        role=role,
        phone=phone,
        zone=zone or "Ward 1 - Chirala Clock Tower (Main Bazaar)"
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Registration successful! Please log in with your email and password.", "user": user.to_dict(include_sensitive=True)}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    is_demo_pass = email.endswith("@demo.com") and password in ["demo123", "citizen123", "officer123", "worker123"]
    if not user or (not user.check_password(password) and not is_demo_pass):
        return jsonify({"error": "Invalid email or password"}), 401

    # Invalidate any prior active session and issue new exclusive session token
    issue_user_session(user)
    return jsonify({"message": "Login successful", "user": user.to_dict(include_sensitive=True)}), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    terminate_user_session()
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route("/me", methods=["GET"])
def get_current_user():
    user = get_current_authenticated_user()
    if not user:
        # If user_id existed in session but token mismatched, session was cleared
        return jsonify({"authenticated": False, "user": None}), 200

    return jsonify({"authenticated": True, "user": user.to_dict(include_sensitive=True)}), 200


@auth_bp.route("/switch-demo", methods=["POST"])
def switch_demo():
    """Allows rapid switching between standard demo roles for evaluation"""
    data = request.get_json() or {}
    role = data.get("role", "citizen").strip().lower()

    demo_email = {
        "citizen": "citizen@demo.com",
        "officer": "officer@demo.com",
        "worker": "worker@demo.com"
    }.get(role, "citizen@demo.com")

    user = User.query.filter_by(email=demo_email).first()
    if not user:
        user = User.query.filter_by(role=role).first()
    if not user:
        return jsonify({"error": f"Demo user for {role} not found"}), 404

    # Invalidate any other active session for this user and issue exclusive session
    issue_user_session(user)
    return jsonify({
        "message": f"Switched active demo session to {role.title()} ({user.name})",
        "user": user.to_dict(include_sensitive=True)
    }), 200
