import AIMatchingService from '../intelligentMatchingService';
import { db } from '../../config/database';

/**
 * Test script for the actual AIMatchingService algorithm using mocked Firestore
 * This lets you test your real algorithm logic without hitting Firestore quotas
 */

// Mock test data with comprehensive information needed by AIMatchingService
const mockData = {
  packages: [
    {
      id: 'pkg-1',
      dimensions: {
        length: 90,
        width: 70,
        height: 50,
        weight: 40
      },
      pickupLocation: {
        latitude: 40.7128,
        longitude: -74.0060,
        city: "New York",
        address: "123 Main St, New York"
      },
      deliveryLocation: {
        latitude: 40.7300,
        longitude: -74.0200,
        city: "New York",
        address: "456 Broadway, New York"
      },
      pickupWindow: ["09:00", "12:00"],
      deliveryWindow: ["13:00", "17:00"],
      status: 'ready_for_pickup',
      distance: 5.2, // distance in km
      urgency: 'medium',
      packageWeight: 40,
      routeId: 'route-1',
      matched: false
    },
    {
      id: 'pkg-2',
      dimensions: {
        length: 30,
        width: 20,
        height: 15,
        weight: 5
      },
      pickupLocation: {
        latitude: 40.7200,
        longitude: -74.0100,
        city: "New York",
        address: "789 Park Ave, New York"
      },
      deliveryLocation: {
        latitude: 40.7350,
        longitude: -74.0150,
        city: "New York",
        address: "321 Fifth Ave, New York"
      },
      pickupWindow: ["10:00", "14:00"],
      deliveryWindow: ["15:00", "19:00"],
      status: 'ready_for_pickup',
      distance: 3.1, // distance in km
      urgency: 'low',
      packageWeight: 5,
      routeId: 'route-2',
      matched: false
    }
  ],
  routes: [
    {
      id: 'route-1',
      packageId: 'pkg-1',
      status: 'active',
      distance: 5.2,
      pickupLocation: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      deliveryLocation: {
        latitude: 40.7300,
        longitude: -74.0200
      },
      estimatedDuration: 20, // minutes
      waypoints: [
        { latitude: 40.7128, longitude: -74.0060 },
        { latitude: 40.7200, longitude: -74.0100 },
        { latitude: 40.7300, longitude: -74.0200 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: 'route-2',
      packageId: 'pkg-2',
      status: 'active',
      distance: 3.1,
      pickupLocation: {
        latitude: 40.7200,
        longitude: -74.0100
      },
      deliveryLocation: {
        latitude: 40.7350,
        longitude: -74.0150
      },
      estimatedDuration: 15, // minutes
      waypoints: [
        { latitude: 40.7200, longitude: -74.0100 },
        { latitude: 40.7300, longitude: -74.0120 },
        { latitude: 40.7350, longitude: -74.0150 }
      ],
      createdAt: new Date().toISOString()
    }
  ],
  carriers: [
    {
      id: 'carrier-1',
      name: 'Large Truck Carrier',
      role: 'carrier',
      lastLocation: {
        latitude: 40.7130,
        longitude: -74.0062
      },
      vehicleCapacity: {
        length: 100,
        width: 80,
        height: 60,
        weightLimit: 50
      },
      routeCoordinates: [
        [40.7130, -74.0062],
        [40.7200, -74.0100],
        [40.7300, -74.0150]
      ],
      schedule: {
        startTime: "08:00",
        endTime: "18:00"
      },
      active: true,
      available: true,
      rating: 4.7,
      onTimeRate: 0.95,
      completedDeliveries: ["delivery-1", "delivery-2", "delivery-3"],
      vehicleType: "truck",
      vehicleSize: "large"
    },
    {
      id: 'carrier-2',
      name: 'Medium Van Carrier',
      role: 'carrier',
      lastLocation: {
        latitude: 40.7135,
        longitude: -74.0068
      },
      vehicleCapacity: {
        length: 80,
        width: 60,
        height: 50,
        weightLimit: 35
      },
      routeCoordinates: [
        [40.7135, -74.0068],
        [40.7220, -74.0110],
        [40.7320, -74.0160]
      ],
      schedule: {
        startTime: "09:00",
        endTime: "17:00"
      },
      active: true,
      available: true,
      rating: 4.5,
      onTimeRate: 0.92,
      completedDeliveries: ["delivery-4", "delivery-5"],
      vehicleType: "van",
      vehicleSize: "medium"
    },
    {
      id: 'carrier-3',
      name: 'Small Car Carrier',
      role: 'carrier',
      lastLocation: {
        latitude: 40.7140,
        longitude: -74.0070
      },
      vehicleCapacity: {
        length: 50,
        width: 40,
        height: 30,
        weightLimit: 20
      },
      routeCoordinates: [
        [40.7140, -74.0070],
        [40.7210, -74.0090],
        [40.7310, -74.0140]
      ],
      schedule: {
        startTime: "10:00",
        endTime: "20:00"
      },
      active: true,
      available: true,
      rating: 4.8,
      onTimeRate: 0.98,
      completedDeliveries: ["delivery-6", "delivery-7", "delivery-8", "delivery-9"],
      vehicleType: "car",
      vehicleSize: "small"
    }
  ],
  users: [
    {
      id: 'carrier-1',
      name: 'Large Truck Carrier',
      role: 'carrier',
      active: true,
      available: true
    },
    {
      id: 'carrier-2',
      name: 'Medium Van Carrier',
      role: 'carrier',
      active: true,
      available: true
    },
    {
      id: 'carrier-3',
      name: 'Small Car Carrier',
      role: 'carrier',
      active: true,
      available: true
    },
    {
      id: 'user-1',
      name: 'Regular Customer',
      role: 'customer',
      active: true
    }
  ]
};

// Helper function to log test results
const logTestResult = (testName: string, success: boolean, details?: any) => {
  console.log(`[TEST] ${testName}: ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (details) {
    console.log('Details:', details);
  }
  console.log('-----------------------------------');
};

// Store original methods properly without executing them
let originalDbCollection: any;

// Create comprehensive Firestore mock
function setupFirestoreMock() {
  // Save the original method
  originalDbCollection = db.collection;
  
  console.log(`\n[DEBUG] Setting up Firestore mock...`);
  
  // Replace with mock implementation using type assertion
  (db as any).collection = function mockedCollection(collectionName: string) {
    console.log(`[DEBUG] Mocked collection access: "${collectionName}"`);
    
    // Create a mock collection with needed methods
    return {
      doc: (id: string) => {
        console.log(`[DEBUG] Accessing document ${collectionName}/${id}`);
        
        // Determine which data collection to look in
        let collection: any[];
        if (collectionName === 'packages') {
          collection = mockData.packages;
        } else if (collectionName === 'routes') {
          collection = mockData.routes;
        } else if (collectionName === 'carriers') {
          collection = mockData.carriers;
        } else if (collectionName === 'users') {
          collection = mockData.users;
        } else {
          collection = [];
        }
        
        // Find the document
        const doc = collection.find(item => item.id === id);
        
        return {
          get: async () => {
            if (doc) {
              console.log(`[DEBUG] Found document ${collectionName}/${id}`);
              return {
                exists: true,
                id: id,
                data: () => ({...doc})
              };
            }
            console.log(`[DEBUG] Document ${collectionName}/${id} not found`);
            return { exists: false, id: id, data: () => null };
          },
          update: async (data: any) => {
            console.log(`[DEBUG] Mock updating ${collectionName}/${id} with:`, data);
            return Promise.resolve();
          }
        };
      },
      where: (field: string, op: string, value: any) => {
        console.log(`[DEBUG] Query: ${collectionName}.where(${field} ${op} ${value})`);
        
        // Start filtering based on first condition
        let filteredData: any[] = [];
        
        // Determine which collection to filter
        if (collectionName === 'carriers') {
          filteredData = [...mockData.carriers];
        } else if (collectionName === 'users') {
          filteredData = [...mockData.users];
        } else if (collectionName === 'packages') {
          filteredData = [...mockData.packages];
        } else if (collectionName === 'routes') {
          filteredData = [...mockData.routes];
        } else {
          // Default to empty array for unknown collections
          filteredData = [];
        }
        
        // Apply the filter
        filteredData = filteredData.filter(item => {
          // Handle nested properties
          const getNestedValue = (obj: any, path: string) => {
            const parts = path.split('.');
            let value = obj;
            for (const part of parts) {
              if (value == null) return undefined;
              value = value[part];
            }
            return value;
          };
          
          const itemValue = getNestedValue(item, field);
          
          if (op === '==') {
            return itemValue === value;
          } else if (op === '!=') {
            return itemValue !== value;
          } else if (op === '>') {
            return itemValue > value;
          } else if (op === '>=') {
            return itemValue >= value;
          } else if (op === '<') {
            return itemValue < value;
          } else if (op === '<=') {
            return itemValue <= value;
          }
          
          return true; // Default case
        });
        
        console.log(`[DEBUG] After filter: ${filteredData.length} documents`);
        
        // Create a function to build the query object
        const createQueryObj = () => {
          return {
            where: (nextField: string, nextOp: string, nextValue: any) => {
              console.log(`[DEBUG] Query: ${collectionName}.where(${nextField} ${nextOp} ${nextValue})`);
              
              // Apply additional filter
              filteredData = filteredData.filter(item => {
                const getNestedValue = (obj: any, path: string) => {
                  const parts = path.split('.');
                  let value = obj;
                  for (const part of parts) {
                    if (value == null) return undefined;
                    value = value[part];
                  }
                  return value;
                };
                
                const itemValue = getNestedValue(item, nextField);
                
                if (nextOp === '==') {
                  return itemValue === nextValue;
                } else if (nextOp === '!=') {
                  return itemValue !== nextValue;
                } else if (nextOp === '>') {
                  return itemValue > nextValue;
                } else if (nextOp === '>=') {
                  return itemValue >= nextValue;
                } else if (nextOp === '<') {
                  return itemValue < nextValue;
                } else if (nextOp === '<=') {
                  return itemValue <= nextValue;
                }
                
                return true; // Default case
              });
              
              console.log(`[DEBUG] After additional filter: ${filteredData.length} documents`);
              
              return createQueryObj(); // Return a new chainable object
            },
            limit: (limitCount: number) => {
              console.log(`[DEBUG] Query: ${collectionName}.limit(${limitCount})`);
              
              // Apply limit to the data
              filteredData = filteredData.slice(0, limitCount);
              
              console.log(`[DEBUG] After limit: ${filteredData.length} documents`);
              
              return createQueryObj(); // Return a new chainable object
            },
            orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => {
              console.log(`[DEBUG] Query: ${collectionName}.orderBy(${field}, ${direction})`);
              
              // Sort the data based on field and direction
              filteredData = filteredData.sort((a, b) => {
                // Handle nested properties using a helper function
                const getNestedValue = (obj: any, path: string) => {
                  const parts = path.split('.');
                  let value = obj;
                  for (const part of parts) {
                    if (value == null) return undefined;
                    value = value[part];
                  }
                  return value;
                };

                const aValue = getNestedValue(a, field);
                const bValue = getNestedValue(b, field);
                
                if (aValue === bValue) return 0;
                
                if (direction === 'asc') {
                  return aValue < bValue ? -1 : 1;
                } else {
                  return aValue > bValue ? -1 : 1;
                }
              });
              
              console.log(`[DEBUG] After orderBy: ${filteredData.length} documents`);
              
              return createQueryObj(); // Return a new chainable object
            },
            get: async () => {
              console.log(`[DEBUG] Query: ${collectionName}.get() - ${filteredData.length} results`);
              
              return {
                empty: filteredData.length === 0,
                docs: filteredData.map(doc => ({
                  id: doc.id,
                  data: () => ({...doc})
                }))
              };
            }
          };
        };
        
        return createQueryObj();
      },
      get: async () => {
        console.log(`[DEBUG] Getting all docs from ${collectionName}`);
        
        // Return all documents in the collection
        let allData: any[] = [];
        if (collectionName === 'carriers') {
          allData = mockData.carriers;
        } else if (collectionName === 'users') {
          allData = mockData.users;
        } else if (collectionName === 'packages') {
          allData = mockData.packages;
        } else if (collectionName === 'routes') {
          allData = mockData.routes;
        }
        
        console.log(`[DEBUG] Returning ${allData.length} documents from ${collectionName}`);
        
        return {
          empty: allData.length === 0,
          docs: allData.map(doc => ({
            id: doc.id,
            data: () => ({...doc})
          }))
        };
      }
    };
  };
}

// Properly restore Firestore
function restoreFirestore() {
  if (originalDbCollection) {
    (db as any).collection = originalDbCollection;
    console.log('Firebase Firestore mocks have been successfully restored');
  }
}

// Run test with the actual algorithm
async function testActualAlgorithm() {
  console.log('===== TESTING ACTUAL AI MATCHING ALGORITHM =====');
  
  try {
    // Set up our mocked Firestore
    setupFirestoreMock();
    
    // Create an instance of your actual service
    const actualService = new AIMatchingService();
    
    // Test large package
    console.log('\n📦 PACKAGE 1 (LARGE): 90x70x50cm, 40kg');
    console.log('Expected to match with large carriers only\n');
    
    try {
      console.log(`\n[DEBUG] About to find optimal carriers for package pkg-1...`);
      console.log(`[DEBUG] Package 1 data:`, JSON.stringify(mockData.packages[0], null, 2));
      console.log(`[DEBUG] Route 1 data:`, JSON.stringify(mockData.routes[0], null, 2));
      
      const radiusKm = 5;
      const largePackageMatches = await actualService.findOptimalCarriers('pkg-1', radiusKm, 10);
      console.log('MATCHES FOUND:', largePackageMatches.length);
      
      if (largePackageMatches.length > 0) {
        console.log('Matched carriers:');
        console.table(largePackageMatches);
        
        // Check if only large carriers matched
        const onlyLargeCarriersMatched = largePackageMatches.every(match => {
          const carrier = mockData.carriers.find(c => c.id === match.carrierId);
          return carrier && carrier.vehicleCapacity && carrier.vehicleCapacity.weightLimit >= 35;
        });
        
        logTestResult('Large package matching (actual algorithm)', onlyLargeCarriersMatched, {
          expected: 'Only large carriers should match',
          actual: onlyLargeCarriersMatched ? 'Only large carriers matched' : 'Some small carriers incorrectly matched'
        });
      } else {
        logTestResult('Large package matching (actual algorithm)', false, {
          expected: 'Should find at least carrier-1 and carrier-2',
          actual: 'No carriers matched'
        });
      }
    } catch (error) {
      console.error('Error testing large package matching with actual algorithm:', error);
      logTestResult('Large package matching (actual algorithm)', false, {error});
    }
    
    // Test small package
    console.log('\n📦 PACKAGE 2 (SMALL): 30x20x15cm, 5kg');
    console.log('Expected to match with all carriers\n');
    
    try {
      console.log(`\n[DEBUG] About to find optimal carriers for package pkg-2...`);
      console.log(`[DEBUG] Package 2 data:`, JSON.stringify(mockData.packages[1], null, 2));
      console.log(`[DEBUG] Route 2 data:`, JSON.stringify(mockData.routes[1], null, 2));
      
      const smallPackageMatches = await actualService.findOptimalCarriers('pkg-2', 5, 10);
      console.log('MATCHES FOUND:', smallPackageMatches.length);
      
      if (smallPackageMatches.length > 0) {
        console.log('Matched carriers:');
        console.table(smallPackageMatches);
        
        // All active carriers with carrier role should match small package
        const allCarriersCount = mockData.carriers.filter(c => 
          c.role === 'carrier' && c.active && c.available
        ).length;
        
        const allCarriersMatched = smallPackageMatches.length === allCarriersCount;
        
        logTestResult('Small package matching (actual algorithm)', allCarriersMatched, {
          expected: `All ${allCarriersCount} active carriers should match small package`,
          actual: `Found ${smallPackageMatches.length} carriers`
        });
      } else {
        logTestResult('Small package matching (actual algorithm)', false, {
          expected: 'Should find all carriers',
          actual: 'No carriers matched'
        });
      }
    } catch (error) {
      console.error('Error testing small package matching with actual algorithm:', error);
      logTestResult('Small package matching (actual algorithm)', false, {error});
    }
    
    // Restore original Firestore
    restoreFirestore();
    
    console.log('\n===== TEST SUMMARY =====');
    console.log('The above tests used your actual algorithm with mocked Firestore data');
    console.log('If tests failed, check if your algorithm correctly implements capacity checking');
    
    return true;
  } catch (error) {
    console.error('Error in test setup:', error);
    return false;
  }
}

// Execute the test
testActualAlgorithm().then((success) => {
  console.log('Test completed.');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test script failed with unhandled error:', error);
  process.exit(1);
});