// src/config/database.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { config } from './index';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { initializeMongoDB } from './mongodb';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Re-export all MongoDB models and functions
export * from '../models/ml/mlModels';

// Firebase app instance
export const firebaseApp = initializeFirebaseAdmin();

// Initialize Firestore
export const db = getFirestore(firebaseApp);

// Set Firestore settings
db.settings({
  ignoreUndefinedProperties: true,
  timestampsInSnapshots: true,
});

// Connect to Firestore
export const connectDatabase = async (): Promise<void> => {
  try {
    // Connect to Firestore
    await connectFirestore();
    
    // Connect to MongoDB for ML operations (but don't block app startup if it fails)
    await initializeMongoDB().catch(err => {
      logger.warn('MongoDB connection failed, ML features will be limited:', err.message);
    });
    
    logger.info('All database connections initialized');
  } catch (error) {
    logger.error('Database initialization error:', error);
    throw error;
  }
};

// Connect to Firestore
const connectFirestore = async (): Promise<void> => {
  try {
    // Simple test query to verify connection
    const testCollection = db.collection('connection_test');
    const testDoc = testCollection.doc('test');
    
    await testDoc.set({
      timestamp: Timestamp.now(),
      message: 'Connection test successful'
    });
    
    const doc = await testDoc.get();
    if (doc.exists) {
      logger.info('Firestore connection has been established successfully.');
      await testDoc.delete(); // Clean up test document
    } else {
      throw new Error('Failed to write test document to Firestore');
    }
  } catch (error) {
    logger.error('Unable to connect to Firestore:', error);
    throw error;
  }
};
// Initialize Firebase Admin
function initializeFirebaseAdmin() {
  try {
    let serviceAccount;
    
    // First check environment variables for base64 encoded credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        // Decode the base64 string to a JSON string
        const decodedServiceAccount = Buffer.from(
          process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
          'base64'
        ).toString('utf8');
        
        // Parse the JSON string to an object
        serviceAccount = JSON.parse(decodedServiceAccount);
        logger.info('Firebase Admin initialized using base64 encoded service account');
      } catch (base64Error) {
        logger.error('Failed to decode base64 service account:', base64Error);
        throw new Error('Invalid base64 encoded Firebase service account');
      }
    } 
    // Then try file path from environment variable
    else if (process.env.FIREBASE_CREDENTIALS) {
      try {
        const serviceAccountPath = process.env.FIREBASE_CREDENTIALS;
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        logger.info('Firebase Admin initialized using service account from FIREBASE_CREDENTIALS');
      } catch (fileError) {
        logger.error('Failed to read Firebase credentials from env path:', fileError);
        throw new Error('Failed to read Firebase credentials file specified in FIREBASE_CREDENTIALS');
      }
    }
    // Fallback to local firebase-key.json
    else {
      try {
        const serviceAccountPath = path.resolve(process.cwd(), 'firebase-key.json');
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        logger.info('Firebase Admin initialized using local service account file');
      } catch (fileError) {
        logger.error('Failed to read local firebase-key.json:', fileError);
        throw new Error('Firebase service account not found in environment variables or local file');
      }
    }
    
    // Log success but don't expose the entire credential object
    logger.info('Successfully loaded Firebase service account for project:', 
      serviceAccount.project_id || 'unknown project');
    
    // Initialize Firebase with the service account
    const app = initializeApp({
      credential: cert(serviceAccount),
    });
    
    logger.info('Firebase Admin initialized successfully');
    return app;
  } catch (error: any) {
    // Handle errors
    if (error.code === 'app/duplicate-app') {
      logger.warn('Firebase app already initialized');
      return initializeApp();
    }
    
    logger.error('Firebase initialization error:', error);
    throw error;
  }
}
// Utility functions for Firestore operations

/**
 * Create a document in Firestore
 * This function supports two parameter patterns:
 * 1. createDocument(collection, id, data) - where id can be undefined for auto-generated ID
 * 2. createDocument(collection, data) - where data is the document data and ID is auto-generated
 * 
 * @param collection Collection name
 * @param idOrData Document ID (string) or document data (object)
 * @param data Document data (only used if first pattern is followed)
 * @returns Document ID
 */
 export const createDocument = async (
  collection: string, 
  idOrData: string | any | undefined, 
  data?: any
): Promise<string> => {
  try {
    // Check parameter pattern
    if (typeof idOrData === 'string' || idOrData === undefined) {
      // Pattern 1: createDocument(collection, id, data)
      const id = idOrData as string | undefined;
      
      if (!data) {
        throw new Error('Data parameter is required when providing an ID');
      }
      
      if (id) {
        await db.collection(collection).doc(id).set({
          ...data,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        return id;
      } else {
        const docRef = await db.collection(collection).add({
          ...data,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        return docRef.id;
      }
    } else {
      // Pattern 2: createDocument(collection, data)
      const docData = idOrData;
      
      const docRef = await db.collection(collection).add({
        ...docData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      return docRef.id;
    }
  } catch (error) {
    logger.error(`Error creating document in ${collection}:`, error);
    throw error;
  }
};

/**
 * Get a document from Firestore
 * @param collection Collection name
 * @param id Document ID
 * @returns Document data or null if not found
 */
export const getDocument = async (collection: string, id: string): Promise<any | null> => {
  try {
    const docRef = await db.collection(collection).doc(id).get();
    if (!docRef.exists) {
      return null;
    }
    return { id: docRef.id, ...docRef.data() };
  } catch (error) {
    logger.error(`Error getting document from ${collection}:`, error);
    throw error;
  }
};

/**
 * Update a document in Firestore
 * @param collection Collection name
 * @param id Document ID
 * @param data Document data to update
 * @returns Success status
 */
export const updateDocument = async (collection: string, id: string, data: any): Promise<boolean> => {
  try {
    await db.collection(collection).doc(id).update({
      ...data,
      updatedAt: FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    logger.error(`Error updating document in ${collection}:`, error);
    return false;
  }
};
/**
 * Define a proper type for the orderBy parameter to support both formats
 */
 type OrderByParameter = [string, 'asc' | 'desc'] | { field: string; direction: 'asc' | 'desc' };

 /**
  * Query documents from Firestore with improved type support
  * @param collection Collection name
  * @param conditions Query conditions
  * @param orderByParam Order by field and direction (supports both array and object formats)
  * @param limitParam Limit results
  * @returns Array of documents
  */
 export const queryDocuments = async (
   collection: string, 
   conditions: [string, FirebaseFirestore.WhereFilterOp, any][], 
   orderByParam?: OrderByParameter,
   limitParam?: number
 ): Promise<any[]> => {
   try {
     let query: FirebaseFirestore.Query = db.collection(collection);
     
     // Apply conditions
     conditions.forEach(([field, operator, value]) => {
       query = query.where(field, operator, value);
     });
     
     // Apply ordering if specified - handle both tuple and object formats
     if (orderByParam) {
       if (Array.isArray(orderByParam)) {
         query = query.orderBy(orderByParam[0], orderByParam[1]);
       } else {
         query = query.orderBy(orderByParam.field, orderByParam.direction);
       }
     }
     
     // Apply limit if specified
     if (limitParam) {
       query = query.limit(limitParam);
     }
     
     const snapshot = await query.get();
     return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
   } catch (error) {
     logger.error(`Error querying documents from ${collection}:`, error);
     throw error;
   }
 };
// Export Firestore types for convenience
export { Timestamp, FieldValue };