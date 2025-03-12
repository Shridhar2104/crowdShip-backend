import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Rating type enum
export enum RatingType {
  SENDER_TO_CARRIER = 'sender_to_carrier',   // Sender rating carrier
  CARRIER_TO_SENDER = 'carrier_to_sender',   // Carrier rating sender
  SYSTEM_TO_CARRIER = 'system_to_carrier',   // Automatic system rating for carrier
  SYSTEM_TO_SENDER = 'system_to_sender'      // Automatic system rating for sender
}

// Rating attributes interface
export interface RatingAttributes {
  id: string;
  packageId: string;
  fromUserId: string;  // User who gave the rating
  toUserId: string;    // User who received the rating
  type: RatingType;
  score: number;       // Rating score (1-5)
  comment?: string;    // Optional comment with the rating
  isAnonymous: boolean;// Whether the rating is anonymous
  tags?: string;       // JSON array of tags/categories for the rating
  isReviewed: boolean; // Whether the rating has been reviewed by admins
  isHidden: boolean;   // Whether the rating is hidden from public view
  adminNotes?: string; // Admin notes about this rating
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new Rating
export interface RatingCreationAttributes extends Optional<RatingAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Rating model class
class Rating extends Model<RatingAttributes, RatingCreationAttributes> implements RatingAttributes {
  public id!: string;
  public packageId!: string;
  public fromUserId!: string;
  public toUserId!: string;
  public type!: RatingType;
  public score!: number;
  public comment?: string;
  public isAnonymous!: boolean;
  public tags?: string;
  public isReviewed!: boolean;
  public isHidden!: boolean;
  public adminNotes?: string;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Get tags as array
  public get tagsArray(): string[] {
    return this.tags ? JSON.parse(this.tags) : [];
  }
}

Rating.init(
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
    fromUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    toUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM(...Object.values(RatingType)),
      allowNull: false,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    comment: {
      type: DataTypes.TEXT,
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    tags: {
      type: DataTypes.TEXT, // JSON array of tags/categories
    },
    isReviewed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isHidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    adminNotes: {
      type: DataTypes.TEXT,
    },
  },
  {
    sequelize,
    modelName: 'Rating',
    tableName: 'ratings',
    timestamps: true,
  }
);

export default Rating;