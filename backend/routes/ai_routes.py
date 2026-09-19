import os
import time
from pathlib import Path
from flask import Blueprint, request, jsonify, session, current_app
from werkzeug.utils import secure_filename

from backend.database.db import db
from backend.models.user import User
from backend.ai.vision_service import analyze_waste_image
from backend.ai.assistant_service import handle_citizen_chat, handle_municipal_chat
from backend.services.priority_engine import calculate_priority

from backend.services.auth_service import get_current_authenticated_user

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

def get_current_user():
    return get_current_authenticated_user()

@ai_bp.route("/analyze-image", methods=["POST"])
def analyze_image():
    file = request.files.get("image")
    notes = request.form.get("notes", "")

    if not file or not file.filename:
        # Check if sample image URL provided
        data = request.get_json(silent=True) or {}
        img_url = data.get("image_url") or request.form.get("image_url")
        if img_url:
            filename = Path(img_url).name
            image_path = str(Path(current_app.config["UPLOAD_FOLDER"]) / filename)
        else:
            return jsonify({"error": "An image file is required for AI inspection"}), 400
    else:
        filename = secure_filename(file.filename)
        temp_name = f"temp_ai_{int(time.time())}_{filename}"
        upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
        target_path = upload_dir / temp_name
        file.save(target_path)
        image_path = str(target_path)

    result = analyze_waste_image(image_path, notes)

    is_waste = result.get("is_waste")
    if is_waste is None:
        is_waste = bool(result.get("is_garbage", False)) and result.get("detected_category") not in ["Other", "Not Garbage / Clean Area", None]

    if not is_waste:
        return jsonify({
            "valid": False,
            "is_waste": False,
            "is_garbage": False,
            "error": "Invalid Waste Image",
            "message": "No clear waste or garbage was detected in this image. Please upload a clear photo showing the waste you want to report."
        }), 422

    # Dynamic follow-up questions for Step 4 guided conversational flow
    questions = [
        {
            "id": "q1",
            "question": "Is the waste blocking a road, footpath, or property entrance?",
            "options": ["Yes", "No", "Not sure"],
            "default": "Yes" if result.get("road_obstruction") else "No"
        },
        {
            "id": "q2",
            "question": "How long has this waste approximately been accumulating?",
            "options": ["Less than a day", "1–2 days", "3–7 days", "More than a week", "Not sure"],
            "default": "1–2 days"
        },
        {
            "id": "q3",
            "question": "Is there a strong odor, liquid leakage, or visible animal scavenging?",
            "options": ["Yes", "No", "Not sure"],
            "default": "Yes" if result.get("environmental_concern") else "No"
        }
    ]

    return jsonify({
        "valid": True,
        "is_waste": True,
        "analysis": result,
        "image_temp_path": f"/uploads/{Path(image_path).name}",
        "suggested_questions": questions
    }), 200


@ai_bp.route("/generate-complaint", methods=["POST"])
def generate_complaint():
    """
    Synthesizes AI image detection + citizen's answers into a structured complaint draft.
    Citizen MUST review and explicitly submit this.
    """
    data = request.get_json() or {}
    category = data.get("category", "Mixed Waste")
    severity = data.get("severity", "Medium")
    location_name = data.get("location_name", "Ward 5")
    road_obstruction = data.get("road_obstruction", False)
    observed_duration = data.get("observed_duration", "1–2 days")
    concerns = data.get("concerns", "None specified")
    notes = data.get("notes", "")

    # Priority calculation
    priority, reasons = calculate_priority(
        severity=severity,
        road_obstruction=road_obstruction,
        category=category,
        observed_duration=observed_duration,
        description=f"{notes} {concerns}"
    )

    ai_summary = (
        f"A verified accumulation of {category.lower()} has been documented at {location_name}. "
        f"Citizen observed this condition for {observed_duration.lower()} with "
        f"{'active obstruction to pedestrian/vehicular traffic' if road_obstruction else 'no direct roadway obstruction'}. "
        f"Recommended for {priority.lower()} priority municipal dispatch."
    )

    return jsonify({
        "structured_complaint": {
            "issue": f"{category} Accumulation",
            "category": category,
            "severity": severity,
            "priority": priority,
            "priority_reasons": reasons,
            "location_name": location_name,
            "observed_duration": observed_duration,
            "road_obstruction": road_obstruction,
            "ai_summary": ai_summary,
            "additional_info": notes or f"Odor / leakage reported: {concerns}."
        }
    }), 200


@ai_bp.route("/assistant/chat", methods=["POST"])
def assistant_chat():
    user = get_current_user()
    data = request.get_json() or {}
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"reply": "Please send a valid message or question."}), 400

    role = user.role if user else "citizen"

    if role == "officer":
        res = handle_municipal_chat(user, message)
    else:
        res = handle_citizen_chat(user, message)

    return jsonify(res), 200
