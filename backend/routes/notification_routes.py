from flask import Blueprint, jsonify, request, session
from backend.database.db import db
from backend.models.notification import Notification
from backend.models.user import User

from backend.services.auth_service import get_current_authenticated_user

notification_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")

def get_current_user():
    return get_current_authenticated_user()

@notification_bp.route("", methods=["GET"])
def get_notifications():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    notifications = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(50).all()
    unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()

    return jsonify({
        "unread_count": unread_count,
        "notifications": [n.to_dict() for n in notifications]
    }), 200

@notification_bp.route("/<int:notif_id>/read", methods=["PUT", "POST"])
def mark_read(notif_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    notif = db.session.get(Notification, notif_id)
    if not notif or notif.user_id != user.id:
        return jsonify({"error": "Notification not found"}), 404

    notif.is_read = True
    db.session.commit()
    return jsonify({"message": "Marked as read", "notification": notif.to_dict()}), 200

@notification_bp.route("/read-all", methods=["PUT", "POST"])
@notification_bp.route("/mark-all-read", methods=["PUT", "POST"])
def mark_all_read():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "All notifications marked as read"}), 200
