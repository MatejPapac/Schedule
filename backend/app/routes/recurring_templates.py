from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from datetime import datetime, timedelta, time
from app import db
from app.models.models import RecurringShiftTemplate, Role, ShiftRequirement
from app.schemas import RecurringShiftTemplateSchema

recurring_templates_bp = Blueprint('recurring_templates', __name__)

# Helper function to check if user is manager
def check_manager():
    identity = get_jwt_identity()
    return identity['type'] == 'manager'

# Get all recurring templates (managers only)
@recurring_templates_bp.route('', methods=['GET'])
@jwt_required()
def get_recurring_templates():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get role filter from query parameters
        role_id = request.args.get('role_id')
        
        # Build query
        query = RecurringShiftTemplate.query
        
        if role_id:
            query = query.filter_by(role_id=role_id)
        
        # Get templates
        templates = query.all()
        
        # Serialize templates
        schema = RecurringShiftTemplateSchema(many=True)
        templates_data = schema.dump(templates)
        
        return jsonify(templates_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get single recurring template
@recurring_templates_bp.route('/<int:template_id>', methods=['GET'])
@jwt_required()
def get_recurring_template(template_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get template from database
        template = RecurringShiftTemplate.query.get(template_id)
        
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        # Serialize template
        schema = RecurringShiftTemplateSchema()
        template_data = schema.dump(template)
        
        return jsonify(template_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create new recurring template (managers only)
@recurring_templates_bp.route('', methods=['POST'])
@jwt_required()
def create_recurring_template():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Validate request data
        schema = RecurringShiftTemplateSchema()
        data = schema.load(request.json)
        
        # Check if role exists
        role = Role.query.get(data['role_id'])
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Create new template
        template = RecurringShiftTemplate(
            role_id=data['role_id'],
            start_time=data['start_time'],
            end_time=data['end_time'],
            employee_count=data['employee_count'],
            monday=data.get('monday', False),
            tuesday=data.get('tuesday', False),
            wednesday=data.get('wednesday', False),
            thursday=data.get('thursday', False),
            friday=data.get('friday', False),
            saturday=data.get('saturday', False),
            sunday=data.get('sunday', False),
            is_active=data.get('is_active', True)
        )
        
        # Save to database
        db.session.add(template)
        db.session.commit()
        
        # Serialize and return created template
        result = schema.dump(template)
        
        return jsonify(result), 201
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Update recurring template (managers only)
@recurring_templates_bp.route('/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_recurring_template(template_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get template from database
        template = RecurringShiftTemplate.query.get(template_id)
        
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        # Validate request data
        schema = RecurringShiftTemplateSchema()
        data = schema.load(request.json, partial=True)
        
        # Update fields
        if 'role_id' in data:
            # Check if role exists
            role = Role.query.get(data['role_id'])
            if not role:
                return jsonify({'error': 'Role not found'}), 404
            template.role_id = data['role_id']
            
        if 'start_time' in data:
            template.start_time = data['start_time']
        if 'end_time' in data:
            template.end_time = data['end_time']
        if 'employee_count' in data:
            template.employee_count = data['employee_count']
        if 'monday' in data:
            template.monday = data['monday']
        if 'tuesday' in data:
            template.tuesday = data['tuesday']
        if 'wednesday' in data:
            template.wednesday = data['wednesday']
        if 'thursday' in data:
            template.thursday = data['thursday']
        if 'friday' in data:
            template.friday = data['friday']
        if 'saturday' in data:
            template.saturday = data['saturday']
        if 'sunday' in data:
            template.sunday = data['sunday']
        if 'is_active' in data:
            template.is_active = data['is_active']
        
        # Save to database
        db.session.commit()
        
        # Serialize and return updated template
        result = schema.dump(template)
        
        return jsonify(result), 200
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete recurring template (managers only)
@recurring_templates_bp.route('/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_recurring_template(template_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get template from database
        template = RecurringShiftTemplate.query.get(template_id)
        
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        # Delete template
        db.session.delete(template)
        db.session.commit()
        
        return jsonify({'message': 'Template deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Generate shift requirements from templates (managers only)
@recurring_templates_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_shift_requirements():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get request data
        data = request.json
        start_date = datetime.strptime(data.get('start_date'), '%Y-%m-%d').date()
        end_date = datetime.strptime(data.get('end_date'), '%Y-%m-%d').date()
        template_ids = data.get('template_ids', [])  # Optional filter for specific templates
        
        if end_date < start_date:
            return jsonify({'error': 'End date must be after start date'}), 400
        
        # Limit generation to a reasonable period (e.g., 3 months)
        max_days = 90
        if (end_date - start_date).days > max_days:
            return jsonify({'error': f'Date range cannot exceed {max_days} days'}), 400
        
        # Query active templates
        query = RecurringShiftTemplate.query.filter_by(is_active=True)
        
        if template_ids:
            query = query.filter(RecurringShiftTemplate.id.in_(template_ids))
        
        templates = query.all()
        
        if not templates:
            return jsonify({'error': 'No active templates found'}), 404
        
        # Track created requirements
        created_requirements = []
        
        # Generate requirements for each day in the range
        current_date = start_date
        while current_date <= end_date:
            # Get weekday (0 = Monday, 6 = Sunday)
            weekday = current_date.weekday()
            
            # Map weekday to template attributes
            day_map = {
                0: 'monday',
                1: 'tuesday',
                2: 'wednesday',
                3: 'thursday',
                4: 'friday',
                5: 'saturday',
                6: 'sunday'
            }
            
            day_attr = day_map[weekday]
            
            # Generate requirements for each template
            for template in templates:
                # Check if this template applies to this day
                if getattr(template, day_attr):
                    # Create datetime objects for start and end time on this date
                    start_datetime = datetime.combine(current_date, template.start_time)
                    end_datetime = datetime.combine(current_date, template.end_time)
                    
                    # Check if a similar requirement already exists
                    existing = ShiftRequirement.query.filter_by(
                        role_id=template.role_id,
                        start_time=start_datetime,
                        end_time=end_datetime
                    ).first()
                    
                    if not existing:
                        # Create new requirement
                        requirement = ShiftRequirement(
                            role_id=template.role_id,
                            start_time=start_datetime,
                            end_time=end_datetime,
                            employee_count=template.employee_count
                        )
                        
                        db.session.add(requirement)
                        created_requirements.append({
                            'date': current_date.isoformat(),
                            'role_id': template.role_id,
                            'start_time': template.start_time.isoformat(),
                            'end_time': template.end_time.isoformat()
                        })
            
            # Move to next day
            current_date += timedelta(days=1)
        
        # Commit all changes
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully generated {len(created_requirements)} shift requirements',
            'requirements': created_requirements
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500