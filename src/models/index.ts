// // Import all model classes
import User from './User';
// import CarrierProfile from './CarrierProfile';
// import Package from './Packages';
// import Route from './Route';
// import Match from './Match';
// import Payment from './Payment';
// import Rating from './Rating';
// import Notification from './Notification';

// // Export relationship helper functions for Firestore

// /**
//  * Get a carrier profile for a user
//  * @param userId The user ID to get the carrier profile for
//  */
// export async function getCarrierProfileForUser(userId: string): Promise<CarrierProfile | null> {
//   return await CarrierProfile.findByUserId(userId);
// }

// /**
//  * Get all packages sent by a user
//  * @param userId The sender's user ID
//  */
// export async function getSentPackages(userId: string): Promise<Package[]> {
//   return await Package.findBySenderId(userId);
// }

// /**
//  * Get all packages carried by a user
//  * @param userId The carrier's user ID
//  */
// export async function getDeliveredPackages(userId: string): Promise<Package[]> {
//   return await Package.findByCarrierId(userId);
// }

// /**
//  * Get all routes created by a carrier
//  * @param carrierId The carrier's user ID
//  */
// export async function getRoutesForCarrier(carrierId: string): Promise<Route[]> {
//   return await Route.findByCarrierId(carrierId);
// }

// /**
//  * Get all matches for a carrier
//  * @param carrierId The carrier's user ID
//  */
// export async function getMatchesForCarrier(carrierId: string): Promise<Match[]> {
//   return await Match.findByCarrierId(carrierId);
// }

// /**
//  * Get all matches for a package
//  * @param packageId The package ID
//  */
// export async function getMatchesForPackage(packageId: string): Promise<Match[]> {
//   return await Match.findByPackageId(packageId);
// }

// /**
//  * Get all matches for a route
//  * @param routeId The route ID
//  */
// export async function getMatchesForRoute(routeId: string): Promise<Match[]> {
//   return await Match.findByRouteId(routeId);
// }

// /**
//  * Get all payments for a user
//  * @param userId The user ID
//  */
// export async function getPaymentsForUser(userId: string): Promise<Payment[]> {
//   return await Payment.findByUserId(userId);
// }

// /**
//  * Get all payments for a package
//  * @param packageId The package ID
//  */
// export async function getPaymentsForPackage(packageId: string): Promise<Payment[]> {
//   return await Payment.findByPackageId(packageId);
// }

// /**
//  * Get all payments for a match
//  * @param matchId The match ID
//  */
// export async function getPaymentsForMatch(matchId: string): Promise<Payment[]> {
//   return await Payment.findByMatchId(matchId);
// }

// /**
//  * Get all ratings for a package
//  * @param packageId The package ID
//  */
// export async function getRatingsForPackage(packageId: string): Promise<Rating[]> {
//   return await Rating.findByPackageId(packageId);
// }

// /**
//  * Get all ratings given by a user
//  * @param userId The user ID who gave the ratings
//  */
// export async function getGivenRatings(userId: string): Promise<Rating[]> {
//   return await Rating.findByFromUserId(userId);
// }

// /**
//  * Get all ratings received by a user
//  * @param userId The user ID who received the ratings
//  */
// export async function getReceivedRatings(userId: string): Promise<Rating[]> {
//   return await Rating.findByToUserId(userId);
// }

// /**
//  * Get all notifications for a user
//  * @param userId The user ID
//  */
// export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
//   return await Notification.findByUserId(userId);
// }

// /**
//  * Get all notifications for a package
//  * @param packageId The package ID
//  */
// export async function getNotificationsForPackage(packageId: string): Promise<Notification[]> {
//   return await Notification.findByPackageId(packageId);
// }

// /**
//  * Get all notifications for a match
//  * @param matchId The match ID
//  */
// export async function getNotificationsForMatch(matchId: string): Promise<Notification[]> {
//   return await Notification.findByMatchId(matchId);
// }

// // Export all models
export {
  User,
//   CarrierProfile,
//   Package,
//   Route,
//   Match,
//   Payment,
//   Rating,
//   Notification,
};