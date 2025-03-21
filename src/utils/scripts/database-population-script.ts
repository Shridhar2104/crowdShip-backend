import path from 'path';
import fs from 'fs';
import { db, FieldValue } from '../../config/database';
// Don't use "new" with the imported service since it's already instantiated
import AIMatchingService from '../intelligentMatchingService';

// Define sample locations (coordinates for major US cities)
const locations = [
  { city: "New York", coords: { latitude: 40.7128, longitude: -74.0060 } },
  { city: "Los Angeles", coords: { latitude: 34.0522, longitude: -118.2437 } },
  { city: "Chicago", coords: { latitude: 41.8781, longitude: -87.6298 } },
  { city: "Houston", coords: { latitude: 29.7604, longitude: -95.3698 } },
  { city: "Phoenix", coords: { latitude: 33.4484, longitude: -112.0740 } },
  { city: "Philadelphia", coords: { latitude: 39.9526, longitude: -75.1652 } },
  { city: "San Antonio", coords: { latitude: 29.4241, longitude: -98.4936 } },
  { city: "San Diego", coords: { latitude: 32.7157, longitude: -117.1611 } },
  { city: "Dallas", coords: { latitude: 32.7767, longitude: -96.7970 } },
  { city: "San Jose", coords: { latitude: 37.3382, longitude: -121.8863 } }
];

// Vehicle types with dimensions
const vehicleTypes = {
  bicycle: {
    capacity: { length: 40, width: 30, height: 30, weightLimit: 10 },
    size: "small"
  },
  motorcycle: {
    capacity: { length: 50, width: 40, height: 40, weightLimit: 20 },
    size: "small"
  },
  car: {
    capacity: { length: 100, width: 80, height: 60, weightLimit: 50 },
    size: "medium"
  },
  van: {
    capacity: { length: 200, width: 150, height: 150, weightLimit: 200 },
    size: "large"
  },
  truck: {
    capacity: { length: 400, width: 200, height: 200, weightLimit: 1000 },
    size: "extra_large"
  }
};

// Generate a random route between two locations
const generateRoute = (start: {latitude: number, longitude: number}, end: {latitude: number, longitude: number}, numPoints = 5): Array<{latitude: number, longitude: number}> => {
  const route: Array<{latitude: number, longitude: number}> = [start];
  
  for (let i = 1; i < numPoints - 1; i++) {
    const progress = i / (numPoints - 1);
    // Add some randomness to the route
    const jitter = 0.01; // About 1km jitter
    const lat = start.latitude + (end.latitude - start.latitude) * progress + (Math.random() - 0.5) * jitter;
    const lng = start.longitude + (end.longitude - start.longitude) * progress + (Math.random() - 0.5) * jitter;
    route.push({latitude: lat, longitude: lng});
  }
  
  route.push(end);
  return route;
};

// Generate a random time between 00:00 and 23:59
const randomTime = () => {
  const hours = Math.floor(Math.random() * 24).toString().padStart(2, '0');
  const minutes = Math.floor(Math.random() * 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Generate a time window (start, end) with reasonable duration
const randomTimeWindow = (minHours = 1, maxHours = 4) => {
  const startHour = Math.floor(Math.random() * 20); // 0-19 to leave room for the window
  const startMinute = Math.floor(Math.random() * 60);
  
  const durationHours = Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours;
  
  let endHour = startHour + durationHours;
  const endMinute = startMinute;
  
  // Format times as strings
  const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  
  return [startTime, endTime];
};

// Generate random package dimensions
const randomPackageDimensions = (size: 'small' | 'medium' | 'large' = 'medium') => {
  let lengthRange, widthRange, heightRange, weightRange;
  
  switch (size) {
    case 'small':
      lengthRange = [10, 30];
      widthRange = [10, 20];
      heightRange = [5, 15];
      weightRange = [0.5, 5];
      break;
    case 'large':
      lengthRange = [50, 200];
      widthRange = [40, 100];
      heightRange = [40, 100];
      weightRange = [10, 50];
      break;
    case 'medium':
    default:
      lengthRange = [20, 60];
      widthRange = [15, 40];
      heightRange = [15, 30];
      weightRange = [2, 15];
      break;
  }
  
  return {
    length: Math.floor(Math.random() * (lengthRange[1] - lengthRange[0] + 1)) + lengthRange[0],
    width: Math.floor(Math.random() * (widthRange[1] - widthRange[0] + 1)) + widthRange[0],
    height: Math.floor(Math.random() * (heightRange[1] - heightRange[0] + 1)) + heightRange[0],
    weight: Math.floor((Math.random() * (weightRange[1] - weightRange[0]) + weightRange[0]) * 10) / 10,
  };
};

// Generate a random schedule for carriers
const randomSchedule = () => {
  const scheduleTypes = [
    { startTime: "06:00", endTime: "14:00" }, // Early shift
    { startTime: "09:00", endTime: "17:00" }, // Regular day shift
    { startTime: "14:00", endTime: "22:00" }, // Late shift
    { startTime: "18:00", endTime: "02:00" }, // Night shift
    { startTime: "08:00", endTime: "20:00" }, // Long day shift
  ];
  
  return scheduleTypes[Math.floor(Math.random() * scheduleTypes.length)];
};

// Generate random completion history
const randomCompletionHistory = (count: number) => {
  const completedDeliveries: string[] = [];
  for (let i = 0; i < count; i++) {
    completedDeliveries.push(`historicDelivery-${Math.floor(Math.random() * 10000)}`);
  }
  return completedDeliveries;
};

// Create carriers in the database
const createCarriers = async (count: number) => {
  console.log(`Creating ${count} carriers...`);
  const carriers = [];
  
  for (let i = 0; i < count; i++) {
    const vehicleTypeKeys = Object.keys(vehicleTypes);
    const vehicleType = vehicleTypeKeys[Math.floor(Math.random() * vehicleTypeKeys.length)];
    const vehicle = vehicleTypes[vehicleType as keyof typeof vehicleTypes];
    
    const homeLocationIndex = Math.floor(Math.random() * locations.length);
    const homeLocation = locations[homeLocationIndex];
    
    // Small random offset from the city center
    const latOffset = (Math.random() - 0.5) * 0.05;
    const lngOffset = (Math.random() - 0.5) * 0.05;
    
    const lastLocation = {
      latitude: homeLocation.coords.latitude + latOffset,
      longitude: homeLocation.coords.longitude + lngOffset
    };
    
    // Generate a random route with 5-10 points
    const destinationIndex = (homeLocationIndex + 1 + Math.floor(Math.random() * (locations.length - 1))) % locations.length;
    const destination = locations[destinationIndex];
    
    const routeCoordinates = generateRoute(
      lastLocation,
      {latitude: destination.coords.latitude, longitude: destination.coords.longitude},
      Math.floor(Math.random() * 6) + 5
    );
    
    // Random rating between 3.0 and 5.0
    const rating = Math.round((Math.random() * 2 + 3) * 10) / 10;
    
    // On-time rate between 70% and 100%
    const onTimeRate = Math.round((Math.random() * 30 + 70)) / 100;
    
    // Random number of completed deliveries (0-100)
    const completedDeliveriesCount = Math.floor(Math.random() * 101);
    
    const carrier = {
      name: `Carrier ${i + 1}`,
      email: `carrier${i + 1}@example.com`,
      phone: `555-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicleType,
      vehicleSize: vehicle.size,
      vehicleCapacity: vehicle.capacity,
      lastLocation,
      homeLocation: {
        latitude: homeLocation.coords.latitude,
        longitude: homeLocation.coords.longitude,
        city: homeLocation.city
      },
      routeCoordinates,
      schedule: randomSchedule(),
      rating,
      onTimeRate,
      completedDeliveries: randomCompletionHistory(completedDeliveriesCount),
      active: Math.random() > 0.2, // 80% active
      available: Math.random() > 0.3, // 70% available
      role: 'carrier',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    
    const carrierId = `carrier-${i + 1}`;
    await db.collection('carriers').doc(carrierId).set(carrier);
    carriers.push({ id: carrierId, ...carrier });
    
    // Also create a user record
    await db.collection('users').doc(carrierId).set({
      name: carrier.name,
      email: carrier.email,
      phone: carrier.phone,
      role: 'carrier',
      active: carrier.active,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  
  console.log(`Created ${carriers.length} carriers`);
  return carriers;
};

// Create packages in the database
const createPackages = async (count: number) => {
  console.log(`Creating ${count} packages...`);
  const packages = [];
  
  const packageSizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
  const packageUrgencies: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
  
  for (let i = 0; i < count; i++) {
    const pickupLocationIndex = Math.floor(Math.random() * locations.length);
    const pickupLocation = locations[pickupLocationIndex];
    
    // Delivery is in a different city
    let deliveryLocationIndex;
    do {
      deliveryLocationIndex = Math.floor(Math.random() * locations.length);
    } while (deliveryLocationIndex === pickupLocationIndex);
    
    const deliveryLocation = locations[deliveryLocationIndex];
    
    // Small random offset from the city center
    const pickupLatOffset = (Math.random() - 0.5) * 0.05;
    const pickupLngOffset = (Math.random() - 0.5) * 0.05;
    const deliveryLatOffset = (Math.random() - 0.5) * 0.05;
    const deliveryLngOffset = (Math.random() - 0.5) * 0.05;
    
    const size = packageSizes[Math.floor(Math.random() * packageSizes.length)];
    const dimensions = randomPackageDimensions(size);
    const urgency = packageUrgencies[Math.floor(Math.random() * packageUrgencies.length)];
    
    // Create pickup and delivery windows
    const pickupWindow = randomTimeWindow(2, 4);
    
    // Calculate distance in km (approximate)
    const R = 6371; // Earth radius in km
    const dLat = (deliveryLocation.coords.latitude - pickupLocation.coords.latitude) * Math.PI / 180;
    const dLon = (deliveryLocation.coords.longitude - pickupLocation.coords.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pickupLocation.coords.latitude * Math.PI / 180) * Math.cos(deliveryLocation.coords.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c;
    
    // Delivery window starts 1-5 hours after pickup window end depending on distance
    const pickupEndParts = pickupWindow[1].split(':');
    let deliveryStartHour = parseInt(pickupEndParts[0]) + Math.max(1, Math.min(5, Math.ceil(distance / 100)));
    let deliveryStartMinute = parseInt(pickupEndParts[1]);
    
    // Handle overflow to next day
    if (deliveryStartHour >= 24) {
      deliveryStartHour -= 24;
    }
    
    const deliveryStartTime = `${deliveryStartHour.toString().padStart(2, '0')}:${deliveryStartMinute.toString().padStart(2, '0')}`;
    const deliveryWindow = [deliveryStartTime, `${(deliveryStartHour + 3).toString().padStart(2, '0')}:${deliveryStartMinute.toString().padStart(2, '0')}`];
    
    // Add some variation to status
    const statuses = ['ready_for_pickup', 'in_transit', 'delivered'];
    const statusWeights = [0.7, 0.2, 0.1]; // 70% ready, 20% transit, 10% delivered
    
    let statusIndex = 0;
    const randomValue = Math.random();
    let cumulativeWeight = 0;
    
    for (let j = 0; j < statuses.length; j++) {
      cumulativeWeight += statusWeights[j];
      if (randomValue <= cumulativeWeight) {
        statusIndex = j;
        break;
      }
    }
    
    const status = statuses[statusIndex];
    
    const pkg = {
      pickupLocation: {
        latitude: pickupLocation.coords.latitude + pickupLatOffset,
        longitude: pickupLocation.coords.longitude + pickupLngOffset,
        city: pickupLocation.city,
        address: `${Math.floor(Math.random() * 1000) + 100} Main St, ${pickupLocation.city}`
      },
      deliveryLocation: {
        latitude: deliveryLocation.coords.latitude + deliveryLatOffset,
        longitude: deliveryLocation.coords.longitude + deliveryLngOffset,
        city: deliveryLocation.city,
        address: `${Math.floor(Math.random() * 1000) + 100} Broadway, ${deliveryLocation.city}`
      },
      pickupWindow,
      deliveryWindow,
      dimensions,
      packageWeight: dimensions.weight,
      urgency,
      distance,
      status,
      matched: status !== 'ready_for_pickup' || Math.random() > 0.7, // 30% of ready packages are matched
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    
    const packageId = `package-${i + 1}`;
    await db.collection('packages').doc(packageId).set(pkg);
    packages.push({ id: packageId, ...pkg });
    
    // If the package is matched or in transit/delivered, create a route
    if (pkg.matched || status !== 'ready_for_pickup') {
      const route = {
        packageId,
        pickupLocation: pkg.pickupLocation,
        deliveryLocation: pkg.deliveryLocation,
        distance: pkg.distance,
        estimatedDuration: Math.ceil(pkg.distance / 60 * 60), // minutes, assuming 60 km/h average speed
        waypoints: generateRoute(
          {latitude: pkg.pickupLocation.latitude, longitude: pkg.pickupLocation.longitude},
          {latitude: pkg.deliveryLocation.latitude, longitude: pkg.deliveryLocation.longitude},
          Math.floor(Math.random() * 6) + 5
        ),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      await db.collection('routes').doc(`route-${packageId}`).set(route);
    }
  }
  
  console.log(`Created ${packages.length} packages`);
  return packages;
};

// Create historical matches with feedback for training
const createHistoricalMatches = async (carriers: any[], packages: any[], count: number) => {
  console.log(`Creating ${count} historical matches...`);
  const matches = [];
  
  for (let i = 0; i < count; i++) {
    const carrier = carriers[Math.floor(Math.random() * carriers.length)];
    const pkg = packages[Math.floor(Math.random() * packages.length)];
    
    // 80% successful matches, 20% rejected/failed
    const successful = Math.random() > 0.2;
    const status = successful ? 'completed' : 'rejected';
    
    // Calculate match details
    const carrierLocation = carrier.lastLocation;
    const pickupLocation = pkg.pickupLocation;
    
    // Simple distance calculation (Haversine formula)
    const R = 6371; // Earth radius in km
    const dLat = (pickupLocation.latitude - carrierLocation.latitude) * Math.PI / 180;
    const dLon = (pickupLocation.longitude - carrierLocation.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(carrierLocation.latitude * Math.PI / 180) * Math.cos(pickupLocation.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c;
    
    // Base compensation calculation
    const baseRate = 50;
    const distanceRate = 10; // per km
    const weightRate = 5; // per kg
    
    let urgencyMultiplier = 1;
    if (pkg.urgency === 'high') {
      urgencyMultiplier = 1.5;
    } else if (pkg.urgency === 'medium') {
      urgencyMultiplier = 1.2;
    }
    
    const compensation = Math.round((baseRate + distance * distanceRate + pkg.packageWeight * weightRate) * urgencyMultiplier);
    
    const match = {
      packageId: pkg.id,
      carrierId: carrier.id,
      status,
      score: Math.random() * 0.5 + (successful ? 0.5 : 0), // Higher scores for successful matches
      detourDistance: distance,
      detourTime: Math.ceil(distance / 30 * 60), // minutes, assuming 30 km/h for detour
      carrierPayoutAmount: compensation,
      platformFeeAmount: Math.round(compensation * 0.15), // 15% platform fee
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: successful ? FieldValue.serverTimestamp() : null
    };
    
    const matchId = `match-${i + 1}`;
    await db.collection('matches').doc(matchId).set(match);
    
    // Add feedback for training
    if (successful) {
      await db.collection('match_feedback').doc(matchId).set({
        success: true,
        feedback: "Delivery completed successfully",
        rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars for successful deliveries
        createdAt: FieldValue.serverTimestamp()
      });
    } else {
      await db.collection('match_feedback').doc(matchId).set({
        success: false,
        feedback: "Carrier rejected the delivery",
        createdAt: FieldValue.serverTimestamp()
      });
    }
    
    matches.push({ id: matchId, ...match });
  }
  
  console.log(`Created ${matches.length} historical matches`);
  return matches;
};

// Generate structured training data for the model
const generateTrainingData = async (matches: any[]) => {
  console.log("Generating training data for the ML model...");
  const trainingData = [];
  
  for (const match of matches) {
    const packageDoc = await db.collection('packages').doc(match.packageId).get();
    const carrierDoc = await db.collection('carriers').doc(match.carrierId).get();
    
    if (!packageDoc.exists || !carrierDoc.exists) {
      continue;
    }
    
    const packageData = packageDoc.data();
    const carrierData = carrierDoc.data();
    
    if (!packageData || !carrierData) {
      console.log(`Missing data for match between package ${match.packageId} and carrier ${match.carrierId}`);
      continue;
    }
    
    // Prepare package data
    const packageForML = {
      id: match.packageId,
      pickupCoordinates: [
        packageData.pickupLocation?.latitude || 0,
        packageData.pickupLocation?.longitude || 0
      ],
      deliveryCoordinates: [
        packageData.deliveryLocation?.latitude || 0,
        packageData.deliveryLocation?.longitude || 0
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
    const carrierForML = {
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
    
    // Get feedback to determine success
    let success = match.status === 'completed';
    
    try {
      const feedbackDoc = await db.collection('match_feedback').doc(match.id).get();
      // Check if the document exists and has data before trying to access it
      if (feedbackDoc && feedbackDoc.exists && feedbackDoc.data()) {
        success = feedbackDoc.data()?.success ?? success;
      }
    } catch (error) {
      console.error(`Error fetching feedback for match ${match.id}:`, error);
      // Fall back to using match status
    }
    
    trainingData.push({
      package: packageForML,
      carrier: carrierForML,
      success: success ? 1 : 0
    });
  }
  
  // Create directory if it doesn't exist
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Save to file
  const trainingDataPath = path.join(dataDir, 'matching_history.json');
  fs.writeFileSync(trainingDataPath, JSON.stringify(trainingData, null, 2));
  
  console.log(`Generated training data with ${trainingData.length} examples`);
  return trainingData;
};
// Main function to populate the database and train the model
const populateAndTrain = async () => {
    
      // Create carriers, packages, and historical matches
      const carriers = await createCarriers(30);
      const packages = await createPackages(50);
      const matches = await createHistoricalMatches(carriers, packages, 100);
      
      // Generate training data
      await generateTrainingData(matches);
      
      // Use the imported singleton instance directly
      console.log("Training the AI matching model...");
      const trained = await AIMatchingService.trainModel();
      
      if (trained!) {
        console.log("Model trained successfully!");
        
        // Test the model with a random package
        const randomPackageId = packages[Math.floor(Math.random() * packages.length)].id;
        console.log(`Testing model with package ${randomPackageId}...`);
        
        // Make sure findOptimalCarriers returns an array
        const optimalCarriers = await AIMatchingService.findOptimalCarriers(randomPackageId);
        
        // Check if the result is an array before accessing length property
        if (Array.isArray(optimalCarriers)) {
          console.log(`Found ${optimalCarriers.length} optimal carriers`);
          console.log(JSON.stringify(optimalCarriers, null, 2));
        } else {
          console.log("Result is not an array. Actual result:", optimalCarriers);
        }
      } else {
        console.error("Failed to train the model");
      }
    
  };
  
  // Run the script
  populateAndTrain().then(() => {
    console.log("Database population and model training completed");
    process.exit(0);
  }).catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
  });