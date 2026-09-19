import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
import json
from backend.app import create_app
from backend.database.db import db
from backend.models.user import User
from backend.models.report import WasteReport
from backend.models.task import Task
from backend.services.duplicate_detector import haversine_distance

class TestWorkerDistanceCalculation(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_haversine_formula_accuracy(self):
        """Test the Haversine formula calculation for local Chirala points"""
        # Clock Tower (15.8246, 80.3522) to Station Road (15.8285, 80.3548)
        dist_m = haversine_distance(15.8246, 80.3522, 15.8285, 80.3548)
        dist_km = round(dist_m / 1000.0, 1)
        self.assertGreater(dist_km, 0.3)
        self.assertLess(dist_km, 0.8)

    def test_worker_recommendations_realistic_distance(self):
        """Test that worker recommendations return realistic distances (e.g. 0.1 - 4.0 km), NOT 400+ km"""
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})

        # Report 1: Clock Tower (15.8246, 80.3522)
        resp = self.client.get("/api/tasks/recommended-workers/SW-2026-001201")
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        workers = data["recommended_workers"]
        self.assertGreater(len(workers), 0)

        # Check workers with coordinates
        located_workers = [w for w in workers if w["distance_km"] is not None]
        unlocated_workers = [w for w in workers if w["distance_km"] is None]

        self.assertGreater(len(located_workers), 0)
        for w in located_workers:
            # All local Chirala distances must be under 10 km, definitely NOT ~425 km!
            self.assertLess(w["distance_km"], 10.0, f"Worker {w['name']} distance {w['distance_km']} km is too large!")
            self.assertGreaterEqual(w["distance_km"], 0.0)
            self.assertIn(f"{w['distance_km']} km", w["reason"])

        # Unlocated worker must explicitly report "Location unavailable"
        if unlocated_workers:
            for uw in unlocated_workers:
                self.assertIsNone(uw["distance_km"])
                self.assertIn("Location unavailable", uw["reason"])

    def test_multiple_complaint_locations_distances(self):
        """Test recommendations across multiple complaints in different wards"""
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})

        # SW-2026-001201 (Ward 1 - Clock Tower)
        r1_resp = self.client.get("/api/tasks/recommended-workers/SW-2026-001201")
        self.assertEqual(r1_resp.status_code, 200)
        r1_workers = json.loads(r1_resp.data)["recommended_workers"]
        ravi_r1 = next(w for w in r1_workers if w["name"] == "Ravi")
        self.assertLess(ravi_r1["distance_km"], 0.5)

        # SW-2026-001202 (Ward 2 - Railway Station Road)
        r2_resp = self.client.get("/api/tasks/recommended-workers/SW-2026-001202")
        self.assertEqual(r2_resp.status_code, 200)
        r2_workers = json.loads(r2_resp.data)["recommended_workers"]
        ravi_r2 = next(w for w in r2_workers if w["name"] == "Ravi")
        self.assertLess(ravi_r2["distance_km"], 2.0)

    def test_missing_worker_coordinates_fallback(self):
        """Test that worker with null coordinates returns Location unavailable without fake numbers"""
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})
        with self.app.app_context():
            suresh = User.query.filter_by(name="Suresh").first()
            if suresh:
                suresh.latitude = None
                suresh.longitude = None
                db.session.commit()

        resp = self.client.get("/api/tasks/recommended-workers/SW-2026-001201")
        self.assertEqual(resp.status_code, 200)
        workers = json.loads(resp.data)["recommended_workers"]
        suresh_w = next((w for w in workers if w["name"] == "Suresh"), None)
        if suresh_w:
            self.assertIsNone(suresh_w["distance_km"])
            self.assertIn("Location unavailable", suresh_w["reason"])

    def test_worker_location_update_api(self):
        """Test dynamic update of worker coordinates via API"""
        self.client.post("/api/auth/switch-demo", json={"role": "worker"})
        update_resp = self.client.post("/api/tasks/worker/location", json={
            "latitude": 15.8248,
            "longitude": 80.3520
        })
        self.assertEqual(update_resp.status_code, 200)
        data = json.loads(update_resp.data)
        self.assertAlmostEqual(data["worker"]["latitude"], 15.8248, places=4)
        self.assertAlmostEqual(data["worker"]["longitude"], 80.3520, places=4)

        # Switch to officer and verify recalculated distance
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})
        rec_resp = self.client.get("/api/tasks/recommended-workers/SW-2026-001201")
        self.assertEqual(rec_resp.status_code, 200)
        workers = json.loads(rec_resp.data)["recommended_workers"]
        ravi = next(w for w in workers if w["name"] == "Ravi")
        # Now Ravi is at (15.8248, 80.3520), extremely close (~0.0 - 0.1 km)
        self.assertLessEqual(ravi["distance_km"], 0.2)

    def test_task_to_dict_distance(self):
        """Verify Task.to_dict() returns distance_km calculated correctly"""
        with self.app.app_context():
            worker = User.query.filter_by(name="Ravi").first()
            report = db.session.get(WasteReport, "SW-2026-001201")
            task = Task(
                report_id=report.id,
                worker_id=worker.id,
                assigned_by=1,
                status="ASSIGNED"
            )
            td = task.to_dict()
            self.assertIn("distance_km", td)
            self.assertIsNotNone(td["distance_km"])
            self.assertLess(td["distance_km"], 1.0)
            self.assertIn("worker_latitude", td)
            self.assertIn("worker_longitude", td)

if __name__ == "__main__":
    unittest.main()
