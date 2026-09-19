import secrets
import datetime
from flask import session
from backend.database.db import db
from backend.models.user import User

def issue_user_session(user):
    token = secrets.token_hex(24)
    user.session_token = token
    user.last_login_at = datetime.datetime.utcnow()
    db.session.commit()

    session['user_id'] = user.id
    session['session_token'] = token
    session.permanent = True
    return token

def get_current_authenticated_user():
    user_id = session.get('user_id')
    req_token = session.get('session_token')
    if not user_id:
        return None

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return None

    if user.session_token and req_token and user.session_token != req_token:
        session.clear()
        return None

    if user.session_token and not req_token:
        session.clear()
        return None

    return user

def terminate_user_session(user=None):
    if not user:
        user_id = session.get('user_id')
        if user_id:
            user = db.session.get(User, user_id)

    if user:
        user.session_token = None
        db.session.commit()

    session.clear()
