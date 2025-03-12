import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { NotificationType, NotificationChannel } from './Notification';

// NotificationSettings attributes interface
export interface NotificationSettingsAttributes {
  id: string;
  userId: string;
  preferences: Record<string, boolean>; // Map of notification types to boolean preferences
  channels: Record<string, boolean>;    // Map of channels to boolean preferences
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new NotificationSettings
export interface NotificationSettingsCreationAttributes extends Optional<NotificationSettingsAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// NotificationSettings model class
class NotificationSettings extends Model<NotificationSettingsAttributes, NotificationSettingsCreationAttributes> implements NotificationSettingsAttributes {
  public id!: string;
  public userId!: string;
  public preferences!: Record<string, boolean>;
  public channels!: Record<string, boolean>;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Get default preferences
  public static getDefaultPreferences(): Record<string, boolean> {
    const preferences: Record<string, boolean> = {};
    
    // Set all notification types to true by default
    Object.values(NotificationType).forEach(type => {
      preferences[type] = true;
    });
    
    return preferences;
  }
  
  // Get default channel settings
  public static getDefaultChannels(): Record<string, boolean> {
    return {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.PUSH]: true,
      [NotificationChannel.SMS]: false
    };
  }
  
  // Checks if a notification type is enabled
  public isNotificationEnabled(type: NotificationType): boolean {
    return this.preferences[type] !== false; // Default to true if not specified
  }
  
  // Checks if a channel is enabled
  public isChannelEnabled(channel: NotificationChannel): boolean {
    return this.channels[channel] !== false; // Default to true if not specified
  }
}

NotificationSettings.init(
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
    preferences: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: NotificationSettings.getDefaultPreferences(),
    },
    channels: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: NotificationSettings.getDefaultChannels(),
    },
  },
  {
    sequelize,
    modelName: 'NotificationSettings',
    tableName: 'notification_settings',
    timestamps: true,
  }
);

export default NotificationSettings;