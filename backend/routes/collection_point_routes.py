from flask import Blueprint, jsonify, request, session
from backend.database.db import db
from backend.models.collection_point import CollectionPoint
from backend.models.report import WasteReport
from backend.services.route_service import generate_collection_route

collection_bp = Blueprint("collection_points", __name__, url_prefix="/api/collection-points")

@collection_bp.route("", methods=["GET"])
def list_collection_points():
    points = CollectionPoint.query.all()
    return jsonify({"collection_points": [p.to_dict() for p in points]}), 200

@collection_bp.route("/<int:point_id>/status", methods=["PUT"])
def update_status(point_id):
    point = db.session.get(CollectionPoint, point_id)
    if not point:
        return jsonify({"error": "Collection point not found"}), 404

    data = request.get_json() or {}
    status = data.get("status")
    level = data.get("current_level_pct")

    if status:
        point.status = status
    if level is not None:
        point.current_level_pct = int(level)

    db.session.commit()
    return jsonify({"message": "Collection point updated", "collection_point": point.to_dict()}), 200

@collection_bp.route("/generate-route", methods=["POST"])
def generate_route():
    data = request.get_json() or {}
    start_lat = float(data.get("start_lat", 12.9716))
    start_lng = float(data.get("start_lng", 77.5946))
    vehicle_type = data.get("vehicle_type", "Standard 5-Ton Municipal Tipper")

    # Fetch pending tasks/reports (SUBMITTED, UNDER_REVIEW, ASSIGNED)
    pending_reports = WasteReport.query.filter(
        WasteReport.status.in_(["ASSIGNED", "UNDER_REVIEW", "SUBMITTED"])
    ).limit(8).all()

    tasks_payload = []
    for r in pending_reports:
        tasks_payload.append({
            "id": r.id,
            "report_id": r.id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "category": r.category,
            "priority": r.priority,
            "location_name": r.location_name
        })

    route_plan = generate_collection_route(start_lat, start_lng, tasks_payload, vehicle_type)
    return jsonify({"route": route_plan}), 200
