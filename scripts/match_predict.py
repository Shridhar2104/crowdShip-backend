#!/usr/bin/env python3
import sys
import json
import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
import pandas as pd
from geopy.distance import geodesic

def time_to_minutes(time_str):
    """Convert time string (HH:MM) to minutes since midnight"""
    hours, minutes = map(int, time_str.split(':'))
    return hours * 60 + minutes

def calculate_window_overlap(window1_start, window1_end, window2_start, window2_end):
    """Calculate the overlap between two time windows as a ratio"""
    # Convert times to minutes for easier calculation
    w1_start = time_to_minutes(window1_start)
    w1_end = time_to_minutes(window1_end)
    w2_start = time_to_minutes(window2_start)
    w2_end = time_to_minutes(window2_end)
    
    # Calculate overlap
    overlap_start = max(w1_start, w2_start)
    overlap_end = min(w1_end, w2_end)
    
    if overlap_end <= overlap_start:
        return 0  # No overlap
    
    overlap_duration = overlap_end - overlap_start
    window2_duration = w2_end - w2_start
    
    # Return the ratio of overlap to the package window duration
    return overlap_duration / window2_duration

def calculate_route_deviation(route_coords, pickup_coords, delivery_coords):
    """Calculate route deviation distance and time"""
    # Convert coordinates to proper format
    route = [(coord[0], coord[1]) for coord in route_coords]
    pickup = (pickup_coords[0], pickup_coords[1])
    delivery = (delivery_coords[0], delivery_coords[1])
    
    # Find nearest points on the carrier's route
    nearest_to_pickup = min(route, key=lambda point: geodesic(point, pickup).km)
    nearest_to_delivery = min(route, key=lambda point: geodesic(point, delivery).km)
    
    # Calculate deviations
    pickup_deviation = geodesic(nearest_to_pickup, pickup).km
    delivery_deviation = geodesic(nearest_to_delivery, delivery).km
    
    # Estimate time deviation (assuming average speed of 30 km/h)
    time_deviation = (pickup_deviation + delivery_deviation) / 30 * 60  # minutes
    
    return {
        'distance': pickup_deviation + delivery_deviation,
        'time': time_deviation
    }

def evaluate_size_compatibility(vehicle_capacity, package_dimensions):
    """Evaluate if the package fits well in the carrier's vehicle"""
    # Extract vehicle capacity
    vehicle_length = vehicle_capacity['length']
    vehicle_width = vehicle_capacity['width']
    vehicle_height = vehicle_capacity['height']
    vehicle_weight_limit = vehicle_capacity['weightLimit']
    
    # Extract package dimensions
    package_length = package_dimensions['length']
    package_width = package_dimensions['width']
    package_height = package_dimensions['height']
    package_weight = package_dimensions['weight']
    
    # Check dimensional compatibility
    dim_compatibility = (
        package_length <= vehicle_length and
        package_width <= vehicle_width and
        package_height <= vehicle_height and
        package_weight <= vehicle_weight_limit
    )
    
    if not dim_compatibility:
        return 0
    
    # Calculate how much of the vehicle capacity is used (as a ratio)
    volume_ratio = (
        (package_length * package_width * package_height) / 
        (vehicle_length * vehicle_width * vehicle_height)
    )
    weight_ratio = package_weight / vehicle_weight_limit
    
    # Optimal packages use between 10-50% of vehicle capacity
    efficiency_score = 1 - abs(0.3 - max(volume_ratio, weight_ratio))
    return max(0.1, efficiency_score)

def calculate_time_compatibility(carrier_schedule, pickup_window, delivery_window):
    """Calculate how well the carrier's schedule aligns with package timing requirements"""
    # Extract carrier availability windows
    carrier_start = carrier_schedule['startTime']
    carrier_end = carrier_schedule['endTime']
    
    # Extract package time windows
    pickup_start, pickup_end = pickup_window
    delivery_start, delivery_end = delivery_window
    
    # Check if carrier is available during pickup and delivery windows
    pickup_compatibility = calculate_window_overlap(
        carrier_start, carrier_end,
        pickup_start, pickup_end
    )
    
    delivery_compatibility = calculate_window_overlap(
        carrier_start, carrier_end,
        delivery_start, delivery_end
    )
    
    # Return overall time compatibility score between 0 and 1
    return min(pickup_compatibility, delivery_compatibility)

def extract_features(package, carrier):
    """Extract features for the matching algorithm"""
    # Route compatibility features
    route_deviation = calculate_route_deviation(
        carrier['routeCoordinates'], 
        package['pickupCoordinates'], 
        package['deliveryCoordinates']
    )
    
    # Time compatibility features
    time_flexibility = calculate_time_compatibility(
        carrier['schedule'], 
        package['pickupWindow'], 
        package['deliveryWindow']
    )
    
    # Package characteristics compatibility
    size_compatibility = evaluate_size_compatibility(
        carrier['vehicleCapacity'], 
        package['dimensions']
    )
    
    # Historical success rate features
    carrier_rating = carrier.get('rating', 0)
    carrier_reliability = carrier.get('onTimeRate', 0)
    carrier_experience = len(carrier.get('completedDeliveries', []))
    
    # Return feature vector
    return [
        route_deviation['distance'], 
        route_deviation['time'],
        time_flexibility,
        size_compatibility,
        carrier_rating,
        carrier_reliability,
        carrier_experience
    ]

def calculate_compensation(package, carrier):
    """Calculate fair compensation for the carrier"""
    # Get route deviation
    deviation = calculate_route_deviation(
        carrier['routeCoordinates'], 
        package['pickupCoordinates'], 
        package['deliveryCoordinates']
    )
    
    # Base compensation
    base_rate = 50  # Base rate in currency units
    
    # Additional compensation for deviation
    deviation_compensation = deviation['distance'] * 10  # 10 units per km
    
    # Additional compensation for package properties
    weight_factor = package['dimensions']['weight'] * 5  # 5 units per kg
    
    # Urgency premium
    urgency_premium = 0
    if package.get('urgency') == 'high':
        urgency_premium = 100
    elif package.get('urgency') == 'medium':
        urgency_premium = 50
    
    # Calculate total compensation
    total_compensation = base_rate + deviation_compensation + weight_factor + urgency_premium
    
    return round(total_compensation, 2)

def predict_match(model_path, package_json, carrier_json):
    """Predict match score and calculate compensation"""
    try:
        # Parse input JSON
        package = json.loads(package_json)
        carrier = json.loads(carrier_json)
        
        # Load the model
        model = joblib.load(model_path)
        
        # Extract features
        features = extract_features(package, carrier)
        features_array = np.array(features).reshape(1, -1)
        
        # Predict match score
        match_score = model.predict_proba(features_array)[0][1]
        
        # Calculate compensation
        compensation = calculate_compensation(package, carrier)
        
        # Calculate route deviation for reference
        route_deviation = calculate_route_deviation(
            carrier['routeCoordinates'], 
            package['pickupCoordinates'], 
            package['deliveryCoordinates']
        )
        
        # Return results
        result = {
            'carrierId': carrier['id'],
            'packageId': package['id'],
            'matchScore': float(match_score),
            'compensation': compensation,
            'routeDeviation': route_deviation
        }
        
        return json.dumps(result)
    except Exception as e:
        return json.dumps({'error': str(e)})

def train_model(training_data_path, model_path):
    """Train the matching model with historical data"""
    try:
        # Load training data
        with open(training_data_path, 'r') as f:
            training_data = json.load(f)
        
        X = []  # Features
        y = []  # Outcomes (1 = successful match, 0 = unsuccessful)
        
        for match in training_data:
            features = extract_features(match['package'], match['carrier'])
            outcome = match['success']
            X.append(features)
            y.append(outcome)
        
        # Build and train the model
        model = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
        ])
        
        model.fit(X, y)
        
        # Save the model
        joblib.dump(model, model_path)
        
        return json.dumps({'success': True, 'message': 'Model trained successfully'})
    except Exception as e:
        return json.dumps({'error': str(e)})

if __name__ == "__main__":
    command = sys.argv[1]
    
    if command == "predict":
        model_path = sys.argv[2]
        package_json = sys.argv[3]
        carrier_json = sys.argv[4]
        result = predict_match(model_path, package_json, carrier_json)
        print(result)
    
    elif command == "train":
        training_data_path = sys.argv[2]
        model_path = sys.argv[3]
        result = train_model(training_data_path, model_path)
        print(result)
