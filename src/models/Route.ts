import { db } from '../config/database';
import { FieldValue } from 'firebase-admin/firestore';

// Route frequency enum
export enum RouteFrequency {
  ONE_TIME = 'one_time',
  DAILY = 'daily',
  WEEKDAYS = 'weekdays',
  WEEKLY = 'weekly',
  CUSTOM = 'custom'
}

// Route attributes interface
export interface RouteAttributes {
  id: string;
  carrierId: string;
  title: string;
  startAddress: string;
  startLatitude: number;
  startLongitude: number;
  endAddress: string;
  endLatitude: number;
  endLongitude: number;
  waypoints?: string; // JSON string with waypoints
  distance: number; // Distance in kilometers
  estimatedDuration: number; // Duration in minutes
  startTime: Date;
  endTime: Date;
  frequency: RouteFrequency;
  customFrequency?: string; // JSON string with custom frequency details
  isActive: boolean;
  maxDetourDistance: number; // Maximum allowed detour in kilometers
  maxDetourTime: number; // Maximum allowed detour in minutes
  availableCapacity: number; // Available weight capacity in kg
  routePolyline?: string; // Encoded polyline representation of route
  notes?: string;
  daysOfWeek?: string; // JSON array of days (0-6, 0 being Sunday)
  createdAt?: Date;
  updatedAt?: Date;
}

// Route model class
class Route implements RouteAttributes {
  public id: string;
  public carrierId: string;
  public title: string;
  public startAddress: string;
  public startLatitude: number;
  public startLongitude: number;
  public endAddress: string;
  public endLatitude: number;
  public endLongitude: number;
  public waypoints?: string;
  public distance: number;
  public estimatedDuration: number;
  public startTime: Date;
  public endTime: Date;
  public frequency: RouteFrequency;
  public customFrequency?: string;
  public isActive: boolean;
  public maxDetourDistance: number;
  public maxDetourTime: number;
  public availableCapacity: number;
  public routePolyline?: string;
  public notes?: string;
  public daysOfWeek?: string;
  public createdAt?: Date;
  public updatedAt?: Date;

  constructor(data: RouteAttributes) {
    this.id = data.id;
    this.carrierId = data.carrierId;
    this.title = data.title;
    this.startAddress = data.startAddress;
    this.startLatitude = data.startLatitude;
    this.startLongitude = data.startLongitude;
    this.endAddress = data.endAddress;
    this.endLatitude = data.endLatitude;
    this.endLongitude = data.endLongitude;
    this.waypoints = data.waypoints;
    this.distance = data.distance;
    this.estimatedDuration = data.estimatedDuration;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.frequency = data.frequency;
    this.customFrequency = data.customFrequency;
    this.isActive = data.isActive;
    this.maxDetourDistance = data.maxDetourDistance;
    this.maxDetourTime = data.maxDetourTime;
    this.availableCapacity = data.availableCapacity;
    this.routePolyline = data.routePolyline;
    this.notes = data.notes;
    this.daysOfWeek = data.daysOfWeek;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Get waypoints as array of objects
  public get waypointsArray(): Array<{latitude: number; longitude: number; address: string}> {
    return this.waypoints ? JSON.parse(this.waypoints) : [];
  }
  
  // Get days of week as array
  public get daysOfWeekArray(): number[] {
    return this.daysOfWeek ? JSON.parse(this.daysOfWeek) : [];
  }
  
  // Get custom frequency as object
  public get customFrequencyObj(): any {
    return this.customFrequency ? JSON.parse(this.customFrequency) : {};
  }
  
  // Check if route is active on a given day (0-6, 0 being Sunday)
  public isActiveOnDay(day: number): boolean {
    if (this.frequency === RouteFrequency.DAILY) {
      return true;
    }
    
    if (this.frequency === RouteFrequency.WEEKDAYS) {
      return day >= 1 && day <= 5; // Monday to Friday
    }
    
    if (this.frequency === RouteFrequency.WEEKLY || this.frequency === RouteFrequency.CUSTOM) {
      const activeDays = this.daysOfWeekArray;
      return activeDays.includes(day);
    }
    
    return false;
  }

  // Create a new route
  public async create(): Promise<string> {
    const routesRef = db.collection('routes');
    const routeData = {
      carrierId: this.carrierId,
      title: this.title,
      startAddress: this.startAddress,
      startLatitude: this.startLatitude,
      startLongitude: this.startLongitude,
      endAddress: this.endAddress,
      endLatitude: this.endLatitude,
      endLongitude: this.endLongitude,
      waypoints: this.waypoints,
      distance: this.distance,
      estimatedDuration: this.estimatedDuration,
      startTime: this.startTime,
      endTime: this.endTime,
      frequency: this.frequency,
      customFrequency: this.customFrequency,
      isActive: this.isActive,
      maxDetourDistance: this.maxDetourDistance,
      maxDetourTime: this.maxDetourTime,
      availableCapacity: this.availableCapacity,
      routePolyline: this.routePolyline,
      notes: this.notes,
      daysOfWeek: this.daysOfWeek,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    
    const docRef = await routesRef.add(routeData);
    this.id = docRef.id;
    return docRef.id;
  }

  // Update an existing route
  public async update(): Promise<void> {
    if (!this.id) {
      throw new Error('Route ID is required for update');
    }

    const routeRef = db.collection('routes').doc(this.id);
    
    const updateData = {
      carrierId: this.carrierId,
      title: this.title,
      startAddress: this.startAddress,
      startLatitude: this.startLatitude,
      startLongitude: this.startLongitude,
      endAddress: this.endAddress,
      endLatitude: this.endLatitude,
      endLongitude: this.endLongitude,
      waypoints: this.waypoints,
      distance: this.distance,
      estimatedDuration: this.estimatedDuration,
      startTime: this.startTime,
      endTime: this.endTime,
      frequency: this.frequency,
      customFrequency: this.customFrequency,
      isActive: this.isActive,
      maxDetourDistance: this.maxDetourDistance,
      maxDetourTime: this.maxDetourTime,
      availableCapacity: this.availableCapacity,
      routePolyline: this.routePolyline,
      notes: this.notes,
      daysOfWeek: this.daysOfWeek,
      updatedAt: FieldValue.serverTimestamp()
    };

    await routeRef.update(updateData);
  }

  // Delete a route
  public async delete(): Promise<void> {
    if (!this.id) {
      throw new Error('Route ID is required for deletion');
    }

    const routeRef = db.collection('routes').doc(this.id);
    await routeRef.delete();
  }

  // Fetch a route by ID
  public static async findById(id: string): Promise<Route | null> {
    const routeRef = db.collection('routes').doc(id);
    const doc = await routeRef.get();
  
    if (!doc.exists) {
      return null;
    }
  
    const data = doc.data() as RouteAttributes;
    return new Route({
      ...data,
      id: doc.id
    });
  }

  // Find routes by carrier ID
  public static async findByCarrierId(carrierId: string): Promise<Route[]> {
    const routesRef = db.collection('routes');
    const snapshot = await routesRef.where('carrierId', '==', carrierId).get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() as RouteAttributes;
      return new Route({
        ...data,
        id: doc.id
      });
    });
  }
}

export default Route;