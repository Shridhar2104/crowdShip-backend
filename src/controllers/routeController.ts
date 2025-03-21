// import { Request, Response } from 'express';
// import { db, Timestamp, queryDocuments, getDocument, createDocument, updateDocument, deleteDocument } from '../config/database';
// import { RouteFrequency } from '../models/Route';

// // Collection names
// const ROUTES_COLLECTION = 'routes';
// const PACKAGES_COLLECTION = 'packages';
// const USERS_COLLECTION = 'users';

// /**
//  * Create a new route
//  * @route POST /api/v1/routes
//  * @access Private (carrier)
//  */
// export const createRoute = async (req: Request, res: Response) => {
//   try {
//     const carrierId = req.user?.id;
//     if (!carrierId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     const routeData = req.body;

//     // Validate required fields
//     if (!routeData.title || !routeData.startAddress || !routeData.endAddress || 
//         routeData.startLatitude === undefined || routeData.startLongitude === undefined ||
//         routeData.endLatitude === undefined || routeData.endLongitude === undefined ||
//         routeData.distance === undefined || routeData.estimatedDuration === undefined ||
//         !routeData.startTime || !routeData.endTime || !routeData.frequency) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required route fields'
//       });
//     }

//     // Validate frequency
//     if (!Object.values(RouteFrequency).includes(routeData.frequency)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid frequency value'
//       });
//     }

//     // Convert dates from strings to Timestamps if needed
//     const startTime = typeof routeData.startTime === 'string' 
//       ? Timestamp.fromDate(new Date(routeData.startTime))
//       : routeData.startTime;
      
//     const endTime = typeof routeData.endTime === 'string'
//       ? Timestamp.fromDate(new Date(routeData.endTime))
//       : routeData.endTime;

//     // Prepare waypoints, custom frequency and days of week if provided
//     const waypoints = routeData.waypoints ? JSON.stringify(routeData.waypoints) : null;
//     const customFrequency = routeData.customFrequency ? JSON.stringify(routeData.customFrequency) : null;
//     const daysOfWeek = routeData.daysOfWeek ? JSON.stringify(routeData.daysOfWeek) : null;

//     // Create new route
//     const routeId = await createDocument(ROUTES_COLLECTION, {
//       carrierId,
//       title: routeData.title,
//       startAddress: routeData.startAddress,
//       startLatitude: routeData.startLatitude,
//       startLongitude: routeData.startLongitude,
//       endAddress: routeData.endAddress,
//       endLatitude: routeData.endLatitude,
//       endLongitude: routeData.endLongitude,
//       waypoints,
//       distance: routeData.distance,
//       estimatedDuration: routeData.estimatedDuration,
//       startTime,
//       endTime,
//       frequency: routeData.frequency,
//       customFrequency,
//       isActive: routeData.isActive !== undefined ? routeData.isActive : true,
//       maxDetourDistance: routeData.maxDetourDistance || 2.0,
//       maxDetourTime: routeData.maxDetourTime || 15,
//       availableCapacity: routeData.availableCapacity || 5.0,
//       routePolyline: routeData.routePolyline || null,
//       notes: routeData.notes || null,
//       daysOfWeek,
//       createdAt: Timestamp.now(),
//       updatedAt: Timestamp.now()
//     });

//     // Get the newly created route
//     const newRoute = await getDocument(ROUTES_COLLECTION, routeId);

//     res.status(201).json({
//       success: true,
//       data: newRoute
//     });
//   } catch (error) {
//     console.error('Error creating route:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error creating route',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Get all routes (filtered by query params)
//  * @route GET /api/v1/routes
//  * @access Private
//  */
// export const getRoutes = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     const userRole = req.user?.role;
    
//     if (!userId || !userRole) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     const { 
//       carrierId, 
//       isActive,
//       frequency,
//       limit: queryLimit = 10, 
//       page = 1,
//       sortBy = 'createdAt',
//       sortOrder = 'desc' 
//     } = req.query;

//     const pageSize = parseInt(queryLimit as string);
//     const pageNumber = parseInt(page as string);
    
//     // Build queries array for queryDocuments
//     const queries: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [];
    
//     // Apply filters
//     if (carrierId) {
//       queries.push(['carrierId', '==', carrierId]);
//     }
    
//     if (isActive !== undefined) {
//       queries.push(['isActive', '==', isActive === 'true']);
//     }
    
//     if (frequency) {
//       queries.push(['frequency', '==', frequency]);
//     }

//     // Non-admin users can only see active routes unless it's their own
//     if (userRole !== 'admin' && carrierId !== userId) {
//       queries.push(['isActive', '==', true]);
//     }
    
//     // Apply sorting and pagination
//     const orderByOption = {
//       field: sortBy as string || 'createdAt',
//       direction: (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
//     };
    
//     // Execute query
//     let allRoutes = await queryDocuments(
//       ROUTES_COLLECTION,
//       queries,
//       orderByOption
//     );
    
//     // Apply manual pagination
//     const routes = allRoutes.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
//     const totalCount = allRoutes.length;
    
//     res.status(200).json({
//       success: true,
//       data: routes,
//       pagination: {
//         total: totalCount,
//         page: pageNumber,
//         pageSize,
//         totalPages: Math.ceil(totalCount / pageSize)
//       }
//     });
//   } catch (error) {
//     console.error('Error getting routes:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error retrieving routes',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Get current carrier's routes
//  * @route GET /api/v1/routes/me
//  * @access Private (carrier)
//  */
// export const getCarrierRoutes = async (req: Request, res: Response) => {
//   try {
//     const carrierId = req.user?.id;
    
//     if (!carrierId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     const { isActive } = req.query;

//     // Build query conditions
//     const queries: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [
//       ['carrierId', '==', carrierId]
//     ];

//     // Add active filter if provided
//     if (isActive !== undefined) {
//       queries.push(['isActive', '==', isActive === 'true']);
//     }

//     // Get routes for this carrier
//     const routes = await queryDocuments(ROUTES_COLLECTION, queries, {
//       field: 'createdAt',
//       direction: 'desc'
//     });

//     // Parse JSON strings in route data
//     const parsedRoutes = routes.map(route => {
//       return {
//         ...route,
//         waypoints: route.waypoints ? JSON.parse(route.waypoints) : [],
//         daysOfWeek: route.daysOfWeek ? JSON.parse(route.daysOfWeek) : [],
//         customFrequency: route.customFrequency ? JSON.parse(route.customFrequency) : null
//       };
//     });

//     res.status(200).json({
//       success: true,
//       data: parsedRoutes
//     });
//   } catch (error) {
//     console.error('Error getting carrier routes:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error retrieving carrier routes',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Get route by ID
//  * @route GET /api/v1/routes/:id
//  * @access Private
//  */
// export const getRouteById = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user?.id;
//     const userRole = req.user?.role;
    
//     if (!userId || !userRole) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     const route = await getDocument(ROUTES_COLLECTION, id);
    
//     if (!route) {
//       return res.status(404).json({
//         success: false,
//         message: 'Route not found'
//       });
//     }

//     // Check authorization - only carrier who owns the route or admin can see inactive routes
//     if (!route.isActive && userRole !== 'admin' && route.carrierId !== userId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized to access this route'
//       });
//     }
    
//     // Parse JSON strings in route data
//     const parsedRoute = {
//       ...route,
//       waypoints: route.waypoints ? JSON.parse(route.waypoints) : [],
//       daysOfWeek: route.daysOfWeek ? JSON.parse(route.daysOfWeek) : [],
//       customFrequency: route.customFrequency ? JSON.parse(route.customFrequency) : null
//     };
    
//     res.status(200).json({
//       success: true,
//       data: parsedRoute
//     });
//   } catch (error) {
//     console.error('Error getting route:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error retrieving route',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Update route
//  * @route PUT /api/v1/routes/:id
//  * @access Private (carrier)
//  */
// export const updateRoute = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const carrierId = req.user?.id;
    
//     if (!carrierId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     // Get the route
//     const route = await getDocument(ROUTES_COLLECTION, id);
    
//     if (!route) {
//       return res.status(404).json({
//         success: false,
//         message: 'Route not found'
//       });
//     }
    
//     // Verify carrier authorization
//     if (route.carrierId !== carrierId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized to update this route'
//       });
//     }

//     const updateData = { ...req.body };
    
//     // Don't allow updates to carrierId
//     delete updateData.carrierId;

//     // Convert dates if provided
//     if (updateData.startTime) {
//       updateData.startTime = typeof updateData.startTime === 'string' 
//         ? Timestamp.fromDate(new Date(updateData.startTime))
//         : updateData.startTime;
//     }
    
//     if (updateData.endTime) {
//       updateData.endTime = typeof updateData.endTime === 'string'
//         ? Timestamp.fromDate(new Date(updateData.endTime))
//         : updateData.endTime;
//     }

//     // Handle JSON fields
//     if (updateData.waypoints) {
//       updateData.waypoints = JSON.stringify(updateData.waypoints);
//     }
    
//     if (updateData.customFrequency) {
//       updateData.customFrequency = JSON.stringify(updateData.customFrequency);
//     }
    
//     if (updateData.daysOfWeek) {
//       updateData.daysOfWeek = JSON.stringify(updateData.daysOfWeek);
//     }

//     // Add updatedAt timestamp
//     updateData.updatedAt = Timestamp.now();

//     // Update route
//     await updateDocument(ROUTES_COLLECTION, id, updateData);
    
//     // Get updated route
//     const updatedRoute = await getDocument(ROUTES_COLLECTION, id);
    
//     // Parse JSON strings for response
//     const parsedRoute = {
//       ...updatedRoute,
//       waypoints: updatedRoute.waypoints ? JSON.parse(updatedRoute.waypoints) : [],
//       daysOfWeek: updatedRoute.daysOfWeek ? JSON.parse(updatedRoute.daysOfWeek) : [],
//       customFrequency: updatedRoute.customFrequency ? JSON.parse(updatedRoute.customFrequency) : null
//     };
    
//     res.status(200).json({
//       success: true,
//       data: parsedRoute,
//       message: 'Route updated successfully'
//     });
//   } catch (error) {
//     console.error('Error updating route:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error updating route',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Delete route
//  * @route DELETE /api/v1/routes/:id
//  * @access Private (carrier)
//  */
// export const deleteRoute = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const carrierId = req.user?.id;
    
//     if (!carrierId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     // Get the route
//     const route = await getDocument(ROUTES_COLLECTION, id);
    
//     if (!route) {
//       return res.status(404).json({
//         success: false,
//         message: 'Route not found'
//       });
//     }
    
//     // Verify carrier authorization
//     if (route.carrierId !== carrierId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized to delete this route'
//       });
//     }

//     // Check if there are any active matches using this route
//     // This would require checking if there are any matches with this routeId
//     // For this example, we'll use a simple query to the matches collection

//     const MATCHES_COLLECTION = 'matches';
//     const activeMatches = await queryDocuments(
//       MATCHES_COLLECTION,
//       [
//         ['routeId', '==', id],
//         ['status', 'in', ['PENDING', 'ACCEPTED', 'IN_PROGRESS']]
//       ]
//     );

//     if (activeMatches.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot delete route with active matches'
//       });
//     }

//     // Delete the route
//     await deleteDocument(ROUTES_COLLECTION, id);
    
//     res.status(200).json({
//       success: true,
//       message: 'Route deleted successfully'
//     });
//   } catch (error) {
//     console.error('Error deleting route:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting route',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Activate route
//  * @route PUT /api/v1/routes/:id/activate
//  * @access Private (carrier)
//  */
// export const activateRoute = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const carrierId = req.user?.id;
    
//     if (!carrierId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     // Get the route
//     const route = await getDocument(ROUTES_COLLECTION, id);
    
//     if (!route) {
//       return res.status(404).json({
//         success: false,
//         message: 'Route not found'
//       });
//     }
    
//     // Verify carrier authorization
//     if (route.carrierId !== carrierId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized to activate this route'
//       });
//     }

//     // If already active, return success
//     if (route.isActive) {
//       return res.status(200).json({
//         success: true,
//         data: route,
//         message: 'Route is already active'
//       });
//     }

//     // Update route status
//     await updateDocument(ROUTES_COLLECTION, id, {
//       isActive: true,
//       activatedAt: Timestamp.now(),
//       updatedAt: Timestamp.now()
//     });
    
//     // Get updated route
//     const updatedRoute = await getDocument(ROUTES_COLLECTION, id);
    
//     // Parse JSON strings for response
//     const parsedRoute = {
//       ...updatedRoute,
//       waypoints: updatedRoute.waypoints ? JSON.parse(updatedRoute.waypoints) : [],
//       daysOfWeek: updatedRoute.daysOfWeek ? JSON.parse(updatedRoute.daysOfWeek) : [],
//       customFrequency: updatedRoute.customFrequency ? JSON.parse(updatedRoute.customFrequency) : null
//     };
    
//     res.status(200).json({
//       success: true,
//       data: parsedRoute,
//       message: 'Route activated successfully'
//     });
//   } catch (error) {
//     console.error('Error activating route:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error activating route',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Deactivate route
//  * @route PUT /api/v1/routes/:id/deactivate
//  * @access Private (carrier)
//  */
// export const deactivateRoute = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const carrierId = req.user?.id;
    
//     if (!carrierId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     // Get the route
//     const route = await getDocument(ROUTES_COLLECTION, id);
    
//     if (!route) {
//       return res.status(404).json({
//         success: false,
//         message: 'Route not found'
//       });
//     }
    
//     // Verify carrier authorization
//     if (route.carrierId !== carrierId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized to deactivate this route'
//       });
//     }

//     // If already inactive, return success
//     if (!route.isActive) {
//       return res.status(200).json({
//         success: true,
//         data: route,
//         message: 'Route is already inactive'
//       });
//     }

//     // Check for active matches using this route
//     const MATCHES_COLLECTION = 'matches';
//     const activeMatches = await queryDocuments(
//       MATCHES_COLLECTION,
//       [
//         ['routeId', '==', id],
//         ['status', 'in', ['ACCEPTED', 'IN_PROGRESS']]
//       ]
//     );

//     if (activeMatches.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot deactivate route with active matches in progress'
//       });
//     }

//     // Update route status
//     await updateDocument(ROUTES_COLLECTION, id, {
//       isActive: false,
//       deactivatedAt: Timestamp.now(),
//       updatedAt: Timestamp.now()
//     });
    
//     // Get updated route
//     const updatedRoute = await getDocument(ROUTES_COLLECTION, id);
    
//     // Parse JSON strings for response
//     const parsedRoute = {
//       ...updatedRoute,
//       waypoints: updatedRoute.waypoints ? JSON.parse(updatedRoute.waypoints) : [],
//       daysOfWeek: updatedRoute.daysOfWeek ? JSON.parse(updatedRoute.daysOfWeek) : [],
//       customFrequency: updatedRoute.customFrequency ? JSON.parse(updatedRoute.customFrequency) : null
//     };
    
//     res.status(200).json({
//       success: true,
//       data: parsedRoute,
//       message: 'Route deactivated successfully'
//     });
//   } catch (error) {
//     console.error('Error deactivating route:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error deactivating route',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Check route compatibility with a package
//  * @route POST /api/v1/routes/check-compatibility
//  * @access Private
//  */
// export const checkRouteCompatibility = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user?.id;
//     const userRole = req.user?.role;
    
//     if (!userId || !userRole) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     const { packageId, routeId } = req.body;

//     if (!packageId || !routeId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Package ID and Route ID are required'
//       });
//     }

//     // Get the package
//     const packageData = await getDocument(PACKAGES_COLLECTION, packageId);
//     if (!packageData) {
//       return res.status(404).json({
//         success: false,
//         message: 'Package not found'
//       });
//     }

//     // Get the route
//     const route = await getDocument(ROUTES_COLLECTION, routeId);
//     if (!route) {
//       return res.status(404).json({
//         success: false,
//         message: 'Route not found'
//       });
//     }

//     // Check authorization
//     if (userRole === 'sender' && packageData.senderId !== userId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized to check compatibility for this package'
//       });
//     }

//     if (userRole === 'carrier' && route.carrierId !== userId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized to check compatibility for this route'
//       });
//     }

//     // Parse JSON fields from route
//     const parsedRoute = {
//       ...route,
//       waypoints: route.waypoints ? JSON.parse(route.waypoints) : [],
//       daysOfWeek: route.daysOfWeek ? JSON.parse(route.daysOfWeek) : [],
//       customFrequency: route.customFrequency ? JSON.parse(route.customFrequency) : null
//     };

//     // Check if package is within route's max detour distance
//     const detourDistance = calculateDetourDistance(packageData, parsedRoute);
//     const isWithinDetourLimit = detourDistance <= route.maxDetourDistance;
    
//     // Check if package is within route's capacity
//     const isWithinCapacity = packageData.weight <= route.availableCapacity;
    
//     // Check if package's pickup/delivery times are compatible with route schedule
//     const isTimeCompatible = checkTimeCompatibility(packageData, parsedRoute);
    
//     // Calculate detour time based on distance
//     const detourTime = Math.ceil(detourDistance * 2); // Estimate: 2 minutes per km
//     const isWithinTimeLimit = detourTime <= route.maxDetourTime;
    
//     // Overall compatibility
//     const isCompatible = isWithinDetourLimit && isWithinCapacity && isTimeCompatible && isWithinTimeLimit;
    
//     // Calculate compatibility score (0-100)
//     const detourScore = isWithinDetourLimit ? 
//       Math.max(0, 100 - (detourDistance / route.maxDetourDistance * 80)) : 0;
    
//     const capacityScore = isWithinCapacity ?
//       Math.max(0, 100 - (packageData.weight / route.availableCapacity * 70)) : 0;
    
//     const timeScore = isTimeCompatible ? 90 : 0;
    
//     // Weighted score
//     const score = isCompatible ? 
//       Math.round((detourScore * 0.4) + (capacityScore * 0.3) + (timeScore * 0.3)) : 0;
    
//     res.status(200).json({
//       success: true,
//       data: {
//         isCompatible,
//         score,
//         details: {
//           detourDistance,
//           detourTime,
//           isWithinDetourLimit,
//           isWithinCapacity,
//           isTimeCompatible,
//           isWithinTimeLimit
//         },
//         packageId: packageData.id,
//         routeId: route.id
//       }
//     });
//   } catch (error) {
//     console.error('Error checking compatibility:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error checking route compatibility',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Get packages compatible with carrier's routes
//  * @route GET /api/v1/routes/nearby-packages
//  * @access Private (carrier)
//  */
// export const getNearbyPackages = async (req: Request, res: Response) => {
//   try {
//     const carrierId = req.user?.id;
    
//     if (!carrierId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     const { maxDistance = 10, limit = 20 } = req.query;
    
//     // Get carrier's active routes
//     const routes = await queryDocuments(ROUTES_COLLECTION, [
//       ['carrierId', '==', carrierId],
//       ['isActive', '==', true]
//     ]);
    
//     if (routes.length === 0) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         message: 'No active routes found'
//       });
//     }
    
//     // Parse JSON fields for all routes
//     const parsedRoutes = routes.map(route => ({
//       ...route,
//       waypoints: route.waypoints ? JSON.parse(route.waypoints) : [],
//       daysOfWeek: route.daysOfWeek ? JSON.parse(route.daysOfWeek) : [],
//       customFrequency: route.customFrequency ? JSON.parse(route.customFrequency) : null
//     }));
    
//     // Get available packages
//     const packages = await queryDocuments(PACKAGES_COLLECTION, [
//       ['status', '==', 'ready_for_pickup'],
//       ['matched', '==', false]
//     ]);
    
//     if (packages.length === 0) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         message: 'No available packages found'
//       });
//     }
    
//     // Check compatibility for each package with each route
//     const compatiblePackages = [];
    
//     for (const pkg of packages) {
//       let bestMatch = null;
//       let bestScore = 0;
      
//       for (const route of parsedRoutes) {
//         // Check if package is within route's max detour distance
//         const detourDistance = calculateDetourDistance(pkg, route);
        
//         // Skip if detour is too long
//         if (detourDistance > parseFloat(maxDistance as string) || detourDistance > route.maxDetourDistance) {
//           continue;
//         }
        
//         // Check if package fits within capacity
//         if (pkg.weight > route.availableCapacity) {
//           continue;
//         }
        
//         // Check if package's pickup time is compatible with route schedule
//         if (!checkTimeCompatibility(pkg, route)) {
//           continue;
//         }
        
//         // Calculate detour time based on distance
//         const detourTime = Math.ceil(detourDistance * 2); // Estimate: 2 minutes per km
        
//         // Skip if detour time exceeds limit
//         if (detourTime > route.maxDetourTime) {
//           continue;
//         }
        
//         // Calculate compatibility score (0-100)
//         const detourScore = Math.max(0, 100 - (detourDistance / route.maxDetourDistance * 80));
//         const capacityScore = Math.max(0, 100 - (pkg.weight / route.availableCapacity * 70));
//         const timeScore = 90; // Already checked compatibility
        
//         // Weighted score
//         const score = Math.round((detourScore * 0.4) + (capacityScore * 0.3) + (timeScore * 0.3));
        
//         if (score > bestScore) {
//           bestScore = score;
//           bestMatch = {
//             packageId: pkg.id,
//             routeId: route.id,
//             score,
//             detourDistance,
//             detourTime,
//             packageDetails: {
//               id: pkg.id,
//               pickupAddress: pkg.pickupAddress,
//               deliveryAddress: pkg.deliveryAddress,
//               weight: pkg.weight,
//               size: pkg.size,
//               priority: pkg.priority
//             },
//             routeDetails: {
//               id: route.id,
//               title: route.title,
//               startAddress: route.startAddress,
//               endAddress: route.endAddress
//             }
//           };
//         }
//       }
      
//       if (bestMatch) {
//         compatiblePackages.push(bestMatch);
//       }
//     }
    
//     // Sort by score and limit results
//     const sortedPackages = compatiblePackages
//       .sort((a, b) => b.score - a.score)
//       .slice(0, parseInt(limit as string));
    
//     res.status(200).json({
//       success: true,
//       data: sortedPackages,
//       count: sortedPackages.length
//     });
//   } catch (error) {
//     console.error('Error finding nearby packages:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error finding nearby packages',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Update current location on route
//  * @route POST /api/v1/routes/:id/update-location
//  * @access Private (carrier)
//  */
// export const updateLocation = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const carrierId = req.user?.id;
    
//     if (!carrierId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Unauthorized' 
//       });
//     }

//     const { latitude, longitude, timestamp, accuracy, speed, heading } = req.body;

//     if (latitude === undefined || longitude === undefined) {
//       return res.status(400).json({
//         success: false,
//         message: 'Latitude and longitude are required'
//       });
//     }

//     // Get the route
//     const route = await getDocument(ROUTES_COLLECTION, id);
    
//     if (!route) {
//       return res.status(404).json({
//         success: false,
//         message: 'Route not found'
//       });
//     }
    
//     // Verify carrier authorization
//     if (route.carrierId !== carrierId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Unauthorized to update location for this route'
//       });
//     }

//     // Verify route is active
//     if (!route.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot update location for inactive route'
//       });
//     }

//     // Create location update
//     const locationUpdate = {
//       latitude,
//       longitude,
//       timestamp: timestamp ? Timestamp.fromDate(new Date(timestamp)) : Timestamp.now(),
//       accuracy: accuracy || null,
//       speed: speed || null,
//       heading: heading || null,
//       updatedAt: Timestamp.now()
//     };

//     // Update route with new location
//     await updateDocument(ROUTES_COLLECTION, id, {
//       currentLocation: locationUpdate,
//       locationHistory: [...(route.locationHistory || []), locationUpdate],
//       updatedAt: Timestamp.now()
//     });
    
//     res.status(200).json({
//       success: true,
//       message: 'Location updated successfully',
//       data: locationUpdate
//     });
//   } catch (error) {
//     console.error('Error updating location:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error updating location',
//       error: (error as Error).message
//     });
//   }
// };

// /**
//  * Helper functions
//  */

// /**
//  * Calculate detour distance for a package on a route
//  * @param packageData Package data
//  * @param route Route data
//  * @returns Detour distance in kilometers
//  */
// const calculateDetourDistance = (packageData: any, route: any): number => {
//   // In a real application, this would use the Google Maps Distance Matrix API
//   // or similar service to calculate the actual detour distance
  
//   // For this example, we'll use a simplified calculation based on haversine distance
  
//   // Get package pickup and delivery coordinates
//   const pickupLat = packageData.pickupLatitude || 0;
//   const pickupLng = packageData.pickupLongitude || 0;
//   const deliveryLat = packageData.deliveryLatitude || 0;
//   const deliveryLng = packageData.deliveryLongitude || 0;
  
//   // Get route start and end coordinates
//   const startLat = route.startLatitude || 0;
//   const startLng = route.startLongitude || 0;
//   const endLat = route.endLatitude || 0;
//   const endLng = route.endLongitude || 0;
  
//   // Calculate direct distance from start to end
//   const directDistance = haversineDistance(
//     startLat, startLng,
//     endLat, endLng
//   );
  
//   // Calculate distance with detour to pickup and deliver the package
//   const detourDistance = haversineDistance(startLat, startLng, pickupLat, pickupLng) +
//                          haversineDistance(pickupLat, pickupLng, deliveryLat, deliveryLng) +
//                          haversineDistance(deliveryLat, deliveryLng, endLat, endLng);
  
//   // Return the difference
//   return Math.max(0, detourDistance - directDistance);
// };

// /**
//  * Calculate haversine distance between two points
//  * @param lat1 Latitude of point 1
//  * @param lng1 Longitude of point 1
//  * @param lat2 Latitude of point 2
//  * @param lng2 Longitude of point 2
//  * @returns Distance in kilometers
//  */
// const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
//   const R = 6371; // Radius of the Earth in km
//   const dLat = (lat2 - lat1) * Math.PI / 180;
//   const dLng = (lng2 - lng1) * Math.PI / 180;
//   const a = 
//     Math.sin(dLat/2) * Math.sin(dLat/2) +
//     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
//     Math.sin(dLng/2) * Math.sin(dLng/2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//   return R * c;
// };

// /**
//  * Check if a package's pickup/delivery times are compatible with a route's schedule
//  * @param packageData Package data
//  * @param route Route data
//  * @returns True if compatible, false otherwise
//  */
// const checkTimeCompatibility = (packageData: any, route: any): boolean => {
//   // In a real application, this would involve checking:
//   // 1. If the route is active on the day the package needs to be delivered
//   // 2. If the package's pickup window falls within the route's time window
//   // 3. If there's enough time to complete the delivery
  
//   // For this example, we'll do a simplified check

//   // Check if package has specified pickup window
//   if (!packageData.pickupTimeEarliest || !packageData.pickupTimeLatest) {
//     return true; // If no specific time window, assume compatible
//   }

//   // Convert pickup times to Date objects
//   const pickupEarliest = new Date(packageData.pickupTimeEarliest);
//   const pickupLatest = new Date(packageData.pickupTimeLatest);
  
//   // Get route start and end times
//   const routeStart = new Date(route.startTime);
//   const routeEnd = new Date(route.endTime);
  
//   // Check if the route's schedule overlaps with the package's pickup window
//   const hasOverlap = (routeStart <= pickupLatest) && (routeEnd >= pickupEarliest);
  
//   // Check if route is active on the day of pickup
//   let isActiveOnDay = true;
  
//   if (route.frequency === RouteFrequency.ONE_TIME) {
//     // For one-time routes, check if it's on the same day
//     const routeDate = new Date(routeStart).setHours(0, 0, 0, 0);
//     const pickupDate = new Date(pickupEarliest).setHours(0, 0, 0, 0);
//     isActiveOnDay = routeDate === pickupDate;
//   } 
//   else if (route.frequency === RouteFrequency.DAILY) {
//     isActiveOnDay = true; // Active every day
//   } 
//   else if (route.frequency === RouteFrequency.WEEKDAYS) {
//     // Check if pickup day is a weekday (1-5, Monday to Friday)
//     const pickupDay = pickupEarliest.getDay();
//     isActiveOnDay = (pickupDay >= 1 && pickupDay <= 5);
//   } 
//   else if (route.frequency === RouteFrequency.WEEKLY || route.frequency === RouteFrequency.CUSTOM) {
//     // Check if route is active on pickup day
//     const pickupDay = pickupEarliest.getDay();
//     isActiveOnDay = route.daysOfWeek.includes(pickupDay);
//   }
  
//   return hasOverlap && isActiveOnDay;
// };