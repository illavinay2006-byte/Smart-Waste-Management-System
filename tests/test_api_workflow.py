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
from backend.services.state_machine import can_transition, transition_report, StateMachineError

class TestSmartWasteWorkflow(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_state_machine_validations(self):
        """Verify strict transition guards"""
        self.assertTrue(can_transition("SUBMITTED", "UNDER_REVIEW"))
        self.assertTrue(can_transition("UNDER_REVIEW", "ASSIGNED"))
        self.assertTrue(can_transition("ASSIGNED", "ACCEPTED"))
        self.assertTrue(can_transition("ACCEPTED", "IN_PROGRESS"))
        self.assertTrue(can_transition("IN_PROGRESS", "AWAITING_VERIFICATION"))
        self.assertTrue(can_transition("AWAITING_VERIFICATION", "COMPLETED"))
        self.assertTrue(can_transition("AWAITING_VERIFICATION", "RE_CLEANING_REQUIRED"))
        self.assertTrue(can_transition("RE_CLEANING_REQUIRED", "IN_PROGRESS"))
        self.assertTrue(can_transition("UNDER_REVIEW", "INFORMATION_REQUESTED"))
        self.assertTrue(can_transition("INFORMATION_REQUESTED", "UNDER_REVIEW"))
        self.assertTrue(can_transition("UNDER_REVIEW", "REJECTED"))

        # Forbidden shortcuts
        self.assertFalse(can_transition("SUBMITTED", "COMPLETED"))
        self.assertFalse(can_transition("SUBMITTED", "IN_PROGRESS"))
        self.assertFalse(can_transition("ASSIGNED", "COMPLETED"))
        self.assertFalse(can_transition("COMPLETED", "IN_PROGRESS"))

    def test_demo_auth_switching(self):
        """Verify demo role switching endpoint"""
        resp = self.client.post("/api/auth/switch-demo", json={"role": "citizen"})
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data["user"]["role"], "citizen")

        resp = self.client.post("/api/auth/switch-demo", json={"role": "officer"})
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data["user"]["role"], "officer")

        resp = self.client.post("/api/auth/switch-demo", json={"role": "worker"})
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data["user"]["role"], "worker")

    def test_golden_lifecycle_api(self):
        """
        Tests the complete 24-step golden path through the REST APIs:
        1. Citizen submits report -> SUBMITTED
        2. Officer reviews report -> UNDER_REVIEW
        3. Officer assigns worker -> ASSIGNED
        4. Worker accepts task -> ACCEPTED
        5. Worker starts cleaning -> IN_PROGRESS
        6. Worker submits after proof -> AWAITING_VERIFICATION
        7. Officer verifies and approves -> COMPLETED
        8. Citizen submits feedback
        """
        # Step 1: Login as citizen
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})
        
        # Step 2: Citizen creates new report
        create_resp = self.client.post("/api/reports", data={
            "category": "Plastic",
            "severity": "High",
            "latitude": "12.9716",
            "longitude": "77.5946",
            "location_name": "Residency Road Corner",
            "description": "Massive pile of plastic packaging and bottles",
            "road_obstruction": "true",
            "observed_duration": "3–7 days",
            "image_url": "/uploads/sample_plastic.jpg"
        })
        self.assertEqual(create_resp.status_code, 201)
        rep = json.loads(create_resp.data)["report"]
        report_id = rep["id"]
        self.assertEqual(rep["status"], "SUBMITTED")
        self.assertIn(rep["priority"], ["HIGH", "CRITICAL"])

        # Step 3: Officer logs in and reviews
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})
        rev_resp = self.client.post(f"/api/reports/{report_id}/review")
        self.assertEqual(rev_resp.status_code, 200)
        self.assertEqual(json.loads(rev_resp.data)["report"]["status"], "UNDER_REVIEW")

        # Step 4: Officer queries recommended workers and assigns the primary demo worker
        rec_resp = self.client.get(f"/api/tasks/recommended-workers/{report_id}")
        self.assertEqual(rec_resp.status_code, 200)
        rec_data = json.loads(rec_resp.data)
        self.assertTrue(len(rec_data["recommended_workers"]) > 0)

        # Get worker id
        with self.app.app_context():
            demo_worker = User.query.filter_by(role="worker").first()
            worker_id = demo_worker.id

        # Step 5: Officer assigns worker
        assign_resp = self.client.post("/api/tasks/assign", json={
            "report_id": report_id,
            "worker_id": worker_id
        })
        self.assertEqual(assign_resp.status_code, 200)
        task_id = json.loads(assign_resp.data)["task"]["id"]

        # Step 6: Worker logs in and views task
        self.client.post("/api/auth/switch-demo", json={"role": "worker"})
        
        # Worker accepts
        acc_resp = self.client.put(f"/api/tasks/{task_id}/accept")
        self.assertEqual(acc_resp.status_code, 200)
        self.assertEqual(json.loads(acc_resp.data)["task"]["status"], "ACCEPTED")

        # Worker starts cleaning
        start_resp = self.client.put(f"/api/tasks/{task_id}/start")
        self.assertEqual(start_resp.status_code, 200)
        self.assertEqual(json.loads(start_resp.data)["task"]["status"], "IN_PROGRESS")

        # Citizen checks status
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})
        chk_resp = self.client.get(f"/api/reports/{report_id}")
        self.assertEqual(json.loads(chk_resp.data)["report"]["status"], "IN_PROGRESS")

        # Worker submits proof
        self.client.post("/api/auth/switch-demo", json={"role": "worker"})
        proof_resp = self.client.post(f"/api/tasks/{task_id}/proof", data={
            "notes": "Pavement swept clean, debris bagged and transported.",
            "image_url": "/uploads/sample_cleaned_after.jpg"
        })
        self.assertEqual(proof_resp.status_code, 200)
        self.assertEqual(json.loads(proof_resp.data)["task"]["status"], "AWAITING_VERIFICATION")

        # Officer verifies
        self.client.post("/api/auth/switch-demo", json={"role": "officer"})
        verif_resp = self.client.post(f"/api/tasks/{task_id}/verify", json={
            "notes": "Verified before and after photos. Area is clean."
        })
        self.assertEqual(verif_resp.status_code, 200)

        # Citizen sees COMPLETED and provides feedback
        self.client.post("/api/auth/switch-demo", json={"role": "citizen"})
        final_resp = self.client.get(f"/api/reports/{report_id}")
        self.assertEqual(json.loads(final_resp.data)["report"]["status"], "COMPLETED")

        fb_resp = self.client.post(f"/api/reports/{report_id}/feedback", json={
            "rating": 5,
            "comment": "Superb turnaround time, spotless result!"
        })
        self.assertEqual(fb_resp.status_code, 200)

if __name__ == "__main__":
    unittest.main()
