// EmissionInterfaces.ts - Type definitions for Firestore documents

import { Timestamp } from 'firebase-admin/firestore';

// Emission document stored in Firestore
export interface EmissionDocument {
  deliveryId: string;
  baselineEmissions: number;
  actualEmissions: number;
  emissionSavings: number;
  savingsPercentage: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Vehicle Emission Profile document stored in Firestore
export interface VehicleEmissionProfileDocument {
  vehicleType: string;
  vehicleSize?: string | null;
  emissionFactor: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Carrier Badge document stored in Firestore
export interface CarrierBadgeDocument {
  carrierId: string;
  badgeName: string;
  badgeIcon: string;
  badgeDescription?: string;
  earnedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Daily Emission Summary document stored in Firestore
export interface EmissionSummaryDocument {
  date: string; // YYYY-MM-DD format
  totalDeliveries: number;
  totalBaselineEmissions: number;
  totalActualEmissions: number;
  totalEmissionSavings: number;
  averageSavingsPercentage: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Carrier Emission Stats document stored in Firestore
export interface CarrierEmissionStatsDocument {
  carrierId: string;
  totalDeliveries: number;
  totalEmissionSavings: number;
  averageSavingsPercentage: number;
  lastDeliveryDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Route data information
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
  createdAt: Timestamp;
}

// Emission calculation result
export interface EmissionData {
  baselineEmissions: number;
  actualEmissions: number;
  emissionSavings: number;
  savingsPercentage: number;
}