import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Vehicle type enum
export enum VehicleType {
  CAR = 'car',
  BIKE = 'bike',
  SCOOTER = 'scooter',
  MOTORCYCLE = 'motorcycle',
  AUTO_RICKSHAW = 'auto_rickshaw',
  PUBLIC_TRANSPORT = 'public_transport',
  WALK = 'walk'
}

// Carrier profile attributes interface
export interface CarrierProfileAttributes {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehicleRegistrationNumber?: string;
  drivingLicenseNumber?: string;
  isVerified: boolean;
  isActive: boolean;
  isOnline: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  lastLocationUpdateTime?: Date;
  maxWeight: number; // Maximum weight carrier can transport in kg
  maxSize: string; // Maximum package size (from PackageSize enum)
  serviceRadius: number; // Maximum distance willing to travel in km
  preferredAreas?: string; // JSON string with preferred working areas
  rating: number; // Average rating (1-5)
  totalRatings: number; // Number of ratings received
  totalDeliveries: number; // Total successful deliveries
  availabilitySchedule?: string; // JSON string with weekly availability
  bankAccountDetails?: string; // Encrypted bank account details
  commissionRate: number; // Commission rate in percentage
  backgroundCheckStatus: 'pending' | 'approved' | 'rejected';
  backgroundCheckDate?: Date;
  insuranceDetails?: string; // Insurance information if any
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new CarrierProfile
export interface CarrierProfileCreationAttributes extends Optional<CarrierProfileAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// CarrierProfile model class
class CarrierProfile extends Model<CarrierProfileAttributes, CarrierProfileCreationAttributes> implements CarrierProfileAttributes {
  public id!: string;
  public userId!: string;
  public vehicleType!: VehicleType;
  public vehicleMake?: string;
  public vehicleModel?: string;
  public vehicleColor?: string;
  public vehicleRegistrationNumber?: string;
  public drivingLicenseNumber?: string;
  public isVerified!: boolean;
  public isActive!: boolean;
  public isOnline!: boolean;
  public currentLatitude?: number;
  public currentLongitude?: number;
  public lastLocationUpdateTime?: Date;
  public maxWeight!: number;
  public maxSize!: string;
  public serviceRadius!: number;
  public preferredAreas?: string;
  public rating!: number;
  public totalRatings!: number;
  public totalDeliveries!: number;
  public availabilitySchedule?: string;
  public bankAccountDetails?: string;
  public commissionRate!: number;
  public backgroundCheckStatus!: 'pending' | 'approved' | 'rejected';
  public backgroundCheckDate?: Date;
  public insuranceDetails?: string;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Get preferred areas as array
  public get preferredAreasArray(): string[] {
    return this.preferredAreas ? JSON.parse(this.preferredAreas) : [];
  }
  
  // Get availability schedule as object
  public get availabilityScheduleObj(): any {
    return this.availabilitySchedule ? JSON.parse(this.availabilitySchedule) : {};
  }
  
  // Update carrier rating
  public async updateRating(newRating: number): Promise<void> {
    const newTotalRatings = this.totalRatings + 1;
    const newAverageRating = ((this.rating * this.totalRatings) + newRating) / newTotalRatings;
    
    this.rating = parseFloat(newAverageRating.toFixed(2));
    this.totalRatings = newTotalRatings;
    await this.save();
  }
}

CarrierProfile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    vehicleType: {
      type: DataTypes.ENUM(...Object.values(VehicleType)),
      allowNull: false,
    },
    vehicleMake: {
      type: DataTypes.STRING,
    },
    vehicleModel: {
      type: DataTypes.STRING,
    },
    vehicleColor: {
      type: DataTypes.STRING,
    },
    vehicleRegistrationNumber: {
      type: DataTypes.STRING,
    },
    drivingLicenseNumber: {
      type: DataTypes.STRING,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    currentLatitude: {
      type: DataTypes.FLOAT,
    },
    currentLongitude: {
      type: DataTypes.FLOAT,
    },
    lastLocationUpdateTime: {
      type: DataTypes.DATE,
    },
    maxWeight: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 5.0, // Default 5kg
    },
    maxSize: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'medium',
    },
    serviceRadius: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 5.0, // Default 5km
    },
    preferredAreas: {
      type: DataTypes.TEXT, // JSON string with preferred working areas
    },
    rating: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 5,
      },
    },
    totalRatings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalDeliveries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    availabilitySchedule: {
      type: DataTypes.TEXT, // JSON string with weekly availability
    },
    bankAccountDetails: {
      type: DataTypes.TEXT, // Encrypted bank account details
    },
    commissionRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 10.0, // Default 10%
    },
    backgroundCheckStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    backgroundCheckDate: {
      type: DataTypes.DATE,
    },
    insuranceDetails: {
      type: DataTypes.TEXT,
    },
  },
  {
    sequelize,
    modelName: 'CarrierProfile',
    tableName: 'carrier_profiles',
    timestamps: true,
  }
);

export default CarrierProfile;