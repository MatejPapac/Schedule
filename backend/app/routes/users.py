from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app import db
from app.models.models import User, Role
from app.schemas import UserSchema, UserUpdateSchema


users_bp = Blueprint('users', __name__)

# Helper function to check if user is manager

def check_manager():
    identity = get_jwt_identity()
    return identity['type'] == 'manager'

# Get all users (managers only)

@users_bp.route("",methods=['GET'])
@jwt_required()
def get_users():
    try:

        #Check if user is a manager
        if not check_manager():
            return jsonify({'error':'Unauthorized access'}),403
        
        # Get all users

        users = User.query.all()

        # Serialize users

        schema = UserSchema(many=True)
        users_data = schema.dump(users)

        return jsonify(users_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    try:

        # Get identity from token
        identity = get_jwt_identity()

        # Check if user is requesting their own data or is a manager
        if identity['id'] != user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get user from database

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Serialize user data

        schema = UserSchema()
        user_data = schema.dump(user)

        # Add capable role IDs
        
        user_data['capable_roles'] = [role.id for role in user.capable_roles]

        return jsonify(user_data),200
    
    except Exception as e:
        return jsonify({'error':str(e)}), 500
    
# Inside app/routes/users.py

# ... other imports ...
from flask_jwt_extended import jwt_required # Keep the import
# ... potentially import check_manager if it's defined elsewhere ...

@users_bp.route('', methods=['POST'])
# @jwt_required()  # <<=== 1. COMMENT OUT THIS LINE TEMPORARILY
def create_user():
    try:
        # Check if user is a manager <<=== 2. COMMENT OUT THIS BLOCK TEMPORARILY
        # if not check_manager():
        #     return jsonify({'error': 'Unauthorized access'}), 403

        # Validate request data (Keep this and the rest)
        schema = UserSchema() # Make sure UserSchema is imported
        data = schema.load(request.json) # Make sure request is imported

        # ... (rest of the function remains the same) ...

        if User.query.filter_by(username=data['username']).first(): # Make sure User is imported
             return jsonify({'error': 'Username already exists'}), 400

        if User.query.filter_by(email=data['email']).first(): # Make sure User is imported
             return jsonify({'error': 'Email already exists'}), 400

        # Create new user
        user=User( # Make sure User is imported
            username=data['username'],
            name=data['name'],
            email=data['email'],
            user_type=data['user_type'], # This will correctly set 'manager' from the image data
            target_hours=data.get('target_hours', 40.0),
            active=data.get('active', True)
        )

        # Set password
        user.set_password(data['password'])

        # Add capable roles if provided
        if 'capable_roles' in data and data['capable_roles']:
             roles = Role.query.filter(Role.id.in_(data['capable_roles'])).all() # Make sure Role is imported
             user.capable_roles = roles

        # Save to database
        db.session.add(user) # Make sure db is imported/available
        db.session.commit()

        # Serialize and return created user
        result = schema.dump(user)

        return jsonify(result), 201

    except ValidationError as e: # Make sure ValidationError is imported (from marshmallow?)
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback() # Make sure db is imported/available
        return jsonify({'error': str(e)}), 500
    

# Update user (nabagers can update any user, employees can only update certain fileds of ther own data)
@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    try:
        # Get identity from token
        
        identity = get_jwt_identity()

        # Get user from Database

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check permissions

        is_manager = identity['type'] == ' manager'
        is_self = identity['id'] == user_id

        if not(is_manager or is_self):
            return jsonify({'error':'Unauthorized access'}), 403
        
        # Validate request data
        schema = UserUpdateSchema()
        data = schema.load(request.json)
        
        # Employees can only update ther name and email
        if not is_manager and is_self:
            allowed_fields = ['name', 'email','password']
            for field in list(data.keys()):
                if field not in allowed_fields:
                    data.pop(field)
        
        # Update user fields

        if 'name' in data:
            user.name = data['name']
        if 'email' in data and data['email'] != user.email:
            # Check if email already exists

            if User.query.filter_by(email=data['email']).first():
                return jsonify({'error' : 'Email already exists'}), 400
            user.email = data['email']
        if 'password' in data:
            user.set_password(data['password'])
        
        # Manager-only updates

        if is_manager:
            if 'user_type' in data:
                user.user_type = data['user_type']
            if 'target_hours' in data:
                user.target_hours = data['target_hours']
            if 'active' in data:
                user.active = data['active']
            if 'capable_roles' in data:
                roles = Role.query.filter(Role.id.in_(data['capable_roles'])).all()
                user.capable_roles = roles

        # Save to database
        db.session.commit()

        # Serialize and return updated user
        result = UserSchema().dump(user)
        
        return jsonify(result), 200
    

    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
    
@users_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get user from database
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Delete user
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': 'User deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500




