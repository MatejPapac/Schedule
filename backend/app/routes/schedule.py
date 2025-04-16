from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from datetime import datetime, timedelta
from app import db
from app.models.models import User, Role, AssignedShift, ShiftRequirement, TimeOffRequest
from app.schemas import AssignedShiftSchema, ScheduleGenerationSchema
import random

schedules_bp = Blueprint('schedules', __name__)

# Helper function to check if user is manager
def check_manager():
    identity = get_jwt_identity()
    return identity['type'] == 'manager'

# Get schedule for a specific user
@schedules_bp.route('/user/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_schedule(user_id):
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Check if user is requesting their own data or is a manager
        if identity['id'] != user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get start and end date/time filters from query parameters
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        
        # Build query
        query = AssignedShift.query.filter_by(user_id=user_id)
        
        if start_time:
            query = query.filter(AssignedShift.start_time >= start_time)
        if end_time:
            query = query.filter(AssignedShift.end_time <= end_time)
        
        # Get assigned shifts
        shifts = query.all()
        
        # Serialize shifts
        schema = AssignedShiftSchema(many=True)
        shifts_data = schema.dump(shifts)
        
        return jsonify(shifts_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get full schedule (managers only)
@schedules_bp.route('', methods=['GET'])
@jwt_required()
def get_full_schedule():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get start and end date/time filters from query parameters
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        user_id = request.args.get('user_id')
        role_id = request.args.get('role_id')
        
        # Build query
        query = AssignedShift.query
        
        if start_time:
            query = query.filter(AssignedShift.start_time >= start_time)
        if end_time:
            query = query.filter(AssignedShift.end_time <= end_time)
        if user_id:
            query = query.filter_by(user_id=user_id)
        if role_id:
            query = query.filter_by(role_id=role_id)
        
        # Get assigned shifts
        shifts = query.all()
        
        # Serialize shifts
        schema = AssignedShiftSchema(many=True)
        shifts_data = schema.dump(shifts)
        
        return jsonify(shifts_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create a new shift assignment (managers only)
@schedules_bp.route('', methods=['POST'])
@jwt_required()
def create_shift():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Validate request data
        schema = AssignedShiftSchema()
        data = schema.load(request.json, context={'start_time': request.json.get('start_time')})
        
        # Check if user exists and is active
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if not user.active:
            return jsonify({'error': 'User is inactive'}), 400
        
        # Check if role exists
        role = Role.query.get(data['role_id'])
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Check if user is capable of performing this role
        if role not in user.capable_roles:
            return jsonify({'error': 'User is not capable of performing this role'}), 400
        
        # Check for conflicting shifts
        conflicting_shifts = AssignedShift.query.filter_by(user_id=data['user_id']).filter(
            ((AssignedShift.start_time <= data['start_time']) & (AssignedShift.end_time > data['start_time'])) |
            ((AssignedShift.start_time < data['end_time']) & (AssignedShift.end_time >= data['end_time'])) |
            ((AssignedShift.start_time >= data['start_time']) & (AssignedShift.end_time <= data['end_time']))
        ).all()
        
        if conflicting_shifts:
            return jsonify({'error': 'Conflicting shift assignment exists'}), 400
        
        # Check for approved time off requests
        time_off = TimeOffRequest.query.filter_by(user_id=data['user_id'], status='approved').filter(
            ((TimeOffRequest.start_time <= data['start_time']) & (TimeOffRequest.end_time > data['start_time'])) |
            ((TimeOffRequest.start_time < data['end_time']) & (TimeOffRequest.end_time >= data['end_time'])) |
            ((TimeOffRequest.start_time >= data['start_time']) & (TimeOffRequest.end_time <= data['end_time']))
        ).first()
        
        if time_off:
            return jsonify({'error': 'User has approved time off during this period'}), 400
        
        # Create new shift assignment
        shift = AssignedShift(
            user_id=data['user_id'],
            role_id=data['role_id'],
            start_time=data['start_time'],
            end_time=data['end_time']
        )
        
        # Save to database
        db.session.add(shift)
        db.session.commit()
        
        # Serialize and return created shift
        result = schema.dump(shift)
        
        return jsonify(result), 201
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Update shift assignment (managers only)
@schedules_bp.route('/<int:shift_id>', methods=['PUT'])
@jwt_required()
def update_shift(shift_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get shift from database
        shift = AssignedShift.query.get(shift_id)
        
        if not shift:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Validate request data
        schema = AssignedShiftSchema()
        data = schema.load(request.json, partial=True, context={'start_time': request.json.get('start_time', shift.start_time)})
        
        # Check if we're updating user or role
        new_user_id = data.get('user_id', shift.user_id)
        new_role_id = data.get('role_id', shift.role_id)
        new_start_time = data.get('start_time', shift.start_time)
        new_end_time = data.get('end_time', shift.end_time)
        
        # If user is changing, check if new user exists and is active
        if new_user_id != shift.user_id:
            user = User.query.get(new_user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            if not user.active:
                return jsonify({'error': 'User is inactive'}), 400
        else:
            user = User.query.get(shift.user_id)
        
        # If role is changing, check if new role exists
        if new_role_id != shift.role_id:
            role = Role.query.get(new_role_id)
            if not role:
                return jsonify({'error': 'Role not found'}), 404
            
            # Check if user is capable of performing this role
            if role not in user.capable_roles:
                return jsonify({'error': 'User is not capable of performing this role'}), 400
        
        # If time or user is changing, check for conflicts
        if new_start_time != shift.start_time or new_end_time != shift.end_time or new_user_id != shift.user_id:
            # Check for conflicting shifts
            conflicting_shifts = AssignedShift.query.filter_by(user_id=new_user_id).filter(
                AssignedShift.id != shift_id
            ).filter(
                ((AssignedShift.start_time <= new_start_time) & (AssignedShift.end_time > new_start_time)) |
                ((AssignedShift.start_time < new_end_time) & (AssignedShift.end_time >= new_end_time)) |
                ((AssignedShift.start_time >= new_start_time) & (AssignedShift.end_time <= new_end_time))
            ).all()
            
            if conflicting_shifts:
                return jsonify({'error': 'Conflicting shift assignment exists'}), 400
            
            # Check for approved time off requests
            time_off = TimeOffRequest.query.filter_by(user_id=new_user_id, status='approved').filter(
                ((TimeOffRequest.start_time <= new_start_time) & (TimeOffRequest.end_time > new_start_time)) |
                ((TimeOffRequest.start_time < new_end_time) & (TimeOffRequest.end_time >= new_end_time)) |
                ((TimeOffRequest.start_time >= new_start_time) & (TimeOffRequest.end_time <= new_end_time))
            ).first()
            
            if time_off:
                return jsonify({'error': 'User has approved time off during this period'}), 400
        
        # Update shift fields
        if 'user_id' in data:
            shift.user_id = data['user_id']
        if 'role_id' in data:
            shift.role_id = data['role_id']
        if 'start_time' in data:
            shift.start_time = data['start_time']
        if 'end_time' in data:
            shift.end_time = data['end_time']
        
        # Save to database
        db.session.commit()
        
        # Serialize and return updated shift
        result = schema.dump(shift)
        
        return jsonify(result), 200
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete shift assignment (managers only)
@schedules_bp.route('/<int:shift_id>', methods=['DELETE'])
@jwt_required()
def delete_shift(shift_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get shift from database
        shift = AssignedShift.query.get(shift_id)
        
        if not shift:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Delete shift
        db.session.delete(shift)
        db.session.commit()
        
        return jsonify({'message': 'Shift deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Generate a schedule (managers only)
@schedules_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_schedule():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Validate request data
        schema = ScheduleGenerationSchema()
        data = schema.load(request.json, context={'start_date': request.json.get('start_date')})
        
        start_date = data['start_date']
        end_date = data['end_date']
        
        # First, clear any existing assignments in the date range
        existing_shifts = AssignedShift.query.filter(
            AssignedShift.start_time >= datetime.combine(start_date, datetime.min.time()),
            AssignedShift.end_time <= datetime.combine(end_date, datetime.max.time())
        ).all()
        
        for shift in existing_shifts:
            db.session.delete(shift)
        
        # Get all shift requirements in the date range
        requirements = ShiftRequirement.query.filter(
            ShiftRequirement.start_time >= datetime.combine(start_date, datetime.min.time()),
            ShiftRequirement.end_time <= datetime.combine(end_date, datetime.max.time())
        ).order_by(ShiftRequirement.start_time).all()
        
        # Get all active users
        users = User.query.filter_by(active=True).all()
        
        # Get all approved time off requests in the date range
        time_off_requests = TimeOffRequest.query.filter_by(status='approved').filter(
            ((TimeOffRequest.start_time >= datetime.combine(start_date, datetime.min.time())) &
             (TimeOffRequest.start_time <= datetime.combine(end_date, datetime.max.time()))) |
            ((TimeOffRequest.end_time >= datetime.combine(start_date, datetime.min.time())) &
             (TimeOffRequest.end_time <= datetime.combine(end_date, datetime.max.time()))) |
            ((TimeOffRequest.start_time <= datetime.combine(start_date, datetime.min.time())) &
             (TimeOffRequest.end_time >= datetime.combine(end_date, datetime.max.time())))
        ).all()
        
        # Create a simple schedule (for MVP)
        assigned_shifts = []
        
        # For each requirement, assign users who are capable of the role
        for req in requirements:
            # Get all users capable of this role
            capable_users = [u for u in users if any(r.id == req.role_id for r in u.capable_roles)]
            
            # Shuffle users to randomize assignments
            random.shuffle(capable_users)
            
            # Track how many users we've assigned to this requirement
            assigned_count = 0
            
            # Try to assign users
            for user in capable_users:
                # Skip if we've met the requirement
                if assigned_count >= req.employee_count:
                    break
                
                # Check if user has time off during this shift
                has_time_off = False
                for tor in time_off_requests:
                    if tor.user_id == user.id:
                        if ((tor.start_time <= req.start_time and tor.end_time > req.start_time) or
                            (tor.start_time < req.end_time and tor.end_time >= req.end_time) or
                            (tor.start_time >= req.start_time and tor.end_time <= req.end_time)):
                            has_time_off = True
                            break
                
                if has_time_off:
                    continue
                
                # Check if user already has a conflicting shift
                has_conflict = False
                for shift in assigned_shifts:
                    if shift.user_id == user.id:
                        if ((shift.start_time <= req.start_time and shift.end_time > req.start_time) or
                            (shift.start_time < req.end_time and shift.end_time >= req.end_time) or
                            (shift.start_time >= req.start_time and shift.end_time <= req.end_time)):
                            has_conflict = True
                            break
                
                if has_conflict:
                    continue
                
                # Create a new shift assignment
                shift = AssignedShift(
                    user_id=user.id,
                    role_id=req.role_id,
                    start_time=req.start_time,
                    end_time=req.end_time
                )
                
                # Add to database
                db.session.add(shift)
                assigned_shifts.append(shift)
                assigned_count += 1
        
        # Commit all changes
        db.session.commit()
        
        # Count how many requirements were fully satisfied
        total_requirements = len(requirements)
        requirements_met = 0
        
        for req in requirements:
            assigned_for_req = sum(1 for shift in assigned_shifts 
                                 if shift.role_id == req.role_id and 
                                 shift.start_time == req.start_time and
                                 shift.end_time == req.end_time)
            if assigned_for_req >= req.employee_count:
                requirements_met += 1
        
        # Return statistics
        return jsonify({
            'total_shifts_assigned': len(assigned_shifts),
            'total_requirements': total_requirements,
            'requirements_met': requirements_met,
            'schedule_completion_percentage': (requirements_met / total_requirements * 100) if total_requirements > 0 else 0
        }), 200
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500