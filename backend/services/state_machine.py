import datetime
from backend.database.db import db
from backend.models.report import WasteReport, ReportHistory
from backend.models.notification import Notification

ALLOWED_TRANSITIONS = {
    "SUBMITTED": {"UNDER_REVIEW"},
    "UNDER_REVIEW": {"ASSIGNED", "INFORMATION_REQUESTED", "REJECTED"},
    "INFORMATION_REQUESTED": {"UNDER_REVIEW"},
    "ASSIGNED": {"ACCEPTED"},
    "ACCEPTED": {"IN_PROGRESS"},
    "IN_PROGRESS": {"AWAITING_VERIFICATION"},
    "AWAITING_VERIFICATION": {"COMPLETED", "RE_CLEANING_REQUIRED"},
    "RE_CLEANING_REQUIRED": {"IN_PROGRESS"},
    "REJECTED": set(),
    "COMPLETED": set()
}

class StateMachineError(Exception):
    pass

def can_transition(current_status: str, target_status: str) -> bool:
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    return target_status in allowed

def transition_report(report: WasteReport, new_status: str, user=None, comment: str = None) -> WasteReport:
    current_status = report.status
    if not can_transition(current_status, new_status):
        raise StateMachineError(
            f"Illegal state transition from '{current_status}' to '{new_status}'. "
            f"Allowed next states: {list(ALLOWED_TRANSITIONS.get(current_status, []))}"
        )

    old_status = current_status
    report.status = new_status
    report.updated_at = datetime.datetime.utcnow()

    if new_status == "COMPLETED":
        report.completed_at = datetime.datetime.utcnow()
        if report.task:
            report.task.completed_at = datetime.datetime.utcnow()
            report.task.status = "COMPLETED"
        if report.citizen:
            report.citizen.award_points(50, "Complaint Cleaned & Verified")

    history_entry = ReportHistory(
        report_id=report.id,
        old_status=old_status,
        new_status=new_status,
        user_id=user.id if user else None,
        comment=comment or f"Status changed to {new_status}"
    )
    db.session.add(history_entry)

    notify_on_transition(report, old_status, new_status, user, comment)

    db.session.commit()
    return report

def notify_on_transition(report: WasteReport, old_status: str, new_status: str, user=None, comment: str = None):
    if new_status == "UNDER_REVIEW":
        db.session.add(Notification(
            user_id=report.citizen_id,
            report_id=report.id,
            title="Report Under Review",
            message=f"Municipal officers are reviewing your complaint #{report.id}.",
            type="info"
        ))
    elif new_status == "INFORMATION_REQUESTED":
        db.session.add(Notification(
            user_id=report.citizen_id,
            report_id=report.id,
            title="More Information Needed",
            message=f"The municipal officer requested details on #{report.id}: {comment or 'Please check your report.'}",
            type="warning"
        ))
    elif new_status == "REJECTED":
        db.session.add(Notification(
            user_id=report.citizen_id,
            report_id=report.id,
            title="Complaint Rejected",
            message=f"Your complaint #{report.id} was rejected. Reason: {comment or 'No reason provided.'}",
            type="danger"
        ))
    elif new_status == "ASSIGNED":
        worker_name = report.task.worker.name if report.task and report.task.worker else "Field Team"
        db.session.add(Notification(
            user_id=report.citizen_id,
            report_id=report.id,
            title="Sanitation Worker Assigned",
            message=f"Worker {worker_name} has been assigned to resolve #{report.id}.",
            type="info"
        ))
    elif new_status == "ACCEPTED":
        db.session.add(Notification(
            user_id=report.citizen_id,
            report_id=report.id,
            title="Worker Accepted Task",
            message=f"The sanitation worker accepted your complaint #{report.id} and is preparing to deploy.",
            type="info"
        ))
    elif new_status == "IN_PROGRESS":
        db.session.add(Notification(
            user_id=report.citizen_id,
            report_id=report.id,
            title="Cleaning Started",
            message=f"Cleaning is actively in progress for your reported issue #{report.id}.",
            type="info"
        ))
    elif new_status == "AWAITING_VERIFICATION":
        from backend.models.user import User
        officers = User.query.filter_by(role="officer").all()
        for officer in officers:
            db.session.add(Notification(
                user_id=officer.id,
                report_id=report.id,
                title="Cleaning Verification Required",
                message=f"Worker submitted completion proof for #{report.id}. Verification required.",
                type="warning"
            ))
    elif new_status == "RE_CLEANING_REQUIRED":
        if report.task and report.task.worker_id:
            db.session.add(Notification(
                user_id=report.task.worker_id,
                report_id=report.id,
                title="Re-Cleaning Required",
                message=f"Officer requested re-cleaning for #{report.id}: {comment or 'Quality inspection failed.'}",
                type="danger"
            ))
    elif new_status == "COMPLETED":
        db.session.add(Notification(
            user_id=report.citizen_id,
            report_id=report.id,
            title="Complaint Resolved",
            message=f"Your complaint #{report.id} has been cleaned and verified by the municipality! Please tap to rate our service.",
            type="success"
        ))
