import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database.db import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="citizen", index=True) # citizen, officer, worker
    phone = db.Column(db.String(20), nullable=True)
    zone = db.Column(db.String(50), nullable=True) # e.g. "Ward 5 - Central", "Ward 3 - East"
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    session_token = db.Column(db.String(100), nullable=True)
    last_login_at = db.Column(db.DateTime, nullable=True)
    points = db.Column(db.Integer, default=0)
    rank_tier = db.Column(db.String(50), default="Eco Scout")
    badges = db.Column(db.Text, default="[]") # JSON list of badge strings
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Relationships
    reports = db.relationship("WasteReport", back_populates="citizen", foreign_keys="WasteReport.citizen_id")
    assigned_tasks = db.relationship("Task", back_populates="worker", foreign_keys="Task.worker_id")
    notifications = db.relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def award_points(self, amount, reason="Civic Action"):
        import json
        self.points = (self.points or 0) + amount
        
        # Calculate rank tier
        if self.points >= 500:
            self.rank_tier = "Sustainability Legend"
        elif self.points >= 250:
            self.rank_tier = "Civic Champion"
        elif self.points >= 100:
            self.rank_tier = "Green Guardian"
        else:
            self.rank_tier = "Eco Scout"

        # Award default milestone badges
        current_badges = []
        try:
            current_badges = json.loads(self.badges or "[]")
        except Exception:
            current_badges = []

        badge_rules = [
            ("first_report", "🌱 First Step", 50),
            ("active_citizen", "🌿 Cleanliness Pioneer", 150),
            ("eco_warrior", "🛡️ Neighborhood Protector", 300),
            ("green_master", "👑 Civic Sustainability Master", 500)
        ]
        for b_id, b_name, threshold in badge_rules:
            if self.points >= threshold and b_name not in current_badges:
                current_badges.append(b_name)

        self.badges = json.dumps(current_badges)
        return self.points

    def get_badges_list(self):
        import json
        try:
            return json.loads(self.badges or "[]")
        except Exception:
            return []

    def to_dict(self, include_sensitive=False):
        data = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "phone": self.phone,
            "zone": self.zone,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "avatar_url": self.avatar_url,
            "points": self.points or 0,
            "rank_tier": self.rank_tier or "Eco Scout",
            "badges": self.get_badges_list(),
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        return data
