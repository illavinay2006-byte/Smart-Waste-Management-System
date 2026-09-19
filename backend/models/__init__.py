from backend.database.db import db
from backend.models.user import User
from backend.models.report import WasteReport, ReportImage, AIAnalysis, ReportQuestion, ReportHistory, Feedback
from backend.models.task import Task
from backend.models.notification import Notification
from backend.models.collection_point import CollectionPoint
from backend.models.audit_log import AuditLog
from backend.models.email_log import EmailLog
from backend.models.announcement import Announcement

__all__ = [
    "db",
    "User",
    "WasteReport",
    "ReportImage",
    "AIAnalysis",
    "ReportQuestion",
    "ReportHistory",
    "Feedback",
    "Task",
    "Notification",
    "CollectionPoint",
    "AuditLog",
    "EmailLog",
    "Announcement"
]
