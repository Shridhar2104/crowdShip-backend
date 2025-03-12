import User from './User';
import CarrierProfile from './CarrierProfile';
import Package from './Packages';
import Route from './Route';
import Match from './Match';
import Payment from './Payment';
import Rating from './Rating';
import Notification from './Notification';

// Define model relationships

// User - CarrierProfile (One-to-One)
User.hasOne(CarrierProfile, {
  foreignKey: 'userId',
  as: 'carrierProfile',
  onDelete: 'CASCADE',
});
CarrierProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// User - Package (Sender) (One-to-Many)
User.hasMany(Package, {
  foreignKey: 'senderId',
  as: 'sentPackages',
});
Package.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender',
});

// User - Package (Carrier) (One-to-Many)
User.hasMany(Package, {
  foreignKey: 'carrierId',
  as: 'deliveredPackages',
});
Package.belongsTo(User, {
  foreignKey: 'carrierId',
  as: 'carrier',
});

// User - Route (One-to-Many)
User.hasMany(Route, {
  foreignKey: 'carrierId',
  as: 'routes',
});
Route.belongsTo(User, {
  foreignKey: 'carrierId',
  as: 'carrier',
});

// User - Match (Carrier) (One-to-Many)
User.hasMany(Match, {
  foreignKey: 'carrierId',
  as: 'matches',
});
Match.belongsTo(User, {
  foreignKey: 'carrierId',
  as: 'carrier',
});

// Package - Match (One-to-Many)
Package.hasMany(Match, {
  foreignKey: 'packageId',
  as: 'matches',
});
Match.belongsTo(Package, {
  foreignKey: 'packageId',
  as: 'package',
});

// Route - Match (One-to-Many)
Route.hasMany(Match, {
  foreignKey: 'routeId',
  as: 'matches',
});
Match.belongsTo(Route, {
  foreignKey: 'routeId',
  as: 'route',
});

// User - Payment (One-to-Many)
User.hasMany(Payment, {
  foreignKey: 'userId',
  as: 'payments',
});
Payment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Package - Payment (One-to-Many)
Package.hasMany(Payment, {
  foreignKey: 'packageId',
  as: 'payments',
});
Payment.belongsTo(Package, {
  foreignKey: 'packageId',
  as: 'package',
});

// Match - Payment (One-to-Many)
Match.hasMany(Payment, {
  foreignKey: 'matchId',
  as: 'payments',
});
Payment.belongsTo(Match, {
  foreignKey: 'matchId',
  as: 'match',
});

// Package - Rating (One-to-Many)
Package.hasMany(Rating, {
  foreignKey: 'packageId',
  as: 'ratings',
});
Rating.belongsTo(Package, {
  foreignKey: 'packageId',
  as: 'package',
});

// User - Rating (From User) (One-to-Many)
User.hasMany(Rating, {
  foreignKey: 'fromUserId',
  as: 'givenRatings',
});
Rating.belongsTo(User, {
  foreignKey: 'fromUserId',
  as: 'fromUser',
});

// User - Rating (To User) (One-to-Many)
User.hasMany(Rating, {
  foreignKey: 'toUserId',
  as: 'receivedRatings',
});
Rating.belongsTo(User, {
  foreignKey: 'toUserId',
  as: 'toUser',
});

// User - Notification (One-to-Many)
User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications',
});
Notification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Package - Notification (One-to-Many)
Package.hasMany(Notification, {
  foreignKey: 'packageId',
  as: 'notifications',
});
Notification.belongsTo(Package, {
  foreignKey: 'packageId',
  as: 'package',
});

// Match - Notification (One-to-Many)
Match.hasMany(Notification, {
  foreignKey: 'matchId',
  as: 'notifications',
});
Notification.belongsTo(Match, {
  foreignKey: 'matchId',
  as: 'match',
});

export {
  User,
  CarrierProfile,
  Package,
  Route,
  Match,
  Payment,
  Rating,
  Notification,
};