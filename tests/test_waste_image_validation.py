import os
import sys
import json
import unittest
from pathlib import Path
from io import BytesIO

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import create_app
from backend.database.db import db
from backend.models.user import User
from backend.models.report import WasteReport

class TestWasteImageValidationGate(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_valid_waste_images_pass_ai_analysis(self):
        """Valid waste images must return 200 with is_waste=True and confidence >= 0.75"""
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})

        valid_samples = [
            ("uploads/sample_plastic.jpg", "Plastic"),
            ("uploads/sample_organic.jpg", "Organic / Wet Waste"),
            ("uploads/sample_mixed_waste.jpg", "Mixed Waste"),
            ("uploads/sample_ewaste.jpg", "E-Waste")
        ]

        for img_rel, expected_cat in valid_samples:
            img_path = Path(img_rel)
            if not img_path.exists():
                continue
            with open(img_path, "rb") as f:
                data = {
                    "image": (BytesIO(f.read()), img_path.name),
                    "notes": "Chirala waste test"
                }
                resp = self.client.post("/api/ai/analyze-image", data=data, content_type="multipart/form-data")
                self.assertEqual(resp.status_code, 200, f"Failed for {img_rel}")
                res = json.loads(resp.data)
                self.assertTrue(res["valid"])
                analysis = res["analysis"]
                self.assertTrue(analysis["is_waste"])
                self.assertTrue(analysis["is_garbage"])
                self.assertGreaterEqual(analysis["confidence"], 0.75)
                self.assertGreaterEqual(analysis["confidence_percentage"], 75)
                self.assertEqual(analysis["detected_category"], expected_cat)

    def test_non_waste_images_rejected_by_ai_analysis(self):
        """Unrelated non-waste images must return 422 with is_waste=False and error='Invalid Waste Image'"""
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})

        non_waste_samples = [
            "uploads/sample_cleaned_after.jpg",
            "uploads/test_laptop.jpg",
            "uploads/test_car.jpg",
            "uploads/test_screenshot.jpg",
            "uploads/test_scenery.jpg",
            "uploads/temp_ai_1789756500_AK2.JPG"
        ]

        for img_rel in non_waste_samples:
            img_path = Path(img_rel)
            if not img_path.exists():
                continue
            with open(img_path, "rb") as f:
                data = {
                    "image": (BytesIO(f.read()), img_path.name),
                    "notes": "Chirala non-waste test"
                }
                resp = self.client.post("/api/ai/analyze-image", data=data, content_type="multipart/form-data")
                self.assertEqual(resp.status_code, 422, f"Expected 422 for non-waste {img_rel}, got {resp.status_code}")
                res = json.loads(resp.data)
                self.assertFalse(res.get("valid", True))
                self.assertFalse(res.get("is_waste", True))
                self.assertEqual(res.get("error"), "Invalid Waste Image")
                self.assertIn("No clear waste or garbage was detected", res.get("message", ""))
                # Must not contain waste category or confidence
                self.assertNotIn("detected_category", res)
                self.assertNotIn("confidence", res)

    def test_non_waste_image_blocks_report_creation(self):
        """POST /api/reports must reject non-waste images with 422 and prevent database insertion"""
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})

        non_waste_path = Path("uploads/test_laptop.jpg")
        if not non_waste_path.exists():
            non_waste_path = Path("uploads/sample_cleaned_after.jpg")

        with self.app.app_context():
            initial_count = WasteReport.query.count()

        with open(non_waste_path, "rb") as f:
            data = {
                "image": (BytesIO(f.read()), non_waste_path.name),
                "latitude": "15.8246",
                "longitude": "80.3522",
                "location_name": "Test Location",
                "category": "Mixed Waste",
                "description": "Attempting to submit non waste image"
            }
            resp = self.client.post("/api/reports", data=data, content_type="multipart/form-data")

        self.assertEqual(resp.status_code, 422)
        res = json.loads(resp.data)
        self.assertFalse(res.get("is_waste", True))
        self.assertEqual(res.get("error"), "Invalid Waste Image")

        # Verify no report was added to the database
        with self.app.app_context():
            after_count = WasteReport.query.count()
            self.assertEqual(initial_count, after_count, "Report was improperly created for non-waste image!")

    def test_valid_waste_image_allows_report_creation(self):
        """POST /api/reports must accept valid waste image and create report"""
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})

        valid_waste_path = Path("uploads/sample_plastic.jpg")
        with open(valid_waste_path, "rb") as f:
            data = {
                "image": (BytesIO(f.read()), valid_waste_path.name),
                "latitude": "15.8246",
                "longitude": "80.3522",
                "location_name": "Clock Tower, Chirala",
                "category": "Plastic",
                "description": "Discarded plastic bottles on walkway"
            }
            resp = self.client.post("/api/reports", data=data, content_type="multipart/form-data")

        self.assertEqual(resp.status_code, 201)
        res = json.loads(resp.data)
        self.assertIn("report", res)
        report_id = res["report"]["id"]

        with self.app.app_context():
            saved_report = db.session.get(WasteReport, report_id)
            self.assertIsNotNone(saved_report)
            self.assertEqual(saved_report.category, "Plastic")

if __name__ == "__main__":
    unittest.main()
