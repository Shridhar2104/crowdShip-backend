// src/models/EmissionInterfaces.ts

import { Timestamp } from 'firebase/firestore';

// Basic route data interface
export interface RouteData {
  totalDistance: number;
  deviationDistance: number;
  trafficCongestion?: number;
}

// Delivery information for emission calculations
export interface DeliveryInfo {
  id: string;
  carrierId: string;
  vehicleType: string;
  vehicleSize?: string;
  departureTime: string;
  packageWeight: number;
  isFragile: boolean;
  urgency: 'low' | 'medium' | 'high';
  routeData: RouteData;
  createdAt: Timestamp | Date;
}

// Emission calculation results
export interface EmissionData {
  baselineEmissions: number;
  actualEmissions: number;
  emissionSavings: number;
  savingsPercentage: number;
}

// Firestore document interfaces
export interface EmissionDocument extends EmissionData {
  deliveryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VehicleEmissionProfileDocument {
  vehicleType: string;
  vehicleSize?: string;
  emissionFactor: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CarrierBadgeDocument {
  carrierId: string;
  badgeName: string;
  badgeIcon: string;
  badgeDescription: string;
  earnedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EmissionSummaryDocument {
  date: string;
  totalDeliveries: number;
  totalBaselineEmissions: number;
  totalActualEmissions: number;
  totalEmissionSavings: number;
  averageSavingsPercentage: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CarrierEmissionStatsDocument {
  carrierId: string;
  totalDeliveries: number;
  totalEmissionSavings: number;
  averageSavingsPercentage: number;
  lastDeliveryDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// API response interfaces
export interface PlatformSavingsResponse {
  totalEmissionSavingsKg: string;
  totalDeliveries: number;
  firstDeliveryDate: string;
  environmentalEquivalents: {
    treesPlantedEquivalent: string;
    carMilesEquivalent: string;
  };
}

export interface EmissionReportResponse {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalDeliveries: number;
    totalBaselineEmissionsKg: string;
    totalActualEmissionsKg: string;
    totalEmissionSavingsKg: string;
    averageSavingsPercentage: string;
  };
  byVehicleType: {
    [key: string]: {
      savings: number;
      count: number;
    };
  };
  environmentalEquivalents: {
    treesPlantedEquivalent: string;
    carMilesEquivalent: string;
  };
  dailySummaries: Array<{
    date: string;
    totalDeliveries: number;
    totalEmissionSavings: number;
  }>;
}

export interface CarrierEmissionResponse {
  carrierId: string;
  totalDeliveries: number;
  totalEmissionSavingsKg: string;
  avgSavingsPercentage: string;
  lastDeliveryDate: Timestamp | Date;
  environmentalEquivalents: {
    treesPlantedEquivalent: string;
    carMilesEquivalent: string;
  };
}

export interface BadgeInfo {
  name: string;
  icon: string;
  description: string;
  earnedAt?: Timestamp | Date;
}

export interface CarrierBadgesResponse {
  carrierId: string;
  totalSavingsKg: number;
  earnedBadges: BadgeInfo[];
}

export interface EmissionPredictionResponse {
  daily_predictions: Array<{
    date: string;
    predicted_savings: number;
  }>;
  total_predicted_savings_kg: string;
  prediction_confidence: 'low' | 'medium' | 'high';
  environmental_equivalents: {
    trees_planted_equivalent: string;
    car_miles_equivalent: string;
  };
}