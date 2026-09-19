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

class TestExtendedFeatures(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        with self.app.app_context():
            for test_id in ["SW-2026-999001", "SW-2026-999002"]:
                old = db.session.get(WasteReport, test_id)
                if old:
                    db.session.delete(old)
            db.session.commit()

    def test_recleaning_loop(self):
        """
        Tests the verification rejection & re-cleaning loop:
        AWAITING_VERIFICATION -> RE_CLEANING_REQUIRED -> IN_PROGRESS -> AWAITING_VERIFICATION -> COMPLETED
        """
        # Officer logs in
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})

        # Create a report in AWAITING_VERIFICATION state or use seeded r7/r8
        with self.app.app_context():
            worker = User.query.filter_by(role="worker").first()
            citizen = User.query.filter_by(role="citizen").first()
            officer = User.query.filter_by(role="officer").first()

            rep = WasteReport(
                id="SW-2026-999001",
                citizen_id=citizen.id,
                category="Mixed Waste",
                severity="High",
                status="AWAITING_VERIFICATION",
                latitude=12.9716,
                longitude=77.5946,
                location_name="Test Recleaning Corner"
            )
            db.session.add(rep)
            task = Task(
                report_id=rep.id,
                worker_id=worker.id,
                assigned_by=officer.id,
                status="AWAITING_VERIFICATION"
            )
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        # Officer rejects completion proof with reason
        reclean_resp = self.client.post(f"/api/tasks/{task_id}/reclean", json={
            "reason": "Debris remains along the drainage curb"
        })
        self.assertEqual(reclean_resp.status_code, 200)

        with self.app.app_context():
            chk_rep = db.session.get(WasteReport, "SW-2026-999001")
            self.assertEqual(chk_rep.status, "RE_CLEANING_REQUIRED")

        # Worker logs in and starts re-cleaning
        self.client.post("/api/auth/switch-demo", json={"role": "worker"})
        start_resp = self.client.put(f"/api/tasks/{task_id}/start")
        self.assertEqual(start_resp.status_code, 200)

        with self.app.app_context():
            chk_rep = db.session.get(WasteReport, "SW-2026-999001")
            self.assertEqual(chk_rep.status, "IN_PROGRESS")

        # Worker re-submits proof
        proof_resp = self.client.post(f"/api/tasks/{task_id}/proof", data={
            "notes": "Drainage curb swept clean and disinfected",
            "image_url": "/uploads/sample_cleaned_after.jpg"
        })
        self.assertEqual(proof_resp.status_code, 200)

        # Officer approves
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})
        verif_resp = self.client.post(f"/api/tasks/{task_id}/verify", json={"notes": "Inspection passed"})
        self.assertEqual(verif_resp.status_code, 200)

        with self.app.app_context():
            chk_rep = db.session.get(WasteReport, "SW-2026-999001")
            self.assertEqual(chk_rep.status, "COMPLETED")

    def test_information_request_loop(self):
        """
        Tests the info-request loop:
        UNDER_REVIEW -> INFORMATION_REQUESTED -> UNDER_REVIEW
        """
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})

        with self.app.app_context():
            citizen = User.query.filter_by(role="citizen").first()
            rep = WasteReport(
                id="SW-2026-999002",
                citizen_id=citizen.id,
                category="Plastic",
                status="UNDER_REVIEW",
                latitude=12.9716,
                longitude=77.5946,
                location_name="Vague Location"
            )
            db.session.add(rep)
            db.session.commit()

        # Officer asks for info
        req_resp = self.client.post("/api/reports/SW-2026-999002/request-info", json={
            "question": "Is this near the northern entrance or southern gate?"
        })
        self.assertEqual(req_resp.status_code, 200)

        with self.app.app_context():
            chk = db.session.get(WasteReport, "SW-2026-999002")
            self.assertEqual(chk.status, "INFORMATION_REQUESTED")

        # Citizen logs in and answers
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})
        ans_resp = self.client.post("/api/reports/SW-2026-999002/answer-info", json={
            "answer": "It is right next to the Southern Gate opposite the pharmacy."
        })
        self.assertEqual(ans_resp.status_code, 200)

        with self.app.app_context():
            chk = db.session.get(WasteReport, "SW-2026-999002")
            self.assertEqual(chk.status, "UNDER_REVIEW")
            self.assertIn("Southern Gate", chk.info_request_answer)

    def test_ai_vision_and_chat(self):
        """Tests image analysis endpoint and role-bounded chat assistant"""
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})
        
        # Test AI chat assistant for citizen
        chat_resp = self.client.post("/api/ai/assistant/chat", json={
            "message": "How do I segregate plastic waste?"
        })
        self.assertEqual(chat_resp.status_code, 200)
        data = json.loads(chat_resp.data)
        self.assertIn("reply", data)
        self.assertIn("plastic", data["reply"].lower())

        # Test AI chat assistant for officer
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})
        off_chat_resp = self.client.post("/api/ai/assistant/chat", json={
            "message": "Show today's unresolved high-priority reports"
        })
        self.assertEqual(off_chat_resp.status_code, 200)
        off_data = json.loads(off_chat_resp.data)
        self.assertIn("reply", off_data)

    def test_route_generation(self):
        """Tests TSP collection route generator"""
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})
        resp = self.client.post("/api/collection-points/generate-route", json={
            "start_lat": 12.9716,
            "start_lng": 77.5946,
            "vehicle_type": "Standard 5-Ton Municipal Tipper"
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn("route", data)
        self.assertGreater(len(data["route"]["stops"]), 1)

    def test_email_password_registration_and_login(self):
        """Tests user registration with only email & password, auto name derivation, and session login"""
        test_email = "newcitizen@community.org"
        with self.app.app_context():
            existing = User.query.filter_by(email=test_email).first()
            if existing:
                db.session.delete(existing)
                db.session.commit()

        # 1. Register with only email and password
        reg_resp = self.client.post("/api/auth/register", json={
            "email": test_email,
            "password": "SecurePassword123",
            "zone": "Ward 111 - Shantala Nagar"
        })
        self.assertEqual(reg_resp.status_code, 201)
        reg_data = json.loads(reg_resp.data)
        self.assertIn("user", reg_data)
        self.assertEqual(reg_data["user"]["email"], test_email)
        self.assertEqual(reg_data["user"]["name"], "Newcitizen")

        # 2. Login with email and password
        login_resp = self.client.post("/api/auth/login", json={
            "email": test_email,
            "password": "SecurePassword123"
        })
        self.assertEqual(login_resp.status_code, 200)
        login_data = json.loads(login_resp.data)
        self.assertEqual(login_data["user"]["email"], test_email)

        # 3. Check /me session
        me_resp = self.client.get("/api/auth/me")
        self.assertEqual(me_resp.status_code, 200)
        me_data = json.loads(me_resp.data)
        self.assertTrue(me_data["authenticated"])
        self.assertEqual(me_data["user"]["email"], test_email)

        # 4. Logout
        logout_resp = self.client.post("/api/auth/logout")
        self.assertEqual(logout_resp.status_code, 200)

        me_resp2 = self.client.get("/api/auth/me")
        me_data2 = json.loads(me_resp2.data)
        self.assertFalse(me_data2["authenticated"])

    def test_deterministic_ai_confidence_and_not_garbage(self):
        """
        Tests:
        1. AI confidence is deterministic and 100% identical when given the same image repeatedly.
        2. Non-waste / clean area / user portrait images return is_garbage=False and 'It is not the garbage' message.
        3. Specific waste categories (Plastic, Organic, E-Waste, Mixed Waste) are identified accurately.
        """
        from backend.ai.vision_service import analyze_waste_image

        # 1. Repeatability on same image
        res_a = analyze_waste_image("uploads/sample_plastic.jpg", "Chirala Clock Tower")
        res_b = analyze_waste_image("uploads/sample_plastic.jpg", "Chirala Clock Tower")
        self.assertEqual(res_a["confidence_percentage"], res_b["confidence_percentage"])
        self.assertEqual(res_a["detected_category"], res_b["detected_category"])
        self.assertEqual(res_a["detected_severity"], res_b["detected_severity"])
        self.assertTrue(res_a["is_garbage"])
        self.assertEqual(res_a["detected_category"], "Plastic")

        # 2. Specific waste types
        res_org = analyze_waste_image("uploads/sample_organic.jpg")
        self.assertTrue(res_org["is_garbage"])
        self.assertEqual(res_org["detected_category"], "Organic / Wet Waste")

        res_ewaste = analyze_waste_image("uploads/sample_ewaste.jpg")
        self.assertTrue(res_ewaste["is_garbage"])
        self.assertEqual(res_ewaste["detected_category"], "E-Waste")

        res_mixed = analyze_waste_image("uploads/sample_mixed_waste.jpg")
        self.assertTrue(res_mixed["is_garbage"])
        self.assertEqual(res_mixed["detected_category"], "Mixed Waste")

        # 3. Not Garbage / Other detection (Clean area)
        res_clean = analyze_waste_image("uploads/sample_cleaned_after.jpg", "Clean road after sweeping")
        self.assertFalse(res_clean["is_garbage"])
        self.assertTrue(res_clean.get("is_not_garbage"))
        self.assertEqual(res_clean["detected_category"], "Other")
        self.assertIn("not the garbage", res_clean["message"].lower())
        self.assertGreaterEqual(res_clean["confidence_percentage"], 90)

        # 4. Not Garbage / Other detection (Person / selfie photo)
        if os.path.exists("uploads/temp_ai_1789756500_AK2.JPG"):
            res_person = analyze_waste_image("uploads/temp_ai_1789756500_AK2.JPG")
            self.assertFalse(res_person["is_garbage"])
            self.assertTrue(res_person.get("is_not_garbage"))
            self.assertEqual(res_person["detected_category"], "Other")
            self.assertIn("not the garbage", res_person["message"].lower())

if __name__ == "__main__":
    unittest.main()
