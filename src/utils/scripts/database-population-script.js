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
Object.defineProperty(exports, "__esModule", { value: true });
var database_1 = require("../../config/database");
var path = require("path");
var fs = require("fs");
var intelligentMatchingService_1 = require("../intelligentMatchingService");
// Define sample locations (coordinates for major US cities)
var locations = [
    { city: "New York", coords: [40.7128, -74.0060] },
    { city: "Los Angeles", coords: [34.0522, -118.2437] },
    { city: "Chicago", coords: [41.8781, -87.6298] },
    { city: "Houston", coords: [29.7604, -95.3698] },
    { city: "Phoenix", coords: [33.4484, -112.0740] },
    { city: "Philadelphia", coords: [39.9526, -75.1652] },
    { city: "San Antonio", coords: [29.4241, -98.4936] },
    { city: "San Diego", coords: [32.7157, -117.1611] },
    { city: "Dallas", coords: [32.7767, -96.7970] },
    { city: "San Jose", coords: [37.3382, -121.8863] }
];
// Vehicle types with dimensions
var vehicleTypes = {
    bicycle: {
        capacity: { length: 40, width: 30, height: 30, weightLimit: 10 },
        size: "small"
    },
    motorcycle: {
        capacity: { length: 50, width: 40, height: 40, weightLimit: 20 },
        size: "small"
    },
    car: {
        capacity: { length: 100, width: 80, height: 60, weightLimit: 50 },
        size: "medium"
    },
    van: {
        capacity: { length: 200, width: 150, height: 150, weightLimit: 200 },
        size: "large"
    },
    truck: {
        capacity: { length: 400, width: 200, height: 200, weightLimit: 1000 },
        size: "extra_large"
    }
};
// Generate a random route between two locations
var generateRoute = function (start, end, numPoints) {
    if (numPoints === void 0) { numPoints = 5; }
    var route = [start];
    for (var i = 1; i < numPoints - 1; i++) {
        var progress = i / (numPoints - 1);
        // Add some randomness to the route
        var jitter = 0.01; // About 1km jitter
        var lat = start[0] + (end[0] - start[0]) * progress + (Math.random() - 0.5) * jitter;
        var lng = start[1] + (end[1] - start[1]) * progress + (Math.random() - 0.5) * jitter;
        route.push([lat, lng]);
    }
    route.push(end);
    return route;
};
// Generate a random time between 00:00 and 23:59
var randomTime = function () {
    var hours = Math.floor(Math.random() * 24).toString().padStart(2, '0');
    var minutes = Math.floor(Math.random() * 60).toString().padStart(2, '0');
    return "".concat(hours, ":").concat(minutes);
};
// Generate a time window (start, end) with reasonable duration
var randomTimeWindow = function (minHours, maxHours) {
    if (minHours === void 0) { minHours = 1; }
    if (maxHours === void 0) { maxHours = 4; }
    var startHour = Math.floor(Math.random() * 20); // 0-19 to leave room for the window
    var startMinute = Math.floor(Math.random() * 60);
    var durationHours = Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours;
    var endHour = startHour + durationHours;
    var endMinute = startMinute;
    // Format times as strings
    var startTime = "".concat(startHour.toString().padStart(2, '0'), ":").concat(startMinute.toString().padStart(2, '0'));
    var endTime = "".concat(endHour.toString().padStart(2, '0'), ":").concat(endMinute.toString().padStart(2, '0'));
    return [startTime, endTime];
};
// Generate random package dimensions
var randomPackageDimensions = function (size) {
    if (size === void 0) { size = 'medium'; }
    var lengthRange, widthRange, heightRange, weightRange;
    switch (size) {
        case 'small':
            lengthRange = [10, 30];
            widthRange = [10, 20];
            heightRange = [5, 15];
            weightRange = [0.5, 5];
            break;
        case 'large':
            lengthRange = [50, 200];
            widthRange = [40, 100];
            heightRange = [40, 100];
            weightRange = [10, 50];
            break;
        case 'medium':
        default:
            lengthRange = [20, 60];
            widthRange = [15, 40];
            heightRange = [15, 30];
            weightRange = [2, 15];
            break;
    }
    return {
        length: Math.floor(Math.random() * (lengthRange[1] - lengthRange[0] + 1)) + lengthRange[0],
        width: Math.floor(Math.random() * (widthRange[1] - widthRange[0] + 1)) + widthRange[0],
        height: Math.floor(Math.random() * (heightRange[1] - heightRange[0] + 1)) + heightRange[0],
        weight: Math.floor((Math.random() * (weightRange[1] - weightRange[0]) + weightRange[0]) * 10) / 10,
    };
};
// Generate a random schedule for carriers
var randomSchedule = function () {
    var scheduleTypes = [
        { startTime: "06:00", endTime: "14:00" }, // Early shift
        { startTime: "09:00", endTime: "17:00" }, // Regular day shift
        { startTime: "14:00", endTime: "22:00" }, // Late shift
        { startTime: "18:00", endTime: "02:00" }, // Night shift
        { startTime: "08:00", endTime: "20:00" }, // Long day shift
    ];
    return scheduleTypes[Math.floor(Math.random() * scheduleTypes.length)];
};
// Generate random completion history
var randomCompletionHistory = function (count) {
    var completedDeliveries = [];
    for (var i = 0; i < count; i++) {
        completedDeliveries.push("historicDelivery-".concat(Math.floor(Math.random() * 10000)));
    }
    return completedDeliveries;
};
// Create carriers in the database
var createCarriers = function (count) { return __awaiter(void 0, void 0, void 0, function () {
    var carriers, i, vehicleTypeKeys, vehicleType, vehicle, homeLocationIndex, homeLocation, latOffset, lngOffset, lastLocation, destinationIndex, destination, routeCoordinates, rating, onTimeRate, completedDeliveriesCount, carrier, carrierId;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Creating ".concat(count, " carriers..."));
                carriers = [];
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < count)) return [3 /*break*/, 5];
                vehicleTypeKeys = Object.keys(vehicleTypes);
                vehicleType = vehicleTypeKeys[Math.floor(Math.random() * vehicleTypeKeys.length)];
                vehicle = vehicleTypes[vehicleType];
                homeLocationIndex = Math.floor(Math.random() * locations.length);
                homeLocation = locations[homeLocationIndex];
                latOffset = (Math.random() - 0.5) * 0.05;
                lngOffset = (Math.random() - 0.5) * 0.05;
                lastLocation = {
                    latitude: homeLocation.coords[0] + latOffset,
                    longitude: homeLocation.coords[1] + lngOffset
                };
                destinationIndex = (homeLocationIndex + 1 + Math.floor(Math.random() * (locations.length - 1))) % locations.length;
                destination = locations[destinationIndex];
                routeCoordinates = generateRoute([lastLocation.latitude, lastLocation.longitude], [destination.coords[0], destination.coords[1]], Math.floor(Math.random() * 6) + 5);
                rating = Math.round((Math.random() * 2 + 3) * 10) / 10;
                onTimeRate = Math.round((Math.random() * 30 + 70)) / 100;
                completedDeliveriesCount = Math.floor(Math.random() * 101);
                carrier = {
                    name: "Carrier ".concat(i + 1),
                    email: "carrier".concat(i + 1, "@example.com"),
                    phone: "555-".concat(Math.floor(1000 + Math.random() * 9000)),
                    vehicleType: vehicleType,
                    vehicleSize: vehicle.size,
                    vehicleCapacity: vehicle.capacity,
                    lastLocation: lastLocation,
                    homeLocation: {
                        latitude: homeLocation.coords[0],
                        longitude: homeLocation.coords[1],
                        city: homeLocation.city
                    },
                    routeCoordinates: routeCoordinates,
                    schedule: randomSchedule(),
                    rating: rating,
                    onTimeRate: onTimeRate,
                    completedDeliveries: randomCompletionHistory(completedDeliveriesCount),
                    active: Math.random() > 0.2, // 80% active
                    available: Math.random() > 0.3, // 70% available
                    role: 'carrier',
                    createdAt: database_1.FieldValue.serverTimestamp(),
                    updatedAt: database_1.FieldValue.serverTimestamp()
                };
                carrierId = "carrier-".concat(i + 1);
                return [4 /*yield*/, database_1.db.collection('carriers').doc(carrierId).set(carrier)];
            case 2:
                _a.sent();
                carriers.push(__assign({ id: carrierId }, carrier));
                // Also create a user record
                return [4 /*yield*/, database_1.db.collection('users').doc(carrierId).set({
                        name: carrier.name,
                        email: carrier.email,
                        phone: carrier.phone,
                        role: 'carrier',
                        active: carrier.active,
                        createdAt: database_1.FieldValue.serverTimestamp(),
                        updatedAt: database_1.FieldValue.serverTimestamp()
                    })];
            case 3:
                // Also create a user record
                _a.sent();
                _a.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 1];
            case 5:
                console.log("Created ".concat(carriers.length, " carriers"));
                return [2 /*return*/, carriers];
        }
    });
}); };
// Create packages in the database
var createPackages = function (count) { return __awaiter(void 0, void 0, void 0, function () {
    var packages, packageSizes, packageUrgencies, i, pickupLocationIndex, pickupLocation, deliveryLocationIndex, deliveryLocation, pickupLatOffset, pickupLngOffset, deliveryLatOffset, deliveryLngOffset, size, dimensions, urgency, pickupWindow, R, dLat, dLon, a, c, distance, pickupEndParts, deliveryStartHour, deliveryStartMinute, deliveryStartTime, deliveryWindow, statuses, statusWeights, statusIndex, randomValue, cumulativeWeight, j, status_1, pkg, packageId, route;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Creating ".concat(count, " packages..."));
                packages = [];
                packageSizes = ['small', 'medium', 'large'];
                packageUrgencies = ['low', 'medium', 'high'];
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < count)) return [3 /*break*/, 5];
                pickupLocationIndex = Math.floor(Math.random() * locations.length);
                pickupLocation = locations[pickupLocationIndex];
                deliveryLocationIndex = void 0;
                do {
                    deliveryLocationIndex = Math.floor(Math.random() * locations.length);
                } while (deliveryLocationIndex === pickupLocationIndex);
                deliveryLocation = locations[deliveryLocationIndex];
                pickupLatOffset = (Math.random() - 0.5) * 0.05;
                pickupLngOffset = (Math.random() - 0.5) * 0.05;
                deliveryLatOffset = (Math.random() - 0.5) * 0.05;
                deliveryLngOffset = (Math.random() - 0.5) * 0.05;
                size = packageSizes[Math.floor(Math.random() * packageSizes.length)];
                dimensions = randomPackageDimensions(size);
                urgency = packageUrgencies[Math.floor(Math.random() * packageUrgencies.length)];
                pickupWindow = randomTimeWindow(2, 4);
                R = 6371;
                dLat = (deliveryLocation.coords[0] - pickupLocation.coords[0]) * Math.PI / 180;
                dLon = (deliveryLocation.coords[1] - pickupLocation.coords[1]) * Math.PI / 180;
                a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(pickupLocation.coords[0] * Math.PI / 180) * Math.cos(deliveryLocation.coords[0] * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                distance = R * c;
                pickupEndParts = pickupWindow[1].split(':');
                deliveryStartHour = parseInt(pickupEndParts[0]) + Math.max(1, Math.min(5, Math.ceil(distance / 100)));
                deliveryStartMinute = parseInt(pickupEndParts[1]);
                // Handle overflow to next day
                if (deliveryStartHour >= 24) {
                    deliveryStartHour -= 24;
                }
                deliveryStartTime = "".concat(deliveryStartHour.toString().padStart(2, '0'), ":").concat(deliveryStartMinute.toString().padStart(2, '0'));
                deliveryWindow = [deliveryStartTime, "".concat((deliveryStartHour + 3).toString().padStart(2, '0'), ":").concat(deliveryStartMinute.toString().padStart(2, '0'))];
                statuses = ['ready_for_pickup', 'in_transit', 'delivered'];
                statusWeights = [0.7, 0.2, 0.1];
                statusIndex = 0;
                randomValue = Math.random();
                cumulativeWeight = 0;
                for (j = 0; j < statuses.length; j++) {
                    cumulativeWeight += statusWeights[j];
                    if (randomValue <= cumulativeWeight) {
                        statusIndex = j;
                        break;
                    }
                }
                status_1 = statuses[statusIndex];
                pkg = {
                    pickupLocation: {
                        latitude: pickupLocation.coords[0] + pickupLatOffset,
                        longitude: pickupLocation.coords[1] + pickupLngOffset,
                        city: pickupLocation.city,
                        address: "".concat(Math.floor(Math.random() * 1000) + 100, " Main St, ").concat(pickupLocation.city)
                    },
                    deliveryLocation: {
                        latitude: deliveryLocation.coords[0] + deliveryLatOffset,
                        longitude: deliveryLocation.coords[1] + deliveryLngOffset,
                        city: deliveryLocation.city,
                        address: "".concat(Math.floor(Math.random() * 1000) + 100, " Broadway, ").concat(deliveryLocation.city)
                    },
                    pickupWindow: pickupWindow,
                    deliveryWindow: deliveryWindow,
                    dimensions: dimensions,
                    packageWeight: dimensions.weight,
                    urgency: urgency,
                    distance: distance,
                    status: status_1,
                    matched: status_1 !== 'ready_for_pickup' || Math.random() > 0.7, // 30% of ready packages are matched
                    createdAt: database_1.FieldValue.serverTimestamp(),
                    updatedAt: database_1.FieldValue.serverTimestamp()
                };
                packageId = "package-".concat(i + 1);
                return [4 /*yield*/, database_1.db.collection('packages').doc(packageId).set(pkg)];
            case 2:
                _a.sent();
                packages.push(__assign({ id: packageId }, pkg));
                if (!(pkg.matched || status_1 !== 'ready_for_pickup')) return [3 /*break*/, 4];
                route = {
                    packageId: packageId,
                    pickupLocation: pkg.pickupLocation,
                    deliveryLocation: pkg.deliveryLocation,
                    distance: pkg.distance,
                    estimatedDuration: Math.ceil(pkg.distance / 60 * 60), // minutes, assuming 60 km/h average speed
                    waypoints: generateRoute([pkg.pickupLocation.latitude, pkg.pickupLocation.longitude], [pkg.deliveryLocation.latitude, pkg.deliveryLocation.longitude], Math.floor(Math.random() * 6) + 5),
                    createdAt: database_1.FieldValue.serverTimestamp(),
                    updatedAt: database_1.FieldValue.serverTimestamp()
                };
                return [4 /*yield*/, database_1.db.collection('routes').doc("route-".concat(packageId)).set(route)];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 1];
            case 5:
                console.log("Created ".concat(packages.length, " packages"));
                return [2 /*return*/, packages];
        }
    });
}); };
// Create historical matches with feedback for training
var createHistoricalMatches = function (carriers, packages, count) { return __awaiter(void 0, void 0, void 0, function () {
    var matches, i, carrier, pkg, successful, status_2, carrierLocation, pickupLocation, R, dLat, dLon, a, c, distance, baseRate, distanceRate, weightRate, urgencyMultiplier, compensation, match, matchId;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Creating ".concat(count, " historical matches..."));
                matches = [];
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < count)) return [3 /*break*/, 8];
                carrier = carriers[Math.floor(Math.random() * carriers.length)];
                pkg = packages[Math.floor(Math.random() * packages.length)];
                successful = Math.random() > 0.2;
                status_2 = successful ? 'completed' : 'rejected';
                carrierLocation = carrier.lastLocation;
                pickupLocation = pkg.pickupLocation;
                R = 6371;
                dLat = (pickupLocation.latitude - carrierLocation.latitude) * Math.PI / 180;
                dLon = (pickupLocation.longitude - carrierLocation.longitude) * Math.PI / 180;
                a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(carrierLocation.latitude * Math.PI / 180) * Math.cos(pickupLocation.latitude * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                distance = R * c;
                baseRate = 50;
                distanceRate = 10;
                weightRate = 5;
                urgencyMultiplier = 1;
                if (pkg.urgency === 'high') {
                    urgencyMultiplier = 1.5;
                }
                else if (pkg.urgency === 'medium') {
                    urgencyMultiplier = 1.2;
                }
                compensation = Math.round((baseRate + distance * distanceRate + pkg.packageWeight * weightRate) * urgencyMultiplier);
                match = {
                    packageId: pkg.id,
                    carrierId: carrier.id,
                    status: status_2,
                    score: Math.random() * 0.5 + (successful ? 0.5 : 0), // Higher scores for successful matches
                    detourDistance: distance,
                    detourTime: Math.ceil(distance / 30 * 60), // minutes, assuming 30 km/h for detour
                    carrierPayoutAmount: compensation,
                    platformFeeAmount: Math.round(compensation * 0.15), // 15% platform fee
                    createdAt: database_1.FieldValue.serverTimestamp(),
                    updatedAt: database_1.FieldValue.serverTimestamp(),
                    completedAt: successful ? database_1.FieldValue.serverTimestamp() : null
                };
                matchId = "match-".concat(i + 1);
                return [4 /*yield*/, database_1.db.collection('matches').doc(matchId).set(match)];
            case 2:
                _a.sent();
                if (!successful) return [3 /*break*/, 4];
                return [4 /*yield*/, database_1.db.collection('match_feedback').doc(matchId).set({
                        success: true,
                        feedback: "Delivery completed successfully",
                        rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars for successful deliveries
                        createdAt: database_1.FieldValue.serverTimestamp()
                    })];
            case 3:
                _a.sent();
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, database_1.db.collection('match_feedback').doc(matchId).set({
                    success: false,
                    feedback: "Carrier rejected the delivery",
                    createdAt: database_1.FieldValue.serverTimestamp()
                })];
            case 5:
                _a.sent();
                _a.label = 6;
            case 6:
                matches.push(__assign({ id: matchId }, match));
                _a.label = 7;
            case 7:
                i++;
                return [3 /*break*/, 1];
            case 8:
                console.log("Created ".concat(matches.length, " historical matches"));
                return [2 /*return*/, matches];
        }
    });
}); };
// Generate structured training data for the model
var generateTrainingData = function (matches) { return __awaiter(void 0, void 0, void 0, function () {
    var trainingData, _i, matches_1, match, packageDoc, carrierDoc, packageData, carrierData, packageForML, carrierForML, success, feedbackDoc, error_1, dataDir, trainingDataPath;
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                console.log("Generating training data for the ML model...");
                trainingData = [];
                _i = 0, matches_1 = matches;
                _j.label = 1;
            case 1:
                if (!(_i < matches_1.length)) return [3 /*break*/, 9];
                match = matches_1[_i];
                return [4 /*yield*/, database_1.db.collection('packages').doc(match.packageId).get()];
            case 2:
                packageDoc = _j.sent();
                return [4 /*yield*/, database_1.db.collection('carriers').doc(match.carrierId).get()];
            case 3:
                carrierDoc = _j.sent();
                if (!packageDoc.exists || !carrierDoc.exists) {
                    return [3 /*break*/, 8];
                }
                packageData = packageDoc.data();
                carrierData = carrierDoc.data();
                if (!packageData || !carrierData) {
                    console.log("Missing data for match between package ".concat(match.packageId, " and carrier ").concat(match.carrierId));
                    return [3 /*break*/, 8];
                }
                packageForML = {
                    id: match.packageId,
                    pickupCoordinates: [
                        ((_a = packageData.pickupLocation) === null || _a === void 0 ? void 0 : _a.latitude) || 0,
                        ((_b = packageData.pickupLocation) === null || _b === void 0 ? void 0 : _b.longitude) || 0
                    ],
                    deliveryCoordinates: [
                        ((_c = packageData.deliveryLocation) === null || _c === void 0 ? void 0 : _c.latitude) || 0,
                        ((_d = packageData.deliveryLocation) === null || _d === void 0 ? void 0 : _d.longitude) || 0
                    ],
                    pickupWindow: packageData.pickupWindow || ['08:00', '18:00'],
                    deliveryWindow: packageData.deliveryWindow || ['08:00', '18:00'],
                    dimensions: packageData.dimensions || {
                        length: 10,
                        width: 10,
                        height: 10,
                        weight: packageData.packageWeight || 1
                    },
                    urgency: packageData.urgency || 'medium'
                };
                carrierForML = {
                    id: match.carrierId,
                    routeCoordinates: carrierData.routeCoordinates || [
                        [((_e = carrierData.lastLocation) === null || _e === void 0 ? void 0 : _e.latitude) || 0, ((_f = carrierData.lastLocation) === null || _f === void 0 ? void 0 : _f.longitude) || 0]
                    ],
                    schedule: carrierData.schedule || {
                        startTime: '08:00',
                        endTime: '18:00'
                    },
                    vehicleCapacity: carrierData.vehicleCapacity || {
                        length: 100,
                        width: 100,
                        height: 100,
                        weightLimit: 50
                    },
                    rating: carrierData.rating || 0,
                    onTimeRate: carrierData.onTimeRate || 0,
                    completedDeliveries: carrierData.completedDeliveries || [],
                    vehicleType: carrierData.vehicleType || 'car',
                    vehicleSize: carrierData.vehicleSize
                };
                success = match.status === 'completed';
                _j.label = 4;
            case 4:
                _j.trys.push([4, 6, , 7]);
                return [4 /*yield*/, database_1.db.collection('match_feedback').doc(match.id).get()];
            case 5:
                feedbackDoc = _j.sent();
                // Check if the document exists and has data before trying to access it
                if (feedbackDoc && feedbackDoc.exists && feedbackDoc.data()) {
                    success = (_h = (_g = feedbackDoc.data()) === null || _g === void 0 ? void 0 : _g.success) !== null && _h !== void 0 ? _h : success;
                }
                return [3 /*break*/, 7];
            case 6:
                error_1 = _j.sent();
                console.error("Error fetching feedback for match ".concat(match.id, ":"), error_1);
                return [3 /*break*/, 7];
            case 7:
                trainingData.push({
                    package: packageForML,
                    carrier: carrierForML,
                    success: success ? 1 : 0
                });
                _j.label = 8;
            case 8:
                _i++;
                return [3 /*break*/, 1];
            case 9:
                dataDir = path.join(__dirname, '../../data');
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                trainingDataPath = path.join(dataDir, 'matching_history.json');
                fs.writeFileSync(trainingDataPath, JSON.stringify(trainingData, null, 2));
                console.log("Generated training data with ".concat(trainingData.length, " examples"));
                return [2 /*return*/, trainingData];
        }
    });
}); };
// Main function to populate the database and train the model
var populateAndTrain = function () { return __awaiter(void 0, void 0, void 0, function () {
    var carriers, packages, matches, aiMatchingService, trained, randomPackageId, optimalCarriers, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 9, , 10]);
                return [4 /*yield*/, createCarriers(30)];
            case 1:
                carriers = _a.sent();
                return [4 /*yield*/, createPackages(50)];
            case 2:
                packages = _a.sent();
                return [4 /*yield*/, createHistoricalMatches(carriers, packages, 100)];
            case 3:
                matches = _a.sent();
                // Generate training data
                return [4 /*yield*/, generateTrainingData(matches)];
            case 4:
                // Generate training data
                _a.sent();
                aiMatchingService = new intelligentMatchingService_1.default();
                return [4 /*yield*/, aiMatchingService.trainModel()];
            case 5:
                trained = _a.sent();
                if (!trained) return [3 /*break*/, 7];
                console.log("Model trained successfully!");
                randomPackageId = packages[Math.floor(Math.random() * packages.length)].id;
                console.log("Testing model with package ".concat(randomPackageId, "..."));
                return [4 /*yield*/, aiMatchingService.findOptimalCarriers(randomPackageId)];
            case 6:
                optimalCarriers = _a.sent();
                console.log("Found ".concat(optimalCarriers.length, " optimal carriers"));
                console.log(JSON.stringify(optimalCarriers, null, 2));
                return [3 /*break*/, 8];
            case 7:
                console.error("Failed to train the model");
                _a.label = 8;
            case 8: return [3 /*break*/, 10];
            case 9:
                error_2 = _a.sent();
                console.error("Error populating database and training model:", error_2);
                return [3 /*break*/, 10];
            case 10: return [2 /*return*/];
        }
    });
}); };
// Run the script
populateAndTrain().then(function () {
    console.log("Database population and model training completed");
    process.exit(0);
}).catch(function (error) {
    console.error("Script failed:", error);
    process.exit(1);
});
