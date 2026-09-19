import datetime
from backend.database.db import db

class CollectionPoint(db.Model):
    __tablename__ = "collection_points"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(150), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    categories = db.Column(db.String(255), default="Organic, Plastic, Paper, Glass")
    capacity_kg = db.Column(db.Float, default=1000.0)
    current_level_pct = db.Column(db.Integer, default=30)
    status = db.Column(db.String(30), default="NORMAL") # NORMAL, NEAR_FULL, FULL, OVERFLOWING, MAINTENANCE
    last_cleaned = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    zone = db.Column(db.String(50), default="Ward 5")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "categories": self.categories.split(",") if self.categories else [],
            "capacity_kg": self.capacity_kg,
            "current_level_pct": self.current_level_pct,
            "status": self.status,
            "last_cleaned": self.last_cleaned.isoformat() if self.last_cleaned else None,
            "zone": self.zone
        }
