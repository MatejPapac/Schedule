from marshmallow import Schema, fields, validate, validates, ValidationError
from datetime import datetime

class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    username = fields.Str(required=True, validate=validate.Length(min=3, max=64))
    password = fields.Str(load_only=True, required=True, validate=validate.Length(min=6))
    name = fields.Str(required=True)
    email = fields.Email(required=True)
    user_type = fields.Str(required=True)
    target_hours = fields.Float(missing=40.0)
    active = fields.Bool(missing=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    
    # Format for Method field
    capable_roles = fields.Method(
        serialize="serialize_capable_roles", 
        deserialize="deserialize_capable_roles"
    )
    
    def serialize_capable_roles(self, obj):
        return [role.id for role in obj.capable_roles]
    
    def deserialize_capable_roles(self, value, attr, obj, **kwargs):
        return value  

class UserUpdateSchema(Schema):
    name = fields.Str()
    email = fields.Email()
    user_type = fields.Str(validate=validate.OneOf(['employee', 'manager']))
    target_hours = fields.Float()
    active = fields.Bool()
    capable_roles = fields.List(fields.Int())
    password = fields.Str(validate=validate.Length(min=6), load_only=True)

class RoleSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=64))
    description = fields.Str(missing="")
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

class ShiftRequirementSchema(Schema):
    id = fields.Int(dump_only=True)
    start_time = fields.DateTime(required=True)
    end_time = fields.DateTime(required=True)
    role_id = fields.Int(required=True)
    employee_count = fields.Int(required=True, validate=validate.Range(min=1))
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    @validates('end_time')
    def validate_end_time(self, end_time, **kwargs):
        start_time = self.context.get('start_time')
        if start_time and end_time <= start_time:
            raise ValidationError('End time must be after start time')


class TimeOffRequestSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    start_time = fields.DateTime(required=True)
    end_time = fields.DateTime(required=True)
    reason = fields.Str(missing="")
    status = fields.Str(missing='pending', validate=validate.OneOf(['pending', 'approved', 'denied']))
    requested_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    @validates('end_time')
    def validate_end_time(self, end_time, **kwargs):
        start_time = self.context.get('start_time')
        if start_time and end_time <= start_time:
            raise ValidationError('End time must be after start time')


class TimeOffResponseSchema(Schema):
    id = fields.Int(required=True)
    status = fields.Str(required=True, validate=validate.OneOf(['approved', 'denied']))

class UserDayPreferenceSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    day_of_week = fields.Int(required=True, validate=validate.Range(min=0, max=6))
    preference_level = fields.Int(missing=1, validate=validate.Range(min=1, max=5))
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

class UserRolePreferenceSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    role_id = fields.Int(required=True)
    preference_level = fields.Int(missing=1, validate=validate.Range(min=1, max=5))
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

class AssignedShiftSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    role_id = fields.Int(required=True)
    start_time = fields.DateTime(required=True)
    end_time = fields.DateTime(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    
    @validates('end_time')
    def validate_end_time(self, end_time, **kwargs):
        start_time = self.context.get('start_time')
        if start_time and end_time <= start_time:
            raise ValidationError('End time must be after start time')

class LoginSchema(Schema):
    username = fields.Str(required=True)
    password = fields.Str(required=True)

class ScheduleGenerationSchema(Schema):
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
    
    @validates('end_date')
    def validate_end_date(self, end_date, **kwargs):
        start_date = self.context.get('start_date')
        if start_date and end_date <= start_date:
            raise ValidationError('End date must be after start date')