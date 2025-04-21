from dataclasses import dataclass
from datetime import datetime
from typing import List,Dict,Set,Optional
import numpy as np

@dataclass
class Employee:
    """Model represting and employee. """
    id: str
    name: str
    max_hours: float
    skills:List[int]

    def can_perform_role(self,role_id:int) -> bool:
        'Checks if employee can perform a specific role'
        return role_id in self.skills
    

@dataclass
class Shift:
    '''Model representing a shift'''

    id:int
    start_time:datetime
    end_time: datetime
    role_id: int
    required_staff: int = 1

    @property
    def duration(self) -> float:
        '''Calculate shift duration in hours'''
        delta = self.end_time - self.start_time
        return delta.total_seconds()/ 3600
    
    @property
    def day_of_week(self) -> int:
        '''Get the day of week(0= Monday, 6 = Sunday)'''
        return self.start_time.weekday()
    
    def __str__(self) -> str:
        '''String represntation of the shift'''
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

        # Create assigment matrix (shift_id, employee_id)

        self.assigments = np.zeros((len(shifts), len(employees)))

        # Cache for quick lookups

        self._employee_idx = {emp.id: i for i, emp in enumerate(employees)}
        self._shift_idx = {shift.id: i for i, shift in enumerate(shifts)}

        def assign(self, shift_idx: int, employee_idx: int, value: int = 1) -> None:
            """Assign an employee to a shift."""
            self.assignments[shift_idx, employee_idx] = value
        
        def get_employee_hours(self) -> Dict[str, float]:
            
        
       


