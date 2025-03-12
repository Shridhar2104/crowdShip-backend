import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Notification type enum
export enum NotificationType {
  PACKAGE_CREATED = 'package_created',
  PACKAGE_MATCHED = 'package_matched',
  PACKAGE_PICKUP_READY = 'package_pickup_ready',
  PACKAGE_PICKED_UP = 'package_picked_up',
  PACKAGE_IN_TRANSIT = 'package_in_transit',
  PACKAGE_DELIVERED = 'package_delivered',
  PACKAGE_DELAYED = 'package_delayed',
  MATCH_OFFER = 'match_offer',
  MATCH_ACCEPTED = 'match_accepted',
  MATCH_REJECTED = 'match_rejected',
  MATCH_EXPIRED = 'match_expired',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  PAYOUT_SENT = 'payout_sent',
  RATING_RECEIVED = 'rating_received',
  SYSTEM_ALERT = 'system_alert',
  ACCOUNT_UPDATE = 'account_update'
}

// Notification channel enum
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push'
}

// Notification priority enum
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

// Notification attributes interface
export interface NotificationAttributes {
  id: string;
  userId: string;   // User the notification is for
  type: NotificationType;
  title: string;
  message: string;
  data?: string;    // JSON string with additional data
  isRead: boolean;
  isArchived: boolean;
  channel: NotificationChannel;
  priority: NotificationPriority;
  scheduledFor?: Date; // For scheduled notifications
  sentAt?: Date;    // When the notification was sent
  readAt?: Date;    // When the notification was read
  expiresAt?: Date; // When the notification expires
  packageId?: string;
  matchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new Notification
export interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Notification model class
class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public id!: string;
  public userId!: string;
  public type!: NotificationType;
  public title!: string;
  public message!: string;
  public data?: string;
  public isRead!: boolean;
  public isArchived!: boolean;
  public channel!: NotificationChannel;
  public priority!: NotificationPriority;
  public scheduledFor?: Date;
  public sentAt?: Date;
  public readAt?: Date;
  public expiresAt?: Date;
  public packageId?: string;
  public matchId?: string;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Get data as object
  public get dataObj(): any {
    return this.data ? JSON.parse(this.data) : {};
  }
  
  // Mark notification as read
  public async markAsRead(): Promise<void> {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
  
  // Mark notification as archived
  public async archive(): Promise<void> {
    this.isArchived = true;
    await this.save();
  }
  
  // Check if notification is expired
  public isExpired(): boolean {
    return this.expiresAt ? this.expiresAt < new Date() : false;
  }
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM(...Object.values(NotificationType)),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.TEXT, // JSON string with additional data
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    channel: {
      type: DataTypes.ENUM(...Object.values(NotificationChannel)),
      allowNull: false,
      defaultValue: NotificationChannel.IN_APP,
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(NotificationPriority)),
      allowNull: false,
      defaultValue: NotificationPriority.MEDIUM,
    },
    scheduledFor: {
      type: DataTypes.DATE,
    },
    sentAt: {
      type: DataTypes.DATE,
    },
    readAt: {
      type: DataTypes.DATE,
    },
    expiresAt: {
      type: DataTypes.DATE,
    },
    packageId: {
      type: DataTypes.UUID,
      references: {
        model: 'packages',
        key: 'id',
      },
    },
    matchId: {
      type: DataTypes.UUID,
      references: {
        model: 'matches',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    indexes: [
      {
        name: 'idx_notifications_user_read',
        fields: ['userId', 'isRead'],
      },
      {
        name: 'idx_notifications_user_type',
        fields: ['userId', 'type'],
      },
    ],
  }
);

export default Notification;