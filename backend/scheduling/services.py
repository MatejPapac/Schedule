from typing import List, Dict, Tuple, Optional, Any
import logging
from datetime import datetime, timedelta
import numpy as np
import json

from .models.schedule import Employee, Shift, Schedule, PreferenceSet
from .algorithms.genetic import SchedulingGA
from .utils.data_gen import generate_employees, generate_shifts, generate_preferences

# Set up logging
logger = logging.getLogger(__name__)


class SchedulingService:
    """
    Service for handling scheduling operations.
    This class provides an interface between the API endpoints and the scheduling algorithms.
    """
    
    @staticmethod
    def generate_schedule(
        employees: List[Employee],
        shifts: List[Shift],
        preferences: Optional[PreferenceSet] = None,
        algorithm_params: Optional[Dict[str, Any]] = None,
        time_limit_seconds: Optional[int] = None
    ) -> Tuple[Schedule, Dict[str, Any]]:
        """
        Generate a schedule using the genetic algorithm.
        
        Args:
            employees: List of Employee objects
            shifts: List of Shift objects
            preferences: Optional PreferenceSet with employee preferences
            algorithm_params: Optional parameters for the algorithm
            time_limit_seconds: Optional time limit in seconds
            
        Returns:
            Tuple of (schedule, stats)
        """
        # Set default algorithm parameters if not provided
        if algorithm_params is None:
            algorithm_params = {}
        
        # Create and configure the genetic algorithm
        scheduler = SchedulingGA(
            employees=employees,
            shifts=shifts,
            preferences=preferences,
            population_size=algorithm_params.get('population_size', 50),
            generations=algorithm_params.get('generations', 100),
            crossover_rate=algorithm_params.get('crossover_rate', 0.8),
            mutation_rate=algorithm_params.get('mutation_rate', 0.2),
            elite_size=algorithm_params.get('elite_size', 5),
            tournament_size=algorithm_params.get('tournament_size', 3),
            coverage_weight=algorithm_params.get('coverage_weight', 1000),
            balance_weight=algorithm_params.get('balance_weight', 200),
            preference_weight=algorithm_params.get('preference_weight', 50),
            constraint_weight=algorithm_params.get('constraint_weight', 500)
        )
        
        # Run the algorithm
        logger.info(f"Starting schedule generation with {len(employees)} employees and {len(shifts)} shifts")
        start_time = datetime.now()
        
        schedule, fitness, stats = scheduler.run(time_limit_seconds=time_limit_seconds)
        
        # Log completion
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Schedule generation completed in {duration:.2f} seconds with fitness {fitness:.2f}")
        
        # Add to stats
        stats['fitness'] = fitness
        stats['duration_seconds'] = duration
        
        return schedule, stats
    
    @staticmethod
    def create_test_schedule(
        num_employees: int = 15,
        num_days: int = 7,
        num_roles: int = 5,
        shifts_per_day: int = 3,
        algorithm_params: Optional[Dict[str, Any]] = None,
        time_limit_seconds: Optional[int] = 60
    ) -> Tuple[Schedule, Dict[str, Any]]:
        """
        Create a test schedule using generated data.
        
        Args:
            num_employees: Number of employees to generate
            num_days: Number of days to generate shifts for
            num_roles: Number of different roles
            shifts_per_day: Number of shifts per day
            algorithm_params: Optional parameters for the algorithm
            time_limit_seconds: Optional time limit in seconds
            
        Returns:
            Tuple of (schedule, stats)
        """
        # Generate test data
        employees = generate_employees(num_employees=num_employees, num_roles=num_roles)
        shifts = generate_shifts(num_days=num_days, shifts_per_day=shifts_per_day, num_roles=num_roles)
        preferences = generate_preferences(employees=employees, shifts=shifts)
        
        # Generate schedule
        return SchedulingService.generate_schedule(
            employees=employees,
            shifts=shifts,
            preferences=preferences,
            algorithm_params=algorithm_params,
            time_limit_seconds=time_limit_seconds
        )
    
    @staticmethod
    def evaluate_schedule(
        schedule: Schedule,
        preferences: Optional[PreferenceSet] = None
    ) -> Dict[str, Any]:
        """
        Evaluate the quality of a schedule.
        
        Args:
            schedule: The schedule to evaluate
            preferences: Optional PreferenceSet with employee preferences
            
        Returns:
            Dictionary with evaluation metrics
        """
        # Check for constraint violations
        violations = schedule.check_constraints()
        
        # Calculate coverage
        coverage = schedule.calculate_coverage()
        
        # Calculate hours stats
        hours = schedule.get_employee_hours()
        hours_values = list(hours.values())
        hours_stats = {
            'total_hours': sum(hours_values),
            'avg_hours': sum(hours_values) / len(hours_values) if hours_values else 0,
            'min_hours': min(hours_values) if hours_values else 0,
            'max_hours': max(hours_values) if hours_values else 0,
            'std_dev_hours': round(float(np.std(hours_values)) * 100) / 100 if hours_values else 0
        }
        
        # Calculate preference satisfaction if preferences provided
        preference_score = None
        if preferences:
            preference_score = preferences.calculate_satisfaction(schedule)
        
        return {
            'violations': violations,
            'coverage': coverage,
            'hours_stats': hours_stats,
            'preference_score': preference_score,
            'employee_hours': hours
        }
    
    @staticmethod
    def schedule_to_dict(schedule: Schedule) -> Dict[str, Any]:
        """
        Convert a schedule to a dictionary format suitable for JSON serialization.
        
        Args:
            schedule: Schedule object
            
        Returns:
            Dictionary representation of the schedule
        """
        # Create a basic dict representation
        schedule_dict = {
            'shifts': [],
            'employees': []
        }
        
        # Add employees info
        for employee in schedule.employees:
            emp_dict = {
                'id': employee.id,
                'name': employee.name,
                'max_hours': employee.max_hours,
                'skills': employee.skills,
                'assigned_hours': 0  # Will be filled in below
            }
            schedule_dict['employees'].append(emp_dict)
        
        # Add shifts and assignments
        for shift_idx, shift in enumerate(schedule.shifts):
            shift_dict = {
                'id': shift.id,
                'start_time': shift.start_time.isoformat(),
                'end_time': shift.end_time.isoformat(),
                'role_id': shift.role_id,
                'required_staff': shift.required_staff,
                'assigned_employees': []
            }
            
            # Add assignments
            for emp_idx, employee in enumerate(schedule.employees):
                if schedule.assignments[shift_idx, emp_idx] == 1:
                    shift_dict['assigned_employees'].append(employee.id)
                    
                    # Update employee's assigned hours
                    emp_dict = next(e for e in schedule_dict['employees'] if e['id'] == employee.id)
                    emp_dict['assigned_hours'] += shift.duration
            
            schedule_dict['shifts'].append(shift_dict)
        
        return schedule_dict
    
    @staticmethod
    def dict_to_schedule(schedule_dict: Dict[str, Any]) -> Schedule:
        """
        Convert a dictionary representation back to a Schedule object.
        
        Args:
            schedule_dict: Dictionary representation of a schedule
            
        Returns:
            Schedule object
        """
        # Create employees
        employees = []
        for emp_dict in schedule_dict['employees']:
            employee = Employee(
                id=emp_dict['id'],
                name=emp_dict['name'],
                max_hours=emp_dict['max_hours'],
                skills=emp_dict['skills']
            )
            employees.append(employee)
        
        # Create shifts
        shifts = []
        for shift_dict in schedule_dict['shifts']:
            shift = Shift(
                id=shift_dict['id'],
                start_time=datetime.fromisoformat(shift_dict['start_time']),
                end_time=datetime.fromisoformat(shift_dict['end_time']),
                role_id=shift_dict['role_id'],
                required_staff=shift_dict.get('required_staff', 1)
            )
            shifts.append(shift)
        
        # Create schedule
        schedule = Schedule(employees, shifts)
        
        # Add assignments
        for shift_dict in schedule_dict['shifts']:
            shift_idx = next(i for i, s in enumerate(shifts) if s.id == shift_dict['id'])
            
            for emp_id in shift_dict['assigned_employees']:
                emp_idx = next(i for i, e in enumerate(employees) if e.id == emp_id)
                schedule.assign(shift_idx, emp_idx, 1)
        
        return schedule