from flask import Blueprint, jsonify, request
from backend.database.db import db
from backend.models.announcement import Announcement
from backend.services.auth_service import get_current_authenticated_user

announcement_bp = Blueprint('announcements', __name__, url_prefix='/api/announcements')

@announcement_bp.route('', methods=['GET'])
def get_announcements():
    ward = request.args.get('ward')
    query = Announcement.query.filter_by(is_active=True)
    if ward and ward != 'All' and ward != 'ALL':
        query = query.filter((Announcement.target_ward == ward) | (Announcement.target_ward == 'All') | (Announcement.target_ward == 'ALL'))
    
    announcements = query.order_by(Announcement.priority.desc(), Announcement.created_at.desc()).all()
    return jsonify({'announcements': [a.to_dict() for a in announcements]}), 200

@announcement_bp.route('', methods=['POST'])
def create_announcement():
    user = get_current_authenticated_user()
    if not user or user.role != 'officer':
        return jsonify({'error': 'Municipal officer privileges required'}), 403
    
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    content = data.get('content', data.get('message', '')).strip()
    if not title or not content:
        return jsonify({'error': 'Title and content/message are required'}), 400
    
    priority = data.get('priority', 'NORMAL')
    target_ward = data.get('target_ward', 'All')
    
    announcement = Announcement(
        title=title,
        content=content,
        priority=priority,
        target_ward=target_ward,
        author_id=user.id,
        is_active=True
    )
    db.session.add(announcement)
    db.session.commit()
    
    return jsonify({'message': 'Announcement published', 'announcement': announcement.to_dict()}), 201

@announcement_bp.route('/<int:announcement_id>', methods=['DELETE'])
def delete_announcement(announcement_id):
    user = get_current_authenticated_user()
    if not user or user.role != 'officer':
        return jsonify({'error': 'Municipal officer privileges required'}), 403
    
    a = db.session.get(Announcement, announcement_id)
    if not a:
        return jsonify({'error': 'Announcement not found'}), 404
    
    a.is_active = False
    db.session.commit()
    return jsonify({'message': 'Announcement removed'}), 200
