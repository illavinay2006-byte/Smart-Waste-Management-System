import datetime
from backend.database.db import db

class Announcement(db.Model):
    __tablename__ = 'announcements'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), default='NORMAL') # NORMAL, IMPORTANT, URGENT
    target_ward = db.Column(db.String(100), default='ALL')
    author_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)

    author = db.relationship('User', foreign_keys=[author_id])

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'priority': self.priority,
            'target_ward': self.target_ward,
            'author_id': self.author_id,
            'author_name': self.author.name if self.author else 'Municipal Administration',
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'formatted_date': self.created_at.strftime('%b %d, %Y • %I:%M %p') if self.created_at else 'Recent'
        }
