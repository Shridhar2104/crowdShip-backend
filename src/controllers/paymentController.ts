// import { Request, Response, NextFunction } from 'express';
// import { Op } from 'sequelize';
// import Payment, { PaymentType, PaymentStatus, PaymentMethod } from '../models/Payment';
// import Package, { PackageStatus } from '../models/Packages';
// import Match from '../models/Match';
// import User from '../models/User';
// import '../models/PaymentMethod';
// import Notification, { NotificationType, NotificationChannel } from '../models/notificationService';
// import {  
//   NotFoundError, 
//   BadRequestError, 
//   InternalServerError,
//   ForbiddenError
// } from '../utils/errorClasses';
// import{logger} from '../utils/logger'
// import { calculateDistance } from '../utils/geoUtils';
// import { stripe } from '../config/stripe';
// import { config } from '../config';
// import { generateUUID } from '../utils/generator';

// /**
//  * Create a payment (admin only)
//  */
// export const createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const {
//       userId,
//       packageId,
//       matchId,
//       transactionId,
//       type,
//       status,
//       amount,
//       currency,
//       method,
//       paymentMethodDetails,
//       processingFee,
//       taxAmount,
//       description,
//       metadata,
//       receiptUrl,
//       paymentDate,
//       dueDate
//     } = req.body;

//     // Validate required fields
//     if (!userId || !type || !amount || !method || !description) {
//       return next(new BadRequestError('Missing required payment information'));
//     }

//     // Validate payment type
//     if (!Object.values(PaymentType).includes(type)) {
//       return next(new BadRequestError(`Invalid payment type. Valid types are: ${Object.values(PaymentType).join(', ')}`));
//     }

//     // Validate payment status
//     if (status && !Object.values(PaymentStatus).includes(status)) {
//       return next(new BadRequestError(`Invalid payment status. Valid statuses are: ${Object.values(PaymentStatus).join(', ')}`));
//     }

//     // Validate payment method
//     if (!Object.values(PaymentMethod).includes(method)) {
//       return next(new BadRequestError(`Invalid payment method. Valid methods are: ${Object.values(PaymentMethod).join(', ')}`));
//     }

//     // Verify user exists
//     const user = await User.findByPk(userId);
//     if (!user) {
//       return next(new NotFoundError('User not found'));
//     }

//     // Verify package exists if packageId is provided
//     if (packageId) {
//       const packageExists = await Package.findByPk(packageId);
//       if (!packageExists) {
//         return next(new NotFoundError('Package not found'));
//       }
//     }

//     // Verify match exists if matchId is provided
//     if (matchId) {
//       const matchExists = await Match.findByPk(matchId);
//       if (!matchExists) {
//         return next(new NotFoundError('Match not found'));
//       }
//     }

//     // Process paymentMethodDetails if it's an object
//     const formattedMethodDetails = typeof paymentMethodDetails === 'string' 
//       ? paymentMethodDetails 
//       : JSON.stringify(paymentMethodDetails || {});

//     // Process metadata if it's an object
//     const formattedMetadata = typeof metadata === 'string' 
//       ? metadata 
//       : JSON.stringify(metadata || {});

//     // Create the payment
//     const payment = await Payment.create({
//       userId,
//       packageId,
//       matchId,
//       transactionId: transactionId || undefined, // Let the model generate one if not provided
//       type,
//       status: status || PaymentStatus.PENDING,
//       amount,
//       currency: currency || 'USD',
//       method,
//       paymentMethodDetails: formattedMethodDetails,
//       processingFee: processingFee || 0,
//       taxAmount: taxAmount || 0,
//       description,
//       metadata: formattedMetadata,
//       receiptUrl,
//       paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
//       dueDate: dueDate ? new Date(dueDate) : undefined
//     });

//     // Create notification for the user
//     await Notification.create({
//       userId,
//       type: NotificationType.PAYMENT_CREATED,
//       title: 'Payment Created',
//       message: `A new payment of ${payment.currency} ${payment.amount} has been created for ${description}`,
//       data: JSON.stringify({ 
//         paymentId: payment.id, 
//         amount: payment.amount,
//         currency: payment.currency,
//         type: payment.type
//       }),
//       isRead: false,
//       isArchived: false,
//       channel: NotificationChannel.IN_APP,
//       sentAt: new Date()
//     });

//     res.status(201).json({
//       success: true,
//       data: payment
//     });
//   } catch (error) {
//     logger.error('Error creating payment:', error);
//     next(new InternalServerError('Failed to create payment'));
//   }
// };

// /**
//  * Get all payments (admin only)
//  */
// export const getAllPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const { 
//       type,
//       status,
//       method,
//       startDate,
//       endDate,
//       minAmount,
//       maxAmount,
//       page = 1,
//       limit = 10
//     } = req.query;

//     // Build query conditions
//     const conditions: any = {};

//     // Filter by type
//     if (type) {
//       conditions.type = type;
//     }

//     // Filter by status
//     if (status) {
//       conditions.status = status;
//     }

//     // Filter by method
//     if (method) {
//       conditions.method = method;
//     }

//     // Filter by date range
//     if (startDate) {
//       conditions.paymentDate = { ...conditions.paymentDate, [Op.gte]: new Date(startDate as string) };
//     }

//     if (endDate) {
//       conditions.paymentDate = { ...conditions.paymentDate, [Op.lte]: new Date(endDate as string) };
//     }

//     // Filter by amount range
//     if (minAmount) {
//       conditions.amount = { ...conditions.amount, [Op.gte]: Number(minAmount) };
//     }

//     if (maxAmount) {
//       conditions.amount = { ...conditions.amount, [Op.lte]: Number(maxAmount) };
//     }

//     // Calculate pagination
//     const offset = (Number(page) - 1) * Number(limit);

//     // Execute the query
//     const { count, rows: payments } = await Payment.findAndCountAll({
//       where: conditions,
//       limit: Number(limit),
//       offset,
//       order: [['paymentDate', 'DESC']]
//     });

//     res.status(200).json({
//       success: true,
//       count,
//       totalPages: Math.ceil(count / Number(limit)),
//       currentPage: Number(page),
//       data: payments
//     });
//   } catch (error) {
//     logger.error('Error fetching payments:', error);
//     next(new InternalServerError('Failed to fetch payments'));
//   }
// };

// /**
//  * Get current user's payments
//  */
// export const getUserPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = req.user.id;
//     const { 
//       type,
//       status,
//       startDate,
//       endDate,
//       page = 1,
//       limit = 10
//     } = req.query;

//     // Build query conditions
//     const conditions: any = { userId };

//     // Filter by type
//     if (type) {
//       conditions.type = type;
//     }

//     // Filter by status
//     if (status) {
//       conditions.status = status;
//     }

//     // Filter by date range
//     if (startDate) {
//       conditions.paymentDate = { ...conditions.paymentDate, [Op.gte]: new Date(startDate as string) };
//     }

//     if (endDate) {
//       conditions.paymentDate = { ...conditions.paymentDate, [Op.lte]: new Date(endDate as string) };
//     }

//     // Calculate pagination
//     const offset = (Number(page) - 1) * Number(limit);

//     // Execute the query
//     const { count, rows: payments } = await Payment.findAndCountAll({
//       where: conditions,
//       limit: Number(limit),
//       offset,
//       order: [['paymentDate', 'DESC']]
//     });

//     res.status(200).json({
//       success: true,
//       count,
//       totalPages: Math.ceil(count / Number(limit)),
//       currentPage: Number(page),
//       data: payments
//     });
//   } catch (error) {
//     logger.error('Error fetching user payments:', error);
//     next(new InternalServerError('Failed to fetch user payments'));
//   }
// };

// /**
//  * Get payment by ID
//  */
// export const getPaymentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const paymentId = req.params.id;
//     const userId = req.user.id;
//     const userRole = req.user.role;

//     // Find the payment
//     const payment = await Payment.findByPk(paymentId);

//     if (!payment) {
//       return next(new NotFoundError('Payment not found'));
//     }

//     // Check if user has access to this payment
//     if (userRole !== 'admin' && payment.userId !== userId) {
//       if (payment.packageId) {
//         // Check if user is the sender of the package
//         const packageItem = await Package.findByPk(payment.packageId);
//         if (!packageItem || packageItem.senderId !== userId) {
//           return next(new ForbiddenError('You do not have permission to access this payment'));
//         }
//       } else if (payment.matchId) {
//         // Check if user is the carrier in the match
//         const match = await Match.findByPk(payment.matchId);
//         if (!match || match.carrierId !== userId) {
//           return next(new ForbiddenError('You do not have permission to access this payment'));
//         }
//       } else {
//         return next(new ForbiddenError('You do not have permission to access this payment'));
//       }
//     }

//     res.status(200).json({
//       success: true,
//       data: payment
//     });
//   } catch (error) {
//     logger.error(`Error fetching payment ${req.params.id}:`, error);
//     next(new InternalServerError('Failed to fetch payment'));
//   }
// };

// /**
//  * Process payment for a package
//  */
// export const processPackagePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const packageId = req.params.packageId;
//     const userId = req.user.id;
//     const { paymentMethodId } = req.body;

//     if (!paymentMethodId) {
//       return next(new BadRequestError('Payment method ID is required'));
//     }

//     // Find the package
//     const packageItem = await Package.findByPk(packageId);

//     if (!packageItem) {
//       return next(new NotFoundError('Package not found'));
//     }

//     // Check if user is the sender of this package
//     if (packageItem.senderId !== userId) {
//       return next(new ForbiddenError('You are not authorized to make payment for this package'));
//     }

//     // Check if package is already paid
//     const existingPayment = await Payment.findOne({
//       where: {
//         packageId,
//         type: PaymentType.PACKAGE_PAYMENT,
//         status: PaymentStatus.COMPLETED
//       }
//     });

//     if (existingPayment) {
//       return next(new BadRequestError('Payment for this package has already been processed'));
//     }

//     // Get user to retrieve Stripe customer ID
//     const user = await User.findByPk(userId);
//     if (!user || !user.stripeCustomerId) {
//       return next(new BadRequestError('User Stripe customer ID not found'));
//     }

//     // Calculate amount in cents
//     const amountInCents = Math.round(packageItem.price * 100);

//     try {
//       // Process payment with Stripe
//       const paymentIntent = await stripe.paymentIntents.create({
//         amount: amountInCents,
//         currency: 'usd',
//         customer: user.stripeCustomerId,
//         payment_method: paymentMethodId,
//         off_session: true,
//         confirm: true,
//         description: `Payment for package ${packageItem.title} (ID: ${packageId})`,
//         metadata: {
//           packageId,
//           userId
//         }
//       });

//       // Create payment record
//       const payment = await Payment.create({
//         userId,
//         packageId,
//         transactionId: paymentIntent.id,
//         type: PaymentType.PACKAGE_PAYMENT,
//         status: paymentIntent.status === 'succeeded' ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
//         amount: packageItem.price,
//         currency: 'USD',
//         method: PaymentMethod.CREDIT_CARD, // Assuming credit card
//         paymentMethodDetails: JSON.stringify({
//           last4: paymentMethodId.substr(paymentMethodId.length - 4),
//           brand: 'card', // This would be better if retrieved from the actual payment method
//           paymentMethodId
//         }),
//         processingFee: (packageItem.price * 0.029) + 0.30, // Example Stripe fee
//         taxAmount: 0, // Tax calculation would go here
//         description: `Payment for package ${packageItem.title}`,
//         metadata: JSON.stringify({
//           stripePaymentIntentId: paymentIntent.id,
//           packageTitle: packageItem.title
//         }),
//         receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
//         paymentDate: new Date(),
//         completedAt: paymentIntent.status === 'succeeded' ? new Date() : undefined
//       });

//       // If payment succeeded, update package status
//       if (paymentIntent.status === 'succeeded') {
//         await packageItem.update({
//           status: PackageStatus.PENDING // or the appropriate status after payment
//         });

//         // Create notification for the user
//         await Notification.create({
//           userId,
//           type: NotificationType.PAYMENT_COMPLETED,
//           title: 'Payment Successful',
//           message: `Your payment of $${packageItem.price} for package ${packageItem.title} was successful`,
//           data: JSON.stringify({ 
//             paymentId: payment.id, 
//             packageId: packageItem.id,
//             amount: payment.amount
//           }),
//           isRead: false,
//           isArchived: false,
//           channel: NotificationChannel.IN_APP,
//           packageId: packageItem.id,
//           sentAt: new Date()
//         });
//       }

//       res.status(200).json({
//         success: true,
//         data: payment,
//         paymentIntent: {
//           id: paymentIntent.id,
//           status: paymentIntent.status,
//           client_secret: paymentIntent.client_secret
//         }
//       });
//     } catch (stripeError: any) {
//       // Handle Stripe errors
//       logger.error('Stripe payment processing error:', stripeError);

//       // Create failed payment record
//       await Payment.create({
//         userId,
//         packageId,
//         transactionId: stripeError.payment_intent?.id || `failed-${generateUUID()}`,
//         type: PaymentType.PACKAGE_PAYMENT,
//         status: PaymentStatus.FAILED,
//         amount: packageItem.price,
//         currency: 'USD',
//         method: PaymentMethod.CREDIT_CARD,
//         paymentMethodDetails: JSON.stringify({
//           paymentMethodId
//         }),
//         processingFee: 0,
//         taxAmount: 0,
//         description: `Failed payment for package ${packageItem.title}`,
//         errorMessage: stripeError.message,
//         metadata: JSON.stringify({
//           stripeError: stripeError.message,
//           stripeCode: stripeError.code
//         }),
//         paymentDate: new Date()
//       });

//       // Create notification for payment failure
//       await Notification.create({
//         userId,
//         type: NotificationType.PAYMENT_FAILED,
//         title: 'Payment Failed',
//         message: `Your payment for package ${packageItem.title} failed: ${stripeError.message}`,
//         data: JSON.stringify({ 
//           packageId: packageItem.id,
//           error: stripeError.message
//         }),
//         isRead: false,
//         isArchived: false,
//         channel: NotificationChannel.IN_APP,
//         packageId: packageItem.id,
//         sentAt: new Date()
//       });

//       return next(new BadRequestError(`Payment processing failed: ${stripeError.message}`));
//     }
//   } catch (error) {
//     logger.error(`Error processing payment for package ${req.params.packageId}:`, error);
//     next(new InternalServerError('Failed to process payment'));
//   }
// };

// /**
//  * Process payout for a carrier (admin only)
//  */
// export const processCarrierPayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const matchId = req.params.matchId;

//     // Find the match
//     const match = await Match.findByPk(matchId);

//     if (!match) {
//       return next(new NotFoundError('Match not found'));
//     }

//     // Find the package associated with the match
//     const packageItem = await Package.findByPk(match.packageId);

//     if (!packageItem) {
//       return next(new NotFoundError('Package not found'));
//     }

//     // Check if carrier payout has already been processed
//     const existingPayout = await Payment.findOne({
//       where: {
//         matchId,
//         type: PaymentType.CARRIER_PAYOUT,
//         status: PaymentStatus.COMPLETED
//       }
//     });

//     if (existingPayout) {
//       return next(new BadRequestError('Payout for this match has already been processed'));
//     }

//     // Check if package delivery has been completed
//     if (packageItem.status !== PackageStatus.DELIVERED) {
//       return next(new BadRequestError('Package delivery must be completed before processing carrier payout'));
//     }

//     // Get carrier to retrieve Stripe connect account ID
//     const carrier = await User.findByPk(match.carrierId);
//     if (!carrier || !carrier.stripeConnectAccountId) {
//       return next(new BadRequestError('Carrier Stripe connect account ID not found'));
//     }

//     // Calculate payout amount in cents
//     const payoutAmountInCents = Math.round(packageItem.carrierPayoutAmount * 100);

//     try {
//       // Process transfer with Stripe
//       const transfer = await stripe.transfers.create({
//         amount: payoutAmountInCents,
//         currency: 'usd',
//         destination: carrier.stripeConnectAccountId,
//         description: `Payout for delivering package ${packageItem.title} (ID: ${packageItem.id})`,
//         metadata: {
//           matchId,
//           packageId: packageItem.id,
//           carrierId: match.carrierId
//         }
//       });

//       // Create payment record
//       const payment = await Payment.create({
//         userId: match.carrierId,
//         packageId: packageItem.id,
//         matchId,
//         transactionId: transfer.id,
//         type: PaymentType.CARRIER_PAYOUT,
//         status: PaymentStatus.COMPLETED,
//         amount: packageItem.carrierPayoutAmount,
//         currency: 'USD',
//         method: PaymentMethod.BANK_TRANSFER,
//         paymentMethodDetails: JSON.stringify({
//           destinationAccountId: carrier.stripeConnectAccountId
//         }),
//         processingFee: 0, // Platform absorbs fees
//         taxAmount: 0, // Tax calculation would go here
//         description: `Payout for delivering package ${packageItem.title}`,
//         metadata: JSON.stringify({
//           stripeTransferId: transfer.id,
//           packageTitle: packageItem.title
//         }),
//         paymentDate: new Date(),
//         completedAt: new Date()
//       });

//       // Create notification for the carrier
//       await Notification.create({
//         userId: match.carrierId,
//         type: NotificationType.PAYOUT_SENT,
//         title: 'Payout Processed',
//         message: `Your payout of $${packageItem.carrierPayoutAmount} for delivering package ${packageItem.title} has been processed`,
//         data: JSON.stringify({ 
//           paymentId: payment.id, 
//           packageId: packageItem.id,
//           matchId,
//           amount: payment.amount
//         }),
//         isRead: false,
//         isArchived: false,
//         channel: NotificationChannel.IN_APP,
//         packageId: packageItem.id,
//         matchId,
//         sentAt: new Date()
//       });

//       res.status(200).json({
//         success: true,
//         data: payment,
//         transfer: {
//           id: transfer.id,
//           amount: transfer.amount / 100, // Convert back to dollars
//           status: transfer.status
//         }
//       });
//     } catch (stripeError: any) {
//       // Handle Stripe errors
//       logger.error('Stripe transfer processing error:', stripeError);

//       // Create failed payment record
//       await Payment.create({
//         userId: match.carrierId,
//         packageId: packageItem.id,
//         matchId,
//         transactionId: `failed-${generateUUID()}`,
//         type: PaymentType.CARRIER_PAYOUT,
//         status: PaymentStatus.FAILED,
//         amount: packageItem.carrierPayoutAmount,
//         currency: 'USD',
//         method: PaymentMethod.BANK_TRANSFER,
//         paymentMethodDetails: JSON.stringify({
//           destinationAccountId: carrier.stripeConnectAccountId
//         }),
//         processingFee: 0,
//         taxAmount: 0,
//         description: `Failed payout for delivering package ${packageItem.title}`,
//         errorMessage: stripeError.message,
//         metadata: JSON.stringify({
//           stripeError: stripeError.message,
//           stripeCode: stripeError.code
//         }),
//         paymentDate: new Date()
//       });

//       // Create notification for payout failure
//       await Notification.create({
//         userId: match.carrierId,
//         type: NotificationType.PAYOUT_FAILED,
//         title: 'Payout Failed',
//         message: `Your payout for delivering package ${packageItem.title} failed: ${stripeError.message}`,
//         data: JSON.stringify({ 
//           packageId: packageItem.id,
//           matchId,
//           error: stripeError.message
//         }),
//         isRead: false,
//         isArchived: false,
//         channel: NotificationChannel.IN_APP,
//         packageId: packageItem.id,
//         matchId,
//         sentAt: new Date()
//       });

//       return next(new BadRequestError(`Payout processing failed: ${stripeError.message}`));
//     }
//   } catch (error) {
//     logger.error(`Error processing carrier payout for match ${req.params.matchId}:`, error);
//     next(new InternalServerError('Failed to process carrier payout'));
//   }
// };

// /**
//  * Refund a payment (admin only)
//  */
// export const refundPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const paymentId = req.params.id;
//     const { amount, reason } = req.body;

//     // Validate input
//     if (!reason) {
//       return next(new BadRequestError('Refund reason is required'));
//     }

//     // Find the payment
//     const payment = await Payment.findByPk(paymentId);

//     if (!payment) {
//       return next(new NotFoundError('Payment not found'));
//     }

//     // Verify this is a payment that can be refunded
//     if (payment.type !== PaymentType.PACKAGE_PAYMENT) {
//       return next(new BadRequestError('Only package payments can be refunded'));
//     }

//     // Check if payment is already refunded
//     if (payment.status === PaymentStatus.REFUNDED) {
//       return next(new BadRequestError('Payment has already been fully refunded'));
//     }

//     // Check if payment was successful
//     if (payment.status !== PaymentStatus.COMPLETED) {
//       return next(new BadRequestError(`Cannot refund a payment with status ${payment.status}`));
//     }

//     // Get the Stripe payment intent ID from the transaction ID
//     const stripePaymentIntentId = payment.transactionId;

//     // Determine refund amount
//     const refundAmount = amount ? Math.min(Number(amount), payment.amount) : payment.amount;
//     const refundAmountInCents = Math.round(refundAmount * 100);

//     try {
//       // Process refund with Stripe
//       const refund = await stripe.refunds.create({
//         payment_intent: stripePaymentIntentId,
//         amount: refundAmountInCents,
//         reason: 'requested_by_customer', // Stripe accepts: 'duplicate', 'fraudulent', 'requested_by_customer'
//         metadata: {
//           originalPaymentId: payment.id,
//           reason
//         }
//       });

//       // Update the original payment
//       const newStatus = refundAmount === payment.amount 
//         ? PaymentStatus.REFUNDED 
//         : PaymentStatus.PARTIALLY_REFUNDED;

//       await payment.update({
//         status: newStatus,
//         refundedAmount: refundAmount,
//         refundReason: reason,
//         refundTransactionId: refund.id
//       });

//       // Create a refund payment record
//       const refundPayment = await Payment.create({
//         userId: payment.userId,
//         packageId: payment.packageId,
//         matchId: payment.matchId,
//         transactionId: refund.id,
//         type: PaymentType.REFUND,
//         status: PaymentStatus.COMPLETED,
//         amount: refundAmount,
//         currency: payment.currency,
//         method: payment.method,
//         paymentMethodDetails: payment.paymentMethodDetails,
//         processingFee: 0,
//         taxAmount: 0,
//         description: `Refund for payment ${payment.id}: ${reason}`,
//         metadata: JSON.stringify({
//           originalPaymentId: payment.id,
//           stripeRefundId: refund.id,
//           reason
//         }),
//         paymentDate: new Date(),
//         completedAt: new Date()
//       });

//       // Create notification for the user
//       await Notification.create({
//         userId: payment.userId,
//         type: NotificationType.PAYMENT_REFUNDED,
//         title: 'Payment Refunded',
//         message: `Your payment of ${payment.currency} ${refundAmount} has been refunded: ${reason}`,
//         data: JSON.stringify({ 
//           originalPaymentId: payment.id, 
//           refundPaymentId: refundPayment.id,
//           amount: refundAmount,
//           reason
//         }),
//         isRead: false,
//         isArchived: false,
//         channel: NotificationChannel.IN_APP,
//         packageId: payment.packageId,
//         sentAt: new Date()
//       });

//       // If there's a package associated with the payment and it's a full refund, update package status
//       if (payment.packageId && newStatus === PaymentStatus.REFUNDED) {
//         const packageItem = await Package.findByPk(payment.packageId);
//         if (packageItem && packageItem.status !== PackageStatus.DELIVERED) {
//           await packageItem.update({
//             status: PackageStatus.CANCELLED
//           });
//         }
//       }

//       res.status(200).json({
//         success: true,
//         data: {
//           originalPayment: payment,
//           refundPayment,
//           refund: {
//             id: refund.id,
//             amount: refund.amount / 100, // Convert back to dollars
//             status: refund.status
//           }
//         }
//       });
//     } catch (stripeError: any) {
//       // Handle Stripe errors
//       logger.error('Stripe refund processing error:', stripeError);
//       return next(new BadRequestError(`Refund processing failed: ${stripeError.message}`));
//     }
//   } catch (error) {
//     logger.error(`Error refunding payment ${req.params.id}:`, error);
//     next(new InternalServerError('Failed to process refund'));
//   }
// };

// /**
//  * Calculate delivery price
//  */
// export const calculatePrice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const {
//       pickupLatitude,
//       pickupLongitude,
//       deliveryLatitude,
//       deliveryLongitude,
//       size,
//       weight,
//       isFragile,
//       requireSignature,
//       isInsured,
//       declaredValue
//     } = req.body;

//     // Validate required fields
//     if (!pickupLatitude || !pickupLongitude || !deliveryLatitude || !deliveryLongitude || !size || !weight) {
//       return next(new BadRequestError('Missing required information for price calculation'));
//     }

//     // Calculate distance
//     const distance = calculateDistance(
//       pickupLatitude,
//       pickupLongitude,
//       deliveryLatitude,
//       deliveryLongitude
//     );

//     // Calculate base price based on distance
//     let basePrice = 5 + (distance * 0.5);

//     // Add size multiplier
//     const sizeMultiplier = {
//       'small': 1,
//       'medium': 1.5,
//       'large': 2,
//       'extra_large': 3
//     };

//     if (!(size in sizeMultiplier)) {
//       return next(new BadRequestError('Invalid package size'));
//     }

//     basePrice *= sizeMultiplier[size as keyof typeof sizeMultiplier];

//     // Add weight factor
//     basePrice += weight * 1;

//     // Add fragile handling fee
//     if (isFragile) {
//       basePrice += 2;
//     }

//     // Add signature required fee
//     if (requireSignature) {
//       basePrice += 1.5;
//     }

//     // Calculate insurance cost if requested
//     let insuranceCost = 0;
//     if (isInsured && declaredValue) {
//       insuranceCost = Math.round(declaredValue * 0.05 * 100) / 100; // 5% of declared value
//       basePrice += insuranceCost;
//     }

//     // Calculate platform commission
//     const commissionRate = 0.15;
//     const commissionAmount = Math.round(basePrice * commissionRate * 100) / 100;

//     // Calculate carrier payout
//     const carrierPayoutAmount = Math.round((basePrice - commissionAmount) * 100) / 100;

//     // Round total price to 2 decimal places
//     basePrice = Math.round(basePrice * 100) / 100;

//     res.status(200).json({
//       success: true,
//       data: {
//         distance,
//         price: basePrice,
//         commissionAmount,
//         carrierPayoutAmount,
//         insuranceCost: isInsured ? insuranceCost : 0,
//         breakdown: {
//           baseDistance: 5,
//           distanceCharge: distance * 0.5,
//           sizeMultiplier: sizeMultiplier[size as keyof typeof sizeMultiplier],
//           weightCharge: weight * 1,
//           fragileHandling: isFragile ? 2 : 0,
//           signatureRequired: requireSignature ? 1.5 : 0,
//           insurance: isInsured ? insuranceCost : 0
//         }
//       }
//     });
//   } catch (error) {
//     logger.error('Error calculating delivery price:', error);
//     next(new InternalServerError('Failed to calculate delivery price'));
//   }
// };

// /**
//  * Handle Stripe webhook events
//  */
// export const stripeWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   const sig = req.headers['stripe-signature'] as string;

//   let event;

//   try {
//     // Verify the event came from Stripe
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       config.stripe.webhookSecret
//     );

//     // Handle the event
//     switch (event.type) {
//       case 'payment_intent.succeeded':
//         await handlePaymentIntentSucceeded(event.data.object);
//         break;
//       case 'payment_intent.payment_failed':
//         await handlePaymentIntentFailed(event.data.object);
//         break;
//       case 'transfer.created':
//         await handleTransferCreated(event.data.object);
//         break;
//       case 'transfer.failed':
//         await handleTransferFailed(event.data.object);
//         break;
//       case 'charge.refunded':
//         await handleChargeRefunded(event.data.object);
//         break;
//       default:
//         // Unexpected event type
//         logger.info(`Unhandled event type: ${event.type}`);
//     }

//     // Return a 200 response to acknowledge receipt of the event
//     res.status(200).json({ received: true });
//   } catch (err: any) {
//     logger.error('Stripe webhook error:', err);
//     res.status(400).json({ error: `Webhook Error: ${err.message}` });
//   }
// };

// /**
//  * Handle successful payment intent
//  */
// const handlePaymentIntentSucceeded = async (paymentIntent: any) => {
//   try {
//     const { packageId, userId } = paymentIntent.metadata;

//     if (!packageId || !userId) {
//       logger.warn('Payment intent succeeded but missing metadata:', paymentIntent.id);
//       return;
//     }

//     // Find existing payment record
//     const payment = await Payment.findOne({
//       where: {
//         transactionId: paymentIntent.id
//       }
//     });

//     if (payment) {
//       // Update payment status if it's not already completed
//       if (payment.status !== PaymentStatus.COMPLETED) {
//         await payment.update({
//           status: PaymentStatus.COMPLETED,
//           completedAt: new Date()
//         });

//         // Update package status
//         const packageItem = await Package.findByPk(packageId);
//         if (packageItem) {
//           await packageItem.update({
//             status: PackageStatus.PENDING // or appropriate status after payment
//           });
//         }

//         // Create notification
//         await Notification.create({
//           userId,
//           type: NotificationType.PAYMENT_COMPLETED,
//           title: 'Payment Successful',
//           message: `Your payment of ${paymentIntent.currency.toUpperCase()} ${paymentIntent.amount / 100} was successful`,
//           data: JSON.stringify({ 
//             paymentId: payment.id, 
//             packageId,
//             amount: payment.amount
//           }),
//           isRead: false,
//           isArchived: false,
//           channel: NotificationChannel.IN_APP,
//           packageId,
//           sentAt: new Date()
//         });
//       }
//     } else {
//       // Payment record doesn't exist yet (webhook received before API response)
//       // Find package to get details
//       const packageItem = await Package.findByPk(packageId);
//       if (!packageItem) {
//         logger.warn(`Package ${packageId} not found for payment intent ${paymentIntent.id}`);
//         return;
//       }

//       // Create payment record
//       const newPayment = await Payment.create({
//         userId,
//         packageId,
//         transactionId: paymentIntent.id,
//         type: PaymentType.PACKAGE_PAYMENT,
//         status: PaymentStatus.COMPLETED,
//         amount: packageItem.price,
//         currency: paymentIntent.currency.toUpperCase(),
//         method: PaymentMethod.CREDIT_CARD,
//         paymentMethodDetails: JSON.stringify({
//           last4: paymentIntent.payment_method_details?.card?.last4 || 'N/A',
//           brand: paymentIntent.payment_method_details?.card?.brand || 'card'
//         }),
//         processingFee: (packageItem.price * 0.029) + 0.30, // Example Stripe fee
//         taxAmount: 0,
//         description: `Payment for package ${packageItem.title}`,
//         metadata: JSON.stringify({
//           stripePaymentIntentId: paymentIntent.id,
//           packageTitle: packageItem.title
//         }),
//         receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
//         paymentDate: new Date(),
//         completedAt: new Date()
//       });

//       // Update package status
//       await packageItem.update({
//         status: PackageStatus.PENDING // or appropriate status after payment
//       });

//       // Create notification
//       await Notification.create({
//         userId,
//         type: NotificationType.PAYMENT_COMPLETED,
//         title: 'Payment Successful',
//         message: `Your payment of ${paymentIntent.currency.toUpperCase()} ${paymentIntent.amount / 100} for package ${packageItem.title} was successful`,
//         data: JSON.stringify({ 
//           paymentId: newPayment.id, 
//           packageId,
//           amount: newPayment.amount
//         }),
//         isRead: false,
//         isArchived: false,
//         channel: NotificationChannel.IN_APP,
//         packageId,
//         sentAt: new Date()
//       });
//     }
//   } catch (error) {
//     logger.error('Error handling payment intent succeeded:', error);
//   }
// };

// /**
//  * Handle failed payment intent
//  */
// const handlePaymentIntentFailed = async (paymentIntent: any) => {
//   try {
//     const { packageId, userId } = paymentIntent.metadata;

//     if (!packageId || !userId) {
//       logger.warn('Payment intent failed but missing metadata:', paymentIntent.id);
//       return;
//     }

//     // Find existing payment record
//     const payment = await Payment.findOne({
//       where: {
//         transactionId: paymentIntent.id
//       }
//     });

//     if (payment) {
//       // Update payment status
//       await payment.update({
//         status: PaymentStatus.FAILED,
//         errorMessage: paymentIntent.last_payment_error?.message || 'Payment failed'
//       });
//     } else {
//       // Find package to get details
//       const packageItem = await Package.findByPk(packageId);
//       if (!packageItem) {
//         logger.warn(`Package ${packageId} not found for failed payment intent ${paymentIntent.id}`);
//         return;
//       }

//       // Create failed payment record
//       await Payment.create({
//         userId,
//         packageId,
//         transactionId: paymentIntent.id,
//         type: PaymentType.PACKAGE_PAYMENT,
//         status: PaymentStatus.FAILED,
//         amount: packageItem.price,
//         currency: paymentIntent.currency.toUpperCase(),
//         method: PaymentMethod.CREDIT_CARD,
//         processingFee: 0,
//         taxAmount: 0,
//         description: `Failed payment for package ${packageItem.title}`,
//         errorMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
//         metadata: JSON.stringify({
//           stripePaymentIntentId: paymentIntent.id,
//           error: paymentIntent.last_payment_error?.message
//         }),
//         paymentDate: new Date()
//       });
//     }

//     // Create notification
//     await Notification.create({
//       userId,
//       type: NotificationType.PAYMENT_FAILED,
//       title: 'Payment Failed',
//       message: `Your payment of ${paymentIntent.currency.toUpperCase()} ${paymentIntent.amount / 100} failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
//       data: JSON.stringify({ 
//         packageId,
//         error: paymentIntent.last_payment_error?.message
//       }),
//       isRead: false,
//       isArchived: false,
//       channel: NotificationChannel.IN_APP,
//       packageId,
//       sentAt: new Date()
//     });
//   } catch (error) {
//     logger.error('Error handling payment intent failed:', error);
//   }
// };

// /**
//  * Handle transfer created
//  */
// const handleTransferCreated = async (transfer: any) => {
//   try {
//     const { matchId, packageId, carrierId } = transfer.metadata;

//     if (!matchId || !packageId || !carrierId) {
//       logger.warn('Transfer created but missing metadata:', transfer.id);
//       return;
//     }

//     // Find existing payment record
//     const payment = await Payment.findOne({
//       where: {
//         transactionId: transfer.id
//       }
//     });

//     if (payment) {
//       // Update payment status if needed
//       if (payment.status !== PaymentStatus.COMPLETED) {
//         await payment.update({
//           status: PaymentStatus.COMPLETED,
//           completedAt: new Date()
//         });
//       }
//     } else {
//       // Find package to get details
//       const packageItem = await Package.findByPk(packageId);
//       if (!packageItem) {
//         logger.warn(`Package ${packageId} not found for transfer ${transfer.id}`);
//         return;
//       }

//       // Create payment record
//       const newPayment = await Payment.create({
//         userId: carrierId,
//         packageId,
//         matchId,
//         transactionId: transfer.id,
//         type: PaymentType.CARRIER_PAYOUT,
//         status: PaymentStatus.COMPLETED,
//         amount: packageItem.carrierPayoutAmount,
//         currency: transfer.currency.toUpperCase(),
//         method: PaymentMethod.BANK_TRANSFER,
//         processingFee: 0,
//         taxAmount: 0,
//         description: `Payout for delivering package ${packageItem.title}`,
//         metadata: JSON.stringify({
//           stripeTransferId: transfer.id
//         }),
//         paymentDate: new Date(),
//         completedAt: new Date()
//       });

//       // Create notification
//       await Notification.create({
//         userId: carrierId,
//         type: NotificationType.PAYOUT_SENT,
//         title: 'Payout Processed',
//         message: `Your payout of ${transfer.currency.toUpperCase()} ${transfer.amount / 100} has been processed`,
//         data: JSON.stringify({ 
//           paymentId: newPayment.id, 
//           packageId,
//           matchId,
//           amount: newPayment.amount
//         }),
//         isRead: false,
//         isArchived: false,
//         channel: NotificationChannel.IN_APP,
//         packageId,
//         matchId,
//         sentAt: new Date()
//       });
//     }
//   } catch (error) {
//     logger.error('Error handling transfer created:', error);
//   }
// };

// /**
//  * Handle transfer failed
//  */
// const handleTransferFailed = async (transfer: any) => {
//   try {
//     const { matchId, packageId, carrierId } = transfer.metadata;

//     if (!matchId || !packageId || !carrierId) {
//       logger.warn('Transfer failed but missing metadata:', transfer.id);
//       return;
//     }

//     // Find existing payment record
//     const payment = await Payment.findOne({
//       where: {
//         transactionId: transfer.id
//       }
//     });

//     if (payment) {
//       // Update payment status
//       await payment.update({
//         status: PaymentStatus.FAILED,
//         errorMessage: transfer.failure_message || 'Transfer failed'
//       });
//     } else {
//       // Find package to get details
//       const packageItem = await Package.findByPk(packageId);
//       if (!packageItem) {
//         logger.warn(`Package ${packageId} not found for failed transfer ${transfer.id}`);
//         return;
//       }

//       // Create failed payment record
//       await Payment.create({
//         userId: carrierId,
//         packageId,
//         matchId,
//         transactionId: transfer.id,
//         type: PaymentType.CARRIER_PAYOUT,
//         status: PaymentStatus.FAILED,
//         amount: packageItem.carrierPayoutAmount,
//         currency: transfer.currency.toUpperCase(),
//         method: PaymentMethod.BANK_TRANSFER,
//         processingFee: 0,
//         taxAmount: 0,
//         description: `Failed payout for delivering package ${packageItem.title}`,
//         errorMessage: transfer.failure_message || 'Transfer failed',
//         metadata: JSON.stringify({
//           stripeTransferId: transfer.id,
//           error: transfer.failure_message
//         }),
//         paymentDate: new Date()
//       });
//     }

//     // Create notification
//     await Notification.create({
//       userId: carrierId,
//       type: NotificationType.PAYOUT_FAILED,
//       title: 'Payout Failed',
//       message: `Your payout of ${transfer.currency.toUpperCase()} ${transfer.amount / 100} failed: ${transfer.failure_message || 'Unknown error'}`,
//       data: JSON.stringify({ 
//         packageId,
//         matchId,
//         error: transfer.failure_message
//       }),
//       isRead: false,
//       isArchived: false,
//       channel: NotificationChannel.IN_APP,
//       packageId,
//       matchId,
//       sentAt: new Date()
//     });
//   } catch (error) {
//     logger.error('Error handling transfer failed:', error);
//   }
// };

// /**
//  * Get payment summary (admin only)
//  */
// export const getPaymentSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const { startDate, endDate } = req.query;

//     // Default to current month if not specified
//     const currentDate = new Date();
//     const defaultStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
//     const defaultEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

//     const queryStartDate = startDate ? new Date(startDate as string) : defaultStartDate;
//     const queryEndDate = endDate ? new Date(endDate as string) : defaultEndDate;

//     // Calculate total payments received
//     const paymentsReceived = await Payment.sum('amount', {
//       where: {
//         type: PaymentType.PACKAGE_PAYMENT,
//         status: PaymentStatus.COMPLETED,
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       }
//     });

//     // Calculate total payouts to carriers
//     const carrierPayouts = await Payment.sum('amount', {
//       where: {
//         type: PaymentType.CARRIER_PAYOUT,
//         status: PaymentStatus.COMPLETED,
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       }
//     });

//     // Calculate total refunds
//     const refunds = await Payment.sum('amount', {
//       where: {
//         type: PaymentType.REFUND,
//         status: PaymentStatus.COMPLETED,
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       }
//     });

//     // Calculate platform revenue (payments - payouts - refunds)
//     const platformRevenue = paymentsReceived - carrierPayouts - refunds;

//     // Get payment counts by status
//     const paymentCountsByStatus = await Payment.findAll({
//       attributes: [
//         'status',
//         [sequelize.fn('COUNT', sequelize.col('id')), 'count']
//       ],
//       where: {
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       },
//       group: ['status']
//     });

//     // Get payment counts by type
//     const paymentCountsByType = await Payment.findAll({
//       attributes: [
//         'type',
//         [sequelize.fn('COUNT', sequelize.col('id')), 'count']
//       ],
//       where: {
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       },
//       group: ['type']
//     });

//     // Get payment counts by method
//     const paymentCountsByMethod = await Payment.findAll({
//       attributes: [
//         'method',
//         [sequelize.fn('COUNT', sequelize.col('id')), 'count']
//       ],
//       where: {
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       },
//       group: ['method']
//     });

//     res.status(200).json({
//       success: true,
//       data: {
//         timeframe: {
//           startDate: queryStartDate,
//           endDate: queryEndDate
//         },
//         totals: {
//           paymentsReceived: paymentsReceived || 0,
//           carrierPayouts: carrierPayouts || 0,
//           refunds: refunds || 0,
//           platformRevenue: platformRevenue || 0
//         },
//         counts: {
//           byStatus: paymentCountsByStatus,
//           byType: paymentCountsByType,
//           byMethod: paymentCountsByMethod
//         }
//       }
//     });
//   } catch (error) {
//     logger.error('Error generating payment summary:', error);
//     next(new InternalServerError('Failed to generate payment summary'));
//   }
// };

// /**
//  * Get carrier earnings
//  */
// export const getCarrierEarnings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const carrierId = req.user.id;
//     const { 
//       startDate, 
//       endDate,
//       page = 1,
//       limit = 10
//     } = req.query;

//     // Default to current month if not specified
//     const currentDate = new Date();
//     const defaultStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
//     const defaultEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

//     const queryStartDate = startDate ? new Date(startDate as string) : defaultStartDate;
//     const queryEndDate = endDate ? new Date(endDate as string) : defaultEndDate;

//     // Calculate pagination
//     const offset = (Number(page) - 1) * Number(limit);

//     // Get carrier payouts
//     const { count, rows: payouts } = await Payment.findAndCountAll({
//       where: {
//         userId: carrierId,
//         type: PaymentType.CARRIER_PAYOUT,
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       },
//       limit: Number(limit),
//       offset,
//       order: [['paymentDate', 'DESC']]
//     });

//     // Calculate total earnings
//     const totalEarnings = await Payment.sum('amount', {
//       where: {
//         userId: carrierId,
//         type: PaymentType.CARRIER_PAYOUT,
//         status: PaymentStatus.COMPLETED,
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       }
//     });

//     // Calculate pending earnings
//     const pendingEarnings = await Payment.sum('amount', {
//       where: {
//         userId: carrierId,
//         type: PaymentType.CARRIER_PAYOUT,
//         status: PaymentStatus.PENDING,
//         paymentDate: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       }
//     });

//     // Get completed deliveries count
//     const deliveriesCount = await Match.count({
//       where: {
//         carrierId,
//         status: 'completed', // Replace with your actual match completion status
//         updatedAt: {
//           [Op.between]: [queryStartDate, queryEndDate]
//         }
//       }
//     });

//     res.status(200).json({
//       success: true,
//       data: {
//         timeframe: {
//           startDate: queryStartDate,
//           endDate: queryEndDate
//         },
//         summary: {
//           totalEarnings: totalEarnings || 0,
//           pendingEarnings: pendingEarnings || 0,
//           deliveriesCompleted: deliveriesCount || 0,
//           averagePerDelivery: deliveriesCount ? (totalEarnings / deliveriesCount) : 0
//         },
//         payouts: {
//           count,
//           totalPages: Math.ceil(count / Number(limit)),
//           currentPage: Number(page),
//           data: payouts
//         }
//       }
//     });
//   } catch (error) {
//     logger.error('Error fetching carrier earnings:', error);
//     next(new InternalServerError('Failed to fetch carrier earnings'));
//   }
// };

// /**
//  * Create a SetupIntent for saving payment method
//  */
// export const createSetupIntent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = req.user.id;

//     // Get user to retrieve Stripe customer ID
//     const user = await User.findByPk(userId);
//     if (!user) {
//       return next(new NotFoundError('User not found'));
//     }

//     // Create or retrieve Stripe customer
//     let stripeCustomerId = user.stripeCustomerId;

//     if (!stripeCustomerId) {
//       // Create new Stripe customer
//       const customer = await stripe.customers.create({
//         email: user.email,
//         name: `${user.firstName} ${user.lastName}`,
//         metadata: {
//           userId
//         }
//       });

//       stripeCustomerId = customer.id;

//       // Update user with Stripe customer ID
//       await user.update({ stripeCustomerId });
//     }

//     // Create a SetupIntent
//     const setupIntent = await stripe.setupIntents.create({
//       customer: stripeCustomerId,
//       usage: 'off_session', // Allow for future off-session payments
//       metadata: {
//         userId
//       }
//     });

//     res.status(200).json({
//       success: true,
//       data: {
//         clientSecret: setupIntent.client_secret,
//         setupIntentId: setupIntent.id
//       }
//     });
//   } catch (error) {
//     logger.error('Error creating setup intent:', error);
//     next(new InternalServerError('Failed to create setup intent'));
//   }
// };

// /**
//  * Get user's saved payment methods
//  */
// export const getPaymentMethods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = req.user.id;

//     // Get user to retrieve Stripe customer ID
//     const user = await User.findByPk(userId);
//     if (!user || !user.stripeCustomerId) {
//       return res.status(200).json({
//         success: true,
//         data: []
//       });
//     }

//     // Retrieve payment methods from Stripe
//     const paymentMethods = await stripe.paymentMethods.list({
//       customer: user.stripeCustomerId,
//       type: 'card'
//     });

//     // Format for response
//     const formattedPaymentMethods = paymentMethods.data.map(pm => ({
//       id: pm.id,
//       type: pm.type,
//       card: {
//         brand: pm.card?.brand,
//         last4: pm.card?.last4,
//         expMonth: pm.card?.exp_month,
//         expYear: pm.card?.exp_year
//       },
//       billingDetails: pm.billing_details,
//       isDefault: pm.metadata.isDefault === 'true'
//     }));

//     res.status(200).json({
//       success: true,
//       data: formattedPaymentMethods
//     });
//   } catch (error) {
//     logger.error('Error fetching payment methods:', error);
//     next(new InternalServerError('Failed to fetch payment methods'));
//   }
// };

// /**
//  * Delete a payment method
//  */
// export const deletePaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const userId = req.user.id;
//     const paymentMethodId = req.params.id;

//     // Get user to retrieve Stripe customer ID
//     const user = await User.findByPk(userId);
//     if (!user || !user.stripeCustomerId) {
//       return next(new NotFoundError('User Stripe customer ID not found'));
//     }

//     // Verify the payment method belongs to this customer
//     const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
//     if (paymentMethod.customer !== user.stripeCustomerId) {
//       return next(new ForbiddenError('Payment method does not belong to this user'));
//     }

//     // Detach the payment method
//     await stripe.paymentMethods.detach(paymentMethodId);

//     res.status(200).json({
//       success: true,
//       message: 'Payment method deleted successfully'
//     });
//   } catch (error) {
//     logger.error(`Error deleting payment method ${req.params.id}:`, error);
//     next(new InternalServerError('Failed to delete payment method'));
//   }
// };

// /**
//  * Handle charge refunded
//  */
// const handleChargeRefunded = async (charge: any) => {
//   try {
//     // Find payment by transaction ID (payment intent ID)
//     const payment = await Payment.findOne({
//       where: {
//         transactionId: charge.payment_intent
//       }
//     });

//     if (!payment) {
//       logger.warn('Charge refunded but payment not found:', charge.payment_intent);
//       return;
//     }

//     // Calculate refund amount
//     const refundAmount = charge.amount_refunded / 100; // Convert from cents to dollars
//     const isFullRefund = charge.refunded; // Boolean indicating if fully refunded

//     // Update payment status
//     await payment.update({
//       status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
//       refundedAmount: refundAmount,
//       refundTransactionId: charge.refunds.data[0]?.id
//     });

//     // Create a refund payment record
//     const refundPayment = await Payment.create({
//       userId: payment.userId,
//       packageId: payment.packageId,
//       matchId: payment.matchId,
//       transactionId: charge.refunds.data[0]?.id || `refund-${charge.id}`,
//       type: PaymentType.REFUND,
//       status: PaymentStatus.COMPLETED,
//       amount: refundAmount,
//       currency: payment.currency,
//       method: payment.method,
//       paymentMethodDetails: payment.paymentMethodDetails,
//       processingFee: 0,
//       taxAmount: 0,
//       description: `Refund for payment ${payment.id}`,
//       metadata: JSON.stringify({
//         originalPaymentId: payment.id,
//         stripeChargeId: charge.id,
//         stripeRefundId: charge.refunds.data[0]?.id
//       }),
//       paymentDate: new Date(),
//       completedAt: new Date()
//     });

//     // Create notification for the user
//     await Notification.create({
//       userId: payment.userId,
//       type: NotificationType.PAYMENT_REFUNDED,
//       title: 'Payment Refunded',
//       message: `Your payment of ${payment.currency} ${refundAmount} has been refunded`,
//       data: JSON.stringify({ 
//         originalPaymentId: payment.id, 
//         refundPaymentId: refundPayment.id,
//         amount: refundAmount
//       }),
//       isRead: false,
//       isArchived: false,
//       channel: NotificationChannel.IN_APP,
//       packageId: payment.packageId,
//       sentAt: new Date()
//     });

//     // If there's a package associated with the payment and it's a full refund, update package status
//     if (payment.packageId && isFullRefund) {
//       const packageItem = await Package.findByPk(payment.packageId);
//       if (packageItem && packageItem.status !== PackageStatus.DELIVERED) {
//         await packageItem.update({
//           status: PackageStatus.CANCELLED
//         });
//       }
//     }
//   } catch (error) {
//     logger.error('Error handling charge refunded:', error);
//   }
// };