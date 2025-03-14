import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { config } from './index';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin with service account JSON file
const initializeFirebaseAdmin = () => {
  try {
    // Path to your service account key file (in the root directory)
    const serviceAccountPath = path.resolve(process.cwd(), 'firebase-key.json');
    
    // Read and parse the service account key file
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    // Initialize Firebase if not already initialized
    const app = initializeApp({
      credential: cert(serviceAccount),
    });
    
    logger.info('Firebase Admin initialized successfully using service account key file');
    return app;
  } catch (error: any) {
    // If already initialized, Firebase throws an error
    if (error.code === 'app/duplicate-app') {
      logger.warn('Firebase app already initialized');
      return initializeApp();
    }
    
    logger.error('Firebase initialization error:', error);
    throw error;
  }
};

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

// Utility functions for Firestore operations

/**
 * Create a document with auto-generated ID
 */
export const createDocument = async (
  collection: string,
  data: any
): Promise<string> => {
  const docRef = await db.collection(collection).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  
  return docRef.id;
};

/**
 * Create or update a document with a specific ID
 */
export const setDocument = async (
  collection: string,
  id: string,
  data: any,
  merge = true
): Promise<void> => {
  const updateData = {
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  };
  
  // If not merging or document doesn't exist, add createdAt
  if (!merge) {
    updateData.createdAt = FieldValue.serverTimestamp();
  }
  
  await db.collection(collection).doc(id).set(updateData, { merge });
};

/**
 * Update specific fields of a document
 */
export const updateDocument = async (
  collection: string,
  id: string,
  data: any
): Promise<void> => {
  await db.collection(collection).doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  });
};

/**
 * Get a document by ID
 */
export const getDocument = async (
  collection: string,
  id: string
): Promise<any | null> => {
  const doc = await db.collection(collection).doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
};

/**
 * Delete a document
 */
export const deleteDocument = async (
  collection: string,
  id: string
): Promise<void> => {
  await db.collection(collection).doc(id).delete();
};

/**
 * Query documents with filters
 */
export const queryDocuments = async (
  collection: string,
  queries: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [],
  orderBy?: { field: string; direction?: 'asc' | 'desc' },
  limit?: number
): Promise<any[]> => {
  let query: FirebaseFirestore.Query = db.collection(collection);
  
  // Apply where clauses
  queries.forEach(([field, operator, value]) => {
    query = query.where(field, operator, value);
  });
  
  // Apply orderBy if provided
  if (orderBy) {
    query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
  }
  
  // Apply limit if provided
  if (limit) {
    query = query.limit(limit);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Export Firestore types for convenience
export { Timestamp, FieldValue };