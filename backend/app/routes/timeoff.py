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
    