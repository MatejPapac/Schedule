
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Set, Optional
import numpy as np


@dataclass
class Employee:
    """Model representing an employee."""
    id: str
    name: str
    max_hours: float
    skills: List[int]  # List of role IDs the employee can perform
    
    def can_perform_role(self, role_id: int) -> bool:
        """Check if employee can perform a specific role."""
        return role_id in self.skills


@dataclass
class Shift:
    """Model representing a shift."""
    id: int
    start_time: datetime
    end_time: datetime
    role_id: int
    required_staff: int = 1
    
    @property
    def duration(self) -> float:
        """Calculate shift duration in hours."""
        delta = self.end_time - self.start_time
        return delta.total_seconds() / 3600

    @property
    def day_of_week(self) -> int:
        """Get the day of week (0 = Monday, 6 = Sunday)."""
        return self.start_time.weekday()
    
    def __str__(self) -> str:
        """String representation of the shift."""
        day_name = self.start_time.strftime("%a")
        start_str = self.start_time.strftime("%H:%M")
        end_str = self.end_time.strftime("%H:%M")
        return f"{day_name} {start_str}-{end_str} (Role {self.role_id})"


class Schedule:
    """
    Represents a complete schedule with shift assignments.
    """
    def __init__(self, employees: List[Employee], shifts: List[Shift]):
        self.employees = employees
        self.shifts = shifts
        
        # Create assignment matrix (shift_id, employee_id)
        self.assignments = np.zeros((len(shifts), len(employees)))
        
        # Cache for quick lookups
        self._employee_idx = {emp.id: i for i, emp in enumerate(employees)}
        self._shift_idx = {shift.id: i for i, shift in enumerate(shifts)}
    
    def assign(self, shift_idx: int, employee_idx: int, value: int = 1) -> None:
        """Assign an employee to a shift."""
        self.assignments[shift_idx, employee_idx] = value
    
    def get_employee_hours(self) -> Dict[str, float]:
        """Calculate hours worked for each employee."""
        hours = {emp.id: 0.0 for emp in self.employees}
        
        for shift_idx, shift in enumerate(self.shifts):
            for emp_idx, employee in enumerate(self.employees):
                if self.assignments[shift_idx, emp_idx] == 1:
                    hours[employee.id] += shift.duration
        
        return hours
    
    def get_employee_assignments(self, employee_id: str) -> List[Shift]:
        """Get all shifts assigned to a specific employee."""
        if employee_id not in self._employee_idx:
            return []
            
        emp_idx = self._employee_idx[employee_id]
        assigned_shifts = []
        
        for shift_idx, shift in enumerate(self.shifts):
            if self.assignments[shift_idx, emp_idx] == 1:
                assigned_shifts.append(shift)
                
        return assigned_shifts
    
    def get_shift_assignments(self, shift_id: int) -> List[Employee]:
        """Get all employees assigned to a specific shift."""
        if shift_id not in self._shift_idx:
            return []
            
        shift_idx = self._shift_idx[shift_id]
        assigned_employees = []
        
        for emp_idx, employee in enumerate(self.employees):
            if self.assignments[shift_idx, emp_idx] == 1:
                assigned_employees.append(employee)
                
        return assigned_employees
    
    def check_constraints(self) -> Dict[str, int]:
        """
        Check for constraint violations.
        
        Returns:
            Dict containing count of each type of violation
        """
        violations = {
            "max_hours_exceeded": 0,
            "unqualified_roles": 0,
            "unfilled_shifts": 0
        }
        
        # Check max hours
        hours = self.get_employee_hours()
        for emp_id, worked_hours in hours.times():
            emp = next(e for e in self.employees if e.id == emp_id)
            if worked_hours > emp.max_hours:
                violations["max_hours_exceeded"] += 1

        # Check for qualifications

        for shift_idx, shift in enumerate(self.shifts):
            for emp_idx, employee in enumerate(self.employees):
                if self.assigments[shift_idx,emp_idx] == 1:
                    if self.role_id not in employee.skills:
                        violations['unqualified_roles'] += 1

        # Check for unfilled shifts

        for shift_idx, shift in enumerate(self.shifts):
            assigned = sum(self.assignments[shift_idx])
            if assigned < shift.required_staff:
                violations["unfilled_shifts"] += 1
        
        return  violations
    

    def to_dict(self) -> List[Dict]:
        """Convert schedule to dictionary format."""
        result = []
        
        for shift_idx, shift in enumerate(self.shifts):
            assigned = []
            for emp_idx, employee in enumerate(self.employees):
                if self.assignments[shift_idx, emp_idx] == 1:
                    assigned.append(employee.id)
            
            if assigned:
                result.append({
                    'shift_id': shift.id,
                    'start_time': shift.start_time,
                    'end_time': shift.end_time,
                    'role_id': shift.role_id,
                    'assigned_employees': assigned
                })
        
        return result

    def calculate_coverage(self) -> Dict:
        """Calculate schedule coverage metrics."""
        total_required = sum(shift.required_staff for shift in self.shifts)
        total_assigned = 0
        
        for shift_idx, shift in enumerate(self.shifts):
            assigned = sum(self.assignments[shift_idx])
            total_assigned += min(assigned, shift.required_staff)
        
        return {
            "total_required": total_required,
            "total_assigned": total_assigned,
            "coverage_percent": (total_assigned / total_required * 100) if total_required > 0 else 0
        }


@dataclass
class PreferenceSet:
    """Stores employee preferences for shifts."""
    # Preferences stored as (employee_id, shift_id) -> score (1-5)
    # 1 = strongly avoid, 3 = neutral, 5 = strongly prefer
    preferences: Dict[tuple, int] = None
    
    def __post_init__(self):
        if self.preferences is None:
            self.preferences = {}
    
    def set_preference(self, employee_id: str, shift_id: int, score: int) -> None:
        """Set a preference score."""
        if not 1 <= score <= 5:
            raise ValueError("Preference score must be between 1 and 5")
        self.preferences[(employee_id, shift_id)] = score
    
    def get_preference(self, employee_id: str, shift_id: int) -> int:
        """Get a preference score (defaults to 3/neutral if not set)."""
        return self.preferences.get((employee_id, shift_id), 3)
    
    def calculate_satisfaction(self, schedule: Schedule) -> float:
        """
        Calculate the average preference satisfaction for a schedule.
        Returns a value from -2 to +2 where:
        - +2: All assignments match strong preferences
        - 0: All assignments match neutral preferences
        - -2: All assignments match strong avoidances
        """
        satisfaction_scores = []
        
        for shift_idx, shift in enumerate(schedule.shifts):
            for emp_idx, employee in enumerate(schedule.employees):
                if schedule.assignments[shift_idx, emp_idx] == 1:
                    pref = self.get_preference(employee.id, shift.id)
                    # Convert 1-5 scale to -2 to +2 scale
                    normalized = pref - 3
                    satisfaction_scores.append(normalized)
        
        if not satisfaction_scores:
            return 0
            
        return sum(satisfaction_scores) / len(satisfaction_scores)