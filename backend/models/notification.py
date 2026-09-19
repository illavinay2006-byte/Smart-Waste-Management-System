import datetime
from backend.database.db import db

class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    report_id = db.Column(db.String(30), db.ForeignKey("waste_reports.id", ondelete="CASCADE"), nullable=True)
    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(20), default="info") # info, success, warning, danger
    is_read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)

    user = db.relationship("User", back_populates="notifications")
    report = db.relationship("WasteReport")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "report_id": self.report_id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "formatted_time": self.created_at.strftime("%b %d, %I:%M %p") if self.created_at else ""
        }
