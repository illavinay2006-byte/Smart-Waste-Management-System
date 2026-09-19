from flask import Blueprint, jsonify, request
from backend.database.db import db
from backend.models.report import WasteReport, Feedback, ReportImage
from backend.models.task import Task
from backend.models.user import User
from backend.models.collection_point import CollectionPoint

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")

@analytics_bp.route("", methods=["GET"])
@analytics_bp.route("/", methods=["GET"])
@analytics_bp.route("/overview", methods=["GET"])
def get_overview():
    total_reports = WasteReport.query.count()
    submitted = WasteReport.query.filter_by(status="SUBMITTED").count()
    under_review = WasteReport.query.filter_by(status="UNDER_REVIEW").query.count() if hasattr(WasteReport.query.filter_by(status="UNDER_REVIEW"), 'query') else WasteReport.query.filter_by(status="UNDER_REVIEW").count()
    assigned = WasteReport.query.filter_by(status="ASSIGNED").count()
    in_progress = WasteReport.query.filter(WasteReport.status.in_(["ACCEPTED", "IN_PROGRESS"])).count()
    awaiting_verif = WasteReport.query.filter_by(status="AWAITING_VERIFICATION").count()
    completed = WasteReport.query.filter_by(status="COMPLETED").count()
    rejected = WasteReport.query.filter_by(status="REJECTED").count()
    recleaning = WasteReport.query.filter_by(status="RE_CLEANING_REQUIRED").count()

    total_workers = User.query.filter_by(role="worker").count()
    busy_workers = db.session.query(Task.worker_id).filter(
        Task.status.in_(["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "RE_CLEANING_REQUIRED"])
    ).distinct().count()
    available_workers = max(total_workers - busy_workers, 0)

    total_points = CollectionPoint.query.count()
    overflowing_points = CollectionPoint.query.filter_by(status="OVERFLOWING").count()
    emergency_reports = WasteReport.query.filter_by(is_emergency=True).count()

    avg_rating_result = db.session.query(db.func.avg(Feedback.rating)).scalar()
    avg_rating = round(float(avg_rating_result), 1) if avg_rating_result else 4.8

    categories = ["Organic / Wet Waste", "Plastic", "Paper", "Glass", "Metal", "E-Waste", "Hazardous Waste", "Mixed Waste", "Other"]
    category_counts = {}
    for cat in categories:
        count = WasteReport.query.filter(WasteReport.category.like(f"%{cat.split('/')[0].strip()}%")).count()
        category_counts[cat] = count

    priority_counts = {
        "CRITICAL": WasteReport.query.filter_by(priority="CRITICAL").count(),
        "HIGH": WasteReport.query.filter_by(priority="HIGH").count(),
        "MEDIUM": WasteReport.query.filter_by(priority="MEDIUM").count(),
        "LOW": WasteReport.query.filter_by(priority="LOW").count(),
    }

    status_counts = {
        "SUBMITTED": submitted,
        "UNDER_REVIEW": under_review,
        "ASSIGNED": assigned,
        "IN_PROGRESS": in_progress,
        "AWAITING_VERIFICATION": awaiting_verif,
        "RE_CLEANING_REQUIRED": recleaning,
        "COMPLETED": completed,
        "REJECTED": rejected
    }

    return jsonify({
        "metrics": {
            "total_reports": total_reports,
            "open_reports": total_reports - completed - rejected,
            "in_progress": in_progress,
            "awaiting_verification": awaiting_verif,
            "completed": completed,
            "rejected": rejected,
            "emergency_reports": emergency_reports,
            "available_workers": available_workers,
            "total_workers": total_workers,
            "overflowing_points": overflowing_points,
            "avg_rating": avg_rating
        },
        "by_category": category_counts,
        "by_priority": priority_counts,
        "by_status": status_counts
    }), 200

@analytics_bp.route("/heatmap", methods=["GET"])
def get_heatmap_data():
    severity_filter = request.args.get("severity")
    ward_filter = request.args.get("ward")

    query = WasteReport.query
    if severity_filter:
        query = query.filter(WasteReport.severity == severity_filter)
    if ward_filter:
        query = query.filter(WasteReport.ward == ward_filter)

    reports = query.all()
    
    points = []
    for r in reports:
        if r.latitude and r.longitude:
            weight = 1.0
            if r.severity == "Critical" or r.is_emergency:
                weight = 2.5
            elif r.severity == "High":
                weight = 1.8
            elif r.severity == "Medium":
                weight = 1.2
            
            points.append({
                "id": r.id,
                "lat": r.latitude,
                "lng": r.longitude,
                "weight": weight,
                "category": r.category,
                "severity": r.severity,
                "priority": r.priority,
                "status": r.status,
                "ward": r.ward or "Ward 5 - Central",
                "is_emergency": bool(r.is_emergency),
                "location_name": r.location_name
            })

    # Ward wise summary
    wards = ["Ward 5 - Central", "Ward 3 - East", "Ward 7 - West", "Ward 11 - North", "Ward 2 - South"]
    ward_stats = []
    for w in wards:
        ct = WasteReport.query.filter(WasteReport.ward == w).count()
        crit = WasteReport.query.filter(WasteReport.ward == w, WasteReport.priority == "CRITICAL").count()
        compl = WasteReport.query.filter(WasteReport.ward == w, WasteReport.status == "COMPLETED").count()
        ward_stats.append({
            "ward": w,
            "total": ct,
            "critical": crit,
            "completed": compl,
            "pending": max(ct - compl, 0)
        })

    return jsonify({
        "heatmap_points": points,
        "ward_stats": ward_stats
    }), 200

@analytics_bp.route("/workers-workload", methods=["GET"])
def get_workers_workload():
    workers = User.query.filter_by(role="worker").all()
    workload_list = []
    for w in workers:
        active_tasks = Task.query.filter(
            Task.worker_id == w.id,
            Task.status.in_(["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "RE_CLEANING_REQUIRED"])
        ).count()
        completed_tasks = Task.query.filter(
            Task.worker_id == w.id,
            Task.status == "COMPLETED"
        ).count()
        total_assigned = Task.query.filter(Task.worker_id == w.id).count()
        
        max_capacity = 5
        capacity_pct = min(100, int((active_tasks / max_capacity) * 100))
        load_status = "Low"
        if active_tasks >= 5:
            load_status = "Full"
        elif active_tasks >= 3:
            load_status = "High"
        elif active_tasks >= 1:
            load_status = "Medium"

        workload_list.append({
            "worker_id": w.id,
            "name": w.name,
            "email": w.email,
            "phone": w.phone,
            "zone": w.zone or "Ward 1 - Chirala Clock Tower",
            "latitude": w.latitude,
            "longitude": w.longitude,
            "active_tasks": active_tasks,
            "completed_tasks": completed_tasks,
            "total_assigned": total_assigned,
            "capacity_pct": capacity_pct,
            "load_status": load_status
        })

    return jsonify({"workers": workload_list}), 200
