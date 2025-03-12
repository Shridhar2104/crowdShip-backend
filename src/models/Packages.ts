import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

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

// Interface for creating a new Package (optional: id, createdAt, updatedAt)
export interface PackageCreationAttributes extends Optional<PackageAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Package model class
class Package extends Model<PackageAttributes, PackageCreationAttributes> implements PackageAttributes {
  public id!: string;
  public senderId!: string;
  public carrierId?: string;
  public title!: string;
  public description?: string;
  public size!: PackageSize;
  public weight!: number;
  public value?: number;
  public isFragile!: boolean;
  public requireSignature!: boolean;
  public status!: PackageStatus;
  public pickupAddress!: string;
  public pickupLatitude!: number;
  public pickupLongitude!: number;
  public pickupContactName!: string;
  public pickupContactPhone!: string;
  public pickupTimeWindow!: string;
  public deliveryAddress!: string;
  public deliveryLatitude!: number;
  public deliveryLongitude!: number;
  public deliveryContactName!: string;
  public deliveryContactPhone!: string;
  public deliveryTimeWindow!: string;
  public trackingCode!: string;
  public deliveryCode?: string;
  public price!: number;
  public commissionAmount!: number;
  public carrierPayoutAmount!: number;
  public pickupTime?: Date;
  public deliveryTime?: Date;
  public estimatedDeliveryTime?: Date;
  public notes?: string;
  public imageUrl?: string;
  public isInsured!: boolean;
  public insuranceCost?: number;
  public distance!: number;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Computed properties
  public get pickupTimeWindowObj(): { start: Date; end: Date } {
    return JSON.parse(this.pickupTimeWindow);
  }
  
  public get deliveryTimeWindowObj(): { start: Date; end: Date } {
    return JSON.parse(this.deliveryTimeWindow);
  }
}

Package.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    carrierId: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    size: {
      type: DataTypes.ENUM(...Object.values(PackageSize)),
      allowNull: false,
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
    },
    isFragile: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    requireSignature: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PackageStatus)),
      allowNull: false,
      defaultValue: PackageStatus.PENDING,
    },
    pickupAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pickupLatitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    pickupLongitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    pickupContactName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pickupContactPhone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pickupTimeWindow: {
      type: DataTypes.TEXT,
      allowNull: false,
      // Store as JSON string with start and end times
    },
    deliveryAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deliveryLatitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    deliveryLongitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    deliveryContactName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deliveryContactPhone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deliveryTimeWindow: {
      type: DataTypes.TEXT,
      allowNull: false,
      // Store as JSON string with start and end times
    },
    trackingCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    deliveryCode: {
      type: DataTypes.STRING,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    commissionAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    carrierPayoutAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    pickupTime: {
      type: DataTypes.DATE,
    },
    deliveryTime: {
      type: DataTypes.DATE,
    },
    estimatedDeliveryTime: {
      type: DataTypes.DATE,
    },
    notes: {
      type: DataTypes.TEXT,
    },
    imageUrl: {
      type: DataTypes.STRING,
    },
    isInsured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    insuranceCost: {
      type: DataTypes.DECIMAL(10, 2),
    },
    distance: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Package',
    tableName: 'packages',
    timestamps: true,
    hooks: {
      // Generate tracking code and delivery code on creation
      beforeCreate: async (pkg: Package) => {
        // Generate random tracking code (e.g., CRW-123456)
        if (!pkg.trackingCode) {
          pkg.trackingCode = `CRW-${Math.floor(100000 + Math.random() * 900000)}`;
        }
        
        // Generate random delivery confirmation code
        if (!pkg.deliveryCode && pkg.requireSignature) {
          pkg.deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
        }
      },
    },
  }
);

export default Package;