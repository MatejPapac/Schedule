import numpy as np
import random
import time
from typing import List, Dict, Tuple, Optional, Any
import logging

from ..models.schedule import Employee, Shift, Schedule, PreferenceSet

# Set up logging
logger = logging.getLogger(__name__)

class SchedulingGA:
    """
    Genetic Algorithm implementation for employee scheduling.
    """
    def __init__(
        self, 
        employees: List[Employee], 
        shifts: List[Shift], 
        preferences: Optional[PreferenceSet] = None,
        population_size: int = 50,
        generations: int = 100,
        crossover_rate: float = 0.8,
        mutation_rate: float = 0.2,
        elite_size: int = 5,
        tournament_size: int = 3,
        coverage_weight: float = 1000,
        balance_weight: float = 200,
        preference_weight: float = 50,
        constraint_weight: float = 500
    ):
        """
        Initialize the scheduling genetic algorithm.
        
        Args:
            employees: List of Employee objects
            shifts: List of Shift objects
            preferences: Optional PreferenceSet with employee preferences
            population_size: Size of the population
            generations: Number of generations to run
            crossover_rate: Probability of crossover (0-1)
            mutation_rate: Probability of mutation (0-1)
            elite_size: Number of best schedules to keep unchanged
            tournament_size: Size of tournament for selection
            coverage_weight: Weight for shift coverage objective
            balance_weight: Weight for hours balance objective
            preference_weight: Weight for preference satisfaction objective
            constraint_weight: Weight for constraint penalties
        """
        self.employees = employees
        self.shifts = shifts
        self.preferences = preferences or PreferenceSet()
        
        # GA parameters
        self.population_size = population_size
        self.generations = generations
        self.crossover_rate = crossover_rate
        self.mutation_rate = mutation_rate
        self.elite_size = elite_size
        self.tournament_size = tournament_size
        
        # Fitness weights
        self.coverage_weight = coverage_weight
        self.balance_weight = balance_weight
        self.preference_weight = preference_weight
        self.constraint_weight = constraint_weight
        
        # Pre-calculate shift durations
        self.shift_durations = {shift.id: shift.duration for shift in shifts}
        
        # Cache employee skills for quick lookup
        self.employee_skills = {emp.id: set(emp.skills) for emp in employees}
    
    def create_initial_population(self) -> List[np.ndarray]:
        """Create an initial population of random schedules."""
        population = []
        
        for _ in range(self.population_size):
            # Create a random schedule that respects basic constraints
            schedule_matrix = np.zeros((len(self.shifts), len(self.employees)))
            
            # Track assigned hours for each employee
            assigned_hours = {emp.id: 0 for emp in self.employees}
            
            # For each shift, randomly assign employees
            for shift_idx, shift in enumerate(self.shifts):
                required = shift.required_staff
                duration = shift.duration
                
                # Get eligible employees for this shift
                eligible = []
                for emp_idx, emp in enumerate(self.employees):
                    if (shift.role_id in emp.skills and 
                        assigned_hours[emp.id] + duration <= emp.max_hours):
                        eligible.append(emp_idx)
                
                # Randomly assign up to the required number
                if eligible and required > 0:
                    to_assign = min(len(eligible), required)
                    assigned = random.sample(eligible, to_assign)
                    
                    for emp_idx in assigned:
                        schedule_matrix[shift_idx][emp_idx] = 1
                        assigned_hours[self.employees[emp_idx].id] += duration
            
            population.append(schedule_matrix)
        
        return population
    

    def calculate_employee_hours(self, schedule: np.ndarray) -> Dict[str, float]:
        """Calculate the total hours assigned to each employee."""
        employee_hours = {emp.id: 0.0 for emp in self.employees}
        
        for shift_idx, shift in enumerate(self.shifts):
            duration = shift.duration
            for emp_idx, emp in enumerate(self.employees):
                if schedule[shift_idx][emp_idx] == 1:
                    employee_hours[emp.id] += duration
        
        return employee_hours
    

    def calculate_fitness(self, schedule: np.ndarray) -> float:
        """
        Calculate fitness score for a schedule.
        Higher score is better.
        """
        # Initialize score components
        coverage_score = 0
        hours_balance_score = 0
        preference_score = 0
        constraint_penalties = 0
        
        # Calculate employee hours
        employee_hours = self.calculate_employee_hours(schedule)
        
        # 1. Coverage Score (primary objective)
        total_required = sum(shift.required_staff for shift in self.shifts)
        filled = 0
        
        for shift_idx, shift in enumerate(self.shifts):
            required = shift.required_staff
            assigned = int(sum(schedule[shift_idx]))
            filled += min(assigned, required)
        
        coverage_ratio = filled / total_required if total_required > 0 else 1.0
        coverage_score = coverage_ratio * self.coverage_weight
        
        # 2. Hours Balance Score (secondary objective)
        if len(self.employees) > 1:
            # Calculate coefficient of variation (normalized std dev)
            hours_array = np.array(list(employee_hours.values()))
            mean_hours = np.mean(hours_array)
            if mean_hours > 0:
                std_dev = np.std(hours_array)
                cv = std_dev / mean_hours
                # Convert to a score where lower variation is better
                hours_balance_score = (1 - min(cv, 1)) * self.balance_weight
        else:
            hours_balance_score = self.balance_weight  # Perfect score for single employee
        
        # 3. Preference Score (tertiary objective)
        if self.preferences:
            total_pref_score = 0
            total_assignments = 0
            
            for shift_idx, shift in enumerate(self.shifts):
                for emp_idx, emp in enumerate(self.employees):
                    if schedule[shift_idx][emp_idx] == 1:
                        # Get preference score (1-5)
                        pref_value = self.preferences.get_preference(emp.id, shift.id)
                        # Normalize to -2 to +2 range where +2 is most preferred
                        normalized_pref = (pref_value - 3)
                        total_pref_score += normalized_pref
                        total_assignments += 1
            
            if total_assignments > 0:
                avg_pref = total_pref_score / total_assignments
                # Convert to 0-50 scale where 50 is best
                preference_score = (avg_pref + 2) * (self.preference_weight / 4)
        
        # 4. Check for constraint violations
        
        # A. Qualification constraints - employees must be capable of their assigned roles
        for shift_idx, shift in enumerate(self.shifts):
            for emp_idx, emp in enumerate(self.employees):
                if schedule[shift_idx][emp_idx] == 1:
                    if shift.role_id not in emp.skills:
                        constraint_penalties += self.constraint_weight
        
        # B. Maximum hours constraints
        for emp_id, hours in employee_hours.items():
            emp = next(e for e in self.employees if e.id == emp_id)
            if hours > emp.max_hours:
                excess = hours - emp.max_hours
                constraint_penalties += excess * self.constraint_weight
        
        # Calculate final fitness (higher is better)
        fitness = coverage_score + hours_balance_score + preference_score - constraint_penalties
        
        return max(0, fitness)  # Ensure non-negative fitness