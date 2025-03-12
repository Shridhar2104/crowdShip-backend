/**
 * Utilities for generating codes, IDs, etc.
 */

/**
 * Generate a unique tracking code
 * Format: CRW-XXXXXX (X = alphanumeric)
 * @returns Tracking code string
 */
 export const generateTrackingCode = (): string => {
    const prefix = 'CRW-';
    const length = 6;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return `${prefix}${result}`;
  };
  
  /**
   * Generate a delivery confirmation code
   * Format: 4-digit numeric code
   * @returns Delivery code string
   */
  export const generateDeliveryCode = (): string => {
    // Generate a 4-digit number between 1000-9999
    return Math.floor(1000 + Math.random() * 9000).toString();
  };
  
  /**
   * Generate a random string
   * @param length Length of the string
   * @param chars Character set to use
   * @returns Random string
   */
  export const generateRandomString = (
    length: number,
    chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  ): string => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  };
  
  /**
   * Generate a UUID v4
   * @returns UUID string
   */
  export const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };