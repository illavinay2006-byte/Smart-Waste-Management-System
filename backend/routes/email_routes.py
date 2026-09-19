from flask import Blueprint, request, jsonify, session
from backend.database.db import db
from backend.models.email_log import EmailLog
from backend.models.user import User
from backend.services.email_service import dispatch_email, get_smtp_config, email_template_wrapper

from backend.services.auth_service import get_current_authenticated_user

email_bp = Blueprint("emails", __name__, url_prefix="/api/emails")

def get_current_user():
    return get_current_authenticated_user()

@email_bp.route("", methods=["GET"])
def get_emails():
    """Returns all dispatched emails for transparency, auditing, and live monitoring"""
    logs = EmailLog.query.order_by(EmailLog.created_at.desc()).limit(50).all()
    return jsonify({
        "emails": [l.to_dict() for l in logs],
        "smtp_configured": bool(get_smtp_config()["username"] and get_smtp_config()["password"]),
        "smtp_server": get_smtp_config()["server"]
    }), 200

@email_bp.route("/<int:email_id>", methods=["GET"])
def get_email_detail(email_id):
    log = db.session.get(EmailLog, email_id)
    if not log:
        return jsonify({"error": "Email record not found"}), 404
    return jsonify({"email": log.to_dict()}), 200

@email_bp.route("/send-test", methods=["POST"])
def send_test_email():
    """Allows testing live email delivery to any user's real email address"""
    data = request.get_json() or {}
    target_email = data.get("email", "").strip()
    role = data.get("role", "citizen")

    if not target_email:
        return jsonify({"error": "Target email is required"}), 400

    test_html = f"""
      <p>Hello <strong>{target_email}</strong>,</p>
      <p>This is a live test notification from the <strong>SmartWaste Civic Network</strong>.</p>
      <div class="info-box">
        <div class="info-row"><strong>Target Role:</strong> <span>{role.title()}</span></div>
        <div class="info-row"><strong>Dispatch Mode:</strong> <span>{'Live SMTP' if get_smtp_config()['username'] else 'Civic Sandbox'}</span></div>
        <div class="info-row"><strong>Time:</strong> <span>Just Now</span></div>
      </div>
      <p>Your email system is fully operational and ready to receive real-time citizen reports and municipal worker dispatches!</p>
    """

    success = dispatch_email(
        recipient_email=target_email,
        recipient_name=f"{role.title()} User",
        recipient_role=role,
        subject=f"🧪 [TEST EMAIL] SmartWaste Notification System Active",
        body_html=email_template_wrapper("Test Dispatch Successful", "linear-gradient(135deg, #059669, #10b981)", test_html),
        body_text=f"SmartWaste notification test for {target_email} ({role}).",
        report_id=None
    )

    return jsonify({"message": f"Test email dispatched to {target_email}", "success": success}), 200

@email_bp.route("/update-role-emails", methods=["POST"])
def update_role_emails():
    """Allows updating real email addresses for Citizen, Municipal Officer, and Field Worker"""
    data = request.get_json() or {}
    citizen_email = data.get("citizen_email", "").strip()
    officer_email = data.get("officer_email", "").strip()
    worker_email = data.get("worker_email", "").strip()

    updated = {}

    if citizen_email:
        cit = User.query.filter_by(role="citizen").first()
        if cit:
            cit.email = citizen_email
            updated["citizen"] = citizen_email

    if officer_email:
        off = User.query.filter_by(role="officer").first()
        if off:
            off.email = officer_email
            updated["officer"] = officer_email

    if worker_email:
        wrk = User.query.filter_by(role="worker").first()
        if wrk:
            wrk.email = worker_email
            updated["worker"] = worker_email

    db.session.commit()
    return jsonify({"message": "Role emails successfully updated", "updated": updated}), 200


@email_bp.route("/smtp-config", methods=["GET", "POST"])
def manage_smtp_config():
    from backend.services.email_service import get_smtp_config, save_smtp_config
    if request.method == "POST":
        data = request.get_json() or {}
        saved = save_smtp_config(data)
        safe_copy = dict(saved)
        if safe_copy.get("password"):
            safe_copy["password"] = "••••••••"
        return jsonify({"message": "Live SMTP configuration saved successfully", "config": safe_copy}), 200

    cfg = get_smtp_config()
    safe_copy = dict(cfg)
    if safe_copy.get("password"):
        safe_copy["password"] = "••••••••"
    return jsonify({"config": safe_copy, "configured": bool(cfg.get("username") and cfg.get("password"))}), 200

