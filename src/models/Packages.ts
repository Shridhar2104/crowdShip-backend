import { db, createDocument, getDocument, updateDocument, queryDocuments, Timestamp, FieldValue } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

// Package status enum
export enum PackageStatus {
  PENDING = 'pending', // Initial state, waiting for carrier match
  MATCHED = 'matched', // Matched with a carrier
  PICKUP_READY = 'pickup_ready', // Ready for pickup
  IN_TRANSIT = 'in_transit', // Carrier has picked up the package
  DELIVERED = 'delivered', // Package delivered to recipient
  CANCELLED = 'cancelled', // Package delivery cancelled
  RETURNED = 'returned', // Package returned to sender
}

// Package size enum
export enum PackageSize {
  SMALL = 'small', // e.g., envelope, small box
  MEDIUM = 'medium', // e.g., shoebox
  LARGE = 'large', // e.g., laptop box
  EXTRA_LARGE = 'extra_large', // e.g., small appliance
}

// Package attributes interface
export interface PackageAttributes {
  id: string;
  senderId: string;
  carrierId?: string;
  title: string;
  description?: string;
  size: PackageSize;
  weight: number; // Weight in kg
  value?: number; // Declared value in currency units
  isFragile: boolean;
  requireSignature: boolean;
  status: PackageStatus;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupTimeWindow: string; // JSON string with start and end times
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  deliveryContactName: string;
  deliveryContactPhone: string;
  deliveryTimeWindow: string; // JSON string with start and end times
  trackingCode: string;
  deliveryCode?: string; // Code to confirm delivery
  price: number; // Total price for delivery
  commissionAmount: number; // Platform commission
  carrierPayoutAmount: number; // Amount paid to carrier
  pickupTime?: Date; // Actual pickup time
  deliveryTime?: Date; // Actual delivery time
  estimatedDeliveryTime?: Date; // Estimated delivery time
  notes?: string; // Any special handling instructions
  imageUrl?: string; // Package image URL
  isInsured: boolean;
  insuranceCost?: number;
  distance: number; // Distance in kilometers
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new Package
export interface PackageCreationAttributes extends Omit<PackageAttributes, 'id' | 'createdAt' | 'updatedAt' | 'trackingCode'> {
  trackingCode?: string; // Optional in creation, will be generated if not provided
}

// Package model class for Firestore
export class Package implements PackageAttributes {
  public id: string;
  public senderId: string;
  public carrierId?: string;
  public title: string;
  public description?: string;
  public size: PackageSize;
  public weight: number;
  public value?: number;
  public isFragile: boolean;
  public requireSignature: boolean;
  public status: PackageStatus;
  public pickupAddress: string;
  public pickupLatitude: number;
  public pickupLongitude: number;
  public pickupContactName: string;
  public pickupContactPhone: string;
  public pickupTimeWindow: string;
  public deliveryAddress: string;
  public deliveryLatitude: number;
  public deliveryLongitude: number;
  public deliveryContactName: string;
  public deliveryContactPhone: string;
  public deliveryTimeWindow: string;
  public trackingCode: string;
  public deliveryCode?: string;
  public price: number;
  public commissionAmount: number;
  public carrierPayoutAmount: number;
  public pickupTime?: Date;
  public deliveryTime?: Date;
  public estimatedDeliveryTime?: Date;
  public notes?: string;
  public imageUrl?: string;
  public isInsured: boolean;
  public insuranceCost?: number;
  public distance: number;
  public createdAt?: Date;
  public updatedAt?: Date;

  // Collection name
  private static collectionName = 'packages';

  // Constructor
  constructor(data: PackageAttributes) {
    this.id = data.id;
    this.senderId = data.senderId;
    this.carrierId = data.carrierId;
    this.title = data.title;
    this.description = data.description;
    this.size = data.size;
    this.weight = data.weight;
    this.value = data.value;
    this.isFragile = data.isFragile;
    this.requireSignature = data.requireSignature;
    this.status = data.status;
    this.pickupAddress = data.pickupAddress;
    this.pickupLatitude = data.pickupLatitude;
    this.pickupLongitude = data.pickupLongitude;
    this.pickupContactName = data.pickupContactName;
    this.pickupContactPhone = data.pickupContactPhone;
    this.pickupTimeWindow = data.pickupTimeWindow;
    this.deliveryAddress = data.deliveryAddress;
    this.deliveryLatitude = data.deliveryLatitude;
    this.deliveryLongitude = data.deliveryLongitude;
    this.deliveryContactName = data.deliveryContactName;
    this.deliveryContactPhone = data.deliveryContactPhone;
    this.deliveryTimeWindow = data.deliveryTimeWindow;
    this.trackingCode = data.trackingCode;
    this.deliveryCode = data.deliveryCode;
    this.price = data.price;
    this.commissionAmount = data.commissionAmount;
    this.carrierPayoutAmount = data.carrierPayoutAmount;
    this.pickupTime = data.pickupTime;
    this.deliveryTime = data.deliveryTime;
    this.estimatedDeliveryTime = data.estimatedDeliveryTime;
    this.notes = data.notes;
    this.imageUrl = data.imageUrl;
    this.isInsured = data.isInsured;
    this.insuranceCost = data.insuranceCost;
    this.distance = data.distance;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Computed properties
  public get pickupTimeWindowObj(): { start: Date; end: Date } {
    const parsed = JSON.parse(this.pickupTimeWindow);
    return {
      start: new Date(parsed.start),
      end: new Date(parsed.end)
    };
  }

  public get deliveryTimeWindowObj(): { start: Date; end: Date } {
    const parsed = JSON.parse(this.deliveryTimeWindow);
    return {
      start: new Date(parsed.start),
      end: new Date(parsed.end)
    };
  }

  // Save the package (create or update)
  public async save(): Promise<string> {
    if (!this.id || this.id === '') {
      // Generate tracking code if not exists
      if (!this.trackingCode) {
        this.trackingCode = `CRW-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      // Generate delivery code if required signature and no code
      if (!this.deliveryCode && this.requireSignature) {
        this.deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
      }

      // Creating a new package
      this.id = uuidv4();
      this.status = this.status || PackageStatus.PENDING;
      
      // Create document
      await db.collection(Package.collectionName).doc(this.id).set(this.toFirestore());
      return this.id;
    } else {
      // Update document
      await db.collection(Package.collectionName).doc(this.id).update(this.toFirestore());
      return this.id;
    }
  }

  // Convert to Firestore format
  private toFirestore(): any {
    const packageData: any = {
      senderId: this.senderId,
      title: this.title,
      size: this.size,
      weight: this.weight,
      isFragile: this.isFragile,
      requireSignature: this.requireSignature,
      status: this.status,
      pickupAddress: this.pickupAddress,
      pickupLatitude: this.pickupLatitude,
      pickupLongitude: this.pickupLongitude,
      pickupContactName: this.pickupContactName,
      pickupContactPhone: this.pickupContactPhone,
      pickupTimeWindow: this.pickupTimeWindow,
      deliveryAddress: this.deliveryAddress,
      deliveryLatitude: this.deliveryLatitude,
      deliveryLongitude: this.deliveryLongitude,
      deliveryContactName: this.deliveryContactName,
      deliveryContactPhone: this.deliveryContactPhone,
      deliveryTimeWindow: this.deliveryTimeWindow,
      trackingCode: this.trackingCode,
      price: this.price,
      commissionAmount: this.commissionAmount,
      carrierPayoutAmount: this.carrierPayoutAmount,
      isInsured: this.isInsured,
      distance: this.distance,
    };

    // Add optional fields
    if (this.carrierId) packageData.carrierId = this.carrierId;
    if (this.description) packageData.description = this.description;
    if (this.value !== undefined) packageData.value = this.value;
    if (this.deliveryCode) packageData.deliveryCode = this.deliveryCode;
    if (this.notes) packageData.notes = this.notes;
    if (this.imageUrl) packageData.imageUrl = this.imageUrl;
    if (this.insuranceCost !== undefined) packageData.insuranceCost = this.insuranceCost;
    
    // Convert Date objects to Firestore Timestamps
    if (this.pickupTime) packageData.pickupTime = Timestamp.fromDate(this.pickupTime);
    if (this.deliveryTime) packageData.deliveryTime = Timestamp.fromDate(this.deliveryTime);
    if (this.estimatedDeliveryTime) packageData.estimatedDeliveryTime = Timestamp.fromDate(this.estimatedDeliveryTime);

    return packageData;
  }

  // Create a new package
  public static async create(packageData: PackageCreationAttributes): Promise<Package> {
    // Create a new Package instance with default values for missing fields
    const pkg = new Package({
      ...packageData,
      id: uuidv4(),
      status: packageData.status || PackageStatus.PENDING,
      trackingCode: packageData.trackingCode || `CRW-${Math.floor(100000 + Math.random() * 900000)}`,
      deliveryCode: packageData.requireSignature && !packageData.deliveryCode ? 
        Math.floor(1000 + Math.random() * 9000).toString() : packageData.deliveryCode,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Save to Firestore
    await db.collection(Package.collectionName).doc(pkg.id).set({
      ...pkg.toFirestore(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return pkg;
  }

  // Find a package by ID
  public static async findById(id: string): Promise<Package | null> {
    const doc = await getDocument(Package.collectionName, id);
    if (!doc) return null;
    
    // Convert Firestore timestamp to Date if needed
    return Package.fromFirestore(doc);
  }

  // Find a package by tracking code
  public static async findByTrackingCode(trackingCode: string): Promise<Package | null> {
    const results = await queryDocuments(Package.collectionName, [['trackingCode', '==', trackingCode]], undefined, 1);
    if (results.length === 0) return null;
    
    return Package.fromFirestore(results[0]);
  }

  // Find packages by sender ID
  public static async findBySenderId(senderId: string): Promise<Package[]> {
    const results = await queryDocuments(Package.collectionName, [['senderId', '==', senderId]]);
    
    return results.map(doc => Package.fromFirestore(doc));
  }

  // Find packages by carrier ID
  public static async findByCarrierId(carrierId: string): Promise<Package[]> {
    const results = await queryDocuments(Package.collectionName, [['carrierId', '==', carrierId]]);
    
    return results.map(doc => Package.fromFirestore(doc));
  }

  // Find packages by status
  public static async findByStatus(status: PackageStatus): Promise<Package[]> {
    const results = await queryDocuments(Package.collectionName, [['status', '==', status]]);
    
    return results.map(doc => Package.fromFirestore(doc));
  }

  // Find packages for matching (pending status, no carrier assigned)
  public static async findForMatching(): Promise<Package[]> {
    const results = await queryDocuments(
      Package.collectionName, 
      [
        ['status', '==', PackageStatus.PENDING],
        ['carrierId', '==', null]
      ]
    );
    
    return results.map(doc => Package.fromFirestore(doc));
  }

  // Update package status
  public async updateStatus(status: PackageStatus): Promise<void> {
    this.status = status;
    this.updatedAt = new Date();
    
    await db.collection(Package.collectionName).doc(this.id).update({
      status,
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  // Assign carrier to package
  public async assignCarrier(carrierId: string): Promise<void> {
    this.carrierId = carrierId;
    this.status = PackageStatus.MATCHED;
    this.updatedAt = new Date();
    
    await db.collection(Package.collectionName).doc(this.id).update({
      carrierId,
      status: PackageStatus.MATCHED,
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  // Record pickup
  public async recordPickup(): Promise<void> {
    this.pickupTime = new Date();
    this.status = PackageStatus.IN_TRANSIT;
    this.updatedAt = new Date();
    
    await db.collection(Package.collectionName).doc(this.id).update({
      pickupTime: Timestamp.fromDate(this.pickupTime),
      status: PackageStatus.IN_TRANSIT,
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  // Record delivery
  public async recordDelivery(): Promise<void> {
    this.deliveryTime = new Date();
    this.status = PackageStatus.DELIVERED;
    this.updatedAt = new Date();
    
    await db.collection(Package.collectionName).doc(this.id).update({
      deliveryTime: Timestamp.fromDate(this.deliveryTime),
      status: PackageStatus.DELIVERED,
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  // Delete a package
  public static async delete(id: string): Promise<boolean> {
    try {
      await db.collection(Package.collectionName).doc(id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting package:', error);
      return false;
    }
  }

  // Convert Firestore data to Package instance
  public static fromFirestore(data: any): Package {
    // Extract the ID if it's in a separate field
    const id = data.id;
    
    // Handle date conversions from Firestore
    const pickupTime = data.pickupTime ? 
      (data.pickupTime instanceof Timestamp ? data.pickupTime.toDate() : new Date(data.pickupTime)) : 
      undefined;
      
    const deliveryTime = data.deliveryTime ? 
      (data.deliveryTime instanceof Timestamp ? data.deliveryTime.toDate() : new Date(data.deliveryTime)) : 
      undefined;
      
    const estimatedDeliveryTime = data.estimatedDeliveryTime ? 
      (data.estimatedDeliveryTime instanceof Timestamp ? data.estimatedDeliveryTime.toDate() : new Date(data.estimatedDeliveryTime)) : 
      undefined;
      
    const createdAt = data.createdAt ? 
      (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)) : 
      undefined;
      
    const updatedAt = data.updatedAt ? 
      (data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)) : 
      undefined;

    return new Package({
      id,
      senderId: data.senderId,
      carrierId: data.carrierId,
      title: data.title,
      description: data.description,
      size: data.size,
      weight: data.weight,
      value: data.value,
      isFragile: data.isFragile,
      requireSignature: data.requireSignature,
      status: data.status,
      pickupAddress: data.pickupAddress,
      pickupLatitude: data.pickupLatitude,
      pickupLongitude: data.pickupLongitude,
      pickupContactName: data.pickupContactName,
      pickupContactPhone: data.pickupContactPhone,
      pickupTimeWindow: data.pickupTimeWindow,
      deliveryAddress: data.deliveryAddress,
      deliveryLatitude: data.deliveryLatitude,
      deliveryLongitude: data.deliveryLongitude,
      deliveryContactName: data.deliveryContactName,
      deliveryContactPhone: data.deliveryContactPhone,
      deliveryTimeWindow: data.deliveryTimeWindow,
      trackingCode: data.trackingCode,
      deliveryCode: data.deliveryCode,
      price: data.price,
      commissionAmount: data.commissionAmount,
      carrierPayoutAmount: data.carrierPayoutAmount,
      pickupTime,
      deliveryTime,
      estimatedDeliveryTime,
      notes: data.notes,
      imageUrl: data.imageUrl,
      isInsured: data.isInsured,
      insuranceCost: data.insuranceCost,
      distance: data.distance,
      createdAt,
      updatedAt
    });
  }
}

export default Package;