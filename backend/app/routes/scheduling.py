from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
import logging
from datetime import datetime
from app import db

# Import scheduling components
from scheduling.services import SchedulingService
from scheduling.models.schedule import Employee, Shift, Schedule, PreferenceSet
from scheduling.utils.data_gen import generate_test_dataset

# Set up logging
logger = logging.getLogger(__name__)

scheduling_bp = Blueprint('scheduling', __name__)

# Helper function to check if user is manager
def check_manager():
    identity = get_jwt_identity()
    return identity.get('type') == 'manager'

@scheduling_bp.route('/test', methods=['POST'])
@jwt_required()
def generate_test_schedule():
    """
    Generate a test schedule with simulated data.
    For testing the scheduling algorithm.
    """
    # Check if user is a manager
    if not check_manager():
        return jsonify({'error': 'Unauthorized access'}), 403
    
    try:
        # Parse request parameters
        data = request.json or {}
        
        num_employees = data.get('num_employees', 15)
        num_days = data.get('num_days', 7)
        num_roles = data.get('num_roles', 5)
        shifts_per_day = data.get('shifts_per_day', 3)
        time_limit_seconds = data.get('time_limit_seconds', 60)
        
        # Algorithm parameters
        algorithm_params = data.get('algorithm_params', {
            'population_size': 50,
            'generations': 100,
            'coverage_weight': 1000,
            'balance_weight': 200,
            'preference_weight': 50
        })
        
        # Generate test data
        employees, shifts, preferences = generate_test_dataset(
            num_employees=num_employees,
            num_days=num_days,
            num_roles=num_roles,
            shifts_per_day=shifts_per_day
        )
        
        # Generate schedule
        schedule, stats = SchedulingService.generate_schedule(
            employees=employees,
            shifts=shifts,
            preferences=preferences,
            algorithm_params=algorithm_params,
            time_limit_seconds=time_limit_seconds
        )
        
        # Evaluate the schedule
        evaluation = SchedulingService.evaluate_schedule(schedule, preferences)
        
        # Convert schedule to dictionary for response
        schedule_dict = SchedulingService.schedule_to_dict(schedule)
        
        # Prepare response
        response = {
            'schedule': schedule_dict,
            'stats': stats,
            'evaluation': {
                'coverage': evaluation['coverage'],
                'preference_score': evaluation['preference_score'],
                'hours_stats': evaluation['hours_stats'],
                'violations': evaluation['violations']
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.exception("Error generating schedule")
        db.session.rollback()  # Rollback any database changes in case of error
        return jsonify({'error': str(e)}), 500


@scheduling_bp.route('/evaluate', methods=['POST'])
@jwt_required()
def evaluate_schedule():
    """
    Evaluate an existing schedule.
    """
    # Check if user is a manager
    if not check_manager():
        return jsonify({'error': 'Unauthorized access'}), 403
    
    try:
        # Parse request data
        data = request.json or {}
        
        # Get date range
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        
        if not start_date_str or not end_date_str:
            return jsonify({'error': 'Start date and end date are required'}), 400
        
        start_date = datetime.fromisoformat(start_date_str)
        end_date = datetime.fromisoformat(end_date_str)
        
        # Get the existing schedule from your database
        from app.models.models import AssignedShift, User, Role, ShiftRequirement
        
        # Get all assigned shifts in the date range
        assigned_shifts = AssignedShift.query.filter(
            AssignedShift.start_time >= start_date,
            AssignedShift.end_time <= end_date
        ).all()
        
        # Get all users and shift requirements for the same period
        users = User.query.filter_by(active=True).all()
        requirements = ShiftRequirement.query.filter(
            ShiftRequirement.start_time >= start_date,
            ShiftRequirement.end_time <= end_date
        ).all()
        
        # Convert to scheduling models
        employees = []
        for user in users:
            employee = Employee(
                id=str(user.id),
                name=user.name,
                max_hours=user.target_hours,
                skills=[role.id for role in user.capable_roles]
            )
            employees.append(employee)
        
        shifts = []
        for req in requirements:
            shift = Shift(
                id=req.id,
                start_time=req.start_time,
                end_time=req.end_time,
                role_id=req.role_id,
                required_staff=req.employee_count
            )
            shifts.append(shift)
        
        # Create preferences set
        from app.models.models import UserRolePreference, UserDayPreference
        
        preferences = PreferenceSet()
        
        # Add role and day preferences (same as in generate_schedule)
        # ... (similar to the code in generate_schedule)
        
        # Create Schedule object
        schedule = Schedule(employees, shifts)
        
        # Fill in assignments
        for assigned_shift in assigned_shifts:
            # Find corresponding shift and employee
            shift_idx = next((i for i, s in enumerate(shifts) if s.id == assigned_shift.id), None)
            emp_idx = next((i for i, e in enumerate(employees) if e.id == str(assigned_shift.user_id)), None)
            
            if shift_idx is not None and emp_idx is not None:
                schedule.assign(shift_idx, emp_idx, 1)
        
        # Evaluate the schedule
        evaluation = SchedulingService.evaluate_schedule(schedule, preferences)
        
        # Convert schedule to dictionary for response
        schedule_dict = SchedulingService.schedule_to_dict(schedule)
        
        # Prepare response
        response = {
            'schedule': schedule_dict,
            'evaluation': {
                'coverage': evaluation['coverage'],
                'preference_score': evaluation['preference_score'],
                'hours_stats': evaluation['hours_stats'],
                'violations': evaluation['violations']
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.exception("Error evaluating schedule")
        return jsonify({'error': str(e)}), 500
        


@scheduling_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_schedule():
    """
    Generate a schedule using the genetic algorithm based on real data.
    """
    # Check if user is a manager
    if not check_manager():
        return jsonify({'error': 'Unauthorized access'}), 403
    
    try:
        # Parse request data
        data = request.json or {}
        
        # Get algorithm parameters
        algorithm_params = data.get('algorithm_params', {})
        time_limit_seconds = data.get('time_limit_seconds', 60)
        
        # Get date range
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        
        if not start_date_str or not end_date_str:
            return jsonify({'error': 'Start date and end date are required'}), 400
        
        start_date = datetime.fromisoformat(start_date_str)
        end_date = datetime.fromisoformat(end_date_str)
        
        # Get employees data from your existing models/database
        # This is where you need to adapt to your actual data model
        from app.models.models import User, Role  # Import your existing models
        
        # Get employees (active users with their roles)
        users = User.query.filter_by(active=True).all()
        
        employees = []
        for user in users:
            # Convert your User model to scheduling Employee model
            employee = Employee(
                id=str(user.id),
                name=user.name,
                max_hours=user.target_hours,
                skills=[role.id for role in user.capable_roles]  # Assuming user.capable_roles is a list of Role objects
            )
            employees.append(employee)
        
        # Get shift requirements from your database
        from app.models.models import ShiftRequirement  # Import your ShiftRequirement model
        
        # Query requirements in the date range
        requirements = ShiftRequirement.query.filter(
            ShiftRequirement.start_time >= start_date,
            ShiftRequirement.end_time <= end_date
        ).all()
        
        shifts = []
        for req in requirements:
            # Convert your ShiftRequirement model to scheduling Shift model
            shift = Shift(
                id=req.id,
                start_time=req.start_time,
                end_time=req.end_time,
                role_id=req.role_id,
                required_staff=req.employee_count
            )
            shifts.append(shift)
        
        # Get preferences (optional)
        from app.models.models import UserRolePreference, UserDayPreference  # Import your preference models
        
        preferences = PreferenceSet()
        
        # Add role preferences
        role_prefs = UserRolePreference.query.filter(
            UserRolePreference.user_id.in_([user.id for user in users])
        ).all()
        
        for pref in role_prefs:
            # For each role preference, apply to all shifts with that role
            for shift in shifts:
                if shift.role_id == pref.role_id:
                    preferences.set_preference(str(pref.user_id), shift.id, pref.preference_level)
        
        # Add day preferences
        day_prefs = UserDayPreference.query.filter(
            UserDayPreference.user_id.in_([user.id for user in users])
        ).all()
        
        for pref in day_prefs:
            # For each day preference, apply to all shifts on that day
            for shift in shifts:
                if shift.day_of_week == pref.day_of_week:
                    # We already might have a role preference, so only set if it doesn't exist
                    key = (str(pref.user_id), shift.id)
                    if key not in preferences.preferences:
                        preferences.set_preference(str(pref.user_id), shift.id, pref.preference_level)
        
        # Get time off constraints
        from app.models.models import TimeOffRequest  # Import your TimeOffRequest model
        
        # Get approved time off requests
        time_off_requests = TimeOffRequest.query.filter_by(status='approved').filter(
            TimeOffRequest.user_id.in_([user.id for user in users]),
            TimeOffRequest.start_time < end_date,
            TimeOffRequest.end_time > start_date
        ).all()
        
        # For each time off request, set strong avoidance preferences for shifts that overlap
        for tor in time_off_requests:
            tor_start = tor.start_time
            tor_end = tor.end_time
            
            for shift in shifts:
                # Check if shift overlaps with time off
                if (shift.start_time < tor_end and shift.end_time > tor_start):
                    # Set strong avoidance (1)
                    preferences.set_preference(str(tor.user_id), shift.id, 1)
        
        # Generate schedule
        schedule, stats = SchedulingService.generate_schedule(
            employees=employees,
            shifts=shifts,
            preferences=preferences,
            algorithm_params=algorithm_params,
            time_limit_seconds=time_limit_seconds
        )
        
        # Evaluate the schedule
        evaluation = SchedulingService.evaluate_schedule(schedule, preferences)
        
        # Convert schedule to dictionary for response
        schedule_dict = SchedulingService.schedule_to_dict(schedule)
        
        # Now convert the schedule back to database models
        # First, clear any existing assigned shifts in the date range
        from app import db
        from app.models.models import AssignedShift  # Import your AssignedShift model
        
        # Delete existing shifts in the date range
        existing_shifts = AssignedShift.query.filter(
            AssignedShift.start_time >= start_date,
            AssignedShift.end_time <= end_date
        ).all()
        
        for shift in existing_shifts:
            db.session.delete(shift)
        
        # Add new shifts from the generated schedule
        for shift_idx, shift in enumerate(shifts):
            for emp_idx, employee in enumerate(employees):
                if schedule.assignments[shift_idx, emp_idx] == 1:
                    # Create new AssignedShift in your database
                    assigned_shift = AssignedShift(
                        user_id=int(employee.id),
                        role_id=shift.role_id,
                        start_time=shift.start_time,
                        end_time=shift.end_time
                    )
                    db.session.add(assigned_shift)
        
        # Commit all changes
        db.session.commit()
        
        # Prepare response
        response = {
            'schedule': schedule_dict,
            'stats': stats,
            'evaluation': {
                'coverage': evaluation['coverage'],
                'preference_score': evaluation['preference_score'],
                'hours_stats': evaluation['hours_stats'],
                'violations': evaluation['violations']
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
      logger.exception("Error generating schedule")
      db.session.rollback()  # Rollback any database changes
      return jsonify({'error': str(e)}), 500