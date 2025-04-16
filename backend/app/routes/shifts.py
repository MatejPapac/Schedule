from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app import db
from app.models.models import ShiftRequirement, Role
from app.schemas import ShiftRequirementSchema

shifts_bp = Blueprint('shifts', __name__)

# Helper function to check if user is manager
def check_manager():
    identity = get_jwt_identity()
    return identity['type'] == 'manager'

# Get all shift requirements (menagers only)

@shifts_bp.route('', methods=['GET'])
@jwt_required()
def get_shift_requirements():
    try:
        # Check if user is menager
        if not check_manager():
            return jsonify({'error':'Unauthorized access'}),403
        
        # Get start and end date filters from query parameters
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        role_id = request.args.get('role_id')

        # Query

        query = ShiftRequirement.query
        
        if start_time:
            query = query.filter(ShiftRequirement.start_time >= start_time)
        if end_time:
            query = query.filter(ShiftRequirement.end_time <= end_time)
        if role_id:
            query = query.filter_by(role_id=role_id)


        # Get shift requirments 

        requirements = query.all()    

        # Serialize requirements
        schema = ShiftRequirementSchema(many=True)
        requirements_data = schema.dump(requirements)
        return jsonify(requirements_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# Get shift requirment by ID

@shifts_bp.route('/<int:requirement_id>', methods=['GET'])
@jwt_required()
def get_shift_requirement(requirement_id):
    try:
        # Check if user is a menager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get requirement from database

        requirement = ShiftRequirement.query(requirement_id)

        if not requirement:
            return jsonify({'error': 'Shift requirment not found'}),404
        
        # Serialize requirement data

        schema = ShiftRequirementSchema()
        requirement_data = schema.dump(requirement)

        return jsonify(requirement_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# Create new shift requirement (managers only)
@shifts_bp.route('', methods=['POST'])
@jwt_required()
def create_shift_requirement():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Validate request data
        schema = ShiftRequirementSchema()
        data = schema.load(request.json)
        
        # Check if role exists
        role = Role.query.get(data['role_id'])
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Create new shift requirement
        requirement = ShiftRequirement(
            start_time=data['start_time'],
            end_time=data['end_time'],
            role_id=data['role_id'],
            employee_count=data['employee_count']
        )
        
        # Save to database
        db.session.add(requirement)
        db.session.commit()
        
        # Serialize and return created requirement
        result = schema.dump(requirement)
        
        return jsonify(result), 201
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
# Update shift requirement (managers only)
@shifts_bp.route('/<int:requirement_id>', methods=['PUT'])
@jwt_required()
def update_shift_requirement(requirement_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get requirement from database
        requirement = ShiftRequirement.query.get(requirement_id)

        if not requirement:
            return jsonify({'error':'Shift requirement not found'}), 404
        
        # Validate request data

        schema = ShiftRequirement.query.get(requirement_id)
        data = schema.load(request.json, partial=True, context={'start_time': request.json.get('start_time',requirement.start_time)})

        # Update fields
        if 'start_time' in data:
            requirement.start_time = data['start_time']
        if 'end_time' in data:
            requirement.end_time = data['end_time']
        if 'role_id' in data:
            # Check if role exists
            role = Role.query.get(data['role_id'])
            if not role:
                return jsonify({'error': 'Role not found'}), 404
            requirement.role_id = data['role_id']
        if 'employee_count' in data:
            requirement.employee_count = data['employee_count']
        
        # Save to database
        db.session.commit()
        
        # Serialize and return updated requirement
        result = schema.dump(requirement)
        
        return jsonify(result), 200
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
    # Delete shift requirement (managers only)
@shifts_bp.route('/<int:requirement_id>', methods=['DELETE'])
@jwt_required()
def delete_shift_requirement(requirement_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get requirement from database
        requirement = ShiftRequirement.query.get(requirement_id)
        
        if not requirement:
            return jsonify({'error': 'Shift requirement not found'}), 404
        
        # Delete requirement
        db.session.delete(requirement)
        db.session.commit()
        
        return jsonify({'message': 'Shift requirement deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500



