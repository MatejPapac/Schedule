"""
Example script demonstrating how to use the scheduling system.
"""
import logging
import sys
import time
from datetime import datetime, timedelta
import json

# Add the project root to the path so we can import our modules
sys.path.insert(0, '.')

from scheduling.services import SchedulingService
from scheduling.utils.data_gen import generate_test_dataset
from scheduling.models.schedule import Employee, Shift, Schedule, PreferenceSet


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_simple_example():
    """Run a simple scheduling example with generated data."""
    logger.info("Starting simple scheduling example...")
    
    # Generate test data
    employees, shifts, preferences = generate_test_dataset(
        num_employees=15,
        num_days=7,
        num_roles=5,
        shifts_per_day=3
    )
    
    # Configure algorithm parameters
    algorithm_params = {
        'population_size': 50,
        'generations': 100,
        'coverage_weight': 1000,  # High weight for coverage
        'balance_weight': 200,    # Medium weight for balance
        'preference_weight': 50   # Lower weight for preferences
    }
    
    # Generate schedule
    logger.info("Generating schedule...")
    schedule, stats = SchedulingService.generate_schedule(
        employees=employees,
        shifts=shifts,
        preferences=preferences,
        algorithm_params=algorithm_params,
        time_limit_seconds=60  # 1 minute time limit
    )
    
    # Evaluate the schedule
    evaluation = SchedulingService.evaluate_schedule(schedule, preferences)
    
    # Print results
    logger.info("Schedule generation completed!")
    logger.info(f"Fitness score: {stats['fitness']:.2f}")
    logger.info(f"Coverage: {evaluation['coverage']['coverage_percent']:.1f}% "
                f"({evaluation['coverage']['total_assigned']}/{evaluation['coverage']['total_required']} shifts)")
    
    # Print hours distribution
    hours = evaluation['employee_hours']
    logger.info("\nEmployee Hours:")
    for emp in employees:
        employee_hours = hours.get(emp.id, 0)
        utilization = (employee_hours / emp.max_hours) * 100
        logger.info(f"  {emp.name}: {employee_hours:.1f}/{emp.max_hours} hours ({utilization:.1f}%)")
    
    # Print preference satisfaction if available
    if evaluation['preference_score'] is not None:
        logger.info(f"\nPreference satisfaction: {evaluation['preference_score']:.2f} (-2 to +2 scale)")
    
    # Print sample of the schedule (first 10 shifts)
    schedule_dict = SchedulingService.schedule_to_dict(schedule)
    logger.info("\nSample Schedule (first 10 assigned shifts):")
    
    sorted_shifts = sorted(
        [s for s in schedule_dict['shifts'] if s['assigned_employees']], 
        key=lambda x: x['start_time']
    )[:10]
    
    for shift_dict in sorted_shifts:
        start_time = datetime.fromisoformat(shift_dict['start_time'])
        end_time = datetime.fromisoformat(shift_dict['end_time'])
        day_name = start_time.strftime("%a")
        
        logger.info(f"  {day_name} {start_time.strftime('%Y-%m-%d %H:%M')} - "
                    f"{end_time.strftime('%H:%M')}, "
                    f"Role {shift_dict['role_id']}, "
                    f"{len(shift_dict['assigned_employees'])} employees assigned")
    
    # Save schedule to file
    with open('example_schedule.json', 'w') as f:
        json.dump(schedule_dict, f, indent=2)
    
    logger.info("\nSchedule saved to example_schedule.json")
    
    return schedule, stats, evaluation


def run_comparison_example():
    """Run an example comparing different algorithm parameters."""
    logger.info("Starting parameter comparison example...")
    
    # Generate test data
    employees, shifts, preferences = generate_test_dataset(
        num_employees=15,
        num_days=7,
        num_roles=5,
        shifts_per_day=3
    )
    
    # Different parameter sets to compare
    parameter_sets = [
        {
            'name': 'Balanced',
            'params': {
                'population_size': 50,
                'generations': 50,
                'coverage_weight': 1000,
                'balance_weight': 200,
                'preference_weight': 50
            }
        },
        {
            'name': 'Coverage Focus',
            'params': {
                'population_size': 50,
                'generations': 50,
                'coverage_weight': 2000,  # Higher coverage weight
                'balance_weight': 100,    # Lower balance weight
                'preference_weight': 20    # Lower preference weight
            }
        },
        {
            'name': 'Preference Focus',
            'params': {
                'population_size': 50,
                'generations': 50,
                'coverage_weight': 800,    # Lower coverage weight
                'balance_weight': 150,     # Lower balance weight
                'preference_weight': 200   # Higher preference weight
            }
        }
    ]
    
    results = []
    
    # Run each parameter set
    for param_set in parameter_sets:
        logger.info(f"\nTesting parameter set: {param_set['name']}")
        
        # Generate schedule
        schedule, stats = SchedulingService.generate_schedule(
            employees=employees,
            shifts=shifts,
            preferences=preferences,
            algorithm_params=param_set['params'],
            time_limit_seconds=30  # 30 second time limit per run
        )
        
        # Evaluate the schedule
        evaluation = SchedulingService.evaluate_schedule(schedule, preferences)
        
        # Store results
        results.append({
            'name': param_set['name'],
            'fitness': stats['fitness'],
            'coverage': evaluation['coverage']['coverage_percent'],
            'preference_score': evaluation['preference_score'],
            'hours_std_dev': evaluation['hours_stats']['std_dev_hours']
        })
        
        # Print summary
        logger.info(f"  Fitness: {stats['fitness']:.2f}")
        logger.info(f"  Coverage: {evaluation['coverage']['coverage_percent']:.1f}%")
        if evaluation['preference_score'] is not None:
            logger.info(f"  Preference satisfaction: {evaluation['preference_score']:.2f}")
    
    # Print comparison
    logger.info("\nParameter comparison summary:")
    logger.info(f"{'Parameter Set':<20} {'Fitness':<10} {'Coverage':<10} {'Preference':<10}")
    logger.info("-" * 50)
    
    for result in results:
        logger.info(f"{result['name']:<20} {result['fitness']:<10.2f} "
                   f"{result['coverage']:<10.1f}% {result['preference_score']:<10.2f}")
    
    return results


if __name__ == "__main__":
    # Run the simple example
    run_simple_example()
    
    # Uncomment to run the comparison example
    # run_comparison_example()