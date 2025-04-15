from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app import db
from app.models.models import User, Role, UserDayPreference, UserRolePreference
from app.schemas import UserDayPreferenceSchema, UserRolePreferenceSchema

preferences_bp = Blueprint('preferences', __name__)

# Helper function to check if user is manager
def check_manager():
    identity = get_jwt_identity()
    return identity['type'] == 'manager'

# Get all day preferences for a user
@preferences_bp.route('/day/<int:user_id>', methods=['GET'])
@jwt_required()
def get_day_preferences(user_id):
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Check if user is requesting their own data or is a manager
        if identity['id'] != user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Check if user exists
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get day preferences
        preferences = UserDayPreference.query.filter_by(user_id=user_id).all()
        
        # Serialize preferences
        schema = UserDayPreferenceSchema(many=True)
        preferences_data = schema.dump(preferences)
        
        return jsonify(preferences_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Set day preference for a user
@preferences_bp.route('/day', methods=['POST'])
@jwt_required()
def set_day_preference():
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Validate request data
        schema = UserDayPreferenceSchema()
        data = schema.load(request.json)
        
        # Check if user is setting their own preference or is a manager
        if identity['id'] != data['user_id'] and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Check if user exists
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if preference already exists
        existing = UserDayPreference.query.filter_by(
            user_id=data['user_id'],
            day_of_week=data['day_of_week']
        ).first()
        
        if existing:
            # Update existing preference
            existing.preference_level = data['preference_level']
            db.session.commit()
            result = schema.dump(existing)
            return jsonify(result), 200
        else:
            # Create new preference
            preference = UserDayPreference(
                user_id=data['user_id'],
                day_of_week=data['day_of_week'],
                preference_level=data['preference_level']
            )
            
            # Save to database
            db.session.add(preference)
            db.session.commit()
            
            # Serialize and return created preference
            result = schema.dump(preference)
            return jsonify(result), 201
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete day preference
@preferences_bp.route('/day/<int:preference_id>', methods=['DELETE'])
@jwt_required()
def delete_day_preference(preference_id):
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Get preference from database
        preference = UserDayPreference.query.get(preference_id)
        
        if not preference:
            return jsonify({'error': 'Preference not found'}), 404
        
        # Check if user is deleting their own preference or is a manager
        if identity['id'] != preference.user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Delete preference
        db.session.delete(preference)
        db.session.commit()
        
        return jsonify({'message': 'Day preference deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Get all role preferences for a user
@preferences_bp.route('/role/<int:user_id>', methods=['GET'])
@jwt_required()
def get_role_preferences(user_id):
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Check if user is requesting their own data or is a manager
        if identity['id'] != user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Check if user exists
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get role preferences
        preferences = UserRolePreference.query.filter_by(user_id=user_id).all()
        
        # Serialize preferences
        schema = UserRolePreferenceSchema(many=True)
        preferences_data = schema.dump(preferences)
        
        return jsonify(preferences_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Set role preference for a user
@preferences_bp.route('/role', methods=['POST'])
@jwt_required()
def set_role_preference():
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Validate request data
        schema = UserRolePreferenceSchema()
        data = schema.load(request.json)
        
        # Check if user is setting their own preference or is a manager
        if identity['id'] != data['user_id'] and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Check if user exists
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if role exists
        role = Role.query.get(data['role_id'])
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Check if preference already exists
        existing = UserRolePreference.query.filter_by(
            user_id=data['user_id'],
            role_id=data['role_id']
        ).first()
        
        if existing:
            # Update existing preference
            existing.preference_level = data['preference_level']
            db.session.commit()
            result = schema.dump(existing)
            return jsonify(result), 200
        else:
            # Create new preference
            preference = UserRolePreference(
                user_id=data['user_id'],
                role_id=data['role_id'],
                preference_level=data['preference_level']
            )
            
            # Save to database
            db.session.add(preference)
            db.session.commit()
            
            # Serialize and return created preference
            result = schema.dump(preference)
            return jsonify(result), 201
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete role preference
@preferences_bp.route('/role/<int:preference_id>', methods=['DELETE'])
@jwt_required()
def delete_role_preference(preference_id):
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Get preference from database
        preference = UserRolePreference.query.get(preference_id)
        
        if not preference:
            return jsonify({'error': 'Preference not found'}), 404
        
        # Check if user is deleting their own preference or is a manager
        if identity['id'] != preference.user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Delete preference
        db.session.delete(preference)
        db.session.commit()
        
        return jsonify({'message': 'Role preference deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500