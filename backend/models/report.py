import datetime
import json
from backend.database.db import db

class WasteReport(db.Model):
    __tablename__ = "waste_reports"

    id = db.Column(db.String(30), primary_key=True) # e.g. SW-2026-001245
    citizen_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = db.Column(db.String(50), nullable=False, default="Mixed Waste")
    severity = db.Column(db.String(20), nullable=False, default="Medium") # Low, Medium, High, Critical
    priority = db.Column(db.String(20), nullable=False, default="Medium") # Low, Medium, High, Critical
    priority_reasons = db.Column(db.Text, nullable=True) # JSON array of reasons
    status = db.Column(db.String(30), nullable=False, default="SUBMITTED", index=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    location_name = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    ai_summary = db.Column(db.Text, nullable=True)
    observed_duration = db.Column(db.String(50), nullable=True)
    road_obstruction = db.Column(db.Boolean, default=False)
    is_emergency = db.Column(db.Boolean, default=False)
    ward = db.Column(db.String(100), default="Ward 1 - Chirala Clock Tower (Main Bazaar)")
    rejection_reason = db.Column(db.Text, nullable=True)
    info_request_question = db.Column(db.Text, nullable=True)
    info_request_answer = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    citizen = db.relationship("User", back_populates="reports", foreign_keys=[citizen_id])
    images = db.relationship("ReportImage", back_populates="report", cascade="all, delete-orphan")
    ai_analysis = db.relationship("AIAnalysis", back_populates="report", uselist=False, cascade="all, delete-orphan")
    questions = db.relationship("ReportQuestion", back_populates="report", cascade="all, delete-orphan")
    history = db.relationship("ReportHistory", back_populates="report", order_by="ReportHistory.timestamp.asc()", cascade="all, delete-orphan")
    task = db.relationship("Task", back_populates="report", uselist=False, cascade="all, delete-orphan")
    feedback = db.relationship("Feedback", back_populates="report", uselist=False, cascade="all, delete-orphan")

    def get_priority_reasons_list(self):
        if not self.priority_reasons:
            return []
        try:
            return json.loads(self.priority_reasons)
        except Exception:
            return [self.priority_reasons]

    def to_dict(self, include_sensitive=False):
        before_image = next((img.file_path for img in self.images if img.image_type == "before"), None)
        after_image = next((img.file_path for img in reversed(self.images) if img.image_type in ("after", "recleaning_after")), None)
        
        citizen_info = None
        if self.citizen:
            if include_sensitive:
                citizen_info = {
                    "id": self.citizen.id,
                    "name": self.citizen.name,
                    "phone": self.citizen.phone,
                    "email": self.citizen.email
                }
            else:
                # Privacy-preserving citizen info (First name or ID only)
                citizen_info = {
                    "id": self.citizen.id,
                    "name": self.citizen.name.split()[0] + (" *" if len(self.citizen.name.split()) > 1 else "")
                }

        return {
            "id": self.id,
            "citizen_id": self.citizen_id,
            "citizen": citizen_info,
            "category": self.category,
            "severity": self.severity,
            "priority": self.priority,
            "priority_reasons": self.get_priority_reasons_list(),
            "status": self.status,
            "is_emergency": bool(self.is_emergency),
            "ward": self.ward or "Ward 1 - Chirala Clock Tower (Main Bazaar)",
            "latitude": self.latitude,
            "longitude": self.longitude,
            "location_name": self.location_name,
            "description": self.description,
            "ai_summary": self.ai_summary,
            "observed_duration": self.observed_duration,
            "road_obstruction": self.road_obstruction,
            "rejection_reason": self.rejection_reason,
            "info_request_question": self.info_request_question,
            "info_request_answer": self.info_request_answer,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "before_image": before_image,
            "after_image": after_image,
            "images": [img.to_dict() for img in self.images],
            "ai_analysis": self.ai_analysis.to_dict() if self.ai_analysis else None,
            "questions": [q.to_dict() for q in self.questions],
            "history": [h.to_dict() for h in self.history],
            "task": self.task.to_dict() if self.task else None,
            "feedback": self.feedback.to_dict() if self.feedback else None
        }


class ReportImage(db.Model):
    __tablename__ = "report_images"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    report_id = db.Column(db.String(30), db.ForeignKey("waste_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    image_type = db.Column(db.String(20), nullable=False, default="before") # before, after, recleaning_after
    file_path = db.Column(db.String(255), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    report = db.relationship("WasteReport", back_populates="images")

    def to_dict(self):
        return {
            "id": self.id,
            "report_id": self.report_id,
            "image_type": self.image_type,
            "file_path": self.file_path,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class AIAnalysis(db.Model):
    __tablename__ = "ai_analyses"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    report_id = db.Column(db.String(30), db.ForeignKey("waste_reports.id", ondelete="CASCADE"), nullable=False, unique=True)
    detected_category = db.Column(db.String(50), nullable=False)
    confidence = db.Column(db.Float, nullable=False) # e.g. 0.91
    detected_severity = db.Column(db.String(20), nullable=False) # Low, Medium, High
    road_obstruction = db.Column(db.Boolean, default=False)
    environmental_concern = db.Column(db.Boolean, default=False)
    raw_response = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    report = db.relationship("WasteReport", back_populates="ai_analysis")

    def to_dict(self):
        return {
            "id": self.id,
            "report_id": self.report_id,
            "detected_category": self.detected_category,
            "confidence": round(self.confidence, 2),
            "confidence_percentage": int(self.confidence * 100),
            "detected_severity": self.detected_severity,
            "road_obstruction": self.road_obstruction,
            "environmental_concern": self.environmental_concern,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ReportQuestion(db.Model):
    __tablename__ = "report_questions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    report_id = db.Column(db.String(30), db.ForeignKey("waste_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    report = db.relationship("WasteReport", back_populates="questions")

    def to_dict(self):
        return {
            "id": self.id,
            "question": self.question,
            "answer": self.answer,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ReportHistory(db.Model):
    __tablename__ = "report_history"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    report_id = db.Column(db.String(30), db.ForeignKey("waste_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status = db.Column(db.String(30), nullable=True)
    new_status = db.Column(db.String(30), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    comment = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)

    report = db.relationship("WasteReport", back_populates="history")
    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "report_id": self.report_id,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "user_name": self.user.name if self.user else "System",
            "comment": self.comment,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "formatted_time": self.timestamp.strftime("%b %d, %Y, %I:%M %p") if self.timestamp else ""
        }


class Feedback(db.Model):
    __tablename__ = "feedback"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    report_id = db.Column(db.String(30), db.ForeignKey("waste_reports.id", ondelete="CASCADE"), nullable=False, unique=True)
    citizen_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    rating = db.Column(db.Integer, nullable=False) # 1 to 5
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    report = db.relationship("WasteReport", back_populates="feedback")
    citizen = db.relationship("User", foreign_keys=[citizen_id])

    def to_dict(self):
        return {
            "id": self.id,
            "report_id": self.report_id,
            "rating": self.rating,
            "comment": self.comment,
            "citizen_name": self.citizen.name if self.citizen else "Citizen",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
