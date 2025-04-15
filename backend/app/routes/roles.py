from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app import db
from app.models.models import Role
from app.schemas import RoleSchema

roles_bp = Blueprint('roles', __name__)

# Helper function to check if user is manager
def check_manager():
    identity = get_jwt_identity()
    return identity['type'] == 'manager'

# Get all roles
@roles_bp.route('', methods=['GET'])
@jwt_required()
def get_roles():
    try:
        # Get all roles
        roles = Role.query.all()
        
        # Serialize roles
        schema = RoleSchema(many=True)
        roles_data = schema.dump(roles)
        
        return jsonify(roles_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get role by ID
@roles_bp.route('/<int:role_id>', methods=['GET'])
@jwt_required()
def get_role(role_id):
    try:
        # Get role from database
        role = Role.query.get(role_id)
        
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Serialize role data
        schema = RoleSchema()
        role_data = schema.dump(role)
        
        return jsonify(role_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create new role (managers only)
@roles_bp.route('', methods=['POST'])
@jwt_required()
def create_role():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Validate request data
        schema = RoleSchema()
        data = schema.load(request.json)
        
        # Check if role name already exists
        if Role.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Role name already exists'}), 400
        
        # Create new role
        role = Role(
            name=data['name'],
            description=data.get('description', '')
        )
        
        # Save to database
        db.session.add(role)
        db.session.commit()
        
        # Serialize and return created role
        result = schema.dump(role)
        
        return jsonify(result), 201
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Update role (managers only)
@roles_bp.route('/<int:role_id>', methods=['PUT'])
@jwt_required()
def update_role(role_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get role from database
        role = Role.query.get(role_id)
        
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Validate request data
        schema = RoleSchema()
        data = schema.load(request.json, partial=True)
        
        # Check if name is being changed and already exists
        if 'name' in data and data['name'] != role.name:
            if Role.query.filter_by(name=data['name']).first():
                return jsonify({'error': 'Role name already exists'}), 400
            role.name = data['name']
        
        # Update description if provided
        if 'description' in data:
            role.description = data['description']
        
        # Save to database
        db.session.commit()
        
        # Serialize and return updated role
        result = schema.dump(role)
        
        return jsonify(result), 200
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete role (managers only)
@roles_bp.route('/<int:role_id>', methods=['DELETE'])
@jwt_required()
def delete_role(role_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get role from database
        role = Role.query.get(role_id)
        
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Delete role
        db.session.delete(role)
        db.session.commit()
        
        return jsonify({'message': 'Role deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500