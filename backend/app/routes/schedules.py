from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from datetime import datetime, timedelta
from app import db
from app.models.models import User, Role, AssignedShift, ShiftRequirement, TimeOffRequest,WorkHoursLog
from app.schemas import AssignedShiftSchema, ScheduleGenerationSchema
import random
import numpy as np
schedules_bp = Blueprint('schedules', __name__)

# Helper function to check if user is manager
def check_manager():
    identity = get_jwt_identity()
    return identity['type'] == 'manager'

# Get schedule for a specific user
@schedules_bp.route('/user/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_schedule(user_id):
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Check if user is requesting their own data or is a manager
        if identity['id'] != user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get start and end date/time filters from query parameters
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        
        # Build query
        query = AssignedShift.query.filter_by(user_id=user_id)
        
        if start_time:
            query = query.filter(AssignedShift.start_time >= start_time)
        if end_time:
            query = query.filter(AssignedShift.end_time <= end_time)
        
        # Get assigned shifts
        shifts = query.all()
        
        # Serialize shifts
        schema = AssignedShiftSchema(many=True)
        shifts_data = schema.dump(shifts)
        
        return jsonify(shifts_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get full schedule (managers only)
@schedules_bp.route('', methods=['GET'])
@jwt_required()
def get_full_schedule():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get start and end date/time filters from query parameters
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        user_id = request.args.get('user_id')
        role_id = request.args.get('role_id')
        
        # Build query
        query = AssignedShift.query
        
        if start_time:
            query = query.filter(AssignedShift.start_time >= start_time)
        if end_time:
            query = query.filter(AssignedShift.end_time <= end_time)
        if user_id:
            query = query.filter_by(user_id=user_id)
        if role_id:
            query = query.filter_by(role_id=role_id)
        
        # Get assigned shifts
        shifts = query.all()
        
        # Serialize shifts
        schema = AssignedShiftSchema(many=True)
        shifts_data = schema.dump(shifts)
        
        return jsonify(shifts_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create a new shift assignment (managers only)
@schedules_bp.route('', methods=['POST'])
@jwt_required()
def create_shift():
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Validate request data
        schema = AssignedShiftSchema()
        data = schema.load(request.json)
        
        # Check if user exists and is active
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if not user.active:
            return jsonify({'error': 'User is inactive'}), 400
        
        # Check if role exists
        role = Role.query.get(data['role_id'])
        if not role:
            return jsonify({'error': 'Role not found'}), 404
        
        # Check if user is capable of performing this role
        if role not in user.capable_roles:
            return jsonify({'error': 'User is not capable of performing this role'}), 400
        
        # Check for conflicting shifts
        conflicting_shifts = AssignedShift.query.filter_by(user_id=data['user_id']).filter(
            ((AssignedShift.start_time <= data['start_time']) & (AssignedShift.end_time > data['start_time'])) |
            ((AssignedShift.start_time < data['end_time']) & (AssignedShift.end_time >= data['end_time'])) |
            ((AssignedShift.start_time >= data['start_time']) & (AssignedShift.end_time <= data['end_time']))
        ).all()
        
        if conflicting_shifts:
            return jsonify({'error': 'Conflicting shift assignment exists'}), 400
        
        # Check for approved time off requests
        time_off = TimeOffRequest.query.filter_by(user_id=data['user_id'], status='approved').filter(
            ((TimeOffRequest.start_time <= data['start_time']) & (TimeOffRequest.end_time > data['start_time'])) |
            ((TimeOffRequest.start_time < data['end_time']) & (TimeOffRequest.end_time >= data['end_time'])) |
            ((TimeOffRequest.start_time >= data['start_time']) & (TimeOffRequest.end_time <= data['end_time']))
        ).first()
        
        if time_off:
            return jsonify({'error': 'User has approved time off during this period'}), 400
        
        # Create new shift assignment
        shift = AssignedShift(
            user_id=data['user_id'],
            role_id=data['role_id'],
            start_time=data['start_time'],
            end_time=data['end_time']
        )
        
        # Save to database
        db.session.add(shift)
        db.session.commit()
        
        # Serialize and return created shift
        result = schema.dump(shift)
        
        return jsonify(result), 201
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Update shift assignment (managers only)
@schedules_bp.route('/<int:shift_id>', methods=['PUT'])
@jwt_required()
def update_shift(shift_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get shift from database
        shift = AssignedShift.query.get(shift_id)
        
        if not shift:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Validate request data
        schema = AssignedShiftSchema()
        data = schema.load(request.json, partial=True)
        
        # Check if we're updating user or role
        new_user_id = data.get('user_id', shift.user_id)
        new_role_id = data.get('role_id', shift.role_id)
        new_start_time = data.get('start_time', shift.start_time)
        new_end_time = data.get('end_time', shift.end_time)
        
        # If user is changing, check if new user exists and is active
        if new_user_id != shift.user_id:
            user = User.query.get(new_user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            if not user.active:
                return jsonify({'error': 'User is inactive'}), 400
        else:
            user = User.query.get(shift.user_id)
        
        # If role is changing, check if new role exists
        if new_role_id != shift.role_id:
            role = Role.query.get(new_role_id)
            if not role:
                return jsonify({'error': 'Role not found'}), 404
            
            # Check if user is capable of performing this role
            if role not in user.capable_roles:
                return jsonify({'error': 'User is not capable of performing this role'}), 400
        
        # If time or user is changing, check for conflicts
        if new_start_time != shift.start_time or new_end_time != shift.end_time or new_user_id != shift.user_id:
            # Check for conflicting shifts
            conflicting_shifts = AssignedShift.query.filter_by(user_id=new_user_id).filter(
                AssignedShift.id != shift_id
            ).filter(
                ((AssignedShift.start_time <= new_start_time) & (AssignedShift.end_time > new_start_time)) |
                ((AssignedShift.start_time < new_end_time) & (AssignedShift.end_time >= new_end_time)) |
                ((AssignedShift.start_time >= new_start_time) & (AssignedShift.end_time <= new_end_time))
            ).all()
            
            if conflicting_shifts:
                return jsonify({'error': 'Conflicting shift assignment exists'}), 400
            
            # Check for approved time off requests
            time_off = TimeOffRequest.query.filter_by(user_id=new_user_id, status='approved').filter(
                ((TimeOffRequest.start_time <= new_start_time) & (TimeOffRequest.end_time > new_start_time)) |
                ((TimeOffRequest.start_time < new_end_time) & (TimeOffRequest.end_time >= new_end_time)) |
                ((TimeOffRequest.start_time >= new_start_time) & (TimeOffRequest.end_time <= new_end_time))
            ).first()
            
            if time_off:
                return jsonify({'error': 'User has approved time off during this period'}), 400
        
        # Update shift fields
        if 'user_id' in data:
            shift.user_id = data['user_id']
        if 'role_id' in data:
            shift.role_id = data['role_id']
        if 'start_time' in data:
            shift.start_time = data['start_time']
        if 'end_time' in data:
            shift.end_time = data['end_time']
        
        # Save to database
        db.session.commit()
        
        # Serialize and return updated shift
        result = schema.dump(shift)
        
        return jsonify(result), 200
    
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete shift assignment (managers only)
@schedules_bp.route('/<int:shift_id>', methods=['DELETE'])
@jwt_required()
def delete_shift(shift_id):
    try:
        # Check if user is a manager
        if not check_manager():
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Get shift from database
        shift = AssignedShift.query.get(shift_id)
        
        if not shift:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Delete shift
        db.session.delete(shift)
        db.session.commit()
        
        return jsonify({'message': 'Shift deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Generate a schedule (managers only)
@schedules_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_schedule():
    """
    Generate a schedule using a genetic algorithm based on real data.
    """

    # Check if user is a manager
    if not check_manager():
        return jsonify({'error' : 'Unauthorized access'}), 403
    
    try:
        # Parse request data

        data = request.json or {}

        #Algorithm parameters
        algorithm_params = data.get('algorithm_params', {
            'population_size': 50,
            'generations': 100,
            'mutation_rate': 0.1,
            'crossover_rate': 0.8,
            'elitism_count': 5
        })
        time_limit_seconds = data.get('time_limit_seconds', 60)

        

        # Get date range

        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')

        if not start_date_str or not end_date_str:
            return jsonify({'error': 'Start date and end date are required'}), 400
        
        start_date = datetime.fromisoformat(start_date_str)
        end_date = datetime.fromisoformat(end_date_str)

        # Get employees (active users with their roles)

        users = User.query.filter_by(active=True).all()

        # Convert your user model to dictionary format for easier proccesing

        employees=[]
        for user in users:
            employee={
                'id': user.id,
                'name': user.name,
                'max_hours': user.target_hours,
                'skills': [role.id for role in user.capable_roles],
                'assigned_shifts': []
            }
            employees.append(employee)

            # Query requirements in the date range
        requirements = ShiftRequirement.query.filter(
            ShiftRequirement.start_time >= start_date,
            ShiftRequirement.end_time <= end_date
        ).all()
        
        if not requirements:
            return jsonify({'error': 'No shift requirements found for the selected period'}), 404
        
        shifts = []
        for req in requirements:
            # Convert your ShiftRequirement model to dictionary
            shift = {
                'id': req.id,
                'start_time': req.start_time,
                'end_time': req.end_time,
                'role_id': req.role_id,
                'required_staff': req.employee_count,
                'assigned_employees': []  
            }
            shifts.append(shift)
        # Get approved time off requests
        time_off_requests = TimeOffRequest.query.filter_by(status='approved').filter(
            TimeOffRequest.user_id.in_([user.id for user in users]),
            TimeOffRequest.start_time < end_date,
            TimeOffRequest.end_time > start_date
        ).all()
        
        # Process time off requests into a more usable format
        time_off_map = {}
        for tor in time_off_requests:
            if tor.user_id not in time_off_map:
                time_off_map[tor.user_id] = []
            time_off_map[tor.user_id].append({
                'start_time': tor.start_time,
                'end_time': tor.end_time
            })

            from app.models.models import UserRolePreference,UserDayPreference

            # Get role preferences
        role_preferences = {}
        role_prefs = UserRolePreference.query.filter(
            UserRolePreference.user_id.in_([user.id for user in users])
        ).all()
        
        for pref in role_prefs:
            if pref.user_id not in role_preferences:
                role_preferences[pref.user_id] = {}
            role_preferences[pref.user_id][pref.role_id] = pref.preference_level
        
        # Get day preferences
        day_preferences = {}
        day_prefs = UserDayPreference.query.filter(
            UserDayPreference.user_id.in_([user.id for user in users])
        ).all()
        
        for pref in day_prefs:
            if pref.user_id not in day_preferences:
                day_preferences[pref.user_id] = {}
            day_preferences[pref.user_id][pref.day_of_week] = pref.preference_level


        # Now implementing the genetic algorithm
        # 1. Define fitness function

        def calculate_fitness(schedule):
            # Schedule is a list of shift assigments(Employee_Id or None for each required position)

            filled_positions = sum(1 for employee_id in schedule if employee_id is not None)
            total_positions = sum(shift['required_staff'] for shift in shifts)

            # Calculate coverage ratio (primary objective)
            coverage_ratio = filled_positions / total_positions if total_positions > 0 else 0
            
            # Calculate penalties for constraint violations
            penalty = 0

            # Reconstruct the full schedule from the chromosome
            reconstructed_schedule = get_reconstructed_schedule(schedule)

            # Cjeck for time off violations
            time_off_violations = 0
            for emp_id,emp_shifts in reconstructed_schedule.items():
                if emp_id in time_off_map:
                    for time_off in time_off_map[emp_id]:
                        for shift_id in emp_shifts:_
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
        
        # Helper function to check for time overlap
        def check_overlap(start1, end1, start2, end2):
            return (start1 < end2) and (end1 > start2)  
        
        # Helper function to reconstruct the full schedule from chromosome

        def get_reconstructed_schedule(schedule):
            result={}

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
        
        # 2. Generate initial population
        def generate_initial_population(population_size):
           
            population = []
            
            # Calculate chromosome length (total required positions)
            total_positions = sum(shift['required_staff'] for shift in shifts)
            
            for _ in range(population_size):
                # Create a new chromosome
                chromosome = [None] * total_positions
                
                # Track assigned shifts per employee to prevent conflicts
                employee_shifts = {emp['id']: [] for emp in employees}
                
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
        
        # 3. Selection function (tournament selection)
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
        
        # 4. Crossover function (single-point crossover)
        def crossover(parent1, parent2, crossover_rate):
            if random.random() > crossover_rate:
                return parent1.copy(), parent2.copy()
            
            # Single point crossover
            crossover_point = random.randint(1, len(parent1) - 1)
            child1 = parent1[:crossover_point] + parent2[crossover_point:]
            child2 = parent2[:crossover_point] + parent1[crossover_point:]
            
            return child1, child2
        # 5.Mutation function
        def mutation(chromosome, mutation_rate):
            mutated = chromosome.copy()

            for i in range(len(mutated)):
                if random.random() < mutation_rate:
                    # 50% chance to clear the assignemt
                    if random.random() < 0.5:
                        mutated[i]= None
                    else:
                        # Find which shift this position corresponds to
                        position_idx = 0
                        current_shift_idx = None
                    
                        
                        for shift_idx, shift in enumerate(shifts):
                            new_position_idx = position_idx + shift['required_staff']
                            if i < new_position_idx:
                                current_shift_idx = shift_idx
                                break
                            position_idx = new_position_idx

                        if current_shift_idx is not None:
                            current_shift = shift[current_shift_idx]

                        # Get eligible employee for this shift

                        eligible_employees = []
                        for emp in employees:
                            if current_shift['role_id'] in emp['skills']:
                                eligible_employees.append(emp['id'])
                        
                        if eligible_employees:
                            # Randomly select an eligible employee
                            mutated[i] = random.choice(eligible_employees)
            return mutated
        
                # 6. The main genetic algorithm loop
        def genetic_algorithm(time_limit_seconds=60):
            start_time = datetime.now()
            
            # Configuration
            population_size = algorithm_params.get('population_size', 50)
            generations = algorithm_params.get('generations', 100)
            mutation_rate = algorithm_params.get('mutation_rate', 0.1)
            crossover_rate = algorithm_params.get('crossover_rate', 0.8)
            elitism_count = algorithm_params.get('elitism_count', 5)
            
            # Generate initial population
            population = generate_initial_population(population_size)
            
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
                fitnesses = [calculate_fitness(individual) for individual in population]

                # Track the best individual
                current_best_idx=fitnesses.index(max(fitnesses))
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
                    'average_fitness': sum(fitnesses) / len(fitnesses)
                })

                # Elitism: keep the best individuals
                elites = []
                for _ in range(elitism_count):
                    if fitnesses:
                        best_idx = fitnesses.index(max(fitnesses))
                        elites.append(population[best_idx])
                        fitnesses[best_idx] = -1  
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
                    child1 = mutation(child1, mutation_rate)
                    child2 = mutation(child2, mutation_rate)
                    
                    # Add to new population
                    new_population.append(child1)
                    if len(new_population) < population_size:
                        new_population.append(child2)
                
                # Replace old population
                population = new_population
            
            # Return the best solution and statistics
            execution_time = (datetime.now() - start_time).total_seconds()
            return best_solution, best_fitness, generation_stats, execution_time
        
        # Run the genetic algorithm
        best_solution, best_fitness, generation_stats, execution_time = genetic_algorithm(time_limit_seconds)
        
        # If no solution found
        if best_solution is None:
            return jsonify({'error': 'Failed to generate a valid schedule'}), 500
        
        # Convert the best solution to the schedule format
        # Create a mapping of shifts to assigned employees
        shift_assignments = {}
        
        position_idx = 0
        for shift_idx, shift in enumerate(shifts):
            shift_assignments[shift['id']] = []
            for _ in range(shift['required_staff']):
                employee_id = best_solution[position_idx]
                if employee_id is not None:
                    shift_assignments[shift['id']].append(employee_id)
                position_idx += 1
        
        # Clear existing shifts in the database
        from app import db
        from app.models.models import AssignedShift
        
        # Delete existing shifts in the date range
        existing_shifts = AssignedShift.query.filter(
            AssignedShift.start_time >= start_date,
            AssignedShift.end_time <= end_date
        ).all()
        
        for shift in existing_shifts:
            db.session.delete(shift)
        
        # Create new shifts in the database
        for shift in shifts:
            shift_id = shift['id']
            for employee_id in shift_assignments.get(shift_id, []):
                assigned_shift = AssignedShift(
                    user_id=employee_id,
                    role_id=shift['role_id'],
                    start_time=shift['start_time'],
                    end_time=shift['end_time']
                )
                db.session.add(assigned_shift)
        
        # Commit all changes
        db.session.commit()
        
        # Calculate statistics for the generated schedule
        total_positions = sum(shift['required_staff'] for shift in shifts)
        filled_positions = sum(len(assigned_emps) for assigned_emps in shift_assignments.values())
        coverage_percentage = (filled_positions / total_positions * 100) if total_positions > 0 else 0
        
        # Get completed schedule data for response
        schedule_data = []
        for shift in shifts:
            schedule_data.append({
                'id': shift['id'],
                'start_time': shift['start_time'].isoformat(),
                'end_time': shift['end_time'].isoformat(),
                'role_id': shift['role_id'],
                'required_staff': shift['required_staff'],
                'assigned_employees': shift_assignments.get(shift['id'], [])
            })
        
        # Prepare response
        response = {
            'message': 'Schedule generated successfully',
            'status': 'success',
            'statistics': {
                'total_shifts': len(shifts),
                'total_positions': total_positions,
                'filled_positions': filled_positions,
                'coverage_percentage': coverage_percentage,
                'fitness_score': best_fitness,
                'execution_time_seconds': execution_time,
                'generations_completed': len(generation_stats)
            },
            'generation_stats': generation_stats,
            'schedule': schedule_data
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500








@schedules_bp.route('/<int:shift_id>/complete', methods=['POST'])
@jwt_required()
def complete_shift(shift_id):
    try:
        # Get identity from token
        identity = get_jwt_identity()
        
        # Get shift from database
        shift = AssignedShift.query.get(shift_id)
        
        if not shift:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Check if user is completing their own shift or is a manager
        if identity['id'] != shift.user_id and identity['type'] != 'manager':
            return jsonify({'error': 'Unauthorized access'}), 403
        
        # Calculate hours worked
        start_time = shift.start_time
        end_time = shift.end_time
        hours_worked = (end_time - start_time).total_seconds() / 3600
        
        # Log hours worked
        log_entry = WorkHoursLog(
            user_id=shift.user_id,
            shift_id=shift.id,
            date=shift.start_time.date(),
            hours_worked=hours_worked,
            role_id=shift.role_id
        )
        
        # Save to database
        db.session.add(log_entry)
        db.session.commit()
        
        return jsonify({'message': 'Shift completed and hours logged', 'hours_worked': hours_worked}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500