from flask import Blueprint, jsonify, request
from backend.database.db import db
from backend.models.user import User
from backend.models.report import WasteReport, Feedback
from backend.services.auth_service import get_current_authenticated_user

citizen_bp = Blueprint("citizen", __name__, url_prefix="/api/citizen")

@citizen_bp.route("/stats", methods=["GET"])
def get_citizen_stats():
    user = get_current_authenticated_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    reports_query = WasteReport.query.filter_by(citizen_id=user.id)
    total_reports = reports_query.count()
    
    active_statuses = ["SUBMITTED", "UNDER_REVIEW", "INFORMATION_REQUESTED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "AWAITING_VERIFICATION", "RE_CLEANING_REQUIRED"]
    active_reports = reports_query.filter(WasteReport.status.in_(active_statuses)).count()
    resolved_reports = reports_query.filter_by(status="COMPLETED").count()
    pending_reports = reports_query.filter(WasteReport.status.in_(["SUBMITTED", "UNDER_REVIEW", "INFORMATION_REQUESTED"])).count()
    emergency_reports = reports_query.filter_by(is_emergency=True).count()
    
    feedbacks_count = Feedback.query.filter_by(citizen_id=user.id).count()
    cleanliness_score = (user.points or 0) + (resolved_reports * 20)

    points = user.points or 0
    next_tier = "Green Guardian"
    points_needed = max(0, 100 - points)
    progress_pct = min(100, int((points / 100) * 100))
    if points >= 500:
        next_tier = "Max Level Reached"
        points_needed = 0
        progress_pct = 100
    elif points >= 250:
        next_tier = "Sustainability Legend"
        points_needed = max(0, 500 - points)
        progress_pct = min(100, int(((points - 250) / 250) * 100))
    elif points >= 100:
        next_tier = "Civic Champion"
        points_needed = max(0, 250 - points)
        progress_pct = min(100, int(((points - 100) / 150) * 100))

    return jsonify({
        "stats": {
            "total_reports": total_reports,
            "active_reports": active_reports,
            "resolved_reports": resolved_reports,
            "pending_reports": pending_reports,
            "emergency_reports": emergency_reports,
            "feedback_count": feedbacks_count,
            "cleanliness_score": cleanliness_score,
            "points": points,
            "rank_tier": user.rank_tier or "Eco Scout",
            "badges": user.get_badges_list(),
            "next_tier": next_tier,
            "points_needed": points_needed,
            "tier_progress_pct": progress_pct
        }
    }), 200

@citizen_bp.route("/leaderboard", methods=["GET"])
def get_leaderboard():
    top_users = User.query.filter_by(role="citizen").order_by(User.points.desc(), User.id.asc()).limit(10).all()
    
    leaderboard = []
    for rank, u in enumerate(top_users, 1):
        resolved_count = WasteReport.query.filter_by(citizen_id=u.id, status="COMPLETED").count()
        leaderboard.append({
            "rank": rank,
            "user_id": u.id,
            "name": u.name,
            "points": u.points or 0,
            "rank_tier": u.rank_tier or "Eco Scout",
            "badges_count": len(u.get_badges_list()),
            "badges": u.get_badges_list(),
            "resolved_reports": resolved_count
        })

    return jsonify({"leaderboard": leaderboard}), 200
