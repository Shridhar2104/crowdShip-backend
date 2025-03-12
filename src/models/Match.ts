import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Match status enum
export enum MatchStatus {
  PENDING = 'pending',        // Match suggested but not yet accepted/rejected
  ACCEPTED = 'accepted',      // Carrier has accepted the match
  REJECTED = 'rejected',      // Carrier has rejected the match
  EXPIRED = 'expired',        // Match offer expired
  CANCELLED = 'cancelled',    // Match was cancelled
  COMPLETED = 'completed'     // Delivery was completed
}

// Match attributes interface
export interface MatchAttributes {
  id: string;
  packageId: string;
  carrierId: string;
  routeId?: string;
  status: MatchStatus;
  score: number;               // Match score (0-100)
  detourDistance: number;      // Additional distance in km
  detourTime: number;          // Additional time in minutes
  estimatedPickupTime: Date;
  estimatedDeliveryTime: Date;
  expiresAt: Date;             // When the match offer expires
  carrierPayoutAmount: number; // Amount carrier will be paid
  platformFeeAmount: number;   // Platform fee amount
  responseTime?: Date;         // When carrier responded to match
  carrierNotes?: string;       // Notes from carrier
  adminNotes?: string;         // Notes from admin
  carrierPickupCode?: string;  // Code to confirm pickup
  carrierDeliveryCode?: string;// Code to confirm delivery
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new Match
export interface MatchCreationAttributes extends Optional<MatchAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Match model class
class Match extends Model<MatchAttributes, MatchCreationAttributes> implements MatchAttributes {
  public id!: string;
  public packageId!: string;
  public carrierId!: string;
  public routeId?: string;
  public status!: MatchStatus;
  public score!: number;
  public detourDistance!: number;
  public detourTime!: number;
  public estimatedPickupTime!: Date;
  public estimatedDeliveryTime!: Date;
  public expiresAt!: Date;
  public carrierPayoutAmount!: number;
  public platformFeeAmount!: number;
  public responseTime?: Date;
  public carrierNotes?: string;
  public adminNotes?: string;
  public carrierPickupCode?: string;
  public carrierDeliveryCode?: string;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Check if match is expired
  public isExpired(): boolean {
    return this.expiresAt < new Date();
  }
  
  // Calculate total match value
  public get totalValue(): number {
    return this.carrierPayoutAmount + this.platformFeeAmount;
  }
}

Match.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    packageId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'packages',
        key: 'id',
      },
    },
    carrierId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    routeId: {
      type: DataTypes.UUID,
      references: {
        model: 'routes',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(MatchStatus)),
      allowNull: false,
      defaultValue: MatchStatus.PENDING,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    detourDistance: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    detourTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    estimatedPickupTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    estimatedDeliveryTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    carrierPayoutAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    platformFeeAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    responseTime: {
      type: DataTypes.DATE,
    },
    carrierNotes: {
      type: DataTypes.TEXT,
    },
    adminNotes: {
      type: DataTypes.TEXT,
    },
    carrierPickupCode: {
      type: DataTypes.STRING(6),
    },
    carrierDeliveryCode: {
      type: DataTypes.STRING(6),
    },
  },
  {
    sequelize,
    modelName: 'Match',
    tableName: 'matches',
    timestamps: true,
    hooks: {
      // Generate random pickup and delivery codes
      beforeCreate: async (match: Match) => {
        if (!match.carrierPickupCode) {
          match.carrierPickupCode = Math.floor(100000 + Math.random() * 900000).toString();
        }
        if (!match.carrierDeliveryCode) {
          match.carrierDeliveryCode = Math.floor(100000 + Math.random() * 900000).toString();
        }
      },
    },
  }
);

export default Match;