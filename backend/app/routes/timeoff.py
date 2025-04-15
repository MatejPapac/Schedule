from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app import db
from app.models.models import User, TimeOffRequest
from app.schemas import TimeOffRequestSchema, TimeOffResponseSchema

timeoff_bp = Blueprint('timeoff', __name__)

# Helper function to check if user is manager

def check_manager():
    identity = get_jwt_identity()
    return identity['type'] == 'manager'

# Get all time off requests(filtered by user for employees, all for managers)

@timeoff_bp.route('', methods=['GET'])
@jwt_required()
def get_time_off_requests():
    try:
        # Get identity from token

        identity = get_jwt_identity()
        user_id = identity['id']
        is_manager = identity['type'] == 'manager'

        # Filter requests based on user type

        if is_manager:
            # Managers can all requests
            # Optional query parameter to filter by status

            status = request.args.get('status')
            if status:
                request = TimeOffRequest.query.filter_by(status=status).all()
            else:
                request = TimeOffRequest.query.all()
        else:

            # Employees can only see their own requests
            requests = TimeOffRequest.query.filter_by(user_id=user_id).all()

        # Serialize requests
        schema = TimeOffRequestSchema(many=True)
        requests_data = schema.dump(requests)

        return jsonify(requests_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@timeoff_bp.route('/<int:request_id>', methods=['GET'])
@jwt_required()
def get_time_off_request(request_id):
    try:

        # Get identity from token 

        identity = get_jwt_identity()
        user_id = identity['id']
        is_manager = identity['type'] == 'manager'

        # Get request from database

        time_off_request = TimeOffRequest.query.get(request_id)

        if not time_off_request:
            return jsonify({'error': 'Time off requst not found'}),404
        
        # Check if user has permission to view this request

        if not is_manager and time_off_request.user_id != user_id:
            return jsonify({'error': 'Unauthorized access'}), 403
        
        schema = TimeOffRequestSchema()
        request_data = schema.dump(time_off_request)

        return jsonify(request_data), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500
    
# Create new time off request

@timeoff_bp.route('', methods=['POST'])
@jwt_required()
def create_time_off_reguest():
    try:
        # Get identity from token
        identity = get_jwt_identity()
        user_id = identity['id']

        # Validate request data

        schema = TimeOffRequestSchema()
        data = schema.load(request.json, context={'start_time': request.json.get('start_time')})

        # Only managers can create requests for other users

        if data['user_id'] != user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Check if user exists

        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        time_off_request = TimeOffRequest(
            user_id=data['user_id'],
            start_time=data['start_time'],
            end_time=data['end_time'],
            reason=data.get('reason', ''),
            status='pending'  # Always create as pending
        )
        
        # Save to database
        db.session.add(time_off_request)
        db.session.commit()

        # Serialize and return created request
        result = schema.dump(time_off_request)

        return jsonify(result), 201
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
    # Update time off request status (managers only)
@timeoff_bp.route('/<int:request_id>/respond', methods=['PUT'])
@jwt_required()
def respond_to_time_off_request(request_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get request from database
        time_off_request = TimeOffRequest.query.get(request_id)
        
        if not time_off_request:
            return jsonify({'error': 'Time off request not found'}), 404
        
        # Validate request data
        schema = TimeOffResponseSchema()
        data = schema.load(request.json)
        
        # Update request status
        time_off_request.status = data['status']
        
        # Save to database
        db.session.commit()
        
        # Serialize and return updated request
        result = TimeOffRequestSchema().dump(time_off_request)
        
        return jsonify(result), 200
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
# Delete time off request (users can delete their own pending requests, managers can delete any)
@timeoff_bp.route('/<int:request_id>', methods=['DELETE'])
@jwt_required()
def delete_time_off_request(request_id):
    try:
        # Get identity from token
        identity = get_jwt_identity()
        user_id = identity['id']
        is_manager = identity['type'] == 'manager'
        
        # Get request from database
        time_off_request = TimeOffRequest.query.get(request_id)
        
        if not time_off_request:
            return jsonify({'error': 'Time off request not found'}), 404
        
        # Check if user has permission to delete this request
        if not is_manager and (time_off_request.user_id != user_id or time_off_request.status != 'pending'):
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Delete request
        db.session.delete(time_off_request)
        db.session.commit()
        
        return jsonify({'message': 'Time off request deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    

        

    