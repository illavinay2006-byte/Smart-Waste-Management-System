import os
import sys
from pathlib import Path
	# Add project root directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


from flask import Flask, send_from_directory, jsonify, render_template, request
from flask_cors import CORS

from backend.config import Config, BASE_DIR
from backend.database.db import db
from backend.routes.auth_routes import auth_bp
from backend.routes.report_routes import report_bp
from backend.routes.task_routes import task_bp
from backend.routes.ai_routes import ai_bp
from backend.routes.analytics_routes import analytics_bp
from backend.routes.collection_point_routes import collection_bp
from backend.routes.notification_routes import notification_bp
from backend.routes.email_routes import email_bp
from backend.routes.citizen_routes import citizen_bp
from backend.routes.announcement_routes import announcement_bp

def create_app(config_class=Config):
    app = Flask(
        __name__,
        static_folder=str(BASE_DIR / "frontend"),
        static_url_path="/static"
    )
    app.config.from_object(config_class)

    CORS(app, supports_credentials=True)
    db.init_app(app)

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(task_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(collection_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(email_bp)
    app.register_blueprint(citizen_bp)
    app.register_blueprint(announcement_bp)


    # Serve uploaded images
    @app.route("/uploads/<path:filename>")
    def serve_upload(filename):
        upload_folder = Path(app.config["UPLOAD_FOLDER"])
        return send_from_directory(upload_folder, filename)

    # Serve frontend assets
    @app.route("/css/<path:filename>")
    def serve_css(filename):
        return send_from_directory(BASE_DIR / "frontend" / "css", filename)

    @app.route("/js/<path:filename>")
    def serve_js(filename):
        return send_from_directory(BASE_DIR / "frontend" / "js", filename)

    @app.route("/images/<path:filename>")
    def serve_images(filename):
        return send_from_directory(BASE_DIR / "frontend" / "images", filename)

    # Serve main SPA
    @app.route("/")
    @app.route("/citizen")
    @app.route("/officer")
    @app.route("/worker")
    def serve_index():
        return send_from_directory(BASE_DIR / "frontend", "index.html")

    # Global Error Handlers
    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Endpoint not found"}), 404
        return send_from_directory(BASE_DIR / "frontend", "index.html")

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error. Please try again."}), 500

    return app

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        db.create_all()
    print("Starting SmartWaste on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
