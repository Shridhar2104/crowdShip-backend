import { db, createDocument, getDocument, queryDocuments, Timestamp, FieldValue } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { PackageStatus } from './Packages';

// PackageTimeline attributes interface
export interface PackageTimelineAttributes {
  id: string;
  packageId: string;
  status: PackageStatus;
  description: string;
  userId: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new PackageTimeline
export interface PackageTimelineCreationAttributes extends Omit<PackageTimelineAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// PackageTimeline model class for Firestore
export class PackageTimeline implements PackageTimelineAttributes {
  public id: string;
  public packageId: string;
  public status: PackageStatus;
  public description: string;
  public userId: string;
  public location?: string;
  public latitude?: number;
  public longitude?: number;
  public createdAt?: Date;
  public updatedAt?: Date;

  // Collection name
  private static collectionName = 'package_timeline';

  // Constructor
  constructor(data: PackageTimelineAttributes) {
    this.id = data.id;
    this.packageId = data.packageId;
    this.status = data.status;
    this.description = data.description;
    this.userId = data.userId;
    this.location = data.location;
    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Save the timeline entry
  public async save(): Promise<string> {
    if (!this.id || this.id === '') {
      // Creating a new timeline entry
      this.id = uuidv4();
      
      // Create document
      await db.collection(PackageTimeline.collectionName).doc(this.id).set(this.toFirestore());
      return this.id;
    } else {
      // Timeline entries shouldn't typically be updated, but just in case
      await db.collection(PackageTimeline.collectionName).doc(this.id).update(this.toFirestore());
      return this.id;
    }
  }

  // Convert to Firestore format
  private toFirestore(): any {
    const timelineData: any = {
      packageId: this.packageId,
      status: this.status,
      description: this.description,
      userId: this.userId
    };

    // Add optional fields if they exist
    if (this.location) timelineData.location = this.location;
    if (this.latitude !== undefined) timelineData.latitude = this.latitude;
    if (this.longitude !== undefined) timelineData.longitude = this.longitude;

    return timelineData;
  }

  // Create a new timeline entry
  public static async create(timelineData: PackageTimelineCreationAttributes): Promise<PackageTimeline> {
    // Create a new PackageTimeline instance
    const timeline = new PackageTimeline({
      ...timelineData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Save to Firestore using direct db call to ensure consistent behavior
    await db.collection(PackageTimeline.collectionName).doc(timeline.id).set({
      ...timeline.toFirestore(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return timeline;
  }

  // Find timeline entries by package ID
  public static async findByPackageId(packageId: string): Promise<PackageTimeline[]> {
    try {
      const results = await queryDocuments(
        PackageTimeline.collectionName, 
        [['packageId', '==', packageId]],
        { field: 'createdAt', direction: 'asc' }
      );
      
      return results.map(doc => PackageTimeline.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding timeline entries by package ID:', error);
      return [];
    }
  }

  // Find timeline entries by user ID
  public static async findByUserId(userId: string): Promise<PackageTimeline[]> {
    try {
      const results = await queryDocuments(
        PackageTimeline.collectionName, 
        [['userId', '==', userId]],
        { field: 'createdAt', direction: 'desc' }
      );
      
      return results.map(doc => PackageTimeline.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding timeline entries by user ID:', error);
      return [];
    }
  }

  // Find timeline entries by status
  public static async findByStatus(status: PackageStatus): Promise<PackageTimeline[]> {
    try {
      const results = await queryDocuments(
        PackageTimeline.collectionName, 
        [['status', '==', status]],
        { field: 'createdAt', direction: 'desc' }
      );
      
      return results.map(doc => PackageTimeline.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding timeline entries by status:', error);
      return [];
    }
  }

  // Find timeline entries by location
  public static async findByLocation(location: string): Promise<PackageTimeline[]> {
    try {
      const results = await queryDocuments(
        PackageTimeline.collectionName, 
        [['location', '==', location]],
        { field: 'createdAt', direction: 'desc' }
      );
      
      return results.map(doc => PackageTimeline.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding timeline entries by location:', error);
      return [];
    }
  }

  // Delete a timeline entry (rarely needed, but included for completeness)
  public static async delete(id: string): Promise<boolean> {
    try {
      await db.collection(PackageTimeline.collectionName).doc(id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting timeline entry:', error);
      return false;
    }
  }

  // Convert Firestore data to PackageTimeline instance
  private static fromFirestore(data: any): PackageTimeline {
    const id = data.id;
    const createdAt = data.createdAt ? 
      (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)) : 
      undefined;
    const updatedAt = data.updatedAt ? 
      (data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)) : 
      undefined;

    return new PackageTimeline({
      id,
      packageId: data.packageId,
      status: data.status,
      description: data.description,
      userId: data.userId,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      createdAt,
      updatedAt
    });
  }
}

export default PackageTimeline;