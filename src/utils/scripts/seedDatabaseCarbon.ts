// scripts/seedDatabase.ts
import { getFirestore, Timestamp, FieldValue, WriteBatch } from 'firebase-admin/firestore';
import { db } from '../../config/database';
import { logger } from '../logger';

/**
 * Seed the database with vehicle emission profiles
 */
async function seedVehicleProfiles(): Promise<void> {
  logger.info('Seeding vehicle emission profiles...');
  
  const defaultProfiles: Array<{
    vehicleType: string;
    vehicleSize?: string;
    emissionFactor: number;
  }> = [
    { vehicleType: 'car', vehicleSize: 'small', emissionFactor: 120 },
    { vehicleType: 'car', vehicleSize: 'medium', emissionFactor: 150 },
    { vehicleType: 'car', vehicleSize: 'large', emissionFactor: 200 },
    { vehicleType: 'car', vehicleSize: 'suv', emissionFactor: 230 },
    { vehicleType: 'car', vehicleSize: 'electric', emissionFactor: 0 },
    { vehicleType: 'motorcycle', emissionFactor: 80 },
    { vehicleType: 'bicycle', emissionFactor: 0 },
    { vehicleType: 'walking', emissionFactor: 0 },
    { vehicleType: 'auto_rickshaw', emissionFactor: 110 },
    { vehicleType: 'taxi', emissionFactor: 160 },
    { vehicleType: 'bus', emissionFactor: 68 },
    { vehicleType: 'train', emissionFactor: 30 }
  ];
  
  const batch = db.batch();
  
  for (const profile of defaultProfiles) {
    const profileRef = db.collection('vehicle_emission_profiles').doc();
    batch.set(profileRef, {
      ...profile,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  
  await batch.commit();
  logger.info('Vehicle emission profiles seeded successfully!');
}

/**
 * Interface for carrier data
 */
interface CarrierData {
  name: string;
  email: string;
  vehicleType: string;
  vehicleSize?: string;
  joinDate: Date;
}

/**
 * Seed the database with sample carriers
 */
async function seedCarriers(): Promise<string[]> {
  logger.info('Seeding carriers...');
  
  const carriers: CarrierData[] = [
    { 
      name: 'John Doe', 
      email: 'john@example.com', 
      vehicleType: 'car', 
      vehicleSize: 'medium',
      joinDate: new Date('2024-01-15')
    },
    { 
      name: 'Jane Smith', 
      email: 'jane@example.com', 
      vehicleType: 'bicycle',
      joinDate: new Date('2024-01-20')
    },
    { 
      name: 'Bob Johnson', 
      email: 'bob@example.com', 
      vehicleType: 'motorcycle',
      joinDate: new Date('2024-01-25')
    },
    { 
      name: 'Alice Brown', 
      email: 'alice@example.com', 
      vehicleType: 'car', 
      vehicleSize: 'electric',
      joinDate: new Date('2024-02-01')
    },
    { 
      name: 'Michael Wilson', 
      email: 'michael@example.com', 
      vehicleType: 'car', 
      vehicleSize: 'suv',
      joinDate: new Date('2024-02-10')
    }
  ];
  
  const batch = db.batch();
  
  const carrierIds: string[] = [];
  
  for (const carrier of carriers) {
    const carrierId = `carrier_${Math.random().toString(36).substring(2, 9)}`;
    carrierIds.push(carrierId);
    
    const carrierRef = db.collection('carriers').doc(carrierId);
    batch.set(carrierRef, {
      ...carrier,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  
  await batch.commit();
  logger.info('Carriers seeded successfully!');
  
  return carrierIds;
}

/**
 * Helper to get document
 */
async function getDocument<T>(collection: string, docId: string): Promise<T | null> {
  try {
    const docRef = db.collection(collection).doc(docId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as T;
    }
    return null;
  } catch (error) {
    logger.error(`Error getting document from ${collection}:`, error);
    return null;
  }
}

/**
 * Seed the database with sample deliveries and related data
 */
async function seedDeliveries(carrierIds: string[]): Promise<void> {
  logger.info('Seeding deliveries and related data...');
  
  interface Delivery {
    id: string;
    carrierId: string;
    packageWeight: number;
    isFragile: boolean;
    urgency: 'low' | 'medium' | 'high';
    departureTime: string;
    createdAt: Date;
    completedAt: Date;
    status: string;
  }

  interface Route {
    deliveryId: string;
    totalDistance: number;
    deviationDistance: number;
    trafficCongestion: number;
    createdAt: Date;
  }

  interface Emission {
    deliveryId: string;
    baselineEmissions: number;
    actualEmissions: number;
    emissionSavings: number;
    savingsPercentage: number;
    createdAt: Date;
  }

  interface DailySummary {
    date: string;
    totalDeliveries: number;
    totalBaselineEmissions: number;
    totalActualEmissions: number;
    totalEmissionSavings: number;
    averageSavingsPercentage: number;
    createdAt: Date;
  }
  
  const deliveries: Delivery[] = [];
  const routes: Route[] = [];
  const emissions: Emission[] = [];
  const summaries: Record<string, DailySummary> = {};
  
  // Create 90 days of data
  for (let day = 0; day < 90; day++) {
    const date = new Date();
    date.setDate(date.getDate() - 90 + day);
    const dateString = date.toISOString().split('T')[0];
    
    // Between 2-10 deliveries per day
    const deliveriesPerDay = Math.floor(Math.random() * 8) + 2;
    
    let totalDeliveries = 0;
    let totalBaselineEmissions = 0;
    let totalActualEmissions = 0;
    let totalEmissionSavings = 0;
    let totalSavingsPercentage = 0;
    
    for (let i = 0; i < deliveriesPerDay; i++) {
      const carrierId = carrierIds[Math.floor(Math.random() * carrierIds.length)];
      const carrier = await getDocument<{
        vehicleType: string;
        vehicleSize?: string;
      }>('carriers', carrierId);
      
      const vehicleType = carrier?.vehicleType || 'car';
      const vehicleSize = carrier?.vehicleSize || 'medium';
      
      // Random delivery time
      const hour = Math.floor(Math.random() * 24);
      const minute = Math.floor(Math.random() * 60);
      const departureTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Random weights, distances, etc.
      const totalDistance = Math.floor(Math.random() * 15) + 5; // 5-20 km
      const deviationDistance = Math.floor(Math.random() * 3) + 1; // 1-4 km
      const trafficCongestion = 1 + Math.random() * 0.8; // 1.0-1.8
      const packageWeight = Math.floor(Math.random() * 15) + 1; // 1-15 kg
      const isFragile = Math.random() < 0.3; // 30% chance of fragile
      const urgencyOptions: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      const urgency = urgencyOptions[Math.floor(Math.random() * urgencyOptions.length)];
      
      // Add delivery
      const deliveryId = `delivery_${Math.random().toString(36).substring(2, 11)}`;
      
      deliveries.push({
        id: deliveryId,
        carrierId,
        packageWeight,
        isFragile,
        urgency,
        departureTime,
        createdAt: date,
        completedAt: new Date(date.getTime() + (Math.random() * 3600000)), // 0-1 hour after creation
        status: 'completed'
      });
      
      // Add route
      routes.push({
        deliveryId,
        totalDistance,
        deviationDistance,
        trafficCongestion,
        createdAt: date
      });
      
      // Calculate emissions
      const vehicleEmissionFactor = getEmissionFactor(vehicleType, vehicleSize);
      
      // Get time factor based on departure hour
      const timeFactor = getTimeFactor(hour);
      
      // Apply traffic congestion factor
      const trafficLevel = getTrafficLevel(trafficCongestion);
      const trafficFactor = getTrafficFactor(trafficLevel);
      
      // Calculate baseline emissions (delivery van)
      const deliveryVanEmissionFactor = 250; // g CO2 per km
      const inefficiencyFactor = 1.5;
      const urgencyFactor = urgency === 'high' ? 1.2 : (urgency === 'medium' ? 1.1 : 1.0);
      
      let baselineEmissions = totalDistance * deliveryVanEmissionFactor * timeFactor * trafficFactor * inefficiencyFactor * urgencyFactor;
      
      // Calculate actual emissions
      const weightFactor = 1 + (packageWeight > 10 ? 0.2 : 0.1);
      const fragileFactor = isFragile ? 1.1 : 1.0;
      
      let actualEmissions = deviationDistance * vehicleEmissionFactor * timeFactor * trafficFactor * weightFactor * fragileFactor;
      
      // Ensure actual is not higher than baseline
      if (actualEmissions > baselineEmissions) {
        actualEmissions = baselineEmissions * 0.95;
      }
      
      // Calculate savings
      const emissionSavings = baselineEmissions - actualEmissions;
      const savingsPercentage = (emissionSavings / baselineEmissions) * 100;
      
      // Add emission record
      emissions.push({
        deliveryId,
        baselineEmissions,
        actualEmissions,
        emissionSavings,
        savingsPercentage,
        createdAt: date
      });
      
      // Add to day's totals
      totalDeliveries++;
      totalBaselineEmissions += baselineEmissions;
      totalActualEmissions += actualEmissions;
      totalEmissionSavings += emissionSavings;
      totalSavingsPercentage += savingsPercentage;
    }
    
    // Create daily summary
    const averageSavingsPercentage = totalSavingsPercentage / totalDeliveries;
    
    summaries[dateString] = {
      date: dateString,
      totalDeliveries,
      totalBaselineEmissions,
      totalActualEmissions,
      totalEmissionSavings,
      averageSavingsPercentage,
      createdAt: date
    };
  }
  
  // Write all data to Firestore in batches
  await commitBatches('deliveries', deliveries, (batch, delivery) => {
    const deliveryRef = db.collection('deliveries').doc(delivery.id);
    batch.set(deliveryRef, {
      carrierId: delivery.carrierId,
      packageWeight: delivery.packageWeight,
      isFragile: delivery.isFragile,
      urgency: delivery.urgency,
      departureTime: delivery.departureTime,
      createdAt: delivery.createdAt,
      completedAt: delivery.completedAt,
      status: delivery.status,
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  
  await commitBatches('routes', routes, (batch, route) => {
    const routeRef = db.collection('routes').doc();
    batch.set(routeRef, {
      deliveryId: route.deliveryId,
      totalDistance: route.totalDistance,
      deviationDistance: route.deviationDistance,
      trafficCongestion: route.trafficCongestion,
      createdAt: route.createdAt,
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  
  await commitBatches('emissions', emissions, (batch, emission) => {
    const emissionRef = db.collection('emissions').doc();
    batch.set(emissionRef, {
      deliveryId: emission.deliveryId,
      baselineEmissions: emission.baselineEmissions,
      actualEmissions: emission.actualEmissions,
      emissionSavings: emission.emissionSavings,
      savingsPercentage: emission.savingsPercentage,
      createdAt: emission.createdAt,
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  
  await commitBatches('emission_summaries', Object.values(summaries), (batch, summary) => {
    const summaryRef = db.collection('emission_summaries').doc();
    batch.set(summaryRef, {
      date: summary.date,
      totalDeliveries: summary.totalDeliveries,
      totalBaselineEmissions: summary.totalBaselineEmissions,
      totalActualEmissions: summary.totalActualEmissions,
      totalEmissionSavings: summary.totalEmissionSavings,
      averageSavingsPercentage: summary.averageSavingsPercentage,
      createdAt: summary.createdAt,
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  
  logger.info('Deliveries, routes, emissions, and summaries seeded successfully!');
}

/**
 * Helper function to commit batch operations
 */
async function commitBatches<T>(
  name: string, 
  items: T[], 
  batchFn: (batch: WriteBatch, item: T) => void
): Promise<void> {
  let batch = db.batch();
  let count = 0;
  
  logger.info(`Writing ${items.length} ${name} to Firestore...`);
  
  for (const item of items) {
    batchFn(batch, item);
    count++;
    
    // Firestore batches have a limit of 500 operations
    if (count % 400 === 0) {
      logger.info(`Committing batch of ${count} ${name}...`);
      await batch.commit();
      batch = db.batch();
    }
  }
  
  if (count % 400 !== 0) {
    logger.info(`Committing final batch of ${count % 400} ${name}...`);
    await batch.commit();
  }
}

/**
 * Interface for badge
 */
interface Badge {
  name: string;
  threshold: number;
  icon: string;
  description: string;
}

/**
 * Seed carrier emission statistics
 */
async function seedCarrierStats(carrierIds: string[]): Promise<void> {
  logger.info('Seeding carrier emission statistics...');
  
  const batch = db.batch();
  
  for (const carrierId of carrierIds) {
    // Get all emissions for this carrier's deliveries
    // In a real implementation, we'd query for this data
    // For seeding, we'll generate random statistics
    
    const totalDeliveries = Math.floor(Math.random() * 50) + 10; // 10-60 deliveries
    const totalEmissionSavings = Math.floor(Math.random() * 100000) + 20000; // 20-120kg in grams
    const averageSavingsPercentage = Math.floor(Math.random() * 40) + 50; // 50-90%
    const lastDeliveryDate = new Date();
    lastDeliveryDate.setDate(lastDeliveryDate.getDate() - Math.floor(Math.random() * 10));
    
    const statsRef = db.collection('carrier_emission_stats').doc();
    batch.set(statsRef, {
      carrierId,
      totalDeliveries,
      totalEmissionSavings,
      averageSavingsPercentage,
      lastDeliveryDate,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Also create badges for carriers
    createCarrierBadges(carrierId, totalEmissionSavings / 1000, batch);
  }
  
  await batch.commit();
  logger.info('Carrier emission statistics seeded successfully!');
}

/**
 * Create carrier badges based on emission savings
 */
function createCarrierBadges(carrierId: string, savingsKg: number, batch: WriteBatch): void {
  // Define badge levels
  const badges: Badge[] = [
    { name: "Carbon Saver", threshold: 10, icon: "bronze-leaf", description: "Saved at least 10kg of CO2 emissions" },
    { name: "Eco Warrior", threshold: 50, icon: "silver-leaf", description: "Saved at least 50kg of CO2 emissions" },
    { name: "Climate Champion", threshold: 100, icon: "gold-leaf", description: "Saved at least 100kg of CO2 emissions" },
    { name: "Earth Protector", threshold: 500, icon: "platinum-earth", description: "Saved at least 500kg of CO2 emissions" }
  ];
  
  // Determine earned badges
  const earnedBadges = badges.filter(badge => savingsKg >= badge.threshold);
  
  // Add badges
  for (const badge of earnedBadges) {
    const badgeRef = db.collection('carrier_badges').doc();
    batch.set(badgeRef, {
      carrierId,
      badgeName: badge.name,
      badgeIcon: badge.icon,
      badgeDescription: badge.description,
      earnedAt: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 30)), // Random time in last 30 days
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
}

// Helper functions

/**
 * Get emission factor for a vehicle type and size
 */
function getEmissionFactor(vehicleType: string, vehicleSize?: string): number {
  if (vehicleType === 'car') {
    const vehicleSizeFactors: Record<string, number> = {
      small: 120,
      medium: 150,
      large: 200,
      suv: 230,
      electric: 0
    };
    return vehicleSizeFactors[vehicleSize || ''] || 150;
  } else {
    const vehicleFactors: Record<string, number> = {
      motorcycle: 80,
      bicycle: 0,
      walking: 0,
      auto_rickshaw: 110,
      taxi: 160,
      bus: 68,
      train: 30
    };
    return vehicleFactors[vehicleType] || 150;
  }
}

/**
 * Get time factor based on hour of day
 */
function getTimeFactor(hour: number): number {
  const timeFactors: Record<number, number> = {
    0: 0.8, 1: 0.7, 2: 0.7, 3: 0.7, 4: 0.7, 5: 0.8,
    6: 0.9, 7: 1.2, 8: 1.5, 9: 1.3, 10: 1.1, 11: 1.0,
    12: 1.1, 13: 1.1, 14: 1.0, 15: 1.1, 16: 1.2, 17: 1.5,
    18: 1.5, 19: 1.3, 20: 1.1, 21: 1.0, 22: 0.9, 23: 0.8
  };
  
  return timeFactors[hour] || 1.0;
}

/**
 * Get traffic level from congestion factor
 */
function getTrafficLevel(congestionFactor: number): string {
  if (congestionFactor < 1.1) return 'low';
  if (congestionFactor < 1.3) return 'medium';
  if (congestionFactor < 1.6) return 'high';
  return 'severe';
}

/**
 * Get traffic factor based on traffic level
 */
function getTrafficFactor(trafficLevel: string): number {
  const trafficFactors: Record<string, number> = {
    low: 1.0,
    medium: 1.2,
    high: 1.5,
    severe: 1.8
  };
  
  return trafficFactors[trafficLevel] || 1.0;
}

/**
 * Main function to seed the database
 */
async function seedDatabase(): Promise<void> {
  try {
    logger.info('Starting database seeding process...');
    
    await seedVehicleProfiles();
    const carrierIds = await seedCarriers();
    await seedDeliveries(carrierIds);
    await seedCarrierStats(carrierIds);
    
    logger.info('Database seeding completed successfully!');
  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  }
}

// Run the seeding process
seedDatabase().catch(error => {
  logger.error('Fatal error during database seeding:', error);
  process.exit(1);
});