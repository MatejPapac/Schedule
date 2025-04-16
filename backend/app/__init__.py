from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
import os
from datetime import timedelta

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()

def create_app(config=None):
    app = Flask(__name__)
    
    # Load configuration
    if config:
        app.config.from_object(config)
    else:
        app.config.from_mapping(
            SECRET_KEY=os.environ.get('SECRET_KEY', 'dev_key'),
            SQLALCHEMY_DATABASE_URI=os.environ.get('DATABASE_URI', 'sqlite:///scheduler.db'),
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY', 'jwt_dev_key'),
            JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=1),
            JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=30),
            JWT_VERIFY_SUB = False
        )
    
    # Initialize extensions with app
    db.init_app(app)
    jwt.init_app(app)
    CORS(app)
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.users import users_bp
    from app.routes.roles import roles_bp
    from app.routes.shifts import shifts_bp
    from app.routes.schedules import schedules_bp
    from app.routes.timeoff import timeoff_bp
    from app.routes.preferences import preferences_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(roles_bp, url_prefix='/api/roles')
    app.register_blueprint(shifts_bp, url_prefix='/api/shifts')
    app.register_blueprint(schedules_bp, url_prefix='/api/schedules')
    app.register_blueprint(timeoff_bp, url_prefix='/api/timeoff')
    app.register_blueprint(preferences_bp, url_prefix='/api/preferences')
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    return app