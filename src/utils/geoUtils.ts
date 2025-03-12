/**
 * Utilities for geo-location calculations
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
 export const calculateDistance = (
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  };
  
  /**
   * Convert degrees to radians
   * @param deg Degrees
   * @returns Radians
   */
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };
  
  /**
   * Validate latitude and longitude coordinates
   * @param lat Latitude
   * @param lon Longitude
   * @returns Boolean indicating if coordinates are valid
   */
  export const validateCoordinates = (lat: number, lon: number): boolean => {
    // Validate latitude: must be between -90 and 90
    if (lat < -90 || lat > 90) {
      return false;
    }
    
    // Validate longitude: must be between -180 and 180
    if (lon < -180 || lon > 180) {
      return false;
    }
    
    return true;
  };
  
  /**
   * Get estimated travel time between two points
   * @param distance Distance in kilometers
   * @param speed Average speed in km/h (default: 30)
   * @returns Estimated travel time in hours
   */
  export const getEstimatedTravelTime = (distance: number, speed: number = 30): number => {
    return distance / speed;
  };
  
  /**
   * Get estimated delivery time given distance and pickup time
   * @param distance Distance in kilometers
   * @param pickupTime Pickup time
   * @param speed Average speed in km/h (default: 30)
   * @returns Estimated delivery time
   */
  export const getEstimatedDeliveryTime = (
    distance: number, 
    pickupTime: Date, 
    speed: number = 30
  ): Date => {
    const travelTimeHours = getEstimatedTravelTime(distance, speed);
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    
    const deliveryTime = new Date(pickupTime.getTime() + travelTimeMs);
    return deliveryTime;
  };