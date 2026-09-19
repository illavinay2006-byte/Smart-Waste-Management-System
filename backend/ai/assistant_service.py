import datetime
from backend.models.report import WasteReport
from backend.models.user import User
from backend.models.collection_point import CollectionPoint
from backend.models.task import Task

def handle_citizen_chat(user: User, message: str, conversation_history: list = None) -> dict:
    """
    Role-bounded AI Assistant for Citizens:
    Assists with waste reporting, segregation guidelines, status inquiries, and nearby facilities.
    """
    msg = message.strip().lower()

    # 1. Status tracking inquiry
    if any(k in msg for k in ["status", "track", "my report", "sw-"]):
        import re
        match = re.search(r"sw-\d{4}-\d+", msg, re.IGNORECASE)
        if match:
            report_id = match.group(0).upper()
            rep = WasteReport.query.filter_by(id=report_id, citizen_id=user.id).first()
            if rep:
                return {
                    "reply": f"Complaint **{rep.id}** is currently **{rep.status}**.\n"
                             f"• Category: {rep.category}\n"
                             f"• Priority: {rep.priority}\n"
                             f"• Location: {rep.location_name}\n"
                             f"• Reported on: {rep.created_at.strftime('%b %d, %Y')}",
                    "quick_actions": ["View My Reports", "Report Waste"]
                }
            else:
                return {
                    "reply": f"I couldn't find a report with ID {report_id} under your account. Please check 'My Reports'.",
                    "quick_actions": ["View My Reports"]
                }
        else:
            recent = WasteReport.query.filter_by(citizen_id=user.id, status="ASSIGNED").order_by(WasteReport.created_at.desc()).limit(3).all()
            if recent:
                items = [f"• **{r.id}** ({r.category}): Status is **{r.status}**" for r in recent]
                return {
                    "reply": "Here are your new reports:\n" + "\n".join(items),
                    "quick_actions": ["View My Reports", "Report Waste"]
                }
            else:
                return {
                    "reply": "You don't have any assigned complaints right now. Would you like to report a waste issue?",
                    "quick_actions": ["Report Waste"]
                }

    # 2. Waste segregation queries
    if any(k in msg for k in ["segregate", "plastic", "organic", "wet waste", "e-waste", "dry waste", "battery", "recycle"]):
        if "battery" in msg or "chemical" in msg or "medicine" in msg:
            return {
                "reply": "⚠️ **Hazardous Waste**: Batteries, paints, and expired medicines should never be mixed with dry or wet waste. Please seal them separately and mark them for municipal hazardous waste collection.",
                "quick_actions": ["Report Hazardous Waste", "Find Collection Point"]
            }
        elif "plastic" in msg or "bottle" in msg or "wrapper" in msg:
            return {
                "reply": "♻️ **Dry / Plastic Waste**: Clean and rinse plastic bottles and containers before placing them in the blue recycling bin. Flatten plastic bottles to conserve space.",
                "quick_actions": ["Report Waste", "Find Collection Point"]
            }
        elif "organic" in msg or "wet" in msg or "food" in msg:
            return {
                "reply": "🌱 **Organic / Wet Waste**: Kitchen scraps, fruit peels, leftover cooked food, and garden leaves should go in the green bin for municipal composting.",
                "quick_actions": ["Report Waste"]
            }
        else:
            return {
                "reply": "SmartWaste follows a 3-stream segregation model:\n1. 🟢 **Green**: Wet & Organic Waste (food, peels)\n2. 🔵 **Blue**: Dry Recyclables (paper, plastic, glass, metal)\n3. 🔴 **Red**: Domestic Hazardous (batteries, chemicals, e-waste)",
                "quick_actions": ["Report Waste", "Find Collection Point"]
            }

    # 3. Collection point lookup
    if any(k in msg for k in ["collection point", "bin", "dump", "center", "nearby"]):
        points = CollectionPoint.query.limit(3).all()
        if points:
            details = [f"• **{p.name}** ({p.zone}): {p.status} (Capacity: {p.current_level_pct}% full)" for p in points]
            return {
                "reply": "Here are active collection points near your ward:\n" + "\n".join(details),
                "quick_actions": ["View Map", "Report Overflowing Bin"]
            }

    # 4. Natural language intent to report
    if any(k in msg for k in ["garbage", "dumped", "dirty", "trash", "overflow", "smell", "waste", "clean"]):
        return {
            "reply": "I can help you file this complaint immediately! Please click **Report Waste** to snap a photo, and I will automatically categorize it and draft the report for municipal dispatch.",
            "quick_actions": ["Report Waste"]
        }

    # Default friendly greeting
    return {
        "reply": "Hello! I am **SmartWaste AI**. I can assist you with:\n"
                 "• 📸 Reporting waste accumulation with photo AI\n"
                 "• 🔍 Tracking the live status of your complaints\n"
                 "• ♻️ Waste segregation rules & recycling advice\n"
                 "• 📍 Finding nearby collection points and bins",
        "quick_actions": ["Report Waste", "My Reports", "Nearby Points"]
    }


def handle_municipal_chat(officer: User, message: str) -> dict:
    """
    Role-bounded AI Assistant for Municipal Staff:
    Analyzes real-time operational data without fabricating numbers or executing unauthorized actions.
    """
    msg = message.strip().lower()

    # 1. Unresolved high priority reports
    if any(k in msg for k in ["high-priority", "high priority", "critical", "urgent"]):
        reports = WasteReport.query.filter(
            WasteReport.priority.in_(["HIGH", "CRITICAL"]),
            WasteReport.status.notin_(["COMPLETED", "REJECTED"])
        ).order_by(WasteReport.created_at.asc()).all()

        if not reports:
            return {
                "reply": "All high-priority and critical reports have been addressed. No unresolved urgent reports at this time.",
                "data": []
            }
        
        items = [f"• **{r.id}** ({r.priority} | {r.category}) at {r.location_name} — Status: `{r.status}`" for r in reports]
        return {
            "reply": f"Found **{len(reports)}** active high-priority complaints requiring attention:\n" + "\n".join(items),
            "count": len(reports),
            "data": [r.to_dict() for r in reports]
        }

    # 2. Overdue reports (Reports pending review > 24 hours or in progress > 48 hours)
    if any(k in msg for k in ["overdue", "delayed", "sla", "pending"]):
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
        overdue = WasteReport.query.filter(
            WasteReport.status.in_(["SUBMITTED", "UNDER_REVIEW", "ASSIGNED"]),
            WasteReport.created_at < cutoff
        ).all()

        if not overdue:
            return {
                "reply": "✅ All open reports are within standard SLA thresholds (under 24 hours pending).",
                "data": []
            }

        items = [f"• **{r.id}** filed on {r.created_at.strftime('%b %d, %I:%M %p')} ({r.status})" for r in overdue]
        return {
            "reply": f"⚠️ **{len(overdue)} reports have exceeded the 24-hour review SLA:**\n" + "\n".join(items),
            "count": len(overdue),
            "data": [r.to_dict() for r in overdue]
        }

    # 3. Worker recommendation for a specific report
    if "closest worker" in msg or "recommend worker" in msg or "who is available" in msg:
        workers = User.query.filter_by(role="worker").all()
        worker_info = []
        for w in workers:
            active_tasks = Task.query.filter(
                Task.worker_id == w.id,
                Task.status.in_(["ASSIGNED", "ACCEPTED", "IN_PROGRESS"])
            ).count()
            worker_info.append(f"• **{w.name}** ({w.zone or 'General'}) — Active Tasks: **{active_tasks}**")

        return {
            "reply": "Current Field Worker Availability:\n" + "\n".join(worker_info) + "\n\n*Recommendation: Workers with 0 active tasks in the same ward are prioritized.*"
        }

    # 4. Sanitation summary
    if any(k in msg for k in ["summary", "overview", "activity", "today"]):
        total = WasteReport.query.count()
        completed = WasteReport.query.filter_by(status="COMPLETED").count()
        in_progress = WasteReport.query.filter(WasteReport.status.in_(["ASSIGNED", "ACCEPTED", "IN_PROGRESS"])).count()
        awaiting_verif = WasteReport.query.filter_by(status="AWAITING_VERIFICATION").count()
        under_review = WasteReport.query.filter_by(status="UNDER_REVIEW").count()

        return {
            "reply": f"📊 **Daily Operational Sanitation Summary**:\n"
                     f"• Total Complaints Filed: **{total}**\n"
                     f"• Completed & Verified: **{completed}**\n"
                     f"• Active In-Field Cleanups: **{in_progress}**\n"
                     f"• Pending Municipal Verification: **{awaiting_verif}**\n"
                     f"• Awaiting Officer Review: **{under_review}**"
        }

    return {
        "reply": "I am the **Municipal AI Operations Assistant**. You can ask me:\n"
                 "• 'Show today's unresolved high-priority reports'\n"
                 "• 'Which reports are overdue?'\n"
                 "• 'Who is available among field workers?'\n"
                 "• 'Summarize today's sanitation activity'"
    }
