import datetime
from backend.database.db import db

class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    report_id = db.Column(db.String(30), db.ForeignKey("waste_reports.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    worker_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    assigned_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(30), nullable=False, default="ASSIGNED") # ASSIGNED, ACCEPTED, IN_PROGRESS, AWAITING_VERIFICATION, RE_CLEANING_REQUIRED, COMPLETED
    assigned_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    accepted_at = db.Column(db.DateTime, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    submitted_proof_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    worker_notes = db.Column(db.Text, nullable=True)
    recleaning_notes = db.Column(db.Text, nullable=True)

    # Relationships
    report = db.relationship("WasteReport", back_populates="task")
    worker = db.relationship("User", foreign_keys=[worker_id], back_populates="assigned_tasks")
    assigner = db.relationship("User", foreign_keys=[assigned_by])

    def to_dict(self):
        from backend.models.user import User
        from backend.models.report import WasteReport
        worker = self.worker or (db.session.get(User, self.worker_id) if self.worker_id else None)
        report = self.report or (db.session.get(WasteReport, self.report_id) if self.report_id else None)

        distance_km = None
        if (worker and worker.latitude is not None and worker.longitude is not None and
            report and report.latitude is not None and report.longitude is not None):
            from backend.services.duplicate_detector import haversine_distance
            meters = haversine_distance(report.latitude, report.longitude, worker.latitude, worker.longitude)
            distance_km = round(meters / 1000.0, 1)

        return {
            "id": self.id,
            "report_id": self.report_id,
            "worker_id": self.worker_id,
            "worker_name": worker.name if worker else "Unassigned",
            "worker_zone": worker.zone if worker else "",
            "worker_latitude": worker.latitude if worker else None,
            "worker_longitude": worker.longitude if worker else None,
            "distance_km": distance_km,
            "assigned_by_name": self.assigner.name if self.assigner else "Municipal Office",
            "status": self.status,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "submitted_proof_at": self.submitted_proof_at.isoformat() if self.submitted_proof_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "worker_notes": self.worker_notes,
            "recleaning_notes": self.recleaning_notes
        }
