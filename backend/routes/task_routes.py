import time
from pathlib import Path
from flask import Blueprint, request, jsonify, session, current_app
from werkzeug.utils import secure_filename

from backend.database.db import db
from backend.models.user import User
from backend.models.report import WasteReport, ReportImage
from backend.models.task import Task
from backend.models.audit_log import AuditLog
from backend.models.notification import Notification
from backend.services.state_machine import transition_report, StateMachineError
from backend.services.duplicate_detector import haversine_distance

from backend.services.auth_service import get_current_authenticated_user

task_bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")

def get_current_user():
    return get_current_authenticated_user()

@task_bp.route("", methods=["GET"])
def get_tasks():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    if user.role == "worker":
        tasks = Task.query.filter_by(worker_id=user.id).order_by(Task.assigned_at.desc()).all()
    else:
        tasks = Task.query.order_by(Task.assigned_at.desc()).all()

    results = []
    for t in tasks:
        td = t.to_dict()
        td["report"] = t.report.to_dict() if t.report else None
        results.append(td)

    return jsonify({"tasks": results}), 200


@task_bp.route("/recommended-workers/<string:report_id>", methods=["GET"])
def get_recommended_workers(report_id):
    user = get_current_user()
    if not user or user.role != "officer":
        return jsonify({"error": "Municipal officer role required"}), 403

    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404

    workers = User.query.filter_by(role="worker").all()
    recommendations = []

    for w in workers:
        active_count = Task.query.filter(
            Task.worker_id == w.id,
            Task.status.in_(["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "RE_CLEANING_REQUIRED"])
        ).count()

        # Calculate actual geographic distance from complaint to worker using Haversine formula
        has_coords = (
            report.latitude is not None and report.longitude is not None and
            w.latitude is not None and w.longitude is not None
        )

        if has_coords:
            dist_meters = haversine_distance(report.latitude, report.longitude, w.latitude, w.longitude)
            dist_km = round(dist_meters / 1000.0, 1)
        else:
            dist_km = None

        is_same_zone = False
        if w.zone:
            w_zone_clean = w.zone.lower()
            if report.location_name and w_zone_clean in report.location_name.lower():
                is_same_zone = True
            elif report.ward and w_zone_clean in report.ward.lower():
                is_same_zone = True
        
        status_label = "Available" if active_count == 0 else ("Busy" if active_count >= 3 else "Active")
        
        reasons = []
        if active_count == 0:
            reasons.append("Currently available (0 active tasks)")
        else:
            reasons.append(f"{active_count} active task(s)")
        
        if is_same_zone:
            reasons.append("Assigned to matching municipal zone")

        if dist_km is not None:
            reasons.append(f"Approx. {dist_km} km from task location")
        else:
            reasons.append("Location unavailable")

        score = 100 - (active_count * 25)
        if is_same_zone:
            score += 20

        if dist_km is not None:
            score -= int(dist_km * 5)
        else:
            score -= 15

        recommendations.append({
            "worker_id": w.id,
            "name": w.name,
            "email": w.email,
            "phone": w.phone,
            "zone": w.zone,
            "latitude": w.latitude,
            "longitude": w.longitude,
            "active_tasks": active_count,
            "status": status_label,
            "distance_km": dist_km,
            "recommendation_score": max(score, 10),
            "reason": " • ".join(reasons)
        })

    recommendations.sort(key=lambda x: x["recommendation_score"], reverse=True)
    return jsonify({"report_id": report.id, "recommended_workers": recommendations}), 200


@task_bp.route("/assign", methods=["POST"])
def assign_worker():
    user = get_current_user()
    if not user or user.role != "officer":
        return jsonify({"error": "Municipal officer role required"}), 403

    data = request.get_json() or {}
    report_id = data.get("report_id")
    worker_id = data.get("worker_id")

    if not report_id or not worker_id:
        return jsonify({"error": "report_id and worker_id are required"}), 400

    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404

    worker = db.session.get(User, worker_id)
    if not worker or worker.role != "worker":
        return jsonify({"error": "Selected user is not a valid field worker"}), 400

    # If report was SUBMITTED, advance to UNDER_REVIEW first
    if report.status == "SUBMITTED":
        transition_report(report, "UNDER_REVIEW", user, "Auto-advanced to Under Review upon assignment")

    # Create or update Task
    task = Task.query.filter_by(report_id=report.id).first()
    if not task:
        task = Task(
            report_id=report.id,
            worker_id=worker.id,
            assigned_by=user.id,
            status="ASSIGNED"
        )
        db.session.add(task)
    else:
        task.worker_id = worker.id
        task.assigned_by = user.id
        task.status = "ASSIGNED"

    # Transition report to ASSIGNED
    try:
        transition_report(report, "ASSIGNED", user, f"Task assigned to worker {worker.name}")
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400

    # Worker notification
    db.session.add(Notification(
        user_id=worker.id,
        report_id=report.id,
        title="New Task Assigned",
        message=f"You have been assigned to clean #{report.id} ({report.priority} Priority - {report.category}) at {report.location_name}.",
        type="warning" if report.priority in ["HIGH", "CRITICAL"] else "info"
    ))

    # Audit log
    db.session.add(AuditLog(
        user_id=user.id,
        action="WORKER_ASSIGNED",
        entity_type="task",
        entity_id=report.id,
        details=f"Assigned to {worker.name} (ID: {worker.id})"
    ))

    # Dispatch email notification to Field Worker and Citizen
    from backend.services.email_service import send_task_assigned_emails
    try:
        send_task_assigned_emails(report, worker, user)
    except Exception as em_err:
        print(f">> [EMAIL ASSIGN DISPATCH ERROR] {em_err}")

    db.session.commit()
    return jsonify({"message": f"Worker {worker.name} assigned successfully", "task": task.to_dict()}), 200


@task_bp.route("/worker/location", methods=["POST", "PUT"])
def update_worker_location():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    data = request.get_json() or {}
    worker_id = data.get("worker_id") or (user.id if user.role == "worker" else None)
    if not worker_id:
        return jsonify({"error": "worker_id is required"}), 400

    if user.role == "worker" and user.id != worker_id:
        return jsonify({"error": "Unauthorized"}), 403
    elif user.role not in ["worker", "officer"]:
        return jsonify({"error": "Unauthorized"}), 403

    worker = db.session.get(User, worker_id)
    if not worker or worker.role != "worker":
        return jsonify({"error": "Worker not found"}), 404

    try:
        lat = float(data.get("latitude"))
        lng = float(data.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({"error": "Valid latitude and longitude are required"}), 400

    worker.latitude = lat
    worker.longitude = lng
    db.session.commit()

    return jsonify({
        "message": f"Updated location for {worker.name}",
        "worker": worker.to_dict()
    }), 200


@task_bp.route("/<int:task_id>/accept", methods=["PUT"])
def accept_task(task_id):
    user = get_current_user()
    if not user or user.role != "worker":
        return jsonify({"error": "Field worker role required"}), 403

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if task.worker_id != user.id:
        return jsonify({"error": "Unauthorized to accept this task"}), 403

    task.status = "ACCEPTED"
    task.accepted_at = db.func.now()

    try:
        transition_report(task.report, "ACCEPTED", user, f"Worker {user.name} accepted task")
        return jsonify({"message": "Task accepted", "task": task.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400


@task_bp.route("/<int:task_id>/start", methods=["PUT"])
def start_cleaning(task_id):
    user = get_current_user()
    if not user or user.role != "worker":
        return jsonify({"error": "Field worker role required"}), 403

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if task.worker_id != user.id:
        return jsonify({"error": "Unauthorized"}), 403

    task.status = "IN_PROGRESS"
    task.started_at = db.func.now()

    try:
        transition_report(task.report, "IN_PROGRESS", user, f"Worker {user.name} started cleaning operations on site")
        return jsonify({"message": "Cleaning started", "task": task.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400


@task_bp.route("/<int:task_id>/proof", methods=["POST"])
def submit_completion_proof(task_id):
    user = get_current_user()
    if not user or user.role != "worker":
        return jsonify({"error": "Field worker role required"}), 403

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if task.worker_id != user.id:
        return jsonify({"error": "Unauthorized"}), 403

    file = request.files.get("image")
    form_data = request.form.to_dict() if request.form else (request.get_json() or {})
    notes = form_data.get("notes", "Cleanup completed successfully.")

    image_path = ""
    if file and file.filename:
        filename = secure_filename(file.filename)
        unique_name = f"after_{int(time.time())}_{filename}"
        upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
        target_path = upload_dir / unique_name
        file.save(target_path)
        image_path = f"/uploads/{unique_name}"
    else:
        # Fallback to demo after-cleaning photo
        image_path = form_data.get("image_url", "/uploads/sample_cleaned_after.jpg")

    # Add after image record
    img_record = ReportImage(
        report_id=task.report_id,
        image_type="after" if task.report.status != "RE_CLEANING_REQUIRED" else "recleaning_after",
        file_path=image_path,
        uploaded_by=user.id
    )
    db.session.add(img_record)

    task.status = "AWAITING_VERIFICATION"
    task.submitted_proof_at = db.func.now()
    task.worker_notes = notes

    try:
        transition_report(task.report, "AWAITING_VERIFICATION", user, f"Worker {user.name} submitted cleanup proof: {notes}")
        return jsonify({"message": "Completion proof submitted for municipal verification", "task": task.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400


@task_bp.route("/<int:task_id>/verify", methods=["POST"])
def verify_completion(task_id):
    user = get_current_user()
    if not user or user.role != "officer":
        return jsonify({"error": "Municipal officer role required"}), 403

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.get_json() or {}
    notes = data.get("notes", "Cleanup inspected and approved.")

    try:
        transition_report(task.report, "COMPLETED", user, f"Officer verified and approved completion: {notes}")
        
        # Audit log
        db.session.add(AuditLog(
            user_id=user.id,
            action="VERIFICATION_APPROVED",
            entity_type="task",
            entity_id=task.report_id,
            details=f"Approved completion for {task.report_id}. Notes: {notes}"
        ))
        db.session.commit()

        return jsonify({"message": "Complaint verified and marked COMPLETED!", "task": task.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400


@task_bp.route("/<int:task_id>/reclean", methods=["POST"])
def request_recleaning(task_id):
    user = get_current_user()
    if not user or user.role != "officer":
        return jsonify({"error": "Municipal officer role required"}), 403

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.get_json() or {}
    reason = data.get("reason", "").strip()
    if not reason:
        return jsonify({"error": "Reason for re-cleaning is required"}), 400

    task.status = "RE_CLEANING_REQUIRED"
    task.recleaning_notes = reason

    try:
        transition_report(task.report, "RE_CLEANING_REQUIRED", user, f"Officer requested re-cleaning: {reason}")

        # Audit log
        db.session.add(AuditLog(
            user_id=user.id,
            action="RE_CLEANING_REQUESTED",
            entity_type="task",
            entity_id=task.report_id,
            details=f"Re-cleaning requested: {reason}"
        ))
        db.session.commit()

        return jsonify({"message": "Re-cleaning requested from worker", "task": task.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400
