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
    
    def tournament_select(self, population: List[np.ndarray], fitness_scores: List[float]) -> np.ndarray:
        """Select a schedule using tournament selection."""
        # Randomly select tournament_size schedules
        tournament_indices = random.sample(range(len(population)), self.tournament_size)
        tournament_fitness = [fitness_scores[i] for i in tournament_indices]
        
        # Select the best one
        winner_idx = tournament_indices[np.argmax(tournament_fitness)]
        return population[winner_idx].copy()
    
    def crossover(self, parent1: np.ndarray, parent2: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Perform crossover between two parent schedules."""
        if random.random() > self.crossover_rate:
            return parent1.copy(), parent2.copy()
        
        # Perform single-point crossover by shift
        crossover_point = random.randint(1, len(self.shifts) - 1)
        
        child1 = np.vstack([parent1[:crossover_point], parent2[crossover_point:]])
        child2 = np.vstack([parent2[:crossover_point], parent1[crossover_point:]])
        
        return child1, child2
    
    def mutate(self, schedule: np.ndarray) -> np.ndarray:
        """Mutate a schedule by randomly changing some shift assignments."""
        mutated = schedule.copy()
        
        # For each shift, there's a chance of mutation
        for shift_idx, shift in enumerate(self.shifts):
            if random.random() < self.mutation_rate:
                # Get the required staff for this shift
                required = shift.required_staff
                duration = shift.duration
                
                # Clear current assignments for this shift
                mutated[shift_idx] = np.zeros(len(self.employees))
                
                # Calculate current hours for each employee (excluding this shift)
                current_hours = self.calculate_employee_hours(mutated)
                
                # Find eligible employees
                eligible = []
                for emp_idx, emp in enumerate(self.employees):
                    if (shift.role_id in emp.skills and 
                        current_hours[emp.id] + duration <= emp.max_hours):
                        eligible.append(emp_idx)
                
                # Randomly assign up to the required number
                if eligible and required > 0:
                    to_assign = min(len(eligible), required)
                    assigned = random.sample(eligible, to_assign)
                    
                    for emp_idx in assigned:
                        mutated[shift_idx][emp_idx] = 1
        
        return mutated
    
    def run(self, time_limit_seconds: Optional[int] = None) -> Tuple[Schedule, float, Dict[str, Any]]:
        """
        Run the genetic algorithm to find a good schedule.
        
        Args:
            time_limit_seconds: Optional time limit in seconds
            
        Returns:
            Tuple of (best_schedule, best_fitness, stats)
        """
        start_time = time.time()
        
        # Create initial population
        population = self.create_initial_population()
        
        # Track the best schedule
        best_schedule_matrix = None
        best_fitness = -1
        
        # Stats for tracking progress
        stats = {
            "fitness_history": [],
            "coverage_history": [],
            "generation_times": [],
            "total_generations": 0
        }
        
        for generation in range(self.generations):
            gen_start_time = time.time()
            
            # Check time limit if specified
            if time_limit_seconds and (time.time() - start_time) > time_limit_seconds:
                logger.info(f"Time limit reached after {generation} generations")
                break
            
            # Evaluate fitness for each schedule
            fitness_scores = [self.calculate_fitness(schedule) for schedule in population]
            
            # Find the best schedule in this generation
            best_idx = np.argmax(fitness_scores)
            generation_best_fitness = fitness_scores[best_idx]
            
            # Track stats
            stats["fitness_history"].append(generation_best_fitness)
            
            # Create a Schedule object to calculate coverage
            temp_schedule = Schedule(self.employees, self.shifts)
            temp_schedule.assignments = population[best_idx]
            coverage = temp_schedule.calculate_coverage()
            stats["coverage_history"].append(coverage["coverage_percent"])
            
            # Update best overall schedule if improved
            if generation_best_fitness > best_fitness:
                best_fitness = generation_best_fitness
                best_schedule_matrix = population[best_idx].copy()
                logger.info(f"Generation {generation}: New best fitness = {best_fitness} "
                           f"(Coverage: {coverage['coverage_percent']:.1f}%)")
            
            # Create the next generation
            next_population = []
            
            # Elitism - keep the best schedules
            elite_indices = np.argsort(fitness_scores)[-self.elite_size:]
            for idx in elite_indices:
                next_population.append(population[idx].copy())
            
            # Fill the rest of the population with children
            while len(next_population) < self.population_size:
                # Select parents
                parent1 = self.tournament_select(population, fitness_scores)
                parent2 = self.tournament_select(population, fitness_scores)
                
                # Create children through crossover and mutation
                child1, child2 = self.crossover(parent1, parent2)
                child1 = self.mutate(child1)
                child2 = self.mutate(child2)
                
                next_population.append(child1)
                if len(next_population) < self.population_size:
                    next_population.append(child2)
            
            # Replace the old population
            population = next_population
            
            # Track generation time
            generation_time = time.time() - gen_start_time
            stats["generation_times"].append(generation_time)
        
        # Record total generations completed
        stats["total_generations"] = len(stats["fitness_history"])
        stats["total_time"] = time.time() - start_time
        stats["avg_generation_time"] = stats["total_time"] / stats["total_generations"] if stats["total_generations"] > 0 else 0
        
        # Create final Schedule object from the best solution
        final_schedule = Schedule(self.employees, self.shifts)
        if best_schedule_matrix is not None:
            final_schedule.assignments = best_schedule_matrix
            
            # Add final stats
            coverage = final_schedule.calculate_coverage()
            stats["final_coverage"] = coverage
            
            if self.preferences:
                stats["preference_satisfaction"] = self.preferences.calculate_satisfaction(final_schedule)
            
            hours = final_schedule.get_employee_hours()
            stats["employee_hours"] = hours
            stats["hours_std_dev"] = np.std(list(hours.values())) if hours else 0
        
        return final_schedule, best_fitness, stats