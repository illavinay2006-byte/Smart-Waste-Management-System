import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from datetime import datetime

from backend.database.db import db
from backend.models.email_log import EmailLog
from backend.models.user import User

import json
from pathlib import Path

SMTP_SETTINGS_FILE = Path(__file__).resolve().parent.parent.parent / "smtp_settings.json"

def safe_log(msg):
    try:
        print(msg)
    except Exception:
        try:
            print(msg.encode("ascii", "replace").decode("ascii"))
        except Exception:
            pass

def get_smtp_config():
    defaults = {
        "server": os.environ.get("SMTP_SERVER", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", 587)),
        "use_tls": os.environ.get("SMTP_USE_TLS", "true").lower() == "true",
        "username": os.environ.get("SMTP_USERNAME", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "sender": os.environ.get("MAIL_DEFAULT_SENDER", "notifications@smartwaste.civic"),
        "auto_dispatch": True
    }
    if SMTP_SETTINGS_FILE.exists():
        try:
            with open(SMTP_SETTINGS_FILE, "r") as f:
                saved = json.load(f)
                defaults.update(saved)
        except Exception:
            pass
    return defaults

def save_smtp_config(cfg_data):
    current = get_smtp_config()
    for k, v in cfg_data.items():
        if v is not None:
            if k == "port":
                try:
                    current[k] = int(v)
                except Exception:
                    current[k] = 587
            elif k == "use_tls":
                current[k] = bool(v)
            else:
                current[k] = str(v).strip()
    try:
        with open(SMTP_SETTINGS_FILE, "w") as f:
            json.dump(current, f, indent=2)
    except Exception as e:
        safe_log(f"Error saving SMTP settings: {e}")
    return current

def dispatch_email(recipient_email, recipient_name, recipient_role, subject, body_html, body_text="", report_id=None):
    cfg = get_smtp_config()
    status = "SENT"
    error_msg = None

    if cfg["username"] and cfg["password"]:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = Header(subject, "utf-8").encode()
            sender_addr = cfg.get("sender") or cfg["username"]
            msg["From"] = f"SmartWaste Civic Portal <{sender_addr}>"
            msg["To"] = recipient_email

            if body_text:
                msg.attach(MIMEText(body_text, "plain", "utf-8"))
            msg.attach(MIMEText(body_html, "html", "utf-8"))

            port = int(cfg.get("port", 587))
            if port == 465:
                server = smtplib.SMTP_SSL(cfg["server"], port, timeout=12)
            else:
                server = smtplib.SMTP(cfg["server"], port, timeout=12)
                if cfg.get("use_tls", True):
                    server.starttls()

            server.login(cfg["username"], cfg["password"])
            server.sendmail(sender_addr, [recipient_email], msg.as_string())
            server.quit()
            safe_log(f">> [REAL EMAIL DELIVERED] To: {recipient_email} | Subject: {subject}")
        except Exception as e:
            status = "FAILED"
            error_msg = str(e)
            safe_log(f">> [REAL EMAIL FAILED] To: {recipient_email} | Error: {e}")
    else:
        status = "SIMULATED"
        safe_log(f">> [EMAIL SIMULATED - Configure SMTP for Live Delivery] To: {recipient_email} | Subject: {subject}")

    try:
        log = EmailLog(
            recipient_email=recipient_email,
            recipient_name=recipient_name or recipient_email,
            recipient_role=recipient_role,
            report_id=report_id,
            subject=subject,
            body_html=body_html,
            body_text=body_text or subject,
            status=status,
            error_message=error_msg,
            created_at=datetime.utcnow()
        )
        db.session.add(log)
        db.session.commit()
    except Exception as log_err:
        db.session.rollback()

    return status in ["SENT", "SIMULATED"]


def email_template_wrapper(title, header_bg, content_html):
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; color: #1f2937; }}
    .container {{ max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }}
    .header {{ background: {header_bg}; color: #ffffff; padding: 28px; text-align: center; }}
    .header h1 {{ margin: 0 0 6px 0; font-size: 24px; }}
    .header p {{ margin: 0; opacity: 0.9; font-size: 14px; }}
    .body {{ padding: 28px; line-height: 1.6; font-size: 15px; }}
    .badge {{ display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px; }}
    .badge-high {{ background-color: #fee2e2; color: #b91c1c; }}
    .badge-medium {{ background-color: #fef3c7; color: #b45309; }}
    .badge-low {{ background-color: #e0f2fe; color: #0369a1; }}
    .info-box {{ background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0; }}
    .info-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }}
    .btn {{ display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; margin-top: 16px; }}
    .footer {{ background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 32px; margin-bottom: 8px;">🌱 SmartWaste</div>
      <h1>{title}</h1>
      <p>Official Municipal Sanitation & Waste Management Notification</p>
    </div>
    <div class="body">
      {content_html}
    </div>
    <div class="footer">
      <p style="margin: 0;">SmartWaste Civic Operations • Central Municipal Command</p>
      <p style="margin: 4px 0 0 0;">Automated notification service for Citizens, Municipal Officers & Sanitation Field Crews.</p>
    </div>
  </div>
</body>
</html>"""


def send_report_submitted_emails(report, citizen):
    """
    Notifies Municipal Officers of the new waste report filed by citizen,
    and sends a filing confirmation to the Citizen.
    """
    officers = User.query.filter_by(role="officer").all()
    if not officers:
        officers = [User(name="Municipal Officer", email="officer@demo.com", role="officer")]

    priority_class = f"badge-{'high' if report.priority in ['HIGH', 'CRITICAL'] else ('medium' if report.priority == 'MEDIUM' else 'low')}"

    officer_content = f"""
      <p>Hello <strong>Municipal Sanitation Team</strong>,</p>
      <p>A new civic waste complaint has been officially registered and verified by SmartWaste AI:</p>

      <div class="info-box">
        <div class="info-row"><strong>Complaint ID:</strong> <span style="color:#059669; font-weight:bold;">#{report.id}</span></div>
        <div class="info-row"><strong>Category:</strong> <span>{report.category}</span></div>
        <div class="info-row"><strong>Priority:</strong> <span class="badge {priority_class}">{report.priority}</span></div>
        <div class="info-row"><strong>Location:</strong> <span>📍 {report.location_name}</span></div>
        <div class="info-row"><strong>Reported By:</strong> <span>{citizen.name} ({citizen.email})</span></div>
        <div class="info-row"><strong>Observed Duration:</strong> <span>{report.observed_duration or 'N/A'}</span></div>
        <div class="info-row"><strong>Road Obstruction:</strong> <span>{'⚠️ Yes (Obstructing traffic/footpath)' if report.road_obstruction else 'No'}</span></div>
      </div>

      <p><strong>Citizen Description:</strong></p>
      <blockquote style="margin: 0; padding: 10px 16px; background: #f3f4f6; border-left: 4px solid #10b981; border-radius: 4px;">
        {report.description or 'No additional citizen notes.'}
      </blockquote>

      <p style="margin-top: 20px;">Please log in to the Municipal Operations Console to review this complaint and assign a field sanitation worker.</p>
      <div style="text-align: center;">
        <a href="http://127.0.0.1:5000/officer" class="btn" style="background: linear-gradient(135deg, #1e40af, #3b82f6);">Open Municipal Console →</a>
      </div>
    """

    for off in officers:
        if off.email:
            dispatch_email(
                recipient_email=off.email,
                recipient_name=off.name,
                recipient_role="officer",
                subject=f"🚨 [NEW REPORT] #{report.id} ({report.priority} Priority - {report.category}) at {report.location_name}",
                body_html=email_template_wrapper(f"New Waste Complaint #{report.id}", "linear-gradient(135deg, #1e3a8a, #3b82f6)", officer_content),
                body_text=f"New Report #{report.id} ({report.category}) at {report.location_name} filed by {citizen.name}. Priority: {report.priority}",
                report_id=report.id
            )

    # Directly dispatch alert to Field Workers for rapid municipal preparedness
    workers = User.query.filter_by(role="worker").all()
    if not workers:
        workers = [User(name="Field Sanitation Crew", email="worker@demo.com", role="worker")]

    worker_submitted_content = f"""
      <p>Hello <strong>Sanitation Field Crew</strong>,</p>
      <p>A new waste report has been filed and verified by SmartWaste AI in your operating zone:</p>

      <div class="info-box" style="border-left: 4px solid #f59e0b;">
        <div class="info-row"><strong>Complaint ID:</strong> <span style="color:#b45309; font-weight:bold;">#{report.id}</span></div>
        <div class="info-row"><strong>Waste Category:</strong> <span>{report.category}</span></div>
        <div class="info-row"><strong>Priority:</strong> <span class="badge {priority_class}">{report.priority}</span></div>
        <div class="info-row"><strong>Location:</strong> <span>📍 {report.location_name}</span></div>
        <div class="info-row"><strong>Road Obstruction:</strong> <span>{'⚠️ Yes (Immediate clearing required)' if report.road_obstruction else 'No'}</span></div>
        <div class="info-row"><strong>Reported Duration:</strong> <span>{report.observed_duration or '1–2 days'}</span></div>
      </div>

      <p><strong>Citizen Observation:</strong></p>
      <blockquote style="margin: 0; padding: 10px 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
        {report.description or 'Waste accumulation reported on site.'}
      </blockquote>

      <p style="margin-top: 16px;">This site is queued for municipal officer review and worker task dispatch. Please keep necessary equipment and collection bags ready.</p>
      <div style="text-align: center;">
        <a href="http://127.0.0.1:5000/worker" class="btn" style="background: linear-gradient(135deg, #d97706, #f59e0b);">Open Worker Console →</a>
      </div>
    """

    for w in workers:
        if w.email:
            dispatch_email(
                recipient_email=w.email,
                recipient_name=w.name,
                recipient_role="worker",
                subject=f"⚠️ [NEW WASTE ALERT] #{report.id} ({report.priority} Priority - {report.category}) at {report.location_name}",
                body_html=email_template_wrapper(f"Waste Site Alert #{report.id}", "linear-gradient(135deg, #b45309, #d97706)", worker_submitted_content),
                body_text=f"New Waste Alert #{report.id} ({report.category}) at {report.location_name}. Priority: {report.priority}",
                report_id=report.id
            )

    if citizen and citizen.email:
        citizen_content = f"""
          <p>Dear <strong>{citizen.name}</strong>,</p>
          <p>Thank you for taking action to keep our community clean! Your waste complaint has been registered with the Municipal Corporation.</p>

          <div class="info-box">
            <div class="info-row"><strong>Complaint ID:</strong> <span style="color:#059669; font-weight:bold;">#{report.id}</span></div>
            <div class="info-row"><strong>Category:</strong> <span>{report.category}</span></div>
            <div class="info-row"><strong>Location:</strong> <span>📍 {report.location_name}</span></div>
            <div class="info-row"><strong>Status:</strong> <span style="color:#059669; font-weight:bold;">SUBMITTED (Under Review)</span></div>
          </div>

          <p>Our municipal team has received the alert and will dispatch a sanitation crew. You can track real-time progress, worker assignment, and before/after verification photos in your portal.</p>
          <div style="text-align: center;">
            <a href="http://127.0.0.1:5000/citizen" class="btn">Track My Complaint →</a>
          </div>
        """

        dispatch_email(
            recipient_email=citizen.email,
            recipient_name=citizen.name,
            recipient_role="citizen",
            subject=f"✅ Waste Complaint #{report.id} Received — SmartWaste",
            body_html=email_template_wrapper("Complaint Registered Successfully", "linear-gradient(135deg, #064e3b, #059669)", citizen_content),
            body_text=f"Thank you {citizen.name}. Your report #{report.id} at {report.location_name} has been submitted.",
            report_id=report.id
        )


def send_task_assigned_emails(report, worker, officer):
    """
    Notifies the assigned Field Worker of their task dispatch,
    and updates the Citizen with their assigned worker information.
    """
    if worker and worker.email:
        worker_content = f"""
          <p>Hello <strong>{worker.name}</strong>,</p>
          <p>You have been assigned a new sanitation cleanup task by Municipal Officer <strong>{officer.name if officer else 'Central Command'}</strong>:</p>

          <div class="info-box" style="border-left: 4px solid #f59e0b;">
            <div class="info-row"><strong>Task / Complaint ID:</strong> <span style="color:#b45309; font-weight:bold;">#{report.id}</span></div>
            <div class="info-row"><strong>Waste Category:</strong> <span>{report.category}</span></div>
            <div class="info-row"><strong>Priority Level:</strong> <span><strong>{report.priority}</strong></span></div>
            <div class="info-row"><strong>Location:</strong> <span>📍 {report.location_name}</span></div>
            <div class="info-row"><strong>Road Obstruction:</strong> <span>{'⚠️ Yes (Immediate clearing required)' if report.road_obstruction else 'No'}</span></div>
          </div>

          <p><strong>Field Instructions:</strong></p>
          <ol style="padding-left: 20px; line-height: 1.8;">
            <li>Acknowledge and accept the task in your Field Worker console.</li>
            <li>Proceed to the site with proper protective gear and disposal bags.</li>
            <li>Upload after-cleaning verification photo proof upon completion.</li>
          </ol>

          <div style="text-align: center;">
            <a href="http://127.0.0.1:5000/worker" class="btn" style="background: linear-gradient(135deg, #d97706, #f59e0b);">Open Worker Task Console →</a>
          </div>
        """

        dispatch_email(
            recipient_email=worker.email,
            recipient_name=worker.name,
            recipient_role="worker",
            subject=f"👷 [TASK ASSIGNED] Clean #{report.id} ({report.priority} Priority) at {report.location_name}",
            body_html=email_template_wrapper(f"New Sanitation Assignment #{report.id}", "linear-gradient(135deg, #b45309, #d97706)", worker_content),
            body_text=f"Hello {worker.name}. You are assigned to clean #{report.id} ({report.category}) at {report.location_name}.",
            report_id=report.id
        )

    if report.citizen and report.citizen.email:
        citizen_content = f"""
          <p>Dear <strong>{report.citizen.name}</strong>,</p>
          <p>Good news! Your waste complaint <strong>#{report.id}</strong> has been assigned to field sanitation crew member <strong>{worker.name if worker else 'Municipal Sanitation Worker'}</strong>.</p>

          <div class="info-box">
            <div class="info-row"><strong>Assigned Worker:</strong> <span>{worker.name if worker else 'Sanitation Crew'}</span></div>
            <div class="info-row"><strong>Worker Phone:</strong> <span>{worker.phone if worker and worker.phone else 'Direct Municipal Dispatch'}</span></div>
            <div class="info-row"><strong>Status:</strong> <span style="color:#b45309; font-weight:bold;">ASSIGNED (Worker En Route)</span></div>
          </div>

          <p>You can monitor live progress on your complaint dashboard.</p>
          <div style="text-align: center;">
            <a href="http://127.0.0.1:5000/citizen" class="btn">View Status →</a>
          </div>
        """

        dispatch_email(
            recipient_email=report.citizen.email,
            recipient_name=report.citizen.name,
            recipient_role="citizen",
            subject=f"🚚 Worker Assigned to Your Complaint #{report.id}",
            body_html=email_template_wrapper("Worker Assigned to Complaint", "linear-gradient(135deg, #064e3b, #059669)", citizen_content),
            body_text=f"Your complaint #{report.id} has been assigned to worker {worker.name if worker else 'Sanitation Worker'}.",
            report_id=report.id
        )

