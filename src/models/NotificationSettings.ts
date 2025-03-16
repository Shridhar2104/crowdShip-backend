import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { NotificationType, NotificationChannel } from './notificationModel';

// NotificationSettings interface
export interface NotificationSettings {
  id: string;
  userId: string;
  preferences: Record<string, boolean>; // Map of notification types to boolean preferences
  channels: Record<string, boolean>;    // Map of channels to boolean preferences
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

/**
 * Get default preferences for all notification types
 */
export function getDefaultPreferences(): Record<string, boolean> {
  const preferences: Record<string, boolean> = {};
  
  // Set all notification types to true by default
  Object.values(NotificationType).forEach(type => {
    preferences[type] = true;
  });
  
  return preferences;
}

/**
 * Get default channel settings
 */
export function getDefaultChannels(): Record<string, boolean> {
  return {
    [NotificationChannel.IN_APP]: true,
    [NotificationChannel.EMAIL]: true,
    [NotificationChannel.PUSH]: true,
    [NotificationChannel.SMS]: false
  };
}

/**
 * Check if a notification type is enabled
 */
export function isNotificationEnabled(settings: NotificationSettings, type: NotificationType): boolean {
  return settings.preferences[type] !== false; // Default to true if not specified
}

/**
 * Check if a channel is enabled
 */
export function isChannelEnabled(settings: NotificationSettings, channel: NotificationChannel): boolean {
  return settings.channels[channel] !== false; // Default to true if not specified
}

/**
 * Prepare notification settings data with defaults
 */
export function prepareNotificationSettings(
  userId: string,
  data?: {
    preferences?: Record<string, boolean>;
    channels?: Record<string, boolean>;
  }
): Omit<NotificationSettings, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    userId,
    preferences: {
      ...getDefaultPreferences(),
      ...(data?.preferences || {})
    },
    channels: {
      ...getDefaultChannels(),
      ...(data?.channels || {})
    }
  };
}

export default {
  getDefaultPreferences,
  getDefaultChannels,
  isNotificationEnabled,
  isChannelEnabled,
  prepareNotificationSettings
};