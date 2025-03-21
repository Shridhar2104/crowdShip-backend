import { 
    matchingModel, 
    findMatchesForPackage,
    findMatchesForCarrier,
    batchMatchingAlgorithm 
  } from '../src/utils/mlMatchingalogrithm';
  import { 
    Package, 
    Carrier, 
    VehicleType, 
    PackageStatus,
    Location 
  } from '../src/models/types';
  
  /**
   * Test script for the ML-based matching algorithm
   * This script creates sample packages and carriers, then tests different matching scenarios
   */
  
  // Helper function to create a timestamp with offset from now
  function createTimestamp(hourOffset: number): Date {
    const date = new Date();
    date.setHours(date.getHours() + hourOffset);
    return date;
  }
  
  // Sample locations in a city (using generic coordinates)
  const locations = {
    downtown: { latitude: 37.7749, longitude: -122.4194, address: "Downtown" },
    northSide: { latitude: 37.8044, longitude: -122.4199, address: "North Side" },
    eastSide: { latitude: 37.7749, longitude: -122.3914, address: "East Side" },
    southSide: { latitude: 37.7449, longitude: -122.4194, address: "South Side" },
    westSide: { latitude: 37.7749, longitude: -122.4484, address: "West Side" },
    suburb1: { latitude: 37.8534, longitude: -122.5264, address: "Suburb 1" },
    suburb2: { latitude: 37.5485, longitude: -122.3084, address: "Suburb 2" }
  };
  
  // Create sample packages
  const packages: Package[] = [
    // Package 1: Standard small package downtown to east side
    {
      id: "pkg-001",
      senderId: "sender-001",
      recipientId: "recipient-001",
      weight: 2, // 2kg
      size: 20, // small box
      requiresSignature: false,
      requiresRefrigeration: false,
      isFragile: false,
      pickupLocation: locations.downtown,
      deliveryLocation: locations.eastSide,
      pickupTimeWindow: {
        start: createTimestamp(0), // now
        end: createTimestamp(2) // 2 hours from now
      },
      deliveryTimeWindow: {
        start: createTimestamp(1), // 1 hour from now
        end: createTimestamp(4) // 4 hours from now
      },
      status: PackageStatus.CREATED,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    
    // Package 2: Heavy package from suburb to downtown
    {
      id: "pkg-002",
      senderId: "sender-002",
      recipientId: "recipient-002",
      weight: 15, // 15kg
      size: 50, // medium box
      requiresSignature: true,
      requiresRefrigeration: false,
      isFragile: true,
      pickupLocation: locations.suburb1,
      deliveryLocation: locations.downtown,
      pickupTimeWindow: {
        start: createTimestamp(1), // 1 hour from now
        end: createTimestamp(3) // 3 hours from now
      },
      deliveryTimeWindow: {
        start: createTimestamp(2), // 2 hours from now
        end: createTimestamp(5) // 5 hours from now
      },
      status: PackageStatus.CREATED,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    
    // Package 3: Refrigerated package from east to west
    {
      id: "pkg-003",
      senderId: "sender-003",
      recipientId: "recipient-003",
      weight: 5, // 5kg
      size: 30, // medium-small box
      requiresSignature: false,
      requiresRefrigeration: true,
      isFragile: true,
      pickupLocation: locations.eastSide,
      deliveryLocation: locations.westSide,
      pickupTimeWindow: {
        start: createTimestamp(0.5), // 30min from now
        end: createTimestamp(2.5) // 2.5 hours from now
      },
      deliveryTimeWindow: {
        start: createTimestamp(1.5), // 1.5 hours from now
        end: createTimestamp(4) // 4 hours from now
      },
      status: PackageStatus.CREATED,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    
    // Package 4: Small package within downtown
    {
      id: "pkg-004",
      senderId: "sender-004",
      recipientId: "recipient-004",
      weight: 1, // 1kg
      size: 10, // very small box
      requiresSignature: false,
      requiresRefrigeration: false,
      isFragile: false,
      pickupLocation: locations.downtown,
      deliveryLocation: { 
        latitude: 37.7829, 
        longitude: -122.4174, 
        address: "Downtown North" 
      },
      pickupTimeWindow: {
        start: createTimestamp(0), // now
        end: createTimestamp(1) // 1 hour from now
      },
      deliveryTimeWindow: {
        start: createTimestamp(0.5), // 30min from now
        end: createTimestamp(2) // 2 hours from now
      },
      status: PackageStatus.CREATED,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    
    // Package 5: Large package from suburb to suburb
    {
      id: "pkg-005",
      senderId: "sender-005",
      recipientId: "recipient-005",
      weight: 25, // 25kg
      size: 80, // large box
      requiresSignature: true,
      requiresRefrigeration: false,
      isFragile: false,
      pickupLocation: locations.suburb1,
      deliveryLocation: locations.suburb2,
      pickupTimeWindow: {
        start: createTimestamp(2), // 2 hours from now
        end: createTimestamp(5) // 5 hours from now
      },
      deliveryTimeWindow: {
        start: createTimestamp(3), // 3 hours from now
        end: createTimestamp(8) // 8 hours from now
      },
      status: PackageStatus.CREATED,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  // Create sample carriers
  const carriers: Carrier[] = [
    // Carrier 1: Car driver commuting from suburb to downtown
    {
      id: "carrier-001",
      userId: "user-001",
      vehicleType: VehicleType.CAR,
      maxWeight: 50, // 50kg
      maxSize: 100, // large trunk
      maxPackages: 3,
      hasRefrigeration: false,
      rating: 4.7,
      completedDeliveries: 58,
      route: {
        origin: locations.suburb1,
        destination: locations.downtown
      },
      availabilityWindow: {
        start: createTimestamp(0.5), // 30min from now
        end: createTimestamp(2.5) // 2.5 hours from now
      },
      currentLocation: { 
        latitude: 37.8334, 
        longitude: -122.5164, 
        address: "Near Suburb 1" 
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    
    // Carrier 2: Bicycle messenger in downtown
    {
      id: "carrier-002",
      userId: "user-002",
      vehicleType: VehicleType.BICYCLE,
      maxWeight: 10, // 10kg
      maxSize: 30, // backpack
      maxPackages: 2,
      hasRefrigeration: false,
      rating: 4.9,
      completedDeliveries: 203,
      route: {
        origin: locations.downtown,
        destination: locations.eastSide
      },
      availabilityWindow: {
        start: createTimestamp(0), // now
        end: createTimestamp(4) // 4 hours from now
      },
      currentLocation: locations.downtown,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    
    // Carrier 3: Van driver with refrigeration
    {
      id: "carrier-003",
      userId: "user-003",
      vehicleType: VehicleType.VAN,
      maxWeight: 200, // 200kg
      maxSize: 500, // large van
      maxPackages: 10,
      hasRefrigeration: true,
      rating: 4.5,
      completedDeliveries: 112,
      route: {
        origin: locations.eastSide,
        destination: locations.westSide
      },
      availabilityWindow: {
        start: createTimestamp(1), // 1 hour from now
        end: createTimestamp(6) // 6 hours from now
      },
      currentLocation: locations.eastSide,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    
    // Carrier 4: Auto-rickshaw driver
    {
      id: "carrier-004",
      userId: "user-004",
      vehicleType: VehicleType.AUTO_RICKSHAW,
      maxWeight: 30, // 30kg
      maxSize: 60, // medium space
      maxPackages: 3,
      hasRefrigeration: false,
      rating: 4.2,
      completedDeliveries: 89,
      route: {
        origin: locations.southSide,
        destination: locations.northSide
      },
      availabilityWindow: {
        start: createTimestamp(0), // now
        end: createTimestamp(3) // 3 hours from now
      },
      currentLocation: { 
        latitude: 37.7599, 
        longitude: -122.4184, 
        address: "Between South and Downtown" 
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    
    // Carrier 5: Motorcycle courier
    {
      id: "carrier-005",
      userId: "user-005",
      vehicleType: VehicleType.MOTORCYCLE,
      maxWeight: 15, // 15kg
      maxSize: 40, // medium-small storage
      maxPackages: 2,
      hasRefrigeration: false,
      rating: 4.6,
      completedDeliveries: 178,
      route: {
        origin: locations.suburb2,
        destination: locations.downtown
      },
      availabilityWindow: {
        start: createTimestamp(1.5), // 1.5 hours from now
        end: createTimestamp(5) // 5 hours from now
      },
      currentLocation: locations.suburb2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  // Function to run tests
  async function runMatchingTests() {
    console.log("=== CROWDSHIP AI MATCHING ALGORITHM TESTS ===\n");
    
    // Test 1: Find matches for a specific package
    console.log("TEST 1: Finding matches for Package 1 (Downtown to East Side)");
    const pkg1Matches = findMatchesForPackage(matchingModel, packages[0], carriers, 0.3);
    console.log(`Found ${pkg1Matches.length} potential carriers for package 1:`);
    pkg1Matches.forEach(match => {
      const carrier = carriers.find(c => c.id === match.carrierId);
      console.log(`- Carrier ${carrier?.id} (${carrier?.vehicleType}): Score ${match.score.toFixed(2)}, ETA: ${match.estimatedArrival.toLocaleTimeString()}`);
    });
    
    console.log("\n-------------------------------------------\n");
    
    // Test 2: Find matches for a carrier
    console.log("TEST 2: Finding matches for Carrier 2 (Bicycle messenger)");
    const carrier2Matches = findMatchesForCarrier(matchingModel, carriers[1], packages, 0.3);
    console.log(`Found ${carrier2Matches.length} potential packages for carrier 2:`);
    carrier2Matches.forEach(match => {
      const pkg = packages.find(p => p.id === match.packageId);
      console.log(`- Package ${pkg?.id} (${pkg?.weight}kg): Score ${match.score.toFixed(2)}, ETA: ${match.estimatedArrival.toLocaleTimeString()}`);
    });
    
    console.log("\n-------------------------------------------\n");
    
    // Test 3: Batch matching algorithm
    console.log("TEST 3: Running batch matching algorithm");
    const batchMatches = batchMatchingAlgorithm(matchingModel, packages, carriers);
    console.log(`Found ${batchMatches.length} optimal matches:`);
    batchMatches.forEach(match => {
      const pkg = packages.find(p => p.id === match.packageId);
      const carrier = carriers.find(c => c.id === match.carrierId);
      console.log(`- Package ${pkg?.id} (${pkg?.pickupLocation.address} to ${pkg?.deliveryLocation.address}) matched with Carrier ${carrier?.id} (${carrier?.vehicleType}): Score ${match.score.toFixed(2)}`);
    });
    
    console.log("\n-------------------------------------------\n");
    
    // Test 4: Adding feedback to improve the model
    console.log("TEST 4: Adding delivery feedback and retraining model");
    
    // Add some successful deliveries
    console.log("Adding 3 successful deliveries to the model:");
    
    const successfulMatches = [
      { packageId: "pkg-001", carrierId: "carrier-002", score: 0.85 },
      { packageId: "pkg-003", carrierId: "carrier-003", score: 0.92 },
      { packageId: "pkg-004", carrierId: "carrier-002", score: 0.89 }
    ];
    
    successfulMatches.forEach(data => {
      const mockMatch = {
        id: `${data.packageId}-${data.carrierId}`,
        packageId: data.packageId,
        carrierId: data.carrierId,
        score: data.score,
        routeDeviationMeters: 500,
        estimatedArrival: new Date(),
        status: "COMPLETED" as const
      };
      
      matchingModel.addTrainingExample(mockMatch, true, 45, 5);
      console.log(`- Added successful delivery for package ${data.packageId} by carrier ${data.carrierId}`);
    });
    
    // Add an unsuccessful delivery
    console.log("\nAdding 1 unsuccessful delivery to the model:");
    const unsuccessfulMatch = {
      id: "pkg-002-carrier-004",
      packageId: "pkg-002",
      carrierId: "carrier-004",
      score: 0.65,
      routeDeviationMeters: 1200,
      estimatedArrival: new Date(),
      status: "FAILED" as const
    };
    
    matchingModel.addTrainingExample(unsuccessfulMatch, false, 90, 2);
    console.log(`- Added unsuccessful delivery for package pkg-002 by carrier carrier-004`);
    
    // Train the model
    console.log("\nTraining the model with the feedback...");
    matchingModel.trainModel();
    
    console.log("\nModel training complete!");
    console.log("Updated model weights:", matchingModel.getModelWeights());
    
    console.log("\n-------------------------------------------\n");
    
    // Test 5: Rerun batch matching with improved model
    console.log("TEST 5: Running batch matching with improved model");
    const improvedBatchMatches = batchMatchingAlgorithm(matchingModel, packages, carriers);
    console.log(`Found ${improvedBatchMatches.length} optimal matches with improved model:`);
    improvedBatchMatches.forEach(match => {
      const pkg = packages.find(p => p.id === match.packageId);
      const carrier = carriers.find(c => c.id === match.carrierId);
      console.log(`- Package ${pkg?.id} (${pkg?.pickupLocation.address} to ${pkg?.deliveryLocation.address}) matched with Carrier ${carrier?.id} (${carrier?.vehicleType}): Score ${match.score.toFixed(2)}`);
    });
    
    console.log("\n=== TESTS COMPLETED SUCCESSFULLY ===");
  }
  
  // Run the tests
  runMatchingTests().catch(console.error);
  
  export default runMatchingTests;