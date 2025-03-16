import { Timestamp } from 'firebase-admin/firestore';

// Match status enum
export enum MatchStatus {
  PENDING = 'pending',        // Match suggested but not yet accepted/rejected
  ACCEPTED = 'accepted',      // Carrier has accepted the match
  REJECTED = 'rejected',      // Carrier has rejected the match
  EXPIRED = 'expired',        // Match offer expired
  CANCELLED = 'cancelled',    // Match was cancelled
  COMPLETED = 'completed'     // Delivery was completed
}

// Match interface
export interface Match {
  id: string;
  packageId: string;
  carrierId: string;
  routeId?: string;
  status: MatchStatus;
  score: number;               // Match score (0-100)
  detourDistance: number;      // Additional distance in km
  detourTime: number;          // Additional time in minutes
  estimatedPickupTime: Timestamp;
  estimatedDeliveryTime: Timestamp;
  expiresAt: Timestamp;        // When the match offer expires
  carrierPayoutAmount: number; // Amount carrier will be paid
  platformFeeAmount: number;   // Platform fee amount
  responseTime?: Timestamp;    // When carrier responded to match
  carrierNotes?: string;       // Notes from carrier
  adminNotes?: string;         // Notes from admin
  carrierPickupCode?: string;  // Code to confirm pickup
  carrierDeliveryCode?: string;// Code to confirm delivery
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Helper functions for Match model

/**
 * Check if a match is expired
 */
export function isMatchExpired(match: Match): boolean {
  return match.expiresAt.toDate() < new Date();
}

/**
 * Calculate total match value
 */
export function getTotalMatchValue(match: Match): number {
  return match.carrierPayoutAmount + match.platformFeeAmount;
}

/**
 * Generate a random code (for pickup/delivery verification)
 */
export function generateRandomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}