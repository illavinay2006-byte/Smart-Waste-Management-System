import datetime
from backend.database.db import db

class EmailLog(db.Model):
    __tablename__ = 'email_logs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    recipient_email = db.Column(db.String(120), nullable=False, index=True)
    recipient_name = db.Column(db.String(100), nullable=True)
    recipient_role = db.Column(db.String(30), nullable=True)
    report_id = db.Column(db.String(30), nullable=True, index=True)
    subject = db.Column(db.String(255), nullable=False)
    body_html = db.Column(db.Text, nullable=False)
    body_text = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), default='SENT')
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'recipient_email': self.recipient_email,
            'recipient_name': self.recipient_name,
            'recipient_role': self.recipient_role,
            'report_id': self.report_id,
            'subject': self.subject,
            'body_html': self.body_html,
            'body_text': self.body_text,
            'status': self.status,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'formatted_time': self.created_at.strftime('%b %d, %Y %I:%M %p') if self.created_at else ''
        }
