from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.models import AssignedShift, User, WorkHoursLog,Role
from sqlalchemy import func
from datetime import datetime, timedelta

stats_bp = Blueprint('statistics', __name__)

@stats_bp.route('/user/<int:user_id>/hours', methods=['GET'])
@jwt_required()
def get_user_hours(user_id):
    # Get identity from token
    identity = get_jwt_identity()
    
    # Check if user is requesting their own data or is a manager
    if identity['id'] != user_id and identity['type'] != 'manager':
        return jsonify({'error': 'Unauthorized access'}), 403
    
    # Get period from query params (week, month, quarter)
    period = request.args.get('period', 'week')
    
    # Calculate start date based on period
    today = datetime.now().date()
    if period == 'week':
        start_date = today - timedelta(days=today.weekday())
    elif period == 'month':
        start_date = today.replace(day=1)
    elif period == 'quarter':
        month = today.month - 1
        quarter_start_month = (month // 3) * 3 + 1
        start_date = today.replace(month=quarter_start_month, day=1)
    else:
        return jsonify({'error': 'Invalid period'}), 400


# Query hours worked in period
    hours_data = db.session.query(
        WorkHoursLog.date,
        func.sum(WorkHoursLog.hours_worked).label('hours')
    ).filter(
        WorkHoursLog.user_id == user_id,
        WorkHoursLog.date >= start_date
    ).group_by(
        WorkHoursLog.date
    ).all()

    # Format response
    result = {
        'user_id': user_id,
        'period': period,
        'start_date': start_date.isoformat(),
        'end_date': today.isoformat(),
        'daily_hours': [{'date': data.date.isoformat(), 'hours': float(data.hours)} for data in hours_data],
        'total_hours': sum(float(data.hours) for data in hours_data)
    }
    
    return jsonify(result), 200

# Get statistics for hours worked by role
@stats_bp.route('/roles/hours', methods=['GET'])
@jwt_required()
def get_role_hours_stats():
    try:
        # Check if user is a manager
        identity = get_jwt_identity()
        if identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get period from query params (week, month, quarter, all)
        period = request.args.get('period', 'month')
        
        # Calculate start date based on period
        today = datetime.now().date()
        if period == 'week':
            start_date = today - timedelta(days=today.weekday())
        elif period == 'month':
            start_date = today.replace(day=1)
        elif period == 'quarter':
            month = today.month - 1
            quarter_start_month = (month // 3) * 3 + 1
            start_date = today.replace(month=quarter_start_month, day=1)
        elif period == 'all':
            start_date = None
        else:
            return jsonify({'error': 'Invalid period'}), 400
        
        # Build a query
        query = db.session.query(
            Role.id,
            Role.name,
            func.sum(WorkHoursLog.hours_worked).label('total_hours'),
            func.count(func.distinct(WorkHoursLog.user_id)).label('employee_count')

        ).join(
            Role, WorkHoursLog.role_id == Role.id
        ).group_by(
            Role.id,Role.name
        )

        # Apply date filter if not 'all'
        if start_date:
            query = query.filter(WorkHoursLog >= start_date)

            # Execute query
            role_stats = query.all()

            # Format response
            result = {
            'period': period,
            'roles': [
                {
                    'id': stat.id,
                    'name': stat.name,
                    'total_hours': float(stat.total_hours),
                    'employee_count': stat.employee_count
                } for stat in role_stats
            ]
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# Get employee distribution across roles
@stats_bp.route('/roles/distribution', methods=['GET'])
@jwt_required()
def get_role_distribution():
    try:
        # Check if user is a manager
        identity = get_jwt_identity()
        if identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get period from query params
        period = request.args.get('period', 'month')
        
        # Calculate start date based on period
        today = datetime.now().date()
        if period == 'week':
            start_date = today - timedelta(days=today.weekday())
        elif period == 'month':
            start_date = today.replace(day=1)
        elif period == 'quarter':
            month = today.month - 1
            quarter_start_month = (month // 3) * 3 + 1
            start_date = today.replace(month=quarter_start_month, day=1)
        elif period == 'all':
            start_date = None
        else:
            return jsonify({'error': 'Invalid period'}), 400
        
        # Get employee distribution by role
        query = db.session.query(
            User.id,
            User.name.label('user_name'),
            Role.id.label('role_id'),
            Role.name.label('role_name'),
            func.sum(WorkHoursLog.hours_worked).label('hours')
        ).join(
            WorkHoursLog, User.id == WorkHoursLog.user_id
        ).join(
            Role, WorkHoursLog.role_id == Role.id
        ).group_by(
            User.id, User.name, Role.id, Role.name
        )
        
        # Apply date filter if not 'all'
        if start_date:
            query = query.filter(WorkHoursLog.date >= start_date)
        
        distribution = query.all()
        
        # Format data by employee
        employees = {}
        for item in distribution:
            if item.id not in employees:
                employees[item.id] = {
                    'id': item.id,
                    'name': item.user_name,
                    'roles': []
                }
            
            employees[item.id]['roles'].append({
                'id': item.role_id,
                'name': item.role_name,
                'hours': float(item.hours)
            })
        
        result = {
            'period': period,
            'employees': list(employees.values())
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

# Get detailed stats for a specific role
@stats_bp.route('/roles/<int:role_id>/details', methods=['GET'])
@jwt_required()
def get_role_details(role_id):
    try:
        # Check if user is a manager
        identity = get_jwt_identity()
        if identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Check if role exists
        role = Role.query.get(role_id)
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Get period from query params
        period = request.args.get('period', 'month')
        
        # Calculate start date based on period
        today = datetime.now().date()
        if period == 'week':
            start_date = today - timedelta(days=today.weekday())
        elif period == 'month':
            start_date = today.replace(day=1)
        elif period == 'quarter':
            month = today.month - 1
            quarter_start_month = (month // 3) * 3 + 1
            start_date = today.replace(month=quarter_start_month, day=1)
        elif period == 'all':
            start_date = None
        else:
            return jsonify({'error': 'Invalid period'}), 400
        
        # Get daily hours for this role
        daily_query = db.session.query(
            WorkHoursLog.date,
            func.sum(WorkHoursLog.hours_worked).label('hours')
        ).filter(
            WorkHoursLog.role_id == role_id
        ).group_by(
            WorkHoursLog.date
        )
        
        # Apply date filter if not 'all'
        if start_date:
            daily_query = daily_query.filter(WorkHoursLog.date >= start_date)
        
        daily_hours = daily_query.all()
        
        # Get employee breakdown for this role
        employee_query = db.session.query(
            User.id,
            User.name,
            func.sum(WorkHoursLog.hours_worked).label('hours')
        ).join(
            WorkHoursLog, User.id == WorkHoursLog.user_id
        ).filter(
            WorkHoursLog.role_id == role_id
        ).group_by(
            User.id, User.name
        )
        
        # Apply date filter if not 'all'
        if start_date:
            employee_query = employee_query.filter(WorkHoursLog.date >= start_date)
        
        employee_hours = employee_query.all()
        
        # Get top performers (employees with most hours in this role)
        top_performers = sorted(
            employee_hours, 
            key=lambda x: x.hours, 
            reverse=True
        )[:5]  # Top 5
        
        # Format response
        result = {
            'role': {
                'id': role.id,
                'name': role.name,
                'description': role.description
            },
            'period': period,
            'daily_hours': [
                {'date': item.date.isoformat(), 'hours': float(item.hours)}
                for item in daily_hours
            ],
            'total_hours': sum(float(item.hours) for item in daily_hours),
            'employee_breakdown': [
                {'id': item.id, 'name': item.name, 'hours': float(item.hours)}
                for item in employee_hours
            ],
            'top_performers': [
                {'id': item.id, 'name': item.name, 'hours': float(item.hours)}
                for item in top_performers
            ]
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get employee-role efficiency metrics
@stats_bp.route('/efficiency', methods=['GET'])
@jwt_required()
def get_efficiency_metrics():
    try:
        # Check if user is a manager
        identity = get_jwt_identity()
        if identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get period from query params
        period = request.args.get('period', 'month')
        
        # Calculate start date based on period
        today = datetime.now().date()
        if period == 'week':
            start_date = today - timedelta(days=today.weekday())
        elif period == 'month':
            start_date = today.replace(day=1)
        elif period == 'quarter':
            month = today.month - 1
            quarter_start_month = (month // 3) * 3 + 1
            start_date = today.replace(month=quarter_start_month, day=1)
        else:
            return jsonify({'error': 'Invalid period'}), 400
        
        # Get efficiency metrics (average hours per shift by role and employee)
        query = db.session.query(
            User.id.label('user_id'),
            User.name.label('user_name'),
            Role.id.label('role_id'),
            Role.name.label('role_name'),
            func.count(WorkHoursLog.id).label('shift_count'),
            func.sum(WorkHoursLog.hours_worked).label('total_hours'),
            (func.sum(WorkHoursLog.hours_worked) / func.count(WorkHoursLog.id)).label('avg_hours_per_shift')
        ).join(
            WorkHoursLog, User.id == WorkHoursLog.user_id
        ).join(
            Role, WorkHoursLog.role_id == Role.id
        ).filter(
            WorkHoursLog.date >= start_date
        ).group_by(
            User.id, User.name, Role.id, Role.name
        )
        
        metrics = query.all()
        
        # Format response
        result = {
            'period': period,
            'metrics': [
                {
                    'user_id': item.user_id,
                    'user_name': item.user_name,
                    'role_id': item.role_id,
                    'role_name': item.role_name,
                    'shift_count': item.shift_count,
                    'total_hours': float(item.total_hours),
                    'avg_hours_per_shift': float(item.avg_hours_per_shift)
                }
                for item in metrics
            ]
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

