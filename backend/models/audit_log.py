import datetime
from backend.database.db import db

class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(100), nullable=False) # e.g. WORKER_ASSIGNED, REPORT_REJECTED, VERIFICATION_APPROVED
    entity_type = db.Column(db.String(50), nullable=False) # e.g. waste_report, task
    entity_id = db.Column(db.String(50), nullable=False)
    details = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else "System",
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "formatted_time": self.timestamp.strftime("%b %d, %Y, %I:%M %p") if self.timestamp else ""
        }
