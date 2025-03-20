import { spawn } from 'child_process';
import { db, Timestamp, FieldValue } from '../config/database';
import { logger } from './logger';
import path from 'path';
import fs from 'fs';

// Remove this import as it's using the client-side modular API
// import { getFirestore, collection, getDocs } from 'firebase/firestore';

interface MatchScore {
  carrierId: string;
  packageId: string;
  matchScore: number;
  compensation: number;
  routeDeviation: {
    distance: number;
    time: number;
  };
}

// Define a proper interface for the carrier document data
interface CarrierDocument {
  id: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
  };
  routeCoordinates?: [number, number][];
  schedule?: {
    startTime: string;
    endTime: string;
  };
  vehicleCapacity?: {
    length: number;
    width: number;
    height: number;
    weightLimit: number;
  };
  rating?: number;
  onTimeRate?: number;
  completedDeliveries?: string[];
  vehicleType?: string;
  vehicleSize?: string;
  [key: string]: any; // Allow for other properties
}

// Fetch carriers from Firestore
const fetchCarriers = async (): Promise<CarrierDocument[]> => {
  // Use the Admin SDK pattern since we're importing db from '../config/database'
  const carriersSnapshot = await db.collection('carriers').get();

  // Then in your findOptimalCarriers method:
  const carriersData: CarrierDocument[] = carriersSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data
    } as CarrierDocument;
  });

  return carriersData;
};

interface PackageDimensions {
  length: number;
  width: number;
  height: number;
  weight: number;
}

interface PackageData {
  id: string;
  pickupCoordinates: [number, number];
  deliveryCoordinates: [number, number];
  pickupWindow: [string, string];
  deliveryWindow: [string, string];
  dimensions: PackageDimensions;
  urgency: 'low' | 'medium' | 'high';
}

interface VehicleCapacity {
  length: number;
  width: number;
  height: number;
  weightLimit: number;
}

interface CarrierData {
  id: string;
  routeCoordinates: [number, number][];
  schedule: {
    startTime: string;
    endTime: string;
  };
  vehicleCapacity: VehicleCapacity;
  rating: number;
  onTimeRate: number;
  completedDeliveries: string[];
  vehicleType: string;
  vehicleSize?: string;
}

class AIMatchingService {
  private readonly MODEL_PATH = path.join(__dirname, '../../ml_models/matching_model.pkl');
  private readonly PYTHON_SCRIPT_PATH = path.join(__dirname, '../../scripts/match_predict.py');
  private readonly TRAINING_DATA_PATH = path.join(__dirname, '../../data/matching_history.json');
  
  // Collection names
  private readonly MATCHES_COLLECTION = 'matches';
  private readonly PACKAGES_COLLECTION = 'packages';
  private readonly USERS_COLLECTION = 'users';
  private readonly ROUTES_COLLECTION = 'routes';
  private readonly MATCH_FEEDBACK_COLLECTION = 'match_feedback';

  constructor() {
    // Ensure directories exist
    this.ensureDirectoriesExist();
    // Initialize model if needed
    this.initializeModel();
  }

  private ensureDirectoriesExist(): void {
    const directories = [
      path.dirname(this.MODEL_PATH),
      path.dirname(this.PYTHON_SCRIPT_PATH),
      path.dirname(this.TRAINING_DATA_PATH)
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    });
  }

  private async initializeModel(): Promise<void> {
    // Check if Python script exists
    if (!fs.existsSync(this.PYTHON_SCRIPT_PATH)) {
      this.createPythonScript();
      logger.info('Created Python prediction script');
    }

    // Check if model exists, if not, train initial model
    if (!fs.existsSync(this.MODEL_PATH)) {
      await this.trainModel();
      logger.info('Initialized matching model');
    }
  }

  private createPythonScript(): void {
    // Create a Python script for prediction based on your IntelligentMatchingSystem
    const pythonScript = `#!/usr/bin/env python3
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
`;

    fs.writeFileSync(this.PYTHON_SCRIPT_PATH, pythonScript);
    fs.chmodSync(this.PYTHON_SCRIPT_PATH, '755'); // Make executable
  }

  /**
   * Find optimal carriers for a package
   * @param packageId Package ID to find carriers for
   * @param radius Search radius in km
   * @param maxCarriers Maximum number of carriers to return
   */
  public async findOptimalCarriers(packageId: string, radius: number = 10, maxCarriers: number = 5): Promise<MatchScore[]> {
    try {
      // Get package data
      const packageDoc = await db.collection(this.PACKAGES_COLLECTION).doc(packageId).get();
      if (!packageDoc.exists) {
        throw new Error(`Package with ID ${packageId} not found`);
      }
      
      const packageData = packageDoc.data();
      if (!packageData) {
        throw new Error(`No data found for package ID ${packageId}`);
      }
      
      // Fetch route data for pickup/delivery coordinates
      const routeSnapshot = await db.collection(this.ROUTES_COLLECTION)
        .where('packageId', '==', packageId)
        .limit(1)
        .get();
      
      if (routeSnapshot.empty) {
        throw new Error(`No route found for package ID ${packageId}`);
      }
      
      const routeData = routeSnapshot.docs[0].data();
      
      // Prepare package data for ML model
      const packageForML: PackageData = {
        id: packageId,
        pickupCoordinates: [
          packageData.pickupLocation.latitude,
          packageData.pickupLocation.longitude
        ],
        deliveryCoordinates: [
          packageData.deliveryLocation.latitude,
          packageData.deliveryLocation.longitude
        ],
        pickupWindow: packageData.pickupWindow || ['08:00', '18:00'],
        deliveryWindow: packageData.deliveryWindow || ['08:00', '18:00'],
        dimensions: packageData.dimensions || {
          length: 10,
          width: 10,
          height: 10,
          weight: packageData.packageWeight || 1
        },
        urgency: packageData.urgency || 'medium'
      };
      
      // Find available carriers
      // In a real app, you'd use geoqueries to find nearby carriers
      // For simplicity, we'll get all active carriers
      const carriersSnapshot = await db.collection(this.USERS_COLLECTION)
        .where('role', '==', 'carrier')
        .where('active', '==', true)
        .limit(50)
        .get();
      
      if (carriersSnapshot.empty) {
        return [];
      }
      
      const carriersData = carriersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as CarrierDocument;
      });
      
      // Find carriers within radius of pickup
      const nearbyCarriers = carriersData.filter(carrier => {
        // Make sure lastLocation exists before accessing its properties
        if (!carrier.lastLocation || !carrier.lastLocation.latitude || !carrier.lastLocation.longitude) {
          return false;
        }
        
        const carrierLat = carrier.lastLocation.latitude;
        const carrierLng = carrier.lastLocation.longitude;
        const pickupLat = packageData.pickupLocation.latitude;
        const pickupLng = packageData.pickupLocation.longitude;
        
        // Simple distance calculation (Haversine formula)
        const R = 6371; // Earth radius in km
        const dLat = this.deg2rad(pickupLat - carrierLat);
        const dLon = this.deg2rad(pickupLng - carrierLng);
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(this.deg2rad(carrierLat)) * Math.cos(this.deg2rad(pickupLat)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = R * c;
        
        return distance <= radius;
      });
      
      if (nearbyCarriers.length === 0) {
        return [];
      }
      
      // For each carrier, predict match score
      const matchPromises = nearbyCarriers.map(async carrier => {
        // Prepare carrier data for ML model
        const carrierForML: CarrierData = {
          id: carrier.id,
          routeCoordinates: carrier.routeCoordinates || [
            [carrier.lastLocation!.latitude, carrier.lastLocation!.longitude]
          ],
          schedule: carrier.schedule || {
            startTime: '08:00',
            endTime: '18:00'
          },
          vehicleCapacity: carrier.vehicleCapacity || {
            length: 100,
            width: 100,
            height: 100,
            weightLimit: 50
          },
          rating: carrier.rating || 0,
          onTimeRate: carrier.onTimeRate || 0,
          completedDeliveries: carrier.completedDeliveries || [],
          vehicleType: carrier.vehicleType || 'car',
          vehicleSize: carrier.vehicleSize
        };
        
        return await this.predictMatch(packageForML, carrierForML);
      });
      
      const matches = await Promise.all(matchPromises);
      
      // Sort by match score and take top N
      const sortedMatches = matches
        .filter(match => match !== null)
        .sort((a, b) => (b?.matchScore || 0) - (a?.matchScore || 0))
        .slice(0, maxCarriers);
      
      return sortedMatches as MatchScore[];
    } catch (error) {
      logger.error('Error finding optimal carriers:', error);
      throw error;
    }
  }

  /**
   * Predict match score between a package and carrier
   */
  private async predictMatch(packageData: PackageData, carrierData: CarrierData): Promise<MatchScore | null> {
    return new Promise((resolve, reject) => {
      const packageJson = JSON.stringify(packageData);
      const carrierJson = JSON.stringify(carrierData);
      
      const python = spawn('python', [
        this.PYTHON_SCRIPT_PATH,
        'predict',
        this.MODEL_PATH,
        packageJson,
        carrierJson
      ]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          logger.error(`Python process exited with code ${code}: ${errorOutput}`);
          resolve(null);
          return;
        }
        
        try {
          const result = JSON.parse(output);
          if (result.error) {
            logger.error(`Error in Python script: ${result.error}`);
            resolve(null);
            return;
          }
          resolve(result as MatchScore);
        } catch (error) {
          logger.error('Error parsing Python output:', error);
          resolve(null);
        }
      });
    });
  }

  /**
   * Train the matching model with historical data
   */
  public async trainModel(): Promise<boolean> {
    try {
      // Fetch historical match data from Firestore
      const matchesSnapshot = await db.collection(this.MATCHES_COLLECTION).get();
      if (matchesSnapshot.empty) {
        logger.warn('No historical match data found for training');
        return false;
      }
      
      // Process matches to create training data
      const trainingData = await this.prepareTrainingData(matchesSnapshot.docs);
      
      // Save training data to file
      fs.writeFileSync(this.TRAINING_DATA_PATH, JSON.stringify(trainingData, null, 2));
      
      // Train model using Python script
      return new Promise((resolve, reject) => {
        const python = spawn('python', [
          this.PYTHON_SCRIPT_PATH,
          'train',
          this.TRAINING_DATA_PATH,
          this.MODEL_PATH
        ]);
        
        let output = '';
        let errorOutput = '';
        
        python.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        python.on('close', (code) => {
          if (code !== 0) {
            logger.error(`Python training process exited with code ${code}: ${errorOutput}`);
            resolve(false);
            return;
          }
          
          try {
            const result = JSON.parse(output);
            if (result.error) {
              logger.error(`Error in Python training: ${result.error}`);
              resolve(false);
              return;
            }
            logger.info('Model trained successfully');
            resolve(true);
          } catch (error) {
            logger.error('Error parsing Python training output:', error);
            resolve(false);
          }
        });
      });
    } catch (error) {
      logger.error('Error training model:', error);
      return false;
    }
  }

  /**
   * Prepare training data from historical matches
   */
  private async prepareTrainingData(matchDocs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]): Promise<any[]> {
    const trainingData = [];
    
    for (const matchDoc of matchDocs) {
      const match = matchDoc.data();
      
      // Only use completed or rejected matches for training
      if (match.status !== 'completed' && match.status !== 'rejected') {
        continue;
      }
      
      // Get package and carrier data
      const packageDoc = await db.collection(this.PACKAGES_COLLECTION).doc(match.packageId).get();
      const carrierDoc = await db.collection(this.USERS_COLLECTION).doc(match.carrierId).get();
      
      if (!packageDoc.exists || !carrierDoc.exists) {
        continue;
      }
      
      const packageData = packageDoc.data();
      const carrierData = carrierDoc.data();
      
      if (!packageData || !carrierData) {
        continue;
      }
      
      // Prepare package data
      const packageForML: PackageData = {
        id: match.packageId,
        pickupCoordinates: [
          packageData.pickupLocation.latitude,
          packageData.pickupLocation.longitude
        ],
        deliveryCoordinates: [
          packageData.deliveryLocation.latitude,
          packageData.deliveryLocation.longitude
        ],
        pickupWindow: packageData.pickupWindow || ['08:00', '18:00'],
        deliveryWindow: packageData.deliveryWindow || ['08:00', '18:00'],
        dimensions: packageData.dimensions || {
          length: 10,
          width: 10,
          height: 10,
          weight: packageData.packageWeight || 1
        },
        urgency: packageData.urgency || 'medium'
      };
      
      // Prepare carrier data
      const carrierForML: CarrierData = {
        id: match.carrierId,
        routeCoordinates: carrierData.routeCoordinates || [
          [carrierData.lastLocation?.latitude || 0, carrierData.lastLocation?.longitude || 0]
        ],
        schedule: carrierData.schedule || {
          startTime: '08:00',
          endTime: '18:00'
        },
        vehicleCapacity: carrierData.vehicleCapacity || {
          length: 100,
          width: 100,
          height: 100,
          weightLimit: 50
        },
        rating: carrierData.rating || 0,
        onTimeRate: carrierData.onTimeRate || 0,
        completedDeliveries: carrierData.completedDeliveries || [],
        vehicleType: carrierData.vehicleType || 'car',
        vehicleSize: carrierData.vehicleSize
      };
      
      // Success indicator (1 for completed, 0 for rejected)
      const success = match.status === 'completed' ? 1 : 0;
      
      trainingData.push({
        package: packageForML,
        carrier: carrierForML,
        success
      });
    }
    
    return trainingData;
  }

  /**
   * Update model with feedback after delivery completion
   */
  public async updateModelWithFeedback(matchId: string, success: boolean, feedback: string): Promise<boolean> {
    try {
      // Save feedback
      await db.collection(this.MATCH_FEEDBACK_COLLECTION).doc(matchId).set({
        success,
        feedback,
        createdAt: FieldValue.serverTimestamp()
      });
      
      // Check if we should retrain the model
      const feedbackSnapshot = await db.collection(this.MATCH_FEEDBACK_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      
      // Only retrain if we have significant new data (e.g., 10+ new feedbacks)
      if (feedbackSnapshot.size % 10 === 0) {
        logger.info(`Retraining model after ${feedbackSnapshot.size} feedbacks`);
        return await this.trainModel();
      }
      
      return true;
    } catch (error) {
      logger.error('Error updating model with feedback:', error);
      return false;
    }
  }

  /**
   * Auto-match available packages with optimal carriers
   */
  public async autoMatchPackages(limit: number = 10): Promise<any[]> {
    try {
      // Find unmatched packages
      const packagesSnapshot = await db.collection(this.PACKAGES_COLLECTION)
        .where('status', '==', 'ready_for_pickup')
        .where('matched', '==', false)
        .limit(limit)
        .get();
      
      if (packagesSnapshot.empty) {
        return [];
      }
      
      const results = [];
      
      for (const packageDoc of packagesSnapshot.docs) {
        const packageId = packageDoc.id;
        
        // Find optimal carriers
        const carriers = await this.findOptimalCarriers(packageId, 15, 3);
        
        if (carriers.length === 0) {
          results.push({
            packageId,
            matches: []
          });
          continue;
        }
        
        // Create matches for top carriers
        const matchPromises = carriers.map(async (carrier) => {
          // Generate pickup and delivery codes
          const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
          const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();
          
          // Set expiration time (4 hours from now)
          const expirationDate = new Date();
          expirationDate.setHours(expirationDate.getHours() + 4);
          
          // Calculate estimated times
          const now = new Date();
          const packageData = packageDoc.data();
          const distance = packageData?.distance || 5; // Default 5km
          
          const pickupTime = new Date(now.getTime() + 30 * 60000); // 30 mins from now
          const deliveryTime = new Date(pickupTime.getTime() + (distance * 5) * 60000); // ~5 min per km
          
          // Create match document
          const matchData = {
            packageId,
            carrierId: carrier.carrierId,
            status: 'pending',
            score: carrier.matchScore,
            detourDistance: carrier.routeDeviation.distance,
            detourTime: carrier.routeDeviation.time,
            estimatedPickupTime: Timestamp.fromDate(pickupTime),
            estimatedDeliveryTime: Timestamp.fromDate(deliveryTime),
            expiresAt: Timestamp.fromDate(expirationDate),
            carrierPayoutAmount: carrier.compensation,
            platformFeeAmount: carrier.compensation * 0.15, // 15% platform fee
            carrierPickupCode: pickupCode,
            carrierDeliveryCode: deliveryCode,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          };
          
          const matchRef = await db.collection(this.MATCHES_COLLECTION).add(matchData);
          
          // Get the created match
          const matchDoc = await matchRef.get();
          return {
            id: matchDoc.id,
            ...matchDoc.data()
          };
        }, 10);
          const matches = await Promise.all(matchPromises);
        
        // Mark package as matched
        await db.collection(this.PACKAGES_COLLECTION).doc(packageId).update({
          matched: true,
          matchedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        
        results.push({
          packageId,
          matches
        });
      }
      
      return results;
    } catch (error) {
      logger.error('Error in auto-matching packages:', error);
      throw error;
    }
  }

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}

export default new AIMatchingService();