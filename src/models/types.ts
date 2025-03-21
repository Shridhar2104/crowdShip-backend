/**
 * CrowdShip Models and Types
 * Defines the core data structures used by the matching algorithm
 */

 export interface Location {
    latitude: number;
    longitude: number;
    address?: string;
  }
  
  export interface DeliveryTimeWindow {
    start: Date;
    end: Date;
  }
  
  export interface Route {
    origin: Location;
    destination: Location;
    waypoints?: Location[];
    estimatedDuration?: number; // in minutes
    estimatedDistance?: number; // in meters
  }
  
  export interface Package {
    id: string;
    senderId: string;
    recipientId: string;
    weight: number; // in kg
    size: number; // could be volume in cubic cm or a size category (1-small, 2-medium, 3-large)
    requiresSignature: boolean;
    requiresRefrigeration: boolean;
    isFragile: boolean;
    pickupLocation: Location;
    deliveryLocation: Location;
    pickupTimeWindow: DeliveryTimeWindow;
    deliveryTimeWindow: DeliveryTimeWindow;
    status: any;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface Carrier {
    id: string;
    userId: string;
    vehicleType: any;
    maxWeight: number; // in kg
    maxSize: number; // max size/volume carrier can transport
    maxPackages: number; // maximum number of packages carrier can transport at once
    hasRefrigeration: boolean;
    rating: number; // 0-5 star rating
    completedDeliveries: number;
    route: Route; // planned route
    availabilityWindow: DeliveryTimeWindow;
    currentLocation: Location;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface Match {
    id: string;
    packageId: string;
    carrierId: string;
    score: number; // 0-1, higher is better match
    routeDeviationMeters: number;
    estimatedArrival: Date;
    status: any;
    acceptedAt?: Date;
    completedAt?: Date;
  }
  
  export enum VehicleType {
    BICYCLE = 'BICYCLE',
    MOTORCYCLE = 'MOTORCYCLE',
    CAR = 'CAR',
    VAN = 'VAN',
    AUTO_RICKSHAW = 'AUTO_RICKSHAW',
    TAXI = 'TAXI',
    PUBLIC_TRANSPORT = 'PUBLIC_TRANSPORT',
    WALKING = 'WALKING',
    OTHER = 'OTHER'
  }
  
  export enum PackageStatus {
    CREATED = 'CREATED',
    SCHEDULED = 'SCHEDULED',
    IN_TRANSIT = 'IN_TRANSIT',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED',
    CANCELED = 'CANCELED'
  }
  
  export enum MatchStatus {
    PROPOSED = 'PROPOSED',
    SCHEDULED = 'SCHEDULED',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELED = 'CANCELED'
  }
  
  export interface MatchingRequest {
    packageId?: string; // Optional - if sender is requesting matches
    carrierId?: string; // Optional - if carrier is requesting matches
    minMatchScore?: number; // Minimum match score to consider
    maxResults?: number; // Maximum number of matches to return
  }
  
  export interface MatchingResponse {
    matches: Match[];
    requestTimestamp: Date;
  }