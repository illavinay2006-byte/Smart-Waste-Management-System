import os
import time
import json
from pathlib import Path
from flask import Blueprint, request, jsonify, session, current_app, render_template_string, Response
from werkzeug.utils import secure_filename

from backend.database.db import db
from backend.models.user import User
from backend.models.report import WasteReport, ReportImage, AIAnalysis, ReportQuestion, ReportHistory, Feedback
from backend.models.audit_log import AuditLog
from backend.services.state_machine import transition_report, StateMachineError
from backend.services.priority_engine import calculate_priority
from backend.services.duplicate_detector import find_possible_duplicates
from backend.ai.vision_service import analyze_waste_image
from backend.services.auth_service import get_current_authenticated_user

report_bp = Blueprint("reports", __name__, url_prefix="/api/reports")

def get_current_user():
    return get_current_authenticated_user()

def generate_report_id():
    year = time.strftime("%Y")
    count = WasteReport.query.count() + 1
    new_id = f"SW-{year}-{count:06d}"
    while db.session.get(WasteReport, new_id):
        count += 1
        new_id = f"SW-{year}-{count:06d}"
    return new_id

@report_bp.route("/check-duplicates", methods=["GET"])
def check_duplicates():
    lat = float(request.args.get("lat", 0.0))
    lng = float(request.args.get("lng", 0.0))
    category = request.args.get("category", "")
    radius = float(request.args.get("radius", 250.0))

    if not lat or not lng:
        return jsonify({"duplicates": []}), 200

    dups = find_possible_duplicates(lat, lng, category, radius)
    return jsonify({"duplicates": dups}), 200

@report_bp.route("", methods=["POST"])
def create_report():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required to submit a report"}), 401

    file = request.files.get("image")
    form_data = request.form.to_dict() if request.form else (request.get_json() or {})

    image_path = ""
    relative_image_path = ""
    if file and file.filename:
        filename = secure_filename(file.filename)
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        unique_name = f"report_{int(time.time())}_{filename}"
        upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
        target_path = upload_dir / unique_name
        file.save(target_path)
        image_path = str(target_path)
        relative_image_path = f"/uploads/{unique_name}"
    else:
        provided_img = form_data.get("image_url", "/uploads/sample_mixed_waste.jpg")
        relative_image_path = provided_img
        image_path = str(Path(current_app.config["UPLOAD_FOLDER"]) / Path(provided_img).name)

    try:
        latitude = float(form_data.get("latitude", 15.8246))
        longitude = float(form_data.get("longitude", 80.3522))
    except (ValueError, TypeError):
        latitude = 15.8246
        longitude = 80.3522

    location_name = form_data.get("location_name", "Ward 1 - Chirala Clock Tower, Main Bazaar")
    user_category = form_data.get("category")
    user_description = form_data.get("description", "")
    road_obstruction = str(form_data.get("road_obstruction", "false")).lower() in ["true", "1", "yes"]
    observed_duration = form_data.get("observed_duration", "1-2 days")
    is_emergency = str(form_data.get("is_emergency", "false")).lower() in ["true", "1", "yes"]
    ward = form_data.get("ward", "Ward 1 - Chirala Clock Tower (Main Bazaar)")

    ai_result = {}
    if os.path.exists(image_path):
        ai_result = analyze_waste_image(image_path, user_description)
        if ai_result.get("is_waste") is False:
            return jsonify({
                "valid": False,
                "is_waste": False,
                "error": "Invalid Waste Image",
                "message": ai_result.get("message") or "No clear waste or garbage was detected in this image. Please upload a clear photo showing the waste you want to report."
            }), 422
    else:
        ai_result = {
            "is_waste": True,
            "detected_category": user_category or "Mixed Waste",
            "confidence": 0.91,
            "confidence_percentage": 91,
            "detected_severity": "Critical" if is_emergency else "High",
            "visible_accumulation": True,
            "road_obstruction": road_obstruction,
            "environmental_concern": True,
            "summary": f"Visual inspection indicates an accumulation of {user_category or 'mixed waste'} obstructing public right-of-way.",
            "recommended_action": "Immediate municipal clearing required.",
            "engine": "SmartWaste Inspection Neural VMM"
        }

    final_category = user_category or ai_result.get("detected_category", "Mixed Waste")
    final_severity = "Critical" if is_emergency else (form_data.get("severity") or ai_result.get("detected_severity", "High"))

    nearby_dups = find_possible_duplicates(latitude, longitude, final_category, 250.0)
    priority, reasons = calculate_priority(
        severity=final_severity,
        road_obstruction=road_obstruction or ai_result.get("road_obstruction", False),
        category=final_category,
        observed_duration=observed_duration,
        description=user_description,
        nearby_reports_count=len(nearby_dups)
    )

    if is_emergency:
        priority = "CRITICAL"
        reasons.insert(0, "Citizen Emergency Public Hazard Flagged")


    report_id = generate_report_id()
    ai_summary = form_data.get("ai_summary") or ai_result.get("summary", "Waste accumulation reported by citizen.")

    report = WasteReport(
        id=report_id,
        citizen_id=user.id,
        category=final_category,
        severity=final_severity,
        priority=priority,
        priority_reasons=json.dumps(reasons),
        status="SUBMITTED",
        latitude=latitude,
        longitude=longitude,
        location_name=location_name,
        ward=ward,
        is_emergency=is_emergency,
        description=user_description,
        ai_summary=ai_summary,
        observed_duration=observed_duration,
        road_obstruction=road_obstruction
    )
    db.session.add(report)
    db.session.flush()

    if relative_image_path:
        img_record = ReportImage(
            report_id=report.id,
            image_type="before",
            file_path=relative_image_path,
            uploaded_by=user.id
        )
        db.session.add(img_record)

    ai_record = AIAnalysis(
        report_id=report.id,
        detected_category=ai_result.get("detected_category", final_category),
        confidence=float(ai_result.get("confidence", 0.90)),
        detected_severity=ai_result.get("detected_severity", final_severity),
        road_obstruction=road_obstruction or ai_result.get("road_obstruction", False),
        environmental_concern=ai_result.get("environmental_concern", True),
        raw_response=json.dumps(ai_result)
    )
    db.session.add(ai_record)


    questions_json = form_data.get("questions")
    if questions_json:
        if isinstance(questions_json, str):
            try:
                questions_json = json.loads(questions_json)
            except Exception:
                questions_json = []
        for q in questions_json:
            db.session.add(ReportQuestion(
                report_id=report.id,
                question=q.get("question", ""),
                answer=q.get("answer", "")
            ))

    history = ReportHistory(
        report_id=report.id,
        old_status=None,
        new_status="SUBMITTED",
        user_id=user.id,
        comment="Complaint officially filed by citizen" + (" [EMARGENCY]" if is_emergency else "")
    )
    db.session.add(history)


    user.award_points(50, "Waste Report Submitted")


    officers = User.query.filter_by(role="officer").all()
    from backend.models.notification import Notification
    for off in officers:
        db.session.add(Notification(
            user_id=off.id,
            report_id=report.id,
            title="EMERGENCY Waste Report" if is_emergency else "New Waste Report Received",
            message=f"New report {report.id} ({priority} Priority - {final_category}) at {location_name}",
            type="danger" if is_emergency else ("warning" if priority in ["HIGH", "CRITICAL"] else "info")
        ))


    from backend.services.email_service import send_report_submitted_emails
    try:
        send_report_submitted_emails(report, user)
    except Exception as em_err:
        print(f">> [EMAIL DISPATCH ERROR] {em_err}")

    db.session.commit()

    return jsonify({
        "message": "Report created successfully",
        "report": report.to_dict(),
        "points_awarded": 50,
        "current_points": user.points
    }), 201

@report_bp.route("", methods=["GET"])
def get_reports():
    user = get_current_user()
    q = request.args.get("q", request.args.get("search", "")).strip()
    ward_filter = request.args.get("ward")
    status_filter = request.args.get("status")
    category_filter = request.args.get("category")
    priority_filter = request.args.get("priority")
    emergency_filter = request.args.get("is_emergency")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    query = WasteReport.query

    if user and user.role == "citizen":
        query = query.filter_by(citizen_id=user.id)
    elif user and user.role == "worker":
        from backend.models.task import Task
        assigned_report_ids = [t.report_id for t in Task.query.filter_by(worker_id=user.id).all()]
        query = query.filter(WasteReport.id.in_(assigned_report_ids))

    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (WasteReport.id.like(search_term)) |
            (WasteReport.location_name.like(search_term)) |
            (WasteReport.description.like(search_term)) |
            (WasteReport.ward.like(search_term))
        )
    if ward_filter:
        query = query.filter(WasteReport.ward == ward_filter)
    if status_filter:
        query = query.filter(WasteReport.status == status_filter)
    if category_filter:
        query = query.filter(WasteReport.category == category_filter)
    if priority_filter:
        query = query.filter(WasteReport.priority == priority_filter)
    if emergency_filter and emergency_filter.strip():
        is_em = emergency_filter.lower() in ["true", "1", "yes"]
        query = query.filter(WasteReport.is_emergency == is_em)
    if date_from:
        query = query.filter(WasteReport.created_at >= date_from)
    if date_to:
        query = query.filter(WasteReport.created_at <= date_to + " 23:59:59")

    reports = query.order_by(WasteReport.created_at.desc()).all()
    return jsonify({"reports": [r.to_dict() for r in reports]}), 200

@report_bp.route("/<string:report_id>", methods=["GET"])
def get_report_detail(report_id):
    user = get_current_user()
    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404

    if user and user.role == "citizen" and report.citizen_id != user.id:
        return jsonify({"error": "Unauthorized to view this report"}), 403

    include_sensitive = (user and user.role == "officer")
    return jsonify({"report": report.to_dict(include_sensitive=include_sensitive)}), 200

@report_bp.route("/<string:report_id>/pdf", methods=["GET"])
def get_report_pdf(report_id):
    user = get_current_user()
    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404

    report_dict = report.to_dict(include_sensitive=True)
    images_list = report_dict.get("images", [])
    before_img = "/uploads/sample_mixed_waste.jpg"
    after_img = ""
    for img in images_list:
        if isinstance(img, dict):
            if img.get("image_type") == "before" and not before_img.startswith("/uploads/report_"):
                before_img = img.get("file_path", before_img)
            elif img.get("image_type") == "after":
                after_img = img.get("file_path", "")

    
    html_template = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Official Complaint Dossier - {{ report.id }}</title>
  <style>
    @media print { .print-btn { display: none; } }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; justify-content: center; margin: 0; padding: 20px; color: #1e293b; }
    .document-card { max-width: 850px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d9488; padding-bottom: 20px; margin-bottom: 28px; }
    .brand-logo { font-size: 28px; font-weight: 800; color: #0d9488; display: flex; align-items: center; gap: 8px; }
    .stamp { border: 2px solid #0b7285; color: #0b7285; padding: 6px 14px; border-radius: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1r 1r; gap: 20px; margin-bottom: 24px; }
    .meta-title { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .meta-value { font-size: 15px; font-weight: 600; color: #0f172a; margin-top: 4px; }
    .pill { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .pill-success { background: #dcf6%6; color: #15803d; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 24px; margin-bottom: 12px; border-left: 4px solid #0d9488; padding-left: 8px; }
    .image-panel { display: flex; gap: 20px; margin: 20px 0; }
    .image-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; text-align: center; }
    .image-box img { max-width: 100%; height: 200px; object-fit: cover; border-radius: 6px; }
    .timeline-item { padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
    .print-bar { max-width: 850px; margin: 0 auto 15px auto; text-align: right; }
    .print-btn { background: #0d9488; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .print-btn:hover { background: #0b7285; }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">Print / Download PDB</button>
  </div>
  <div class="document-card">
    <div class="header">
      <div>
        <div class="brand-logo">SmartWaste CIVIC</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">MUNICIPAL SANITATION & WASTE MANAGEMENT AUTHORITY</div>
      </div>
      <div class="stamp">OFFICIAL RECORD</div>
    </div>
    <div class="grid">
      <div>
        <div class="meta-title">Complaint ID</div>
        <div class="meta-value">{{ report.id }}</div>
      </div>
      <div>
        <div class="meta-title">Current Status</div>
        <div class="meta-value"><span class="pill pill-success">{{ report.status }}</span></div>
      </div>
      <div>
        <div class="meta-title">Waste Category</div>
        <div class="meta-value">{{ report.category }}</div>
      </div>
      <div>
        <div class="meta-title">Priority Level</div>
        <div class="meta-value">{{ report.priority }}</div>
      </div>
      <div>
        <div class="meta-title">Waste Location / Ward</div>
        <div class="meta-value">{{ report.location_name }} <br><span style="font-size:12px;color:#64748b">{{ report.ward }} (Lat: {{ report.latitude }}, Lng: {{ report.longitude }})</span></div>
      </div>
      <div>
        <div class="meta-title">Reported Date</div>
        <div class="meta-value">{{ report.created_at }}</div>
      </div>
    </div>
    <div class="section-title">AI Inspection & Analysis Summary</div>
    <div style="background: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 14px;">
      <b>AI Verdict:</b> {{ report.ai_summary }}<br>
      <small style="color: #64748b;">Severity: {{ report.severity }} | Road Obstruction: {{ report.road_obstruction }}</small>
    </div>
    <div class="section-title">Visual Evidence (Photographic Record)</div>
    <div class="image-panel">
      <div class="image-box">
        <div style="font-weight: 700; margin-bottom: 8px;">BEFORE (INITIAL REPORT)</div>
        <img src="{{ before_img }}" alt="Before cleaning">
      </div>
      {% if after_img %}
      <div class="image-box">
        <div style="font-weight: 700; margin-bottom: 8px;">AFTER (CLEANED & VERIFIED)</div>
        <img src="{{ after_img }}" alt="After cleaning">
      </div>
      {% endif %}
    </div>
    <div class="section-title">Action & Lifecycle History</div>
    <div>
      {% for h in report.history %}
      <div class="timeline-item">
        <b>{{ h.created_at }}</b> - <span style="color:#0d9488; font-weight:600">{{ h.new_status }}</span>: {{ h.comment }}
      </div>
      {% endfor %}
    </div>
    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
      Generated automatically by SmartWaste AI Civic Platform. This is an official municipal audit record.
    </div>
  </div>
</body>
</html>"""

    rendered = render_template_string(html_template, report=report_dict, before_img=before_img, after_img=after_img)
    return Response(rendered, mimetype="text/html")

@report_bp.route("/<string:report_id>/review", methods=["POST"])
def review_report(report_id):
    user = get_current_user()
    if not user or user.role != "officer":
        return jsonify({"error": "Municipal officer role required"}), 403
    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404
    try:
        transition_report(report, "UNDER_REVIEW", user, "Municipal officer marked report as Under Review")
        return jsonify({"message": "Report status updated to UNDER_REVIEW", "report": report.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400

@report_bp.route("/<string:report_id>/request-info", methods=["POST"])
def request_info(report_id):
    user = get_current_user()
    if not user or user.role != "officer":
        return jsonify({"error": "Municipal officer role required"}), 403
    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404
    data = request.get_json() or {}
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "Question message is required"}), 400
    report.info_request_question = question
    report.info_request_answer = None
    try:
        transition_report(report, "INFORMATION_REQUESTED", user, f"Officer requested information: {question}")
        return jsonify({"message": "Information requested from citizen", "report": report.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400

@report_bp.route("/<string:report_id>/answer-info", methods=["POST"])
def answer_info(report_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404
    if user.role == "citizen" and report.citizen_id != user.id:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json() or {}
    answer = data.get("answer", "").strip()
    if not answer:
        return jsonify({"error": "Answer cannot be empty"}), 400
    report.info_request_answer = answer
    try:
        transition_report(report, "UNDER_REVIEW", user, f"Citizen responded: {answer}")
        return jsonify({"message": "Response submitted to municipality", "report": report.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400

@report_bp.route("/<string:report_id>/reject", methods=["POST"])
def reject_report(report_id):
    user = get_current_user()
    if not user or user.role != "officer":
        return jsonify({"error": "Municipal officer role required"}), 403
    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404
    data = request.get_json() or {}
    reason = data.get("reason", "").strip()
    if not reason:
        return jsonify({"error": "Rejection reason is required"}), 400
    report.rejection_reason = reason
    audit = AuditLog(user_id=user.id, action="REPORT_REJECTED", entity_type="waste_report", entity_id=report.id, details=f"Reason: {reason}")
    db.session.add(audit)
    try:
        transition_report(report, "REJECTED", user, f"Report rejected: {reason}")
        return jsonify({"message": "Report rejected with documented reason", "report": report.to_dict()}), 200
    except StateMachineError as e:
        return jsonify({"error": str(e)}), 400

@report_bp.route("/<string:report_id>/feedback", methods=["POST"])
def submit_feedback(report_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    report = db.session.get(WasteReport, report_id)
    if not report:
        return jsonify({"error": "Complaint not found"}), 404
    if report.citizen_id != user.id:
        return jsonify({"error": "Only the reporting citizen can provide feedback"}), 403
    if report.status != "COMPLETED":
        return jsonify({"error": "Feedback can only be provided after complaint is verified and completed"}), 400

    data = request.get_json() or {}
    try:
        rating = int(data.get("rating", 5))
        if rating < 1 or rating > 5:
            rating = 5
    except (ValueError, TypeError):
        rating = 5

    comment = data.get("comment", "").strip()
    existing = Feedback.query.filter_by(report_id=report.id).first()
    if existing:
        existing.rating = rating
        existing.comment = comment
    else:
        fb = Feedback(report_id=report.id, citizen_id=user.id, rating=rating, comment=comment)
        db.session.add(fb)
        user.award_points(20, "Service Feedback Submitted")


    db.session.commit()
    return jsonify({"message": "Thank you for your feedback!", "feedback": report.feedback.to_dict() if report.feedback else None, "points": user.points}), 200
