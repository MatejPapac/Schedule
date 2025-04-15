from flask import Blueprint, request,jsonify
from flask_jwt_extended import create_access_token, create_refresh_token,jwt_required,get_jwt_identity
from marshmallow import ValidationError
from app import db
from app.models.models import User
from app.schemas import LoginSchema, UserSchema

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login',methods=['POST'])
def login():
    try:

        # Validate request data

        schema = LoginSchema()
        data = schema.load(request.json)

        # Find user by username

        user = User.query.filter_by(username=data['username']).first()

        # Check if user exists and password is correct

        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Check if user is active

        if not user.active:
            return jsonify({'error': 'Account is inactive'}), 403
        
        # Create tokens

        access_token = create_access_token(identity={
            'id': user.id,
            'type': user.user_type
        })
        
        refresh_token = create_refresh_token(identity={
            'id': user.id,
            'type': user.user_type
        })

        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'name': user.name,
                'email': user.email,
                'user_type': user.user_type
            }
        }), 200
    
    except ValidationError as e:
        return jsonify({'error' : e.messages}), 400
    except Exception as e:
        return jsonify({'error': str(e)}),500
    
@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        # Get identity from refresh token

        identity = get_jwt_identity()

        # Create new token 

        access_token = create_access_token(identity=identity)

        return jsonify({'acccess_token': access_token}), 200
    
    except Exception as e:
        return jsonify ({'error': str(e)}), 500
    
@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    try:
        
        # Get identity from token
        identity = get_jwt_identity()
        user_id = identity['id']

        #Get user from database

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error' : 'User not found'}), 404
        
        # Serialize user data

        schema = UserSchema()
        user_data = schema.dump(user)

        return jsonify(user_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500