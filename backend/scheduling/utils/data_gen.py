import random
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Set, Optional
import uuid

from ..models.schedule import Employee, Shift, PreferenceSet


def generate_employees(
    num_employees: int = 15,
    num_roles: int = 5,
    full_time_ratio: float = 0.6,
    part_time_ratio: float = 0.2,
    min_skills: int = 1,
    max_skills: int = 3
) -> List[Employee]:
    """
    Generate a list of test employees.
    
    Args:
        num_employees: Number of employees to generate
        num_roles: Number of different roles
        full_time_ratio: Ratio of full-time employees (40h)
        part_time_ratio: Ratio of part-time employees (24h)
        min_skills: Minimum number of skills per employee
        max_skills: Maximum number of skills per employee
        
    Returns:
        List of Employee objects
    """
    employees = []
    
    for i in range(num_employees):
        emp_id = f"EMP{i+1:03d}"
        
        # Assign max weekly hours based on ratios
        if i < num_employees * part_time_ratio:  # Part-time
            max_hours = 24
        elif i < num_employees * (part_time_ratio + full_time_ratio):  # Full-time
            max_hours = 40
        else:  # Limited hours
            max_hours = 32
        
        # Assign skills (1-3 skills per employee)
        num_skills = random.randint(min_skills, max_skills)
        emp_skills = random.sample(range(1, num_roles + 1), min(num_skills, num_roles))
        
        employees.append(Employee(
            id=emp_id,
            name=f"Employee {i+1}",
            max_hours=max_hours,
            skills=emp_skills
        ))
    
    return employees


def generate_shifts(
    start_date: Optional[datetime] = None,
    num_days: int = 7,
    shifts_per_day: int = 3,
    num_roles: int = 5,
    staff_per_role: Optional[Dict[int, int]] = None
) -> List[Shift]:
    """
    Generate test shift data for a given period.
    
    Args:
        start_date: Start date for shifts (defaults to beginning of current week)
        num_days: Number of days to generate shifts for
        shifts_per_day: Number of shift patterns per day
        num_roles: Number of roles to generate shifts for
        staff_per_role: Dict mapping role_id to required staff count (defaults to 1-3)
        
    Returns:
        List of Shift objects
    """
    shifts = []
    
    # Default start date (beginning of current week)
    if start_date is None:
        start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date -= timedelta(days=start_date.weekday())  # Adjust to Monday
    
    # Default staff requirements if not provided
    if staff_per_role is None:
        staff_per_role = {role_id: random.randint(1, 3) for role_id in range(1, num_roles + 1)}
    
    # Shift patterns
    shift_patterns = [
        {"start": 8, "end": 16, "name": "Morning"},   # 8 AM - 4 PM
        {"start": 16, "end": 24, "name": "Evening"},  # 4 PM - 12 AM
        {"start": 0, "end": 8, "name": "Night"}       # 12 AM - 8 AM
    ][:shifts_per_day]  # Take only the requested number of patterns
    
    shift_id = 0
    for day in range(num_days):
        current_date = start_date + timedelta(days=day)
        
        for pattern in shift_patterns:
            for role_id in range(1, num_roles + 1):
                shift_start = current_date + timedelta(hours=pattern["start"])
                shift_end = current_date + timedelta(hours=pattern["end"])
                
                # Set requirements (busier on weekends, evenings)
                base_requirement = staff_per_role.get(role_id, 1)
                
                # Weekend boost
                if day >= 5:  # Saturday and Sunday
                    base_requirement = min(base_requirement + 1, 5)  # Cap at 5 employees
                
                # Evening/night shift adjustment
                if pattern["name"] == "Evening":
                    base_requirement = min(base_requirement + 1, 5)
                elif pattern["name"] == "Night":
                    base_requirement = max(1, base_requirement - 1)  # Less staff at night, min 1
                
                # Create shift
                shifts.append(Shift(
                    id=shift_id,
                    start_time=shift_start,
                    end_time=shift_end,
                    role_id=role_id,
                    required_staff=base_requirement
                ))
                shift_id += 1
    
    return shifts


def generate_preferences(
    employees: List[Employee],
    shifts: List[Shift],
    coverage: float = 0.3,
    distribution: Optional[Dict[int, float]] = None
) -> PreferenceSet:
    """
    Generate employee preferences for shifts.
    
    Args:
        employees: List of Employee objects
        shifts: List of Shift objects
        coverage: Percentage of employee-shift combinations to generate preferences for
        distribution: Dict mapping preference scores (1-5) to probability (defaults to normal-ish)
        
    Returns:
        PreferenceSet object containing the generated preferences
    """
    preferences = PreferenceSet()
    
    # Default distribution if not provided (more neutral preferences)
    if distribution is None:
        distribution = {
            1: 0.1,  # Strongly avoid (10%)
            2: 0.2,  # Avoid (20%)
            3: 0.4,  # Neutral (40%)
            4: 0.2,  # Prefer (20%)
            5: 0.1   # Strongly prefer (10%)
        }
    
    # For each employee, generate some random preferences
    for employee in employees:
        # Determine which shifts to set preferences for
        num_preferences = int(len(shifts) * coverage)
        preference_shifts = random.sample(range(len(shifts)), num_preferences)
        
        for shift_idx in preference_shifts:
            shift = shifts[shift_idx]
            
            # Only set preferences for roles the employee can perform
            if shift.role_id in employee.skills:
                # Select preference score based on distribution
                pref_score = random.choices(
                    population=list(distribution.keys()),
                    weights=list(distribution.values()),
                    k=1
                )[0]
                
                preferences.set_preference(employee.id, shift.id, pref_score)
    
    return preferences


def generate_test_dataset(
    num_employees: int = 15,
    num_days: int = 7,
    num_roles: int = 5,
    shifts_per_day: int = 3,
    preference_coverage: float = 0.3
) -> Tuple[List[Employee], List[Shift], PreferenceSet]:
    """
    Generate a complete test dataset with employees, shifts, and preferences.
    
    Args:
        num_employees: Number of employees to generate
        num_days: Number of days to generate shifts for
        num_roles: Number of different roles
        shifts_per_day: Number of shifts per day
        preference_coverage: Percentage of shifts to set preferences for
        
    Returns:
        Tuple of (employees, shifts, preferences)
    """
    print(f"Generating test dataset with {num_employees} employees and {num_roles} roles")
    
    # Generate employees
    employees = generate_employees(
        num_employees=num_employees,
        num_roles=num_roles
    )
    
    # Generate shifts
    shifts = generate_shifts(
        num_days=num_days,
        shifts_per_day=shifts_per_day,
        num_roles=num_roles
    )
    
    # Generate preferences
    preferences = generate_preferences(
        employees=employees,
        shifts=shifts,
        coverage=preference_coverage
    )
    
    print(f"Generated {len(employees)} employees, {len(shifts)} shifts, and {len(preferences.preferences)} preferences")
    
    return employees, shifts, preferences