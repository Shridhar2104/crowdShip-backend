import { db, Timestamp, FieldValue } from '../config/database';
import { logger } from './logger';
import {
  EmissionDocument,
  VehicleEmissionProfileDocument,
  CarrierBadgeDocument,
  DeliveryInfo,
  EmissionData
} from '../models/EmissionInterfaces';

class CarbonEmissionService {
  // Collection names
  private readonly EMISSIONS_COLLECTION = 'emissions';
  private readonly VEHICLE_PROFILES_COLLECTION = 'vehicle_emission_profiles';
  private readonly CARRIER_BADGES_COLLECTION = 'carrier_badges';
  private readonly EMISSION_SUMMARIES_COLLECTION = 'emission_summaries';
  private readonly CARRIER_STATS_COLLECTION = 'carrier_emission_stats';
  
  // Traffic congestion impact factors
  private trafficFactors: { [key: string]: number } = {
    low: 1.0,
    medium: 1.2,
    high: 1.5,
    severe: 1.8
  };
  
  // Time of day factors
  private timeFactors: { [key: number]: number } = {
    // Hour of day: factor
    0: 0.8, 1: 0.7, 2: 0.7, 3: 0.7, 4: 0.7, 5: 0.8,
    6: 0.9, 7: 1.2, 8: 1.5, 9: 1.3, 10: 1.1, 11: 1.0,
    12: 1.1, 13: 1.1, 14: 1.0, 15: 1.1, 16: 1.2, 17: 1.5,
    18: 1.5, 19: 1.3, 20: 1.1, 21: 1.0, 22: 0.9, 23: 0.8
  };

  // Standard delivery van emissions (g CO2 per km)
  private deliveryVanEmissionFactor: number = 250;

  constructor() {
    // Initialize default vehicle profiles if collection is empty
    this.initializeVehicleProfiles();
  }

  /**
   * Initialize default vehicle emission profiles if they don't exist
   */
  private async initializeVehicleProfiles(): Promise<void> {
    try {
      const profilesSnapshot = await db.collection(this.VEHICLE_PROFILES_COLLECTION).limit(1).get();
      
      if (profilesSnapshot.empty) {
        logger.info('Initializing default vehicle emission profiles');
        
        const defaultProfiles = [
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
          const profileRef = db.collection(this.VEHICLE_PROFILES_COLLECTION).doc();
          batch.set(profileRef, {
            ...profile,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
        
        await batch.commit();
        logger.info('Default vehicle emission profiles initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize vehicle emission profiles', error);
    }
  }

  /**
   * Calculate baseline emissions if a dedicated delivery vehicle was used
   * @param delivery Delivery information
   * @returns Baseline emissions in grams of CO2
   */
  public calculateBaselineEmissions(delivery: DeliveryInfo): number {
    // Get route distance
    const distance = delivery.routeData.totalDistance;

    // Get time factor based on departure hour
    const departureHour = parseInt(delivery.departureTime.split(':')[0]);
    const timeFactor = this.timeFactors[departureHour] || 1.0;
    
    // Apply traffic congestion factor
    const trafficLevel = this.getTrafficLevel(delivery.routeData.trafficCongestion || 1.0);
    const trafficFactor = this.trafficFactors[trafficLevel];
    
    // Calculate emissions with factors
    let baselineEmissions = distance * this.deliveryVanEmissionFactor * timeFactor * trafficFactor;

    // Add inefficiency factor for single-package deliveries
    const inefficiencyFactor = 1.5;
    baselineEmissions *= inefficiencyFactor;
    
    // Additional factor for urgent deliveries (they often use less efficient routes)
    if (delivery.urgency === 'high') {
      baselineEmissions *= 1.2;
    } else if (delivery.urgency === 'medium') {
      baselineEmissions *= 1.1;
    }

    return baselineEmissions;
  }

  /**
   * Calculate actual emissions from the crowdsourced delivery
   * @param delivery Delivery information
   * @returns Actual emissions in grams of CO2
   */
  public async calculateActualEmissions(delivery: DeliveryInfo): Promise<number> {
    // Get vehicle emission factor from Firestore
    let emissionFactor: number;
    
    const vehicleProfilesSnapshot = await db.collection(this.VEHICLE_PROFILES_COLLECTION)
      .where('vehicleType', '==', delivery.vehicleType)
      .where('vehicleSize', '==', delivery.vehicleSize || null)
      .limit(1)
      .get();
    
    if (!vehicleProfilesSnapshot.empty) {
      const profile = vehicleProfilesSnapshot.docs[0].data() as VehicleEmissionProfileDocument;
      emissionFactor = profile.emissionFactor;
    } else {
      // Default emission factors if not found in Firestore
      if (delivery.vehicleType === 'car') {
        const vehicleSize = delivery.vehicleSize || 'medium';
        const defaultFactors: { [key: string]: number } = {
          small: 120,
          medium: 150,
          large: 200,
          suv: 230,
          electric: 0
        };
        emissionFactor = defaultFactors[vehicleSize] || 150;
      } else {
        const defaultFactors: { [key: string]: number } = {
          motorcycle: 80,
          bicycle: 0,
          walking: 0,
          auto_rickshaw: 110,
          taxi: 160,
          bus: 68,
          train: 30
        };
        emissionFactor = defaultFactors[delivery.vehicleType] || 150;
      }
    }
    
    // Get time factor based on departure hour
    const departureHour = parseInt(delivery.departureTime.split(':')[0]);
    const timeFactor = this.timeFactors[departureHour] || 1.0;
    
    // Apply traffic congestion factor
    const trafficLevel = this.getTrafficLevel(delivery.routeData.trafficCongestion || 1.0);
    const trafficFactor = this.trafficFactors[trafficLevel];
    
    // Only count the deviation distance, as the carrier was making the trip anyway
    const deviationDistance = delivery.routeData.deviationDistance;
    
    // Calculate emissions with all factors
    const emissions = deviationDistance * emissionFactor * timeFactor * trafficFactor;
    
    // Additional factor for package weight
    const weightFactor = 1 + (delivery.packageWeight > 10 ? 0.2 : 0.1);
    
    // Additional factor for fragile items (may require more careful driving)
    const fragileFactor = delivery.isFragile ? 1.1 : 1.0;
    
    return emissions * weightFactor * fragileFactor;
  }

  /**
   * Get traffic level from congestion factor
   * @param congestionFactor Traffic congestion factor
   * @returns Traffic level as string
   */
  private getTrafficLevel(congestionFactor: number): string {
    if (congestionFactor < 1.1) return 'low';
    if (congestionFactor < 1.3) return 'medium';
    if (congestionFactor < 1.6) return 'high';
    return 'severe';
  }

  /**
   * Calculate emission savings from using crowdsourced delivery
   * @param delivery Delivery information
   * @returns Emission calculation data
   */
  public async calculateEmissionSavings(delivery: DeliveryInfo): Promise<EmissionData> {
    const baseline = this.calculateBaselineEmissions(delivery);
    const actual = await this.calculateActualEmissions(delivery);
    let savings = baseline - actual;

    // Sometimes the savings can be negative (if the deviation is too large)
    // In those cases, set savings to zero
    savings = Math.max(0, savings);

    return {
      baselineEmissions: parseFloat(baseline.toFixed(2)),
      actualEmissions: parseFloat(actual.toFixed(2)),
      emissionSavings: parseFloat(savings.toFixed(2)),
      savingsPercentage: parseFloat(((savings / baseline) * 100).toFixed(2))
    };
  }

  /**
   * Process a delivery to calculate and save its emission data
   * @param deliveryId Delivery ID
   * @returns Emission data
   */
  public async processDeliveryEmissions(deliveryId: string): Promise<EmissionData> {
    try {
      // Check if emissions already calculated
      const existingEmissionSnapshot = await db.collection(this.EMISSIONS_COLLECTION)
        .where('deliveryId', '==', deliveryId)
        .limit(1)
        .get();
      
      if (!existingEmissionSnapshot.empty) {
        const existingData = existingEmissionSnapshot.docs[0].data() as EmissionDocument;
        return {
          baselineEmissions: existingData.baselineEmissions,
          actualEmissions: existingData.actualEmissions,
          emissionSavings: existingData.emissionSavings,
          savingsPercentage: existingData.savingsPercentage
        };
      }
      
      // Get delivery data
      const deliverySnapshot = await db.collection('deliveries').doc(deliveryId).get();
      
      if (!deliverySnapshot.exists) {
        throw new Error(`Delivery with ID ${deliveryId} not found`);
      }
      
      const deliveryData = deliverySnapshot.data();
      if (!deliveryData) {
        throw new Error(`No data found for delivery ID ${deliveryId}`);
      }
      
      // Get carrier data
      const carrierSnapshot = await db.collection('carriers').doc(deliveryData.carrierId).get();
      if (!carrierSnapshot.exists) {
        throw new Error(`Carrier with ID ${deliveryData.carrierId} not found`);
      }
      const carrierData = carrierSnapshot.data();
      
      // Get route data
      const routeSnapshot = await db.collection('routes')
        .where('deliveryId', '==', deliveryId)
        .limit(1)
        .get();
      
      if (routeSnapshot.empty) {
        throw new Error(`Route data for delivery ID ${deliveryId} not found`);
      }
      const routeData = routeSnapshot.docs[0].data();
      
      // Construct delivery info object
      const deliveryInfo: DeliveryInfo = {
        id: deliveryId,
        carrierId: deliveryData.carrierId,
        vehicleType: carrierData?.vehicleType,
        vehicleSize: carrierData?.vehicleSize,
        departureTime: deliveryData.departureTime,
        packageWeight: deliveryData.packageWeight || 0,
        isFragile: deliveryData.isFragile || false,
        urgency: deliveryData.urgency || 'low',
        routeData: {
          totalDistance: routeData.totalDistance,
          deviationDistance: routeData.deviationDistance,
          trafficCongestion: routeData.trafficCongestion
        },
        createdAt: deliveryData.createdAt
      };
      
      // Calculate emission savings
      const emissionData = await this.calculateEmissionSavings(deliveryInfo);
      
      // Save emission data to Firestore
      await db.collection(this.EMISSIONS_COLLECTION).doc().set({
        deliveryId,
        baselineEmissions: emissionData.baselineEmissions,
        actualEmissions: emissionData.actualEmissions,
        emissionSavings: emissionData.emissionSavings,
        savingsPercentage: emissionData.savingsPercentage,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // Update daily emission summary
      await this.updateDailyEmissionSummary(deliveryData.createdAt.toDate());
      
      // Update carrier emission stats
      await this.updateCarrierEmissionStats(deliveryData.carrierId);
      
      return emissionData;
    } catch (error) {
      logger.error(`Failed to process emissions for delivery ${deliveryId}`, error);
      throw error;
    }
  }

  /**
   * Update daily emission summary for a specific date
   * @param date Date to update summary for
   */
  private async updateDailyEmissionSummary(date: Date): Promise<void> {
    try {
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Get all emissions for the date
      const startOfDay = new Date(dateString);
      const endOfDay = new Date(dateString);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      // Query deliveries for this date
      const deliveriesSnapshot = await db.collection('deliveries')
        .where('createdAt', '>=', Timestamp.fromDate(startOfDay))
        .where('createdAt', '<', Timestamp.fromDate(endOfDay))
        .get();
      
      if (deliveriesSnapshot.empty) {
        return; // No deliveries for this date
      }
      
      const deliveryIds = deliveriesSnapshot.docs.map(doc => doc.id);
      
      // Get emissions for these deliveries
      const emissionsPromises = deliveryIds.map(id => 
        db.collection(this.EMISSIONS_COLLECTION)
          .where('deliveryId', '==', id)
          .limit(1)
          .get()
      );
      
      const emissionsSnapshots = await Promise.all(emissionsPromises);
      
      // Calculate totals
      let totalDeliveries = 0;
      let totalBaselineEmissions = 0;
      let totalActualEmissions = 0;
      let totalEmissionSavings = 0;
      let totalSavingsPercentage = 0;
      
      emissionsSnapshots.forEach(emissionSnapshot => {
        if (!emissionSnapshot.empty) {
          const emissionData = emissionSnapshot.docs[0].data() as EmissionDocument;
          totalDeliveries++;
          totalBaselineEmissions += emissionData.baselineEmissions;
          totalActualEmissions += emissionData.actualEmissions;
          totalEmissionSavings += emissionData.emissionSavings;
          totalSavingsPercentage += emissionData.savingsPercentage;
        }
      });
      
      const averageSavingsPercentage = totalDeliveries > 0 
        ? totalSavingsPercentage / totalDeliveries 
        : 0;
      
      // Check if summary exists for this date
      const summarySnapshot = await db.collection(this.EMISSION_SUMMARIES_COLLECTION)
        .where('date', '==', dateString)
        .limit(1)
        .get();
      
      if (summarySnapshot.empty) {
        // Create new summary
        await db.collection(this.EMISSION_SUMMARIES_COLLECTION).doc().set({
          date: dateString,
          totalDeliveries,
          totalBaselineEmissions,
          totalActualEmissions,
          totalEmissionSavings,
          averageSavingsPercentage,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        // Update existing summary
        await summarySnapshot.docs[0].ref.update({
          totalDeliveries,
          totalBaselineEmissions,
          totalActualEmissions,
          totalEmissionSavings,
          averageSavingsPercentage,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      logger.error(`Failed to update daily emission summary for ${date.toISOString()}`, error);
    }
  }

  /**
   * Update emission statistics for a carrier
   * @param carrierId Carrier ID
   */
  private async updateCarrierEmissionStats(carrierId: string): Promise<void> {
    try {
      // Get all deliveries for this carrier
      const deliveriesSnapshot = await db.collection('deliveries')
        .where('carrierId', '==', carrierId)
        .get();
      
      if (deliveriesSnapshot.empty) {
        return; // No deliveries for this carrier
      }
      
      const deliveryIds = deliveriesSnapshot.docs.map(doc => doc.id);
      
      // Find most recent delivery date
      const lastDelivery = deliveriesSnapshot.docs
        .sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis())[0];
      
      // Get emissions for these deliveries
      const emissionsPromises = deliveryIds.map(id => 
        db.collection(this.EMISSIONS_COLLECTION)
          .where('deliveryId', '==', id)
          .limit(1)
          .get()
      );
      
      const emissionsSnapshots = await Promise.all(emissionsPromises);
      
      // Calculate totals
      let totalDeliveries = 0;
      let totalEmissionSavings = 0;
      let totalSavingsPercentage = 0;
      
      emissionsSnapshots.forEach(emissionSnapshot => {
        if (!emissionSnapshot.empty) {
          const emissionData = emissionSnapshot.docs[0].data() as EmissionDocument;
          totalDeliveries++;
          totalEmissionSavings += emissionData.emissionSavings;
          totalSavingsPercentage += emissionData.savingsPercentage;
        }
      });
      
      const averageSavingsPercentage = totalDeliveries > 0 
        ? totalSavingsPercentage / totalDeliveries 
        : 0;
      
      // Check if stats exist for this carrier
      const statsSnapshot = await db.collection(this.CARRIER_STATS_COLLECTION)
        .where('carrierId', '==', carrierId)
        .limit(1)
        .get();
      
      if (statsSnapshot.empty) {
        // Create new stats
        await db.collection(this.CARRIER_STATS_COLLECTION).doc().set({
          carrierId,
          totalDeliveries,
          totalEmissionSavings,
          averageSavingsPercentage,
          lastDeliveryDate: lastDelivery.data().createdAt,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        // Update existing stats
        await statsSnapshot.docs[0].ref.update({
          totalDeliveries,
          totalEmissionSavings,
          averageSavingsPercentage,
          lastDeliveryDate: lastDelivery.data().createdAt,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      logger.error(`Failed to update emission stats for carrier ${carrierId}`, error);
    }
  }

  
 /**
 * Generate emission report for a given date range
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 */
public async generateEmissionReport(startDate: string, endDate: string): Promise<any> {
    try {
      // Get emission summaries for the date range
      const startTimestamp: Date = new Date(startDate);
      const endTimestamp: Date = new Date(endDate);
      endTimestamp.setDate(endTimestamp.getDate() + 1); // Include the end date
      
      const summariesSnapshot = await db.collection(this.EMISSION_SUMMARIES_COLLECTION)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date')
        .get();
      
      if (summariesSnapshot.empty) {
        return {
          message: "No emission data available for the specified period",
          data: null
        };
      }
      
      // Calculate total stats
      let totalDeliveries = 0;
      let totalBaselineEmissions = 0;
      let totalActualEmissions = 0;
      let totalEmissionSavings = 0;
      let totalSavingsPercentage = 0;
      
      summariesSnapshot.docs.forEach(doc => {
        const summary = doc.data();
        totalDeliveries += summary.totalDeliveries;
        totalBaselineEmissions += summary.totalBaselineEmissions;
        totalActualEmissions += summary.totalActualEmissions;
        totalEmissionSavings += summary.totalEmissionSavings;
        totalSavingsPercentage += summary.averageSavingsPercentage * summary.totalDeliveries; // Weighted average
      });
      
      const averageSavingsPercentage = totalDeliveries > 0 
        ? totalSavingsPercentage / totalDeliveries 
        : 0;
      
      // Get emissions by vehicle type for the period
      const periodStartDate: Date = new Date(startTimestamp);
      const periodEndDate: Date = new Date(endTimestamp);
      
      const deliveriesSnapshot = await db.collection('deliveries')
        .where('createdAt', '>=', Timestamp.fromDate(periodStartDate))
        .where('createdAt', '<', Timestamp.fromDate(periodEndDate))
        .get();
      
      const deliveryIds = deliveriesSnapshot.docs.map(doc => doc.id);
      const carrierIds = deliveriesSnapshot.docs.map(doc => doc.data().carrierId);
      
      // Get unique carrier IDs
      const uniqueCarrierIds = [...new Set(carrierIds)];
      
      // Get carrier data
      const carriersPromises = uniqueCarrierIds.map(id => 
        db.collection('carriers').doc(id).get()
      );
      
      const carriersSnapshots = await Promise.all(carriersPromises);
      const carriers = carriersSnapshots.reduce((acc, doc) => {
        if (doc.exists) {
          acc[doc.id] = doc.data();
        }
        return acc;
      }, {} as { [key: string]: any });
      
      // Get emissions for deliveries
      const emissionsPromises = deliveryIds.map(id => 
        db.collection(this.EMISSIONS_COLLECTION)
          .where('deliveryId', '==', id)
          .limit(1)
          .get()
      );
      
      const emissionsSnapshots = await Promise.all(emissionsPromises);
      
      // Group emissions by vehicle type
      const emissionsByVehicle: { [key: string]: { savings: number, count: number } } = {};
      
      emissionsSnapshots.forEach((emissionSnapshot, index) => {
        if (!emissionSnapshot.empty) {
          const emissionData = emissionSnapshot.docs[0].data() as EmissionDocument;
          const carrierId = deliveriesSnapshot.docs[index].data().carrierId;
          const vehicleType = carriers[carrierId]?.vehicleType || 'unknown';
          
          if (!emissionsByVehicle[vehicleType]) {
            emissionsByVehicle[vehicleType] = { savings: 0, count: 0 };
          }
          
          emissionsByVehicle[vehicleType].savings += emissionData.emissionSavings;
          emissionsByVehicle[vehicleType].count += 1;
        }
      });
      
      // Calculate environmental impact equivalents
      const treesPlantedEquivalent = totalEmissionSavings / 20000; // Approx. CO2 absorbed by a tree per year (20kg)
      const carMilesEquivalent = totalEmissionSavings / 250; // g CO2 per km for avg car, converted to miles
      
      return {
        period: {
          startDate: periodStartDate,
          endDate: new Date(endTimestamp.getTime() - 1) // Exclude the extra day we added
        },
        summary: {
          totalDeliveries,
          totalBaselineEmissionsKg: (totalBaselineEmissions / 1000).toFixed(2),
          totalActualEmissionsKg: (totalActualEmissions / 1000).toFixed(2),
          totalEmissionSavingsKg: (totalEmissionSavings / 1000).toFixed(2),
          averageSavingsPercentage: averageSavingsPercentage.toFixed(2)
        },
        byVehicleType: emissionsByVehicle,
        environmentalEquivalents: {
          treesPlantedEquivalent: treesPlantedEquivalent.toFixed(2),
          carMilesEquivalent: carMilesEquivalent.toFixed(2)
        },
        dailySummaries: summariesSnapshot.docs.map(doc => ({
          date: doc.data().date,
          totalDeliveries: doc.data().totalDeliveries,
          totalEmissionSavings: doc.data().totalEmissionSavings
        }))
      };
    } catch (error) {
      logger.error('Failed to generate emission report', error);
      throw error;
    }
  }

  /**
   * Get emission statistics for a carrier
   * @param carrierId Carrier ID
   */
  public async getCarrierEmissionStats(carrierId: string): Promise<any> {
    try {
      // Check if we have cached stats
      const statsSnapshot = await db.collection(this.CARRIER_STATS_COLLECTION)
        .where('carrierId', '==', carrierId)
        .limit(1)
        .get();
      
      if (!statsSnapshot.empty) {
        const stats = statsSnapshot.docs[0].data();
        
        // Calculate environmental equivalents
        const totalSavingsKg = stats.totalEmissionSavings / 1000;
        const treesPlantedEquivalent = totalSavingsKg / 20; // kg CO2 per tree per year
        const carMilesEquivalent = stats.totalEmissionSavings / 250; // g CO2 per km for avg car
        
        return {
          carrierId,
          totalDeliveries: stats.totalDeliveries,
          totalEmissionSavingsKg: totalSavingsKg.toFixed(2),
          avgSavingsPercentage: stats.averageSavingsPercentage.toFixed(2),
          lastDeliveryDate: stats.lastDeliveryDate,
          environmentalEquivalents: {
            treesPlantedEquivalent: treesPlantedEquivalent.toFixed(2),
            carMilesEquivalent: carMilesEquivalent.toFixed(2)
          }
        };
      }
      
      // If no cached stats, calculate them on the fly
      const deliveriesSnapshot = await db.collection('deliveries')
        .where('carrierId', '==', carrierId)
        .get();
      
      if (deliveriesSnapshot.empty) {
        return {
          message: "No delivery data found for this carrier",
          data: null
        };
      }
      
      const deliveryIds = deliveriesSnapshot.docs.map(doc => doc.id);
      
      // Find most recent delivery date
      const lastDelivery = deliveriesSnapshot.docs
        .sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis())[0];
      
      // Get emissions for these deliveries
      const emissionsPromises = deliveryIds.map(id => 
        db.collection(this.EMISSIONS_COLLECTION)
          .where('deliveryId', '==', id)
          .limit(1)
          .get()
      );
      
      const emissionsSnapshots = await Promise.all(emissionsPromises);
      
      // Calculate totals
      let totalDeliveries = 0;
      let totalEmissionSavings = 0;
      let totalSavingsPercentage = 0;
      
      emissionsSnapshots.forEach(emissionSnapshot => {
        if (!emissionSnapshot.empty) {
          const emissionData = emissionSnapshot.docs[0].data() as EmissionDocument;
          totalDeliveries++;
          totalEmissionSavings += emissionData.emissionSavings;
          totalSavingsPercentage += emissionData.savingsPercentage;
        }
      });
      
      const averageSavingsPercentage = totalDeliveries > 0 
        ? totalSavingsPercentage / totalDeliveries 
        : 0;
      
      // Calculate environmental equivalents
      const totalSavingsKg = totalEmissionSavings / 1000;
      const treesPlantedEquivalent = totalSavingsKg / 20; // kg CO2 per tree per year
      const carMilesEquivalent = totalEmissionSavings / 250; // g CO2 per km for avg car
      
      // Save stats for future use
      await db.collection(this.CARRIER_STATS_COLLECTION).doc().set({
        carrierId,
        totalDeliveries,
        totalEmissionSavings,
        averageSavingsPercentage,
        lastDeliveryDate: lastDelivery.data().createdAt,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      return {
        carrierId,
        totalDeliveries,
        totalEmissionSavingsKg: totalSavingsKg.toFixed(2),
        avgSavingsPercentage: averageSavingsPercentage.toFixed(2),
        lastDeliveryDate: lastDelivery.data().createdAt,
        environmentalEquivalents: {
          treesPlantedEquivalent: treesPlantedEquivalent.toFixed(2),
          carMilesEquivalent: carMilesEquivalent.toFixed(2)
        }
      };
    } catch (error) {
      logger.error(`Failed to get emission stats for carrier ${carrierId}`)
      throw error
    }
}
     /**
      * Generate emission badges for a carrier
      * @param carrierId Carrier ID
      */
    public async generateCarrierEmissionBadges(carrierId: string): Promise<any> {
       try {
         // Get carrier emission stats
         const stats = await this.getCarrierEmissionStats(carrierId);
         
         if (!stats || !stats.totalEmissionSavingsKg) {
           return null;
         }
         
         const savingsKg = parseFloat(stats.totalEmissionSavingsKg);
         
         // Define badge levels
         const badges = [
           { name: "Carbon Saver", threshold: 10, icon: "bronze-leaf", description: "Saved at least 10kg of CO2 emissions" },
           { name: "Eco Warrior", threshold: 50, icon: "silver-leaf", description: "Saved at least 50kg of CO2 emissions" },
           { name: "Climate Champion", threshold: 100, icon: "gold-leaf", description: "Saved at least 100kg of CO2 emissions" },
           { name: "Earth Protector", threshold: 500, icon: "platinum-earth", description: "Saved at least 500kg of CO2 emissions" }
         ];
         
         // Determine earned badges
         const earnedBadges = badges.filter(badge => savingsKg >= badge.threshold);
         
         // Save to database
         if (earnedBadges.length > 0) {
           // Get existing badges for this carrier
           const existingBadgesSnapshot = await db.collection(this.CARRIER_BADGES_COLLECTION)
             .where('carrierId', '==', carrierId)
             .get();
           
           const existingBadgeNames = existingBadgesSnapshot.docs.map(doc => doc.data().badgeName);
           
           // Find new badges to award
           const newBadges = earnedBadges.filter(badge => !existingBadgeNames.includes(badge.name));
           
           // Add new badges
           if (newBadges.length > 0) {
             const batch = db.batch();
             
             for (const badge of newBadges) {
               const badgeRef = db.collection(this.CARRIER_BADGES_COLLECTION).doc();
               batch.set(badgeRef, {
                 carrierId,
                 badgeName: badge.name,
                 badgeIcon: badge.icon,
                 badgeDescription: badge.description,
                 earnedAt: FieldValue.serverTimestamp(),
                 createdAt: FieldValue.serverTimestamp(),
                 updatedAt: FieldValue.serverTimestamp()
               });
             }
             
             await batch.commit();
           }
         }
         
         // Get all badges for the carrier (including previously earned ones)
         const badgesSnapshot = await db.collection(this.CARRIER_BADGES_COLLECTION)
           .where('carrierId', '==', carrierId)
           .get();
         
         return {
           carrierId,
           totalSavingsKg: savingsKg,
           earnedBadges: badgesSnapshot.docs.map(doc => ({
             name: doc.data().badgeName,
             icon: doc.data().badgeIcon,
             description: doc.data().badgeDescription,
             earnedAt: doc.data().earnedAt
           }))
         };
       } catch (error) {
         logger.error(`Failed to generate emission badges for carrier ${carrierId}`, error);
         throw error;
       }
     }
   
     /**
      * Predict future emission savings using simple trending
      * @param futureDays Number of days to predict
      */
     public async predictEmissionSavings(futureDays: number = 30): Promise<any> {
       try {
         // Get historical emission summaries for the last 90 days
         const pastDate = new Date();
         pastDate.setDate(pastDate.getDate() - 90);
         
         const pastDateString = pastDate.toISOString().split('T')[0];
         const todayString = new Date().toISOString().split('T')[0];
         
         const summariesSnapshot = await db.collection(this.EMISSION_SUMMARIES_COLLECTION)
           .where('date', '>=', pastDateString)
           .where('date', '<=', todayString)
           .orderBy('date')
           .get();
         
         if (summariesSnapshot.empty || summariesSnapshot.docs.length < 7) {
           return {
             message: "Insufficient historical data for prediction",
             data: null
           };
         }
         
         // Extract daily emission savings
         const dailyValues = summariesSnapshot.docs.map(doc => ({
           date: doc.data().date,
           value: doc.data().totalEmissionSavings
         }));
         
         // Calculate trend using linear regression
         const xValues = Array.from({ length: dailyValues.length }, (_, i) => i);
         const yValues = dailyValues.map(d => d.value);
         const trend = this.calculateLinearRegression(xValues, yValues);
         
         // Calculate day-of-week factors (to account for weekly patterns)
         const dayOfWeekFactors = this.calculateDayOfWeekFactors(dailyValues);
         
         // Generate predictions
         const predictions = [];
         let totalPredicted = 0;
         
         for (let i = 1; i <= futureDays; i++) {
           // Predict using trend
           const baseValue = trend.slope * (dailyValues.length + i) + trend.intercept;
           
           // Get date for this prediction
           const predictionDate = new Date();
           predictionDate.setDate(predictionDate.getDate() + i);
           
           // Adjust using day of week pattern
           const dayOfWeek = predictionDate.getDay();
           const dayFactor = dayOfWeekFactors[dayOfWeek] || 1.0;
           
           // Add some randomness to simulate real-world variation
           const randomFactor = 0.9 + Math.random() * 0.2; // Random between 0.9 and 1.1
           
           // Calculate final prediction
           const prediction = baseValue * dayFactor * randomFactor;
           const finalPrediction = Math.max(0, prediction); // Ensure non-negative
           
           predictions.push({
             date: predictionDate.toISOString().split('T')[0],
             predicted_savings: Math.round(finalPrediction)
           });
           
           totalPredicted += finalPrediction;
         }
         
         // Calculate environmental equivalents
         const totalPredictedKg = totalPredicted / 1000;
         const treesPlantedEquivalent = totalPredictedKg / 20; // kg CO2 per tree per year
         const carMilesEquivalent = totalPredicted / 250; // g CO2 per km for avg car
         
         return {
           daily_predictions: predictions,
           total_predicted_savings_kg: totalPredictedKg.toFixed(2),
           prediction_confidence: "medium",
           environmental_equivalents: {
             trees_planted_equivalent: treesPlantedEquivalent.toFixed(2),
             car_miles_equivalent: carMilesEquivalent.toFixed(2)
           }
         };
       } catch (error) {
         logger.error('Failed to predict emission savings', error);
         throw error;
       }
     }
   
     /**
      * Calculate linear regression (trend) from x and y values
      * @param xValues X values (typically days)
      * @param yValues Y values (emission savings)
      * @returns Object with slope and intercept
      */
     private calculateLinearRegression(xValues: number[], yValues: number[]): { slope: number, intercept: number } {
       const n = xValues.length;
       let sumX = 0;
       let sumY = 0;
       let sumXY = 0;
       let sumXX = 0;
       
       for (let i = 0; i < n; i++) {
         sumX += xValues[i];
         sumY += yValues[i];
         sumXY += xValues[i] * yValues[i];
         sumXX += xValues[i] * xValues[i];
       }
       
       const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
       const intercept = (sumY - slope * sumX) / n;
       
       return { slope, intercept };
     }
   
     /**
      * Calculate day-of-week factors to account for weekly patterns
      * @param dailyValues Array of daily values with dates
      * @returns Object with day-of-week factors (0=Sunday, 6=Saturday)
      */
     private calculateDayOfWeekFactors(dailyValues: { date: string, value: number }[]): { [key: number]: number } {
       // Group values by day of week
       const dayGroups: { [key: number]: number[] } = {};
       
       dailyValues.forEach(day => {
         const date = new Date(day.date);
         const dayOfWeek = date.getDay();
         
         if (!dayGroups[dayOfWeek]) {
           dayGroups[dayOfWeek] = [];
         }
         
         dayGroups[dayOfWeek].push(day.value);
       });
       
       // Calculate average for each day
       const dayAverages: { [key: number]: number } = {};
       
       for (const day in dayGroups) {
         const values = dayGroups[parseInt(day)];
         dayAverages[parseInt(day)] = values.reduce((sum, val) => sum + val, 0) / values.length;
       }
       
       // Calculate overall average
       const allValues = dailyValues.map(d => d.value);
       const overallAverage = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
       
       // Calculate factors (ratio of day average to overall average)
       const dayFactors: { [key: number]: number } = {};
       
       for (const day in dayAverages) {
         dayFactors[parseInt(day)] = dayAverages[parseInt(day)] / overallAverage;
       }
       
       return dayFactors;
     }
   
     /**
      * Get total platform emission savings
      */
     public async getTotalPlatformSavings(): Promise<any> {
       try {
         // Get all emission summaries
         const summariesSnapshot = await db.collection(this.EMISSION_SUMMARIES_COLLECTION)
           .orderBy('date')
           .get();
         
         if (summariesSnapshot.empty) {
           return {
             totalEmissionSavingsKg: "0.00",
             totalDeliveries: 0,
             environmentalEquivalents: {
               treesPlantedEquivalent: "0.00",
               carMilesEquivalent: "0.00"
             }
           };
         }
         
         // Calculate totals
         let totalDeliveries = 0;
         let totalEmissionSavings = 0;
         
         summariesSnapshot.docs.forEach(doc => {
           const data = doc.data();
           totalDeliveries += data.totalDeliveries || 0;
           totalEmissionSavings += data.totalEmissionSavings || 0;
         });
         
         // Calculate environmental equivalents
         const totalSavingsKg = totalEmissionSavings / 1000;
         const treesPlantedEquivalent = totalSavingsKg / 20; // kg CO2 per tree per year
         const carMilesEquivalent = totalEmissionSavings / 250; // g CO2 per km for avg car
         
         return {
           totalEmissionSavingsKg: totalSavingsKg.toFixed(2),
           totalDeliveries,
           firstDeliveryDate: summariesSnapshot.docs[0]?.data().date,
           environmentalEquivalents: {
             treesPlantedEquivalent: treesPlantedEquivalent.toFixed(2),
             carMilesEquivalent: carMilesEquivalent.toFixed(2)
           }
         };
       } catch (error) {
         logger.error('Failed to get total platform savings', error);
         throw error;
       }
     }
   
     /**
      * Get all available vehicle emission profiles
      */
     public async getVehicleEmissionProfiles(): Promise<any[]> {
       try {
         const profilesSnapshot = await db.collection(this.VEHICLE_PROFILES_COLLECTION)
           .orderBy('vehicleType')
           .orderBy('vehicleSize')
           .get();
         
         return profilesSnapshot.docs.map(doc => ({
           id: doc.id,
           ...doc.data()
         }));
       } catch (error) {
         logger.error('Failed to get vehicle emission profiles', error);
         throw error;
       }
     }
   
     /**
      * Update a vehicle emission profile
      * @param profileId Profile ID
      * @param data New profile data
      */
     public async updateVehicleEmissionProfile(profileId: string, data: Partial<VehicleEmissionProfileDocument>): Promise<boolean> {
       try {
         await db.collection(this.VEHICLE_PROFILES_COLLECTION).doc(profileId).update({
           ...data,
           updatedAt: FieldValue.serverTimestamp()
         });
         
         return true;
       } catch (error) {
         logger.error(`Failed to update vehicle emission profile ${profileId}`, error);
         throw error;
       }
     }
     /**
 * Get emission data for a specific delivery
 * @param deliveryId Delivery ID
 * @returns Emission data or null if not found
 */
public async getDeliveryEmissions(deliveryId: string): Promise<EmissionData | null> {
    try {
      // Check if emissions already calculated
      const emissionsSnapshot = await db.collection(this.EMISSIONS_COLLECTION)
        .where('deliveryId', '==', deliveryId)
        .limit(1)
        .get();
      
      if (emissionsSnapshot.empty) {
        // If no emission data exists, try to calculate it
        return await this.processDeliveryEmissions(deliveryId);
      }
      
      const emissionData = emissionsSnapshot.docs[0].data() as EmissionDocument;
      return {
        baselineEmissions: emissionData.baselineEmissions,
        actualEmissions: emissionData.actualEmissions,
        emissionSavings: emissionData.emissionSavings,
        savingsPercentage: emissionData.savingsPercentage
      };
    } catch (error) {
      logger.error(`Failed to get emissions for delivery ${deliveryId}:`, error);
      throw error;
    }
  }

     /**
 * Estimate potential emission savings for a potential delivery
 * This is used for matching and showing preview data before a match is completed
 * @param packageId Package ID
 * @param carrierId Carrier ID
 * @param deviationDistance Estimated route deviation distance in km
 * @returns Estimated emission savings in grams of CO2
 */
public async estimateEmissionSavings(
    packageId: string,
    carrierId: string,
    deviationDistance: number
  ): Promise<{ baselineEmissions: number; actualEmissions: number; emissionSavings: number; savingsPercentage: number }> {
    try {
      // Get package data
      const packageSnapshot = await db.collection('packages').doc(packageId).get();
      if (!packageSnapshot.exists) {
        throw new Error(`Package with ID ${packageId} not found`);
      }
      const packageData = packageSnapshot.data();
      if (!packageData) {
        throw new Error(`No data found for package ID ${packageId}`);
      }
  
      // Get carrier data to determine vehicle type
      const carrierSnapshot = await db.collection('users').doc(carrierId).get();
      if (!carrierSnapshot.exists) {
        throw new Error(`Carrier with ID ${carrierId} not found`);
      }
      const carrierData = carrierSnapshot.data();
      if (!carrierData) {
        throw new Error(`No data found for carrier ID ${carrierId}`);
      }
  
      // Get total route distance from package data or estimate it
      let totalDistance = packageData.distance;
      if (!totalDistance) {
        // If no distance in package data, estimate from coordinates
        if (packageData.pickupLocation && packageData.deliveryLocation) {
          const pickupLat = packageData.pickupLocation.latitude;
          const pickupLng = packageData.pickupLocation.longitude;
          const deliveryLat = packageData.deliveryLocation.latitude;
          const deliveryLng = packageData.deliveryLocation.longitude;
          
          // Simple distance calculation (Haversine formula)
          const R = 6371; // Earth radius in km
          const dLat = this.deg2rad(deliveryLat - pickupLat);
          const dLon = this.deg2rad(deliveryLng - pickupLng);
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(pickupLat)) * Math.cos(this.deg2rad(deliveryLat)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
          totalDistance = R * c;
        } else {
          // Default distance if we can't calculate
          totalDistance = 10; // 10 km default
        }
      }
  
      // Construct delivery info for calculation
      const deliveryInfo: DeliveryInfo = {
        id: packageId,
        carrierId: carrierId,
        vehicleType: carrierData.vehicleType || 'car',
        vehicleSize: carrierData.vehicleSize,
        departureTime: packageData.departureTime || '12:00',
        packageWeight: packageData.packageWeight || 1,
        isFragile: packageData.isFragile || false,
        urgency: packageData.urgency || 'medium',
        routeData: {
          totalDistance: totalDistance,
          deviationDistance: deviationDistance,
          trafficCongestion: 1.0 // Default - no congestion
        },
        createdAt: packageData.createdAt || Timestamp.now()
      };
  
      // Calculate emissions
      const emissionData = await this.calculateEmissionSavings(deliveryInfo);
      return emissionData;
    } catch (error) {
      logger.error(`Failed to estimate emission savings: ${error}`);
      // Return default/fallback values
      return {
        baselineEmissions: 250 * 5, // Assume 5km with standard delivery van
        actualEmissions: 120 * deviationDistance, // Assume medium car
        emissionSavings: 250 * 5 - 120 * deviationDistance,
        savingsPercentage: 80 // Default estimated savings
      };
    }
  }
  
  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
   
     /**
      * Add a new vehicle emission profile
      * @param data Profile data
      */
     public async addVehicleEmissionProfile(data: Omit<VehicleEmissionProfileDocument, 'createdAt' | 'updatedAt'>): Promise<string> {
       try {
         const docRef = await db.collection(this.VEHICLE_PROFILES_COLLECTION).add({
           ...data,
           createdAt: FieldValue.serverTimestamp(),
           updatedAt: FieldValue.serverTimestamp()
         });
         
         return docRef.id;
       } catch (error) {
         logger.error('Failed to add vehicle emission profile', error);
         throw error;
       }
     }
   }
   
   
   export default new CarbonEmissionService();