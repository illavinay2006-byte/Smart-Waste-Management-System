import os
import json
import datetime
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

from backend.database.db import db
from backend.models.user import User
from backend.models.report import WasteReport, ReportImage, AIAnalysis, ReportQuestion, ReportHistory, Feedback
from backend.models.task import Task
from backend.models.notification import Notification
from backend.models.collection_point import CollectionPoint
from backend.models.audit_log import AuditLog
from backend.models.announcement import Announcement

def create_sample_images(upload_dir: Path):
    """Generates authentic JPEG images for demo before/after comparisons"""
    upload_dir.mkdir(parents=True, exist_ok=True)

    samples = [
        ("sample_mixed_waste.jpg", (130, 95, 60), "SMARTWASTE EVIDENCE\nGarbage Accumulation\nWard 5 Roadside\nStatus: UNCLEANED"),
        ("sample_cleaned_after.jpg", (45, 125, 75), "SMARTWASTE VERIFICATION PROOF\nArea Cleaned & Sanitized\nWard 5 Roadside\nStatus: RESOLVED"),
        ("sample_plastic.jpg", (70, 110, 150), "SMARTWASTE EVIDENCE\nPlastic Bottle & Wrapper Pile\nMetro Station Walkway"),
        ("sample_organic.jpg", (95, 120, 60), "SMARTWASTE EVIDENCE\nWet Organic Food Waste\nMarket Gate 2"),
        ("sample_ewaste.jpg", (110, 80, 120), "SMARTWASTE EVIDENCE\nDiscarded Electronics & Wires\nIndustrial Zone B"),
        ("sample_cleaned_market.jpg", (40, 130, 80), "SMARTWASTE VERIFICATION PROOF\nMarket Gate 2 Cleared\nInspected & Verified")
    ]

    for fname, bg_color, text in samples:
        fpath = upload_dir / fname
        if not fpath.exists():
            img = Image.new("RGB", (640, 480), color=bg_color)
            draw = ImageDraw.Draw(img)
            
            # Draw realistic street/ground shapes
            draw.rectangle([0, 360, 640, 480], fill=(50, 50, 50)) # Asphalt pavement
            draw.rectangle([0, 340, 640, 360], fill=(180, 180, 170)) # Curb

            # Draw text overlay
            lines = text.split("\n")
            y = 40
            for line in lines:
                draw.text((30, y), line, fill=(255, 255, 255))
                y += 30

            # Watermark / timestamp
            draw.text((30, 430), "SmartWaste Municipal Verification System • Certified Timestamp", fill=(200, 200, 200))
            img.save(fpath, "JPEG", quality=85)


def seed_database(app):
    with app.app_context():
        # Clear existing tables
        db.drop_all()
        db.create_all()

        upload_dir = Path(app.config["UPLOAD_FOLDER"])
        create_sample_images(upload_dir)

        # 1. Users
        citizen = User(
            name="Akash Kothagorla",
            email="citizen@demo.com",
            role="citizen",
            phone="+91 93983 91677",
            zone="Ward 1 - Chirala Clock Tower (Main Bazaar)",
            avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
            points=240,
            rank_tier="Civic Champion",
            badges=json.dumps(["🌱 First Step", "🌿 Cleanliness Pioneer", "🛡️ Neighborhood Protector"])
        )
        citizen.set_password("demo123")

        officer = User(
            name="Ramesh",
            email="officer@demo.com",
            role="officer",
            phone="+91 98765 11223",
            zone="Ward 4 - Chirala Municipality Office (Muntha Vari Thota)",
            avatar_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80"
        )
        officer.set_password("demo123")

        worker1 = User(
            name="Ravi",
            email="worker@demo.com",
            role="worker",
            phone="+91 98765 33445",
            zone="Ward 1 - Chirala Clock Tower (Main Bazaar)",
            latitude=15.8252,
            longitude=80.3530,
            avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
        )
        worker1.set_password("demo123")

        worker2 = User(
            name="Ramu",
            email="ramu.worker@demo.com",
            role="worker",
            phone="+91 98765 55667",
            zone="Ward 3 - Chirala Handloom Weavers Colony (Perala)",
            latitude=15.8205,
            longitude=80.3605,
            avatar_url="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
        )
        worker2.set_password("demo123")

        worker3 = User(
            name="Rajesh",
            email="rajesh.worker@demo.com",
            role="worker",
            phone="+91 98765 77889",
            zone="Ward 5 - Chirala Vadarevu Beach Road",
            latitude=15.8080,
            longitude=80.3810,
            avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80"
        )
        worker3.set_password("demo123")

        worker4 = User(
            name="Suresh",
            email="suresh.worker@demo.com",
            role="worker",
            phone="+91 98765 99001",
            zone="Ward 2 - Chirala Railway Station Road (Kothapeta)",
            latitude=None,
            longitude=None,
            avatar_url="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=120&q=80"
        )
        worker4.set_password("demo123")

        db.session.add_all([citizen, officer, worker1, worker2, worker3, worker4])
        db.session.commit()

        # 2. Collection Points in Chirala
        points = [
            CollectionPoint(
                name="Ward 1 Chirala Clock Tower Community Bin",
                address="Gadiyara Sthambham & Main Bazaar, Chirala",
                latitude=15.8246,
                longitude=80.3522,
                categories="Organic, Plastic, Paper, Metal",
                capacity_kg=1500.0,
                current_level_pct=45,
                status="NORMAL",
                zone="Ward 1 - Chirala Clock Tower (Main Bazaar)"
            ),
            CollectionPoint(
                name="Ward 2 Railway Station Road Segregation Hub",
                address="Near Chirala Railway Station, Kothapeta, Chirala",
                latitude=15.8285,
                longitude=80.3550,
                categories="Organic / Wet Waste, Paper",
                capacity_kg=2500.0,
                current_level_pct=92,
                status="OVERFLOWING",
                zone="Ward 2 - Chirala Railway Station Road (Kothapeta)"
            ),
            CollectionPoint(
                name="Ward 3 Perala Handloom Weavers Drop-off",
                address="Weavers Colony Main Road, Perala, Chirala",
                latitude=15.8190,
                longitude=80.3620,
                categories="Plastic, E-Waste, Textile Waste",
                capacity_kg=1800.0,
                current_level_pct=72,
                status="NEAR_FULL",
                zone="Ward 3 - Chirala Handloom Weavers Colony (Perala)"
            ),
            CollectionPoint(
                name="Ward 4 Chirala Municipality Central Eco-Point",
                address="Muntha Vari Thota, Municipality Office Compound, Chirala",
                latitude=15.8220,
                longitude=80.3480,
                categories="Paper, Plastic, Mixed",
                capacity_kg=2000.0,
                current_level_pct=30,
                status="NORMAL",
                zone="Ward 4 - Chirala Municipality Office (Muntha Vari Thota)"
            ),
            CollectionPoint(
                name="Ward 5 Vadarevu Beach Road Marine Eco-Bin",
                address="Vadarevu Beach Road Fisherman Colony, Chirala",
                latitude=15.8050,
                longitude=80.3850,
                categories="Plastic, Glass, Metal, Organic",
                capacity_kg=1600.0,
                current_level_pct=55,
                status="NORMAL",
                zone="Ward 5 - Chirala Vadarevu Beach Road (Fisherman Colony)"
            )
        ]
        db.session.add_all(points)
        db.session.commit()

        # 3. Reports across states in Chirala Premises
        now = datetime.datetime.utcnow()

        # Report 1: SUBMITTED
        r1 = WasteReport(
            id="SW-2026-001201",
            citizen_id=citizen.id,
            category="Plastic",
            severity="Medium",
            priority="MEDIUM",
            priority_reasons=json.dumps(["Accumulation along pedestrian path", "Plastic packaging"]),
            status="SUBMITTED",
            ward="Ward 1 - Chirala Clock Tower (Main Bazaar)",
            latitude=15.8246,
            longitude=80.3522,
            location_name="Chirala Clock Tower, Gadiyara Sthambham Walkway",
            description="Discarded plastic bottles, food wrappers and bags accumulating along the Clock Tower market curb.",
            ai_summary="Computer vision confirms high density of single-use plastic bottles and polythene packaging.",
            observed_duration="1–2 days",
            road_obstruction=False,
            created_at=now - datetime.timedelta(hours=2)
        )

        # Report 2: UNDER_REVIEW
        r2 = WasteReport(
            id="SW-2026-001202",
            citizen_id=citizen.id,
            category="Organic / Wet Waste",
            severity="High",
            priority="HIGH",
            priority_reasons=json.dumps(["Decomposing wet waste poses odor & disease risk", "Near public market"]),
            status="UNDER_REVIEW",
            ward="Ward 2 - Chirala Railway Station Road (Kothapeta)",
            latitude=15.8285,
            longitude=80.3548,
            location_name="Kothapeta Railway Station Road Commercial Lane",
            description="Large heap of rotten vegetable and market waste discarded outside vendor stalls.",
            ai_summary="High volume organic wet waste identified. Odor risk and stray cattle scavenging detected.",
            observed_duration="3–7 days",
            road_obstruction=True,
            created_at=now - datetime.timedelta(hours=4)
        )

        # Report 3: INFORMATION_REQUESTED
        r3 = WasteReport(
            id="SW-2026-001203",
            citizen_id=citizen.id,
            category="Mixed Waste",
            severity="Medium",
            priority="MEDIUM",
            priority_reasons=json.dumps(["Standard priority based on category and baseline review"]),
            status="INFORMATION_REQUESTED",
            ward="Ward 3 - Chirala Handloom Weavers Colony (Perala)",
            latitude=15.8195,
            longitude=80.3615,
            location_name="Perala Handloom Center Cross Lane 4",
            description="Construction debris and textile bags dumped near electrical transformer.",
            ai_summary="Mixed debris requiring clarification on exact lane access for municipal collection van.",
            observed_duration="1–2 days",
            road_obstruction=False,
            info_request_question="Please provide landmark or specify if this is behind the weaver cooperative building.",
            created_at=now - datetime.timedelta(hours=6)
        )

        # Report 4: UNDER_REVIEW
        r4 = WasteReport(
            id="SW-2026-001204",
            citizen_id=citizen.id,
            category="Mixed Waste",
            severity="High",
            priority="HIGH",
            priority_reasons=json.dumps(["Road obstruction reported", "High volume / large accumulation detected"]),
            status="UNDER_REVIEW",
            ward="Ward 4 - Chirala Municipality Office (Muntha Vari Thota)",
            latitude=15.8225,
            longitude=80.3475,
            location_name="Muntha Vari Thota Municipal Office Avenue",
            description="Community dustbin overflowing with mixed waste spilling onto main municipal road.",
            ai_summary="Severe bin overflow spilling into pedestrian and two-wheeler traffic lane.",
            observed_duration="3–7 days",
            road_obstruction=True,
            created_at=now - datetime.timedelta(hours=8)
        )

        # Report 5: ACCEPTED
        r5 = WasteReport(
            id="SW-2026-001205",
            citizen_id=citizen.id,
            category="Hazardous Waste",
            severity="Critical",
            priority="CRITICAL",
            priority_reasons=json.dumps(["Reported severity is Critical", "Hazardous materials present immediate health hazard"]),
            status="ACCEPTED",
            ward="Ward 5 - Chirala Vadarevu Beach Road (Fisherman Colony)",
            latitude=15.8055,
            longitude=80.3845,
            location_name="Vadarevu Beach Road Fisherman Colony Junction",
            description="Discarded chemical bottles, glass shards and contaminated packaging near public beach walkway.",
            ai_summary="Critical medical/chemical waste hazardous to public health and coastal safety.",
            observed_duration="Less than a day",
            road_obstruction=False,
            created_at=now - datetime.timedelta(hours=10)
        )

        # Report 6: IN_PROGRESS
        r6 = WasteReport(
            id="SW-2026-001206",
            citizen_id=citizen.id,
            category="Mixed Waste",
            severity="High",
            priority="HIGH",
            priority_reasons=json.dumps(["Road obstruction reported", "Accumulated for 3 to 7 days"]),
            status="IN_PROGRESS",
            ward="Ward 6 - Chirala RTC Bus Complex & Bypass Junction",
            latitude=15.8320,
            longitude=80.3450,
            location_name="Chirala RTC Bus Complex Bypass Road",
            description="Illegal dumping near bus terminal sidewalk causing heavy stench and blocking auto stands.",
            ai_summary="Mixed waste accumulation obstructing public bus passenger path.",
            observed_duration="3–7 days",
            road_obstruction=True,
            created_at=now - datetime.timedelta(hours=12)
        )

        # Report 7: AWAITING_VERIFICATION
        r7 = WasteReport(
            id="SW-2026-001207",
            citizen_id=citizen.id,
            category="E-Waste",
            severity="High",
            priority="HIGH",
            priority_reasons=json.dumps(["E-waste requires specialized handling", "High volume"]),
            status="AWAITING_VERIFICATION",
            ward="Ward 7 - Chirala Vetapalem Road (Ramapuram Beach Area)",
            latitude=15.8150,
            longitude=80.3700,
            location_name="Vetapalem Road, Ramapuram Beach Service Lane",
            description="Broken computer monitors, copper wiring and batteries abandoned.",
            ai_summary="Electronic waste accumulation cleared by field worker; awaiting municipal photo verification.",
            observed_duration="More than a week",
            road_obstruction=False,
            created_at=now - datetime.timedelta(hours=14)
        )

        # Report 8: RE_CLEANING_REQUIRED
        r8 = WasteReport(
            id="SW-2026-001208",
            citizen_id=citizen.id,
            category="Organic / Wet Waste",
            severity="Medium",
            priority="MEDIUM",
            priority_reasons=json.dumps(["Decomposing wet waste poses odor & disease risk"]),
            status="RE_CLEANING_REQUIRED",
            ward="Ward 8 - Chirala Ipurupalem & Gandhi Nagar",
            latitude=15.8380,
            longitude=80.3380,
            location_name="Ipurupalem Gandhi Nagar Main Street",
            description="Stray leaves, food containers and rotting waste.",
            ai_summary="Initial cleanup was incomplete; officer flagged leftover residue along eastern wall.",
            observed_duration="1–2 days",
            road_obstruction=False,
            created_at=now - datetime.timedelta(hours=16)
        )

        # Report 9: COMPLETED
        r9 = WasteReport(
            id="SW-2026-001209",
            citizen_id=citizen.id,
            category="Mixed Waste",
            severity="High",
            priority="HIGH",
            priority_reasons=json.dumps(["Road obstruction reported", "High volume / large accumulation detected"]),
            status="COMPLETED",
            ward="Ward 9 - Chirala Trunk Road & St. Mark High School Road",
            latitude=15.8260,
            longitude=80.3510,
            location_name="Chirala Trunk Road near St. Mark High School",
            description="Overflowing dump completely blocking school pedestrian pavement.",
            ai_summary="Cleaned thoroughly by worker Ravi and certified by Municipal Officer Ramesh.",
            observed_duration="3–7 days",
            road_obstruction=True,
            created_at=now - datetime.timedelta(days=1),
            completed_at=now - datetime.timedelta(hours=5)
        )

        # Report 10: COMPLETED
        r10 = WasteReport(
            id="SW-2026-001210",
            citizen_id=citizen.id,
            category="Plastic",
            severity="Low",
            priority="LOW",
            priority_reasons=json.dumps(["Standard priority based on category and baseline review"]),
            status="COMPLETED",
            ward="Ward 11 - Chirala Perala Market & Jandrapeta",
            latitude=15.8120,
            longitude=80.3650,
            location_name="Jandrapeta Market Road Junction",
            description="Littered plastic bottles and food packaging in public area.",
            ai_summary="Litter cleared and segregated for recycling.",
            observed_duration="1–2 days",
            road_obstruction=False,
            created_at=now - datetime.timedelta(days=2),
            completed_at=now - datetime.timedelta(days=1)
        )

        # Report 11: REJECTED
        r11 = WasteReport(
            id="SW-2026-001211",
            citizen_id=citizen.id,
            category="Mixed Waste",
            severity="Low",
            priority="LOW",
            priority_reasons=json.dumps(["Standard priority based on category and baseline review"]),
            status="REJECTED",
            ward="Ward 10 - Chirala Chennupati Nagar & Pandillapalli",
            latitude=15.8290,
            longitude=80.3580,
            location_name="Pandillapalli Private Apartment Compound",
            description="Garbage bags left in private apartment parking.",
            ai_summary="Rejected by municipal inspector.",
            observed_duration="1–2 days",
            road_obstruction=False,
            rejection_reason="Private property interior jurisdiction. Chirala Municipal sanitation covers public roads, streets, and community points only.",
            created_at=now - datetime.timedelta(days=1)
        )

        reports_list = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11]
        db.session.add_all(reports_list)
        db.session.flush()

        # Attach Images
        db.session.add(ReportImage(report_id=r1.id, image_type="before", file_path="/uploads/sample_plastic.jpg", uploaded_by=citizen.id))
        db.session.add(ReportImage(report_id=r2.id, image_type="before", file_path="/uploads/sample_organic.jpg", uploaded_by=citizen.id))
        db.session.add(ReportImage(report_id=r3.id, image_type="before", file_path="/uploads/sample_mixed_waste.jpg", uploaded_by=citizen.id))
        db.session.add(ReportImage(report_id=r4.id, image_type="before", file_path="/uploads/sample_mixed_waste.jpg", uploaded_by=citizen.id))
        db.session.add(ReportImage(report_id=r5.id, image_type="before", file_path="/uploads/sample_mixed_waste.jpg", uploaded_by=citizen.id))
        db.session.add(ReportImage(report_id=r6.id, image_type="before", file_path="/uploads/sample_mixed_waste.jpg", uploaded_by=citizen.id))
        
        # r7: before + after
        db.session.add(ReportImage(report_id=r7.id, image_type="before", file_path="/uploads/sample_ewaste.jpg", uploaded_by=citizen.id))
        db.session.add(ReportImage(report_id=r7.id, image_type="after", file_path="/uploads/sample_cleaned_after.jpg", uploaded_by=worker1.id))
        
        # r8: before
        db.session.add(ReportImage(report_id=r8.id, image_type="before", file_path="/uploads/sample_organic.jpg", uploaded_by=citizen.id))
        
        # r9: before + after (completed)
        db.session.add(ReportImage(report_id=r9.id, image_type="before", file_path="/uploads/sample_mixed_waste.jpg", uploaded_by=citizen.id))
        db.session.add(ReportImage(report_id=r9.id, image_type="after", file_path="/uploads/sample_cleaned_after.jpg", uploaded_by=worker1.id))

        # r10: before + after (completed)
        db.session.add(ReportImage(report_id=r10.id, image_type="before", file_path="/uploads/sample_plastic.jpg", uploaded_by=citizen.id))
        db.session.add(ReportImage(report_id=r10.id, image_type="after", file_path="/uploads/sample_cleaned_after.jpg", uploaded_by=worker2.id))

        # Attach AI Analysis for each
        for rep in reports_list:
            db.session.add(AIAnalysis(
                report_id=rep.id,
                detected_category=rep.category,
                confidence=0.91,
                detected_severity=rep.severity,
                road_obstruction=rep.road_obstruction,
                environmental_concern=(rep.severity in ["High", "Critical"]),
                raw_response=json.dumps({"summary": rep.ai_summary, "confidence": 0.91})
            ))

        # Tasks for active / completed reports
        t5 = Task(report_id=r5.id, worker_id=worker1.id, assigned_by=officer.id, status="ACCEPTED", assigned_at=now - datetime.timedelta(hours=9), accepted_at=now - datetime.timedelta(hours=8))
        t6 = Task(report_id=r6.id, worker_id=worker3.id, assigned_by=officer.id, status="IN_PROGRESS", assigned_at=now - datetime.timedelta(hours=11), accepted_at=now - datetime.timedelta(hours=10), started_at=now - datetime.timedelta(hours=9))
        t7 = Task(report_id=r7.id, worker_id=worker1.id, assigned_by=officer.id, status="AWAITING_VERIFICATION", assigned_at=now - datetime.timedelta(hours=13), accepted_at=now - datetime.timedelta(hours=12), started_at=now - datetime.timedelta(hours=11), submitted_proof_at=now - datetime.timedelta(hours=2), worker_notes="Collected all discarded electronics using protective gear.")
        t8 = Task(report_id=r8.id, worker_id=worker3.id, assigned_by=officer.id, status="RE_CLEANING_REQUIRED", assigned_at=now - datetime.timedelta(hours=15), accepted_at=now - datetime.timedelta(hours=14), started_at=now - datetime.timedelta(hours=13), recleaning_notes="Waste remains near the eastern wall.")
        t9 = Task(report_id=r9.id, worker_id=worker1.id, assigned_by=officer.id, status="COMPLETED", assigned_at=now - datetime.timedelta(days=1), accepted_at=now - datetime.timedelta(hours=20), started_at=now - datetime.timedelta(hours=18), submitted_proof_at=now - datetime.timedelta(hours=8), completed_at=now - datetime.timedelta(hours=5), worker_notes="Area completely swept and disinfected.")
        t10 = Task(report_id=r10.id, worker_id=worker2.id, assigned_by=officer.id, status="COMPLETED", assigned_at=now - datetime.timedelta(days=2), accepted_at=now - datetime.timedelta(days=1, hours=20), started_at=now - datetime.timedelta(days=1, hours=18), submitted_proof_at=now - datetime.timedelta(days=1, hours=10), completed_at=now - datetime.timedelta(days=1, hours=8), worker_notes="All recyclable bottles segregated and packed.")

        db.session.add_all([t5, t6, t7, t8, t9, t10])

        # Add history entries for authentic timeline demonstrations
        for rep in reports_list:
            db.session.add(ReportHistory(
                report_id=rep.id,
                old_status=None,
                new_status="SUBMITTED",
                user_id=rep.citizen_id,
                comment="Complaint registered through Chirala SmartWaste Citizen Portal",
                timestamp=rep.created_at
            ))

        # r9 completed timeline
        db.session.add(ReportHistory(report_id=r9.id, old_status="SUBMITTED", new_status="UNDER_REVIEW", user_id=officer.id, comment="Officer Ramesh reviewed evidence", timestamp=now - datetime.timedelta(hours=23)))
        db.session.add(ReportHistory(report_id=r9.id, old_status="UNDER_REVIEW", new_status="ASSIGNED", user_id=officer.id, comment="Assigned to Field Worker Ravi", timestamp=now - datetime.timedelta(hours=21)))
        db.session.add(ReportHistory(report_id=r9.id, old_status="ASSIGNED", new_status="ACCEPTED", user_id=worker1.id, comment="Worker Ravi accepted task", timestamp=now - datetime.timedelta(hours=20)))
        db.session.add(ReportHistory(report_id=r9.id, old_status="ACCEPTED", new_status="IN_PROGRESS", user_id=worker1.id, comment="Worker reached location in Ward 9 and started clearing", timestamp=now - datetime.timedelta(hours=18)))
        db.session.add(ReportHistory(report_id=r9.id, old_status="IN_PROGRESS", new_status="AWAITING_VERIFICATION", user_id=worker1.id, comment="Cleanup finished; after-cleaning proof uploaded", timestamp=now - datetime.timedelta(hours=8)))
        db.session.add(ReportHistory(report_id=r9.id, old_status="AWAITING_VERIFICATION", new_status="COMPLETED", user_id=officer.id, comment="Municipal Officer Ramesh inspected proof and approved completion", timestamp=now - datetime.timedelta(hours=5)))

        # Feedback for completed report
        db.session.add(Feedback(
            report_id=r9.id,
            citizen_id=citizen.id,
            rating=5,
            comment="Incredible response time! Trunk Road was completely cleared within hours. Thank you Chirala Municipality!"
        ))

        # Announcements in Chirala
        db.session.add(Announcement(
            title="🌿 Swachh Chirala Special Cleanliness Drive",
            content="Chirala Municipality is running an intensified cleanliness drive across Clock Tower, Perala, and Kothapeta markets. Please segregate wet and dry waste before 8:00 AM.",
            priority="HIGH",
            target_ward="ALL",
            author_id=officer.id,
            is_active=True
        ))
        db.session.add(Announcement(
            title="🌊 Vadarevu Coastal Protection & Plastic Cleanup",
            content="Special beach cleaning camp organized this weekend at Vadarevu Beach Road. Volunteers and eco-scouts are invited to participate.",
            priority="NORMAL",
            target_ward="Ward 5 - Chirala Vadarevu Beach Road (Fisherman Colony)",
            author_id=officer.id,
            is_active=True
        ))

        # Audit logs
        db.session.add(AuditLog(
            user_id=officer.id,
            action="VERIFICATION_APPROVED",
            entity_type="waste_report",
            entity_id=r9.id,
            details="Approved completion proof for Trunk Road cleanup after inspecting before & after photos",
            timestamp=now - datetime.timedelta(hours=5)
        ))
        db.session.add(AuditLog(
            user_id=officer.id,
            action="REPORT_REJECTED",
            entity_type="waste_report",
            entity_id=r11.id,
            details="Rejected: Private property jurisdiction in Pandillapalli",
            timestamp=now - datetime.timedelta(days=1)
        ))

        # Initial Notifications
        db.session.add(Notification(
            user_id=citizen.id,
            report_id=r9.id,
            title="🎉 Complaint Resolved",
            message=f"Your complaint #{r9.id} on Trunk Road has been cleaned and verified by Chirala Municipality!",
            type="success"
        ))
        db.session.add(Notification(
            user_id=citizen.id,
            report_id=r3.id,
            title="Information Requested",
            message=f"Officer Ramesh requested clarification for #{r3.id} in Perala",
            type="warning"
        ))
        db.session.add(Notification(
            user_id=worker1.id,
            report_id=r4.id,
            title="New Task Assigned",
            message=f"Task #{r4.id} assigned to you in Ward 4 (Muntha Vari Thota)",
            type="info"
        ))

        db.session.commit()
        print(">> Database successfully initialized and seeded with Chirala municipal data!")

if __name__ == "__main__":
    from backend.app import create_app
    app = create_app()
    seed_database(app)

