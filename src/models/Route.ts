import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

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

// Interface for creating a new Route
export interface RouteCreationAttributes extends Optional<RouteAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Route model class
class Route extends Model<RouteAttributes, RouteCreationAttributes> implements RouteAttributes {
  public id!: string;
  public carrierId!: string;
  public title!: string;
  public startAddress!: string;
  public startLatitude!: number;
  public startLongitude!: number;
  public endAddress!: string;
  public endLatitude!: number;
  public endLongitude!: number;
  public waypoints?: string;
  public distance!: number;
  public estimatedDuration!: number;
  public startTime!: Date;
  public endTime!: Date;
  public frequency!: RouteFrequency;
  public customFrequency?: string;
  public isActive!: boolean;
  public maxDetourDistance!: number;
  public maxDetourTime!: number;
  public availableCapacity!: number;
  public routePolyline?: string;
  public notes?: string;
  public daysOfWeek?: string;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
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
}

Route.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    carrierId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startLatitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    startLongitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    endAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    endLatitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    endLongitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    waypoints: {
      type: DataTypes.TEXT, // JSON string with waypoints
    },
    distance: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    estimatedDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    frequency: {
      type: DataTypes.ENUM(...Object.values(RouteFrequency)),
      allowNull: false,
      defaultValue: RouteFrequency.ONE_TIME,
    },
    customFrequency: {
      type: DataTypes.TEXT, // JSON string with custom frequency details
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    maxDetourDistance: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 2.0, // Default 2km
    },
    maxDetourTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15, // Default 15 minutes
    },
    availableCapacity: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 5.0, // Default 5kg
    },
    routePolyline: {
      type: DataTypes.TEXT, // Encoded polyline representation of route
    },
    notes: {
      type: DataTypes.TEXT,
    },
    daysOfWeek: {
      type: DataTypes.TEXT, // JSON array of days (0-6, 0 being Sunday)
    },
  },
  {
    sequelize,
    modelName: 'Route',
    tableName: 'routes',
    timestamps: true,
  }
);

export default Route;