import { 
    createDocument, 
    getDocument, 
    updateDocument, 
    queryDocuments,
    setDocument  // Add this import
  } from '../config/database';
  import { 
    getDefaultPreferences,
    getDefaultChannels,
    prepareNotificationSettings
  } from './NotificationSettings';
  
  // Collection name
  const NOTIFICATION_SETTINGS_COLLECTION = 'notification_settings';
  
  /**
   * Get notification settings for a user
   */
  export async function getNotificationSettings(userId: string) {
    return getDocument(NOTIFICATION_SETTINGS_COLLECTION, userId);
  }


  
  
  /**
   * Create or update notification settings
   */
  export async function createOrUpdateNotificationSettings(
    userId: string,
    data?: {
      preferences?: Record<string, boolean>;
      channels?: Record<string, boolean>;
    }
  ) {
    // Check if settings already exist
    const existingSettings = await getNotificationSettings(userId);
    
    if (existingSettings) {
      // Update existing settings
      const updatedPreferences = {
        ...existingSettings.preferences,
        ...(data?.preferences || {})
      };
      
      const updatedChannels = {
        ...existingSettings.channels,
        ...(data?.channels || {})
      };
      
      await updateDocument(NOTIFICATION_SETTINGS_COLLECTION, userId, {
        preferences: updatedPreferences,
        channels: updatedChannels
      });
      
      return {
        ...existingSettings,
        preferences: updatedPreferences,
        channels: updatedChannels
      };
    } else {
      // Create new settings
      const settingsData = prepareNotificationSettings(userId, data);
      
      // In Firestore, we'll use the userId as the document ID for settings
      await setDocument(NOTIFICATION_SETTINGS_COLLECTION, userId, settingsData);
      
      // Get the created document
      const newSettings = await getDocument(NOTIFICATION_SETTINGS_COLLECTION, userId);
      
      if (!newSettings) {
        throw new Error('Failed to create notification settings');
      }
      
      return newSettings;
    }
  }
  
  /**
   * Update specific preferences
   */
  export async function updatePreferences(
    userId: string,
    preferences: Record<string, boolean>
  ) {
    const settings = await getNotificationSettings(userId);
    
    if (!settings) {
      return createOrUpdateNotificationSettings(userId, { preferences });
    }
    
    const updatedPreferences = {
      ...settings.preferences,
      ...preferences
    };
    
    await updateDocument(NOTIFICATION_SETTINGS_COLLECTION, userId, {
      preferences: updatedPreferences
    });
    
    return {
      ...settings,
      preferences: updatedPreferences
    };
  }
  
  /**
   * Update channel settings
   */
  export async function updateChannels(
    userId: string,
    channels: Record<string, boolean>
  ) {
    const settings = await getNotificationSettings(userId);
    
    if (!settings) {
      return createOrUpdateNotificationSettings(userId, { channels });
    }
    
    const updatedChannels = {
      ...settings.channels,
      ...channels
    };
    
    await updateDocument(NOTIFICATION_SETTINGS_COLLECTION, userId, {
      channels: updatedChannels
    });
    
    return {
      ...settings,
      channels: updatedChannels
    };
  }