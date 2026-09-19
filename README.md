# SmartWaste 🌿

> **"Report. Respond. Resolve. Together for a Cleaner Community."**

SmartWaste is an end-to-end civic-tech mini application connecting **Citizen → AI Assistant → Municipal Corporation → Field Worker → Municipal Verification → Citizen**. Every button, form, status transition, timeline event, AI dialogue step, and verification loop is backed by an active relational database (SQLite via SQLAlchemy) and a Python Flask backend.

---

## 🌟 The Core Lifecycle

```text
       REPORT (Citizen snaps photo & picks location)
          ↓
   AI UNDERSTANDS (Detects category, volume, obstruction)
          ↓
  CITIZEN CONFIRMS (Answers 3 questions, explicitly confirms)
          ↓
  MUNICIPAL RECEIVES (Appears in officer console)
          ↓
   MUNICIPAL REVIEWS (Marks UNDER_REVIEW / requests info)
          ↓
   WORKER ASSIGNED (Proximity & workload ranking)
          ↓
    WORKER ACCEPTS (Worker acknowledges assignment)
          ↓
   CLEANING STARTS (Worker arrives on-site: IN_PROGRESS)
          ↓
 BEFORE/AFTER PROOF (Worker uploads photo & field notes)
          ↓
MUNICIPAL VERIFICATION (Officer inspects side-by-side)
          ↓
   COMPLAINT CLOSED (Marked COMPLETED, analytics updated)
          ↓
   CITIZEN NOTIFIED (Real-time in-app notification)
          ↓
  CITIZEN FEEDBACK (Citizen rates 1-5 stars & gives comment)
```

---

## 👥 User Roles & Demo Credentials

Use the **Sticky Demo Role Switcher** at the top of the interface for 1-click role swapping:

| Role | Demo Email | Password | Name | Default Jurisdiction |
| :--- | :--- | :--- | :--- | :--- |
| **Citizen** | `citizen@demo.com` | `demo123` | Akash Kothagorla | Ward 1 - Chirala Clock Tower (Main Bazaar) |
| **Municipal Officer** | `officer@demo.com` | `demo123` | Ramesh | Ward 4 - Chirala Municipality Office (Muntha Vari Thota) |
| **Field Worker** | `worker@demo.com` | `demo123` | Ravi | Ward 1 - Chirala Clock Tower (Main Bazaar) |

*(Additional seeded demo workers: `Ramu` [Ward 3 - Perala], `Rajesh` [Ward 5 - Vadarevu Beach Road])*

---

## 🚀 Quick Start Instructions

### 1. Requirements
- Python 3.10+
- Modern Web Browser (Chrome, Edge, Firefox, Safari)

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Initialize & Seed Database
```bash
python -m backend.database.seed_data
```
*Seeds 11 realistic waste complaints across all states, 4 public collection hubs, 3 worker profiles, authentic sample images, and initial history audits.*

### 4. Run the Application
```bash
python backend/app.py
```
Open **http://127.0.0.1:5000** in your browser.

---

## 🧪 Running Automated Test Suites

```bash
# Run Golden Lifecycle & State Machine test
python tests/test_api_workflow.py

# Run Re-cleaning loop, Info-request, AI chat, and TSP Route test
python tests/test_all_features.py
```

---

## 🎯 The 24-Step Golden Demo Walkthrough

1. **Open App**: Navigate to `http://127.0.0.1:5000`. Active role defaults to **Citizen** (`Akash Kothagorla`).
2. **Report Waste**: Click `📸 REPORT WASTE` on the dashboard.
3. **Step 1 (Photo)**: Pick a sample (e.g. *Mixed Waste Heap*) or upload your own photo. Click `Continue to Location`.
4. **Step 2 (Location)**: Notice the Leaflet map with draggable pin. If nearby complaints exist within 250m, duplicate alerts appear. Click `Analyze with AI`.
5. **Step 3 (AI Analysis)**: AI inspects the photo, detects category (e.g. *Mixed Waste*), confidence score (e.g. 91%), estimated severity, and obstruction flags. Click `Yes, Continue to Review`.
6. **Step 4 (AI Follow-Up)**: The AI asks 3 rapid questions (roadway blocked, duration, odor/leakage). Review the synthesized structured complaint draft.
7. **Submit**: Click `SUBMIT TO MUNICIPAL CORPORATION 🚀`. Notice the generated Complaint ID (e.g. `SW-2026-000012`).
8. **Switch Role**: In the top demo bar, click **🏢 Municipal Officer**.
9. **Municipal Review**: The newly created report appears at the top of the table as `SUBMITTED`. Click `Review` to transition to `UNDER_REVIEW`.
10. **Worker Recommendation**: Click `Assign Worker`. The modal shows available workers ranked by distance to site and active task count. Click `Assign` for **Ravi**.
11. **Switch Role**: In the top demo bar, click **👷 Field Worker**.
12. **Worker Tasks**: Ravi sees the new task with high priority badge and location details.
13. **Accept Task**: Click `ACCEPT TASK`. Status becomes `ACCEPTED`. Citizen is notified.
14. **Start Operations**: Click `🚛 START CLEANING`. Status advances to `IN_PROGRESS`.
15. **Submit Proof**: Click `📸 SUBMIT PROOF`. Select an after-cleaning photo and enter notes (e.g., *"Sidewalk swept clean and disinfected"*). Click `SUBMIT FOR VERIFICATION`.
16. **Switch Role**: Click **🏢 Municipal Officer**.
17. **Side-by-Side Inspection**: Open the verification queue. Review the **BEFORE** and **AFTER** photographs side by side.
18. **Approve**: Click `✓ APPROVE COMPLETION`. Report status transitions to `COMPLETED`.
19. **Switch Role**: Click **👤 Citizen**.
20. **Resolution & Feedback**: Citizen sees `🎉 Complaint Resolved & Verified!`. Tap 5 stars and submit feedback comment!

---

## 🛠️ Architecture & Relational Schema

### Database Tables (SQLite + SQLAlchemy with strict foreign keys):
- **`users`**: Role-based access control (`citizen`, `officer`, `worker`), hashed passwords, contact details, assigned zones.
- **`waste_reports`**: Primary entity (`SW-YYYY-NNNNNN`), coordinates, address, category, severity, rule-based priority, status, road obstruction flag, duration, rejection & info request details.
- **`report_images`**: Images classified by `before`, `after`, and `recleaning_after`.
- **`ai_analyses`**: Confidence ratings, detected severity, road obstruction flags, engine metadata.
- **`report_questions`**: Follow-up Q&A pairs.
- **`report_history`**: Immutable audit timeline tracking every transition (`old_status`, `new_status`, timestamp, responsible user, comment).
- **`tasks`**: Worker assignment, acceptance, start, and proof submission timestamps.
- **`notifications`**: Real database notifications for status changes.
- **`feedback`**: Citizen satisfaction rating (1-5 stars) and comments.
- **`collection_points`**: Public smart collection points, capacities, fill levels, and status (`NORMAL`, `NEAR_FULL`, `OVERFLOWING`).
- **`audit_logs`**: Administrative decisions (rejections, re-cleaning, worker assignments).

---

## 🚦 Strict State Machine

Transitions are enforced at the backend service layer (`backend/services/state_machine.py`):
```text
[SUBMITTED]
    │  (Officer reviews)
    ▼
[UNDER_REVIEW] ──────► [REJECTED] (Documented reason required)
    │     ▲
    │     │ (Citizen answers question)
    ├─────┴──────────► [INFORMATION_REQUESTED]
    │  (Officer assigns worker)
    ▼
[ASSIGNED]
    │  (Worker accepts)
    ▼
[ACCEPTED]
    │  (Worker starts work)
    ▼
[IN_PROGRESS] ◄─────────────────────────┐
    │  (Worker uploads after photo)     │
    ▼                                   │ (Worker re-cleans)
[AWAITING_VERIFICATION]                 │
    │     │ (Officer rejects completion)│
    │     └──────────► [RE_CLEANING_REQUIRED]
    │  (Officer approves)
    ▼
[COMPLETED] ──► (Citizen feedback unlocked)
```

---

## 🤖 AI Capabilities & Fallback Strategy

1. **Gemini Vision Integration**:
   - Set `export GEMINI_API_KEY="your-key"` to activate Google Gemini 1.5 Flash Vision.
2. **Local Heuristic Computer Vision Engine**:
   - If no API key is provided, the local heuristic engine inspects image properties, aspect ratio, color variances, and semantic cues to yield realistic confidence scores, category detection, and severity ratings.
3. **Conversational AI Assistant**:
   - Citizen mode: Waste segregation guidelines (3-stream separation), complaint status inquiry (`SW-2026-...`), nearby bin locator.
   - Municipal mode: Daily sanitation activity summaries, overdue SLA detection, available worker queries.

---

## 📦 API Endpoints Summary

- **Auth**: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/switch-demo`, `GET /api/auth/me`
- **Reports**: `GET /api/reports`, `POST /api/reports`, `GET /api/reports/:id`, `POST /api/reports/:id/review`, `POST /api/reports/:id/request-info`, `POST /api/reports/:id/answer-info`, `POST /api/reports/:id/reject`, `POST /api/reports/:id/feedback`
- **AI**: `POST /api/ai/analyze-image`, `POST /api/ai/generate-complaint`, `POST /api/ai/assistant/chat`
- **Tasks**: `GET /api/tasks`, `GET /api/tasks/recommended-workers/:reportId`, `POST /api/tasks/assign`, `PUT /api/tasks/:id/accept`, `PUT /api/tasks/:id/start`, `POST /api/tasks/:id/proof`, `POST /api/tasks/:id/verify`, `POST /api/tasks/:id/reclean`
- **Operations & Routes**: `GET /api/analytics/overview`, `GET /api/collection-points`, `POST /api/collection-points/generate-route`
- **Notifications**: `GET /api/notifications`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`

---

## 🛡️ Security & Validation
- Passwords hashed using PBKDF2:SHA256 via `werkzeug.security`.
- Strict file validation (`jpg`, `jpeg`, `png`, `webp`) and 16 MB size limits.
- SQLite foreign key constraints strictly enforced (`PRAGMA foreign_keys = ON`).
- Privacy-preserving citizen identity redaction for field workers.
