import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';
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
export interface PackageTimelineCreationAttributes extends Optional<PackageTimelineAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// PackageTimeline model class
class PackageTimeline extends Model<PackageTimelineAttributes, PackageTimelineCreationAttributes> implements PackageTimelineAttributes {
  public id!: string;
  public packageId!: string;
  public status!: PackageStatus;
  public description!: string;
  public userId!: string;
  public location?: string;
  public latitude?: number;
  public longitude?: number;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PackageTimeline.init(
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
    status: {
      type: DataTypes.ENUM(...Object.values(PackageStatus)),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    location: {
      type: DataTypes.STRING,
    },
    latitude: {
      type: DataTypes.FLOAT,
    },
    longitude: {
      type: DataTypes.FLOAT,
    },
  },
  {
    sequelize,
    modelName: 'PackageTimeline',
    tableName: 'package_timelines',
    timestamps: true,
  }
);

export default PackageTimeline;