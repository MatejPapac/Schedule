# test_ga_scheduler.py
import json
import random
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import numpy as np

# ------------------------------------------------------
# Mock database models for testing
# ------------------------------------------------------
class MockUser:
    def __init__(self, id, name, target_hours, capable_roles, active=True):
        self.id = id
        self.name = name
        self.target_hours = target_hours
        self.capable_roles = capable_roles
        self.active = active

class MockRole:
    def __init__(self, id, name):
        self.id = id
        self.name = name

class MockShiftRequirement:
    def __init__(self, id, role_id, start_time, end_time, employee_count):
        self.id = id
        self.role_id = role_id
        self.start_time = start_time
        self.end_time = end_time
        self.employee_count = employee_count

class MockTimeOffRequest:
    def __init__(self, id, user_id, start_time, end_time, status="approved"):
        self.id = id
        self.user_id = user_id
        self.start_time = start_time
        self.end_time = end_time
        self.status = status

# ------------------------------------------------------
# Helper functions
# ------------------------------------------------------
# Helper function to check for time overlap
def check_overlap(start1, end1, start2, end2):
    return (start1 < end2) and (end1 > start2)

# Helper function to reconstruct the full schedule
def get_reconstructed_schedule(schedule, shifts):
    result = {}
    
    position_idx = 0
    for shift_idx, shift in enumerate(shifts):
        for _ in range(shift['required_staff']):
            employee_id = schedule[position_idx]
            if employee_id is not None:
                if employee_id not in result:
                    result[employee_id] = []
                result[employee_id].append(shift['id'])
            position_idx += 1
    
    return result

# ------------------------------------------------------
# Data Generation Functions
# ------------------------------------------------------
# Generate test data
def generate_test_data(num_employees=15, num_roles=5, num_days=7, shifts_per_day=3):
    # Create roles
    roles = [MockRole(i+1, f"Role {i+1}") for i in range(num_roles)]
    
    # Create employees
    employees = []
    for i in range(num_employees):
        # Randomly assign 1-3 roles to each employee
        num_roles_per_employee = random.randint(1, 3)
        capable_roles = random.sample(roles, min(num_roles_per_employee, len(roles)))
        
        # Determine target hours (24, 32, or 40)
        target_hours = random.choice([24, 32, 40])
        
        employees.append(MockUser(
            id=i+1,
            name=f"Employee {i+1}",
            target_hours=target_hours,
            capable_roles=capable_roles
        ))
    
    # Create shift requirements
    shift_requirements = []
    shift_id = 0
    
    start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Common shift times
    shift_times = [
        (8, 16),   # 8 AM - 4 PM
        (16, 0),   # 4 PM - 12 AM
        (0, 8)     # 12 AM - 8 AM
    ]
    
    for day in range(num_days):
        current_date = start_date + timedelta(days=day)
        
        for shift_time_idx, (start_hour, end_hour) in enumerate(shift_times):
            # Not all shifts are needed every day
            if shift_time_idx >= shifts_per_day:
                continue
                
            shift_start = current_date.replace(hour=start_hour)
            
            # Handle shift that goes to next day
            if end_hour == 0:
                shift_end = (current_date + timedelta(days=1)).replace(hour=0)
            elif end_hour < start_hour:
                shift_end = (current_date + timedelta(days=1)).replace(hour=end_hour)
            else:
                shift_end = current_date.replace(hour=end_hour)
            
            # Create requirements for each role
            for role in roles:
                # Randomly determine how many employees are needed
                if shift_time_idx == 0:  # Morning shift
                    employee_count = random.randint(2, 4)
                elif shift_time_idx == 1:  # Afternoon shift
                    employee_count = random.randint(3, 5)
                else:  # Night shift
                    employee_count = random.randint(1, 3)
                
                shift_requirements.append(MockShiftRequirement(
                    id=shift_id,
                    role_id=role.id,
                    start_time=shift_start,
                    end_time=shift_end,
                    employee_count=employee_count
                ))
                shift_id += 1
    
    # Generate some time off requests
    time_off_requests = []
    for i in range(int(num_employees * 0.3)):  # About 30% of employees have time off
        employee = random.choice(employees)
        day = random.randint(0, num_days - 1)
        duration = random.randint(1, 3)  # 1-3 days off
        
        start_time = (start_date + timedelta(days=day)).replace(hour=0)
        end_time = (start_date + timedelta(days=day + duration)).replace(hour=0)
        
        time_off_requests.append(MockTimeOffRequest(
            id=i,
            user_id=employee.id,
            start_time=start_time,
            end_time=end_time
        ))
    
    return roles, employees, shift_requirements, time_off_requests

# Convert data to the format needed for the algorithm
def prepare_data_for_algorithm(roles, employees, shift_requirements, time_off_requests):
    # Convert employees
    employee_data = []
    for emp in employees:
        employee_data.append({
            'id': emp.id,
            'name': emp.name,
            'max_hours': emp.target_hours,
            'skills': [role.id for role in emp.capable_roles],
            'assigned_shifts': []
        })
    
    # Convert shifts
    shift_data = []
    for req in shift_requirements:
        shift_data.append({
            'id': req.id,
            'start_time': req.start_time,
            'end_time': req.end_time,
            'role_id': req.role_id,
            'required_staff': req.employee_count,
            'assigned_employees': []
        })
    
    # Convert time off requests to map
    time_off_map = {}
    for tor in time_off_requests:
        if tor.user_id not in time_off_map:
            time_off_map[tor.user_id] = []
        time_off_map[tor.user_id].append({
            'start_time': tor.start_time,
            'end_time': tor.end_time
        })
    
    return employee_data, shift_data, time_off_map

# ------------------------------------------------------
# Genetic Algorithm Components
# ------------------------------------------------------
# Calculate fitness for a schedule
def calculate_fitness(schedule, shifts, employees, time_off_map, role_preferences={}, day_preferences={}):
    # Schedule is a list of shift assignments (employee_id or None for each required position)
    
    # Count filled positions
    filled_positions = sum(1 for employee_id in schedule if employee_id is not None)
    total_positions = sum(shift['required_staff'] for shift in shifts)
    
    # Calculate coverage ratio (primary objective)
    coverage_ratio = filled_positions / total_positions if total_positions > 0 else 0
    
    # Calculate penalties for constraint violations
    penalty = 0
    
    # Reconstruct the full schedule from the chromosome
    reconstructed_schedule = get_reconstructed_schedule(schedule, shifts)
    
    # Check for time-off violations
    time_off_violations = 0
    for emp_id, emp_shifts in reconstructed_schedule.items():
        if emp_id in time_off_map:
            for time_off in time_off_map[emp_id]:
                for shift_id in emp_shifts:
                    shift = next((s for s in shifts if s['id'] == shift_id), None)
                    if shift and check_overlap(shift['start_time'], shift['end_time'], 
                                             time_off['start_time'], time_off['end_time']):
                        time_off_violations += 1
    
    # Heavy penalty for time-off violations
    penalty += time_off_violations * 0.5
    
    # Check for role capability violations
    role_violations = 0
    for emp_id, emp_shifts in reconstructed_schedule.items():
        employee = next((e for e in employees if e['id'] == emp_id), None)
        if employee:
            for shift_id in emp_shifts:
                shift = next((s for s in shifts if s['id'] == shift_id), None)
                if shift and shift['role_id'] not in employee['skills']:
                    role_violations += 1
    
    # Heavy penalty for role violations
    penalty += role_violations * 0.5
    
    # Check for overlapping shifts for same employee
    overlap_violations = 0
    for emp_id, emp_shifts in reconstructed_schedule.items():
        emp_shift_objects = [next((s for s in shifts if s['id'] == shift_id), None) 
                            for shift_id in emp_shifts]
        emp_shift_objects = [s for s in emp_shift_objects if s is not None]
        
        # Check each pair of shifts for overlap
        for i in range(len(emp_shift_objects)):
            for j in range(i+1, len(emp_shift_objects)):
                if check_overlap(emp_shift_objects[i]['start_time'], emp_shift_objects[i]['end_time'],
                               emp_shift_objects[j]['start_time'], emp_shift_objects[j]['end_time']):
                    overlap_violations += 1
    
    # Heavy penalty for overlap violations
    penalty += overlap_violations * 0.5
    
    # Calculate hours balance
    assigned_hours = {}
    for emp_id, emp_shifts in reconstructed_schedule.items():
        assigned_hours[emp_id] = 0
        for shift_id in emp_shifts:
            shift = next((s for s in shifts if s['id'] == shift_id), None)
            if shift:
                duration = (shift['end_time'] - shift['start_time']).total_seconds() / 3600  # hours
                assigned_hours[emp_id] += duration
    
    # Calculate hours balance penalty
    hours_penalty = 0
    if assigned_hours:
        max_hours = max(assigned_hours.values()) if assigned_hours else 0
        min_hours = min(assigned_hours.values()) if assigned_hours else 0
        hours_penalty = (max_hours - min_hours) / 40 * 0.1  # Normalize and scale down
    
    # Calculate preference satisfaction (secondary objective)
    preference_score = 0
    for emp_id, emp_shifts in reconstructed_schedule.items():
        for shift_id in emp_shifts:
            shift = next((s for s in shifts if s['id'] == shift_id), None)
            if shift:
                # Role preference
                if emp_id in role_preferences and shift['role_id'] in role_preferences[emp_id]:
                    # Convert 1-5 scale to 0-1 scale (5 being most preferred)
                    pref_value = (role_preferences[emp_id][shift['role_id']] - 1) / 4
                    preference_score += pref_value
                
                # Day preference
                day_of_week = shift['start_time'].weekday()
                if emp_id in day_preferences and day_of_week in day_preferences[emp_id]:
                    pref_value = (day_preferences[emp_id][day_of_week] - 1) / 4
                    preference_score += pref_value
    
    # Normalize preference score
    total_possible_preferences = len(reconstructed_schedule) * 2  # Both role and day
    normalized_pref_score = preference_score / total_possible_preferences if total_possible_preferences > 0 else 0
    
    # Final fitness value (coverage is primary, preferences are secondary)
    fitness = coverage_ratio - penalty + (normalized_pref_score * 0.1)  # Preference has smaller weight
    
    return max(0, fitness)  # Ensure fitness is not negative

# Generate initial population
def generate_initial_population(population_size, shifts, employees, time_off_map):
    population = []
    
    # Calculate chromosome length (total required positions)
    total_positions = sum(shift['required_staff'] for shift in shifts)

    num_greedy = max(1,int(population_size * 0.25))
    for _ in range(num_greedy):
        chromosome = generate_greedy_solution(shift,employees,time_off_map)
        population.append(chromosome)

    for _ in range(population_size-num_greedy):
        # Create a new chromosome
        chromosome = [None] * total_positions

        
        
        # Track assigned shifts per employee to prevent conflicts
        employee_shifts = {emp['id']: [] for emp in employees}

        # Processing shifts for more diversity

        shift_indices = list(range(len(shifts)))
        random.shuffle(shift_indices)
        

        position_tracker = {} 
        position_idx = 0
        for shift_idx, shift in enumerate(shifts):
            for _ in range(shift['required_staff']):
                # Get eligible employees for this shift
                eligible_employees = []
                for emp in employees:
                    # Check if employee has the required skill
                    if shift['role_id'] not in emp['skills']:
                        continue
                    
                    # Check for time off
                    has_time_off = False
                    if emp['id'] in time_off_map:
                        for time_off in time_off_map[emp['id']]:
                            if check_overlap(shift['start_time'], shift['end_time'], 
                                           time_off['start_time'], time_off['end_time']):
                                has_time_off = True
                                break
                    if has_time_off:
                        continue
                    
                    # Check for shift overlap with already assigned shifts
                    has_overlap = False
                    for assigned_shift_idx in employee_shifts[emp['id']]:
                        assigned_shift = shifts[assigned_shift_idx]
                        if check_overlap(shift['start_time'], shift['end_time'],
                                       assigned_shift['start_time'], assigned_shift['end_time']):
                            has_overlap = True
                            break
                    if has_overlap:
                        continue
                    
                    # Employee is eligible
                    eligible_employees.append(emp['id'])
                
                # Randomly assign an eligible employee or leave unassigned
                if eligible_employees:
                    employee_id = random.choice(eligible_employees)
                    chromosome[position_idx] = employee_id
                    employee_shifts[employee_id].append(shift_idx)
                
                position_idx += 1
        
        population.append(chromosome)
    
    return population

# Selection function (tournament selection)
def selection(population, fitnesses, tournament_size=3):
    selected = []
    
    for _ in range(len(population)):
        # Select tournament_size individuals randomly
        tournament_indices = random.sample(range(len(population)), tournament_size)
        tournament_fitnesses = [fitnesses[i] for i in tournament_indices]
        
        # Select the best individual from the tournament
        winner_idx = tournament_indices[tournament_fitnesses.index(max(tournament_fitnesses))]
        selected.append(population[winner_idx])
    
    return selected

# Crossover function (single-point crossover)
def crossover(parent1, parent2, crossover_rate):
    if random.random() > crossover_rate:
        return parent1.copy(), parent2.copy()
    
    # Single point crossover
    crossover_point = random.randint(1, len(parent1) - 1)
    child1 = parent1[:crossover_point] + parent2[crossover_point:]
    child2 = parent2[:crossover_point] + parent1[crossover_point:]
    
    return child1, child2

# Mutation function
def mutation(chromosome, shifts, employees, mutation_rate):
    mutated = chromosome.copy()
    
    for i in range(len(mutated)):
        if random.random() < mutation_rate:
            # 50% chance to clear the assignment
            if random.random() < 0.5:
                mutated[i] = None
            else:
                # Find which shift this position corresponds to
                position_idx = 0
                current_shift_idx = None
                current_position_in_shift = None
                
                for shift_idx, shift in enumerate(shifts):
                    if i >= position_idx and i < position_idx + shift['required_staff']:
                        current_shift_idx = shift_idx
                        current_position_in_shift = i - position_idx
                        break
                    position_idx += shift['required_staff']
                
                if current_shift_idx is not None:
                    current_shift = shifts[current_shift_idx]
                    
                    # Get eligible employees for this shift
                    eligible_employees = []
                    for emp in employees:
                        if current_shift['role_id'] in emp['skills']:
                            eligible_employees.append(emp['id'])
                    
                    if eligible_employees:
                        # Randomly select an eligible employee
                        mutated[i] = random.choice(eligible_employees)
    
    return mutated

# Calculate coverage percentage
def calculate_coverage(schedule, shifts):
    filled_positions = sum(1 for employee_id in schedule if employee_id is not None)
    total_positions = sum(shift['required_staff'] for shift in shifts)
    coverage = (filled_positions / total_positions * 100) if total_positions > 0 else 0
    return coverage

# ------------------------------------------------------
# Main Genetic Algorithm
# ------------------------------------------------------
# The main genetic algorithm
def genetic_algorithm(shifts, employees, time_off_map, role_preferences={}, day_preferences={}, 
                      time_limit_seconds=30, population_size=50, generations=100, 
                      mutation_rate=0.1, crossover_rate=0.8, elitism_count=5):
    start_time = datetime.now()
    
    # Generate initial population
    population = generate_initial_population(population_size, shifts, employees, time_off_map)
    
    # Track the best solution and its fitness
    best_solution = None
    best_fitness = -1
    
    # Track stats for each generation
    generation_stats = []
    
    # Main loop
    for generation in range(generations):
        # Check if time limit is reached
        if (datetime.now() - start_time).total_seconds() > time_limit_seconds:
            break
        
        # Calculate fitness for each individual
        fitnesses = [calculate_fitness(ind, shifts, employees, time_off_map, 
                                       role_preferences, day_preferences) for ind in population]
        
        # Track the best individual
        current_best_idx = fitnesses.index(max(fitnesses))
        current_best_fitness = fitnesses[current_best_idx]
        current_best_solution = population[current_best_idx]
        
        # Update the overall best if needed
        if current_best_fitness > best_fitness:
            best_solution = current_best_solution
            best_fitness = current_best_fitness
        
        # Record generation statistics
        generation_stats.append({
            'generation': generation,
            'best_fitness': current_best_fitness,
            'average_fitness': sum(fitnesses) / len(fitnesses),
            'coverage': calculate_coverage(current_best_solution, shifts)
        })
        
        # Elitism: keep the best individuals
        elites = []
        elite_indices = sorted(range(len(fitnesses)), key=lambda i: fitnesses[i], reverse=True)[:elitism_count]
        for idx in elite_indices:
            elites.append(population[idx])
        
        # Selection
        selected = selection(population, fitnesses)
        
        # Create new population through crossover and mutation
        new_population = []
        
        # Add elites directly
        new_population.extend(elites)
        
        # Fill the rest with crossover and mutation
        while len(new_population) < population_size:
            # Select two parents
            parent1 = random.choice(selected)
            parent2 = random.choice(selected)
            
            # Crossover
            child1, child2 = crossover(parent1, parent2, crossover_rate)
            
            # Mutation
            child1 = mutation(child1, shifts, employees, mutation_rate)
            child2 = mutation(child2, shifts, employees, mutation_rate)
            
            # Add to new population
            new_population.append(child1)
            if len(new_population) < population_size:
                new_population.append(child2)
        
        # Replace old population
        population = new_population
        
        # Print progress
        if generation % 10 == 0:
            coverage = calculate_coverage(current_best_solution, shifts)
            print(f"Generation {generation}: Best Fitness = {current_best_fitness:.4f}, Coverage = {coverage:.2f}%")
    
    # Return the best solution and statistics
    execution_time = (datetime.now() - start_time).total_seconds()
    
    # Calculate final coverage
    coverage = calculate_coverage(best_solution, shifts)
    
    print(f"\nBest solution found after {len(generation_stats)} generations:")
    print(f"- Fitness: {best_fitness:.4f}")
    print(f"- Coverage: {coverage:.2f}%")
    print(f"- Execution time: {execution_time:.2f} seconds")
    
    return best_solution, best_fitness, generation_stats, execution_time

# ------------------------------------------------------
# Output & Analysis Functions
# ------------------------------------------------------
# Convert the best solution to readable format
def format_solution(best_solution, shifts, employees):
    # Create a mapping of shifts to assigned employees
    shift_assignments = {}
    employee_hours = {emp['id']: 0 for emp in employees}
    
    position_idx = 0
    for shift_idx, shift in enumerate(shifts):
        shift_id = shift['id']
        shift_assignments[shift_id] = []
        for _ in range(shift['required_staff']):
            employee_id = best_solution[position_idx]
            if employee_id is not None:
                shift_assignments[shift_id].append(employee_id)
                
                # Calculate hours
                duration = (shift['end_time'] - shift['start_time']).total_seconds() / 3600
                employee_hours[employee_id] += duration
            
            position_idx += 1
    
    # Create a more readable format
    formatted_shifts = []
    for shift in shifts:
        shift_id = shift['id']
        assigned_employees = shift_assignments.get(shift_id, [])
        
        # Get employee names
        assigned_names = []
        for emp_id in assigned_employees:
            emp = next((e for e in employees if e['id'] == emp_id), None)
            if emp:
                assigned_names.append(emp['name'])
        
        formatted_shifts.append({
            'id': shift_id,
            'role_id': shift['role_id'],
            'role_name': f"Role {shift['role_id']}",  # In a real scenario, you'd get the actual name
            'date': shift['start_time'].strftime('%Y-%m-%d'),
            'start_time': shift['start_time'].strftime('%H:%M'),
            'end_time': shift['end_time'].strftime('%H:%M'),
            'required_staff': shift['required_staff'],
            'assigned_employees': assigned_names,
            'assigned_count': len(assigned_employees),
            'coverage_percentage': (len(assigned_employees) / shift['required_staff'] * 100) if shift['required_staff'] > 0 else 0
        })
    
    # Group shifts by date
    shifts_by_date = {}
    for shift in formatted_shifts:
        date = shift['date']
        if date not in shifts_by_date:
            shifts_by_date[date] = []
        shifts_by_date[date].append(shift)
    
    # Format employee assignments
    employee_assignments = []
    for emp in employees:
        emp_shifts = []
        for shift in shifts:
            if emp['id'] in shift_assignments.get(shift['id'], []):
                emp_shifts.append({
                    'date': shift['start_time'].strftime('%Y-%m-%d'),
                    'start_time': shift['start_time'].strftime('%H:%M'),
                    'end_time': shift['end_time'].strftime('%H:%M'),
                    'role_id': shift['role_id']
                })
        
        employee_assignments.append({
            'id': emp['id'],
            'name': emp['name'],
            'target_hours': emp['max_hours'],
            'assigned_hours': employee_hours[emp['id']],
            'utilization_percentage': (employee_hours[emp['id']] / emp['max_hours'] * 100) if emp['max_hours'] > 0 else 0,
            'shifts': emp_shifts
        })
    
    return {
        'shifts_by_date': shifts_by_date,
        'employees': employee_assignments
    }

# Plot generation statistics
def plot_generation_stats(generation_stats):
    if not generation_stats:
        print("No generation statistics to plot")
        return
    
    generations = [stat['generation'] for stat in generation_stats]
    best_fitness = [stat['best_fitness'] for stat in generation_stats]
    avg_fitness = [stat['average_fitness'] for stat in generation_stats]
    coverage = [stat['coverage'] for stat in generation_stats]
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8))
    
    # Plot fitness
    ax1.plot(generations, best_fitness, 'b-', label='Best Fitness')
    ax1.plot(generations, avg_fitness, 'r-', label='Average Fitness')
    ax1.set_xlabel('Generation')
    ax1.set_ylabel('Fitness')
    ax1.set_title('Fitness Progression')
    ax1.legend()
    ax1.grid(True)
    
    # Plot coverage
    ax2.plot(generations, coverage, 'g-', label='Coverage %')
    ax2.set_xlabel('Generation')
    ax2.set_ylabel('Coverage %')
    ax2.set_title('Schedule Coverage Percentage')
    ax2.grid(True)
    
    plt.tight_layout()
    plt.show()

# Save the solution to a JSON file
def save_solution_to_json(solution, output_file='schedule_solution.json'):
    with open(output_file, 'w') as f:
        json.dump(solution, f, indent=2, default=str)
    print(f"Solution saved to {output_file}")

# ------------------------------------------------------
# Main Execution
# ------------------------------------------------------
# Main function to run the test
def main():
    # Generate test data
    print("Generating test data...")
    roles, employees, shift_requirements, time_off_requests = generate_test_data()
    
    # Prepare data for the algorithm
    print("Preparing data for the algorithm...")
    employee_data, shift_data, time_off_map = prepare_data_for_algorithm(
        roles, employees, shift_requirements, time_off_requests)
    
    # Print some statistics
    print(f"Generated {len(roles)} roles")
    print(f"Generated {len(employees)} employees")
    print(f"Generated {len(shift_requirements)} shift requirements")
    print(f"Generated {len(time_off_requests)} time off requests")
    
    # Sample role and day preferences (in a real scenario, these would come from your database)
    role_preferences = {}
    day_preferences = {}
    
    # Assign some random preferences
    for emp in employee_data:
        # Role preferences
        role_preferences[emp['id']] = {}
        for role_id in emp['skills']:
            # 1-5 scale (5 = strongly prefer, 1 = strongly avoid)
            role_preferences[emp['id']][role_id] = random.randint(1, 5)
        
        # Day preferences
        day_preferences[emp['id']] = {}
        for day in range(7):
            # Randomly assign preferences for some days
            if random.random() < 0.3:
                day_preferences[emp['id']][day] = random.randint(1, 5)
    
    # Run the genetic algorithm
    print("\nRunning genetic algorithm...")
    best_solution, best_fitness, generation_stats, execution_time = genetic_algorithm(
        shift_data, employee_data, time_off_map, role_preferences, day_preferences,
        time_limit_seconds=30, population_size=50, generations=100
    )
    
    # Format and save the solution
    formatted_solution = format_solution(best_solution, shift_data, employee_data)
    save_solution_to_json(formatted_solution)
    
    # Plot the results
    plot_generation_stats(generation_stats)

if __name__ == "__main__":
    main()