"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldValue = exports.Timestamp = exports.queryDocuments = exports.deleteDocument = exports.getDocument = exports.updateDocument = exports.setDocument = exports.createDocument = exports.connectDatabase = exports.db = exports.firebaseApp = void 0;
var app_1 = require("firebase-admin/app");
var firestore_1 = require("firebase-admin/firestore");
Object.defineProperty(exports, "Timestamp", { enumerable: true, get: function () { return firestore_1.Timestamp; } });
Object.defineProperty(exports, "FieldValue", { enumerable: true, get: function () { return firestore_1.FieldValue; } });
var logger_1 = require("../utils/logger");
var path = require("path");
var fs = require("fs");
// At the top of your main file (before any other imports)
var dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') }); // Adjust path as needed
var initializeFirebaseAdmin = function () {
    try {
        var serviceAccount = void 0;
        // Check if we have the base64 encoded service account
        if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
            // Decode the base64 string to a JSON string
            var decodedServiceAccount = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
            // Parse the JSON string to an object
            serviceAccount = JSON.parse(decodedServiceAccount);
        }
        else {
            // Fallback to file for local development
            try {
                var serviceAccountPath = path.resolve(process.cwd(), 'firebase-key.json');
                serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                logger_1.logger.info('Firebase Admin initialized using local service account file');
            }
            catch (fileError) {
                logger_1.logger.error('Failed to read local firebase-key.json:', fileError);
                throw new Error('Firebase service account not found in environment variables or local file');
            }
        }
        // Initialize Firebase with the service account
        var app = (0, app_1.initializeApp)({
            credential: (0, app_1.cert)(serviceAccount),
        });
        logger_1.logger.info('Firebase Admin initialized successfully');
        return app;
    }
    catch (error) {
        // Handle errors
        if (error.code === 'app/duplicate-app') {
            logger_1.logger.warn('Firebase app already initialized');
            return (0, app_1.initializeApp)();
        }
        logger_1.logger.error('Firebase initialization error:', error);
        throw error;
    }
};
// Firebase app instance
exports.firebaseApp = initializeFirebaseAdmin();
// Initialize Firestore
exports.db = (0, firestore_1.getFirestore)(exports.firebaseApp);
// Set Firestore settings
exports.db.settings({
    ignoreUndefinedProperties: true,
    timestampsInSnapshots: true,
});
// Connect to Firestore
var connectDatabase = function () { return __awaiter(void 0, void 0, void 0, function () {
    var testCollection, testDoc, doc, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                testCollection = exports.db.collection('connection_test');
                testDoc = testCollection.doc('test');
                return [4 /*yield*/, testDoc.set({
                        timestamp: firestore_1.Timestamp.now(),
                        message: 'Connection test successful'
                    })];
            case 1:
                _a.sent();
                return [4 /*yield*/, testDoc.get()];
            case 2:
                doc = _a.sent();
                if (!doc.exists) return [3 /*break*/, 4];
                logger_1.logger.info('Firestore connection has been established successfully.');
                return [4 /*yield*/, testDoc.delete()];
            case 3:
                _a.sent(); // Clean up test document
                return [3 /*break*/, 5];
            case 4: throw new Error('Failed to write test document to Firestore');
            case 5: return [3 /*break*/, 7];
            case 6:
                error_1 = _a.sent();
                logger_1.logger.error('Unable to connect to Firestore:', error_1);
                throw error_1;
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.connectDatabase = connectDatabase;
// Utility functions for Firestore operations
/**
 * Create a document with auto-generated ID
 */
var createDocument = function (collection, data) { return __awaiter(void 0, void 0, void 0, function () {
    var docRef;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.db.collection(collection).add(__assign(__assign({}, data), { createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp() }))];
            case 1:
                docRef = _a.sent();
                return [2 /*return*/, docRef.id];
        }
    });
}); };
exports.createDocument = createDocument;
/**
 * Create or update a document with a specific ID
 */
var setDocument = function (collection_1, id_1, data_1) {
    var args_1 = [];
    for (var _i = 3; _i < arguments.length; _i++) {
        args_1[_i - 3] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([collection_1, id_1, data_1], args_1, true), void 0, function (collection, id, data, merge) {
        var updateData;
        if (merge === void 0) { merge = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    updateData = __assign(__assign({}, data), { updatedAt: firestore_1.FieldValue.serverTimestamp() });
                    // If not merging or document doesn't exist, add createdAt
                    if (!merge) {
                        updateData.createdAt = firestore_1.FieldValue.serverTimestamp();
                    }
                    return [4 /*yield*/, exports.db.collection(collection).doc(id).set(updateData, { merge: merge })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
};
exports.setDocument = setDocument;
/**
 * Update specific fields of a document
 */
var updateDocument = function (collection, id, data) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.db.collection(collection).doc(id).update(__assign(__assign({}, data), { updatedAt: firestore_1.FieldValue.serverTimestamp() }))];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.updateDocument = updateDocument;
/**
 * Get a document by ID
 */
var getDocument = function (collection, id) { return __awaiter(void 0, void 0, void 0, function () {
    var doc;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.db.collection(collection).doc(id).get()];
            case 1:
                doc = _a.sent();
                if (!doc.exists) {
                    return [2 /*return*/, null];
                }
                return [2 /*return*/, __assign({ id: doc.id }, doc.data())];
        }
    });
}); };
exports.getDocument = getDocument;
/**
 * Delete a document
 */
var deleteDocument = function (collection, id) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.db.collection(collection).doc(id).delete()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.deleteDocument = deleteDocument;
/**
 * Query documents with filters
 */
var queryDocuments = function (collection_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([collection_1], args_1, true), void 0, function (collection, queries, orderBy, limit) {
        var query, snapshot;
        if (queries === void 0) { queries = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = exports.db.collection(collection);
                    // Apply where clauses
                    queries.forEach(function (_a) {
                        var field = _a[0], operator = _a[1], value = _a[2];
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
                    return [4 /*yield*/, query.get()];
                case 1:
                    snapshot = _a.sent();
                    return [2 /*return*/, snapshot.docs.map(function (doc) { return (__assign({ id: doc.id }, doc.data())); })];
            }
        });
    });
};
exports.queryDocuments = queryDocuments;
