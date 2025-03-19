// import { Model, DataTypes, Optional } from 'sequelize';
// import { sequelize } from '../config/database';

// // Payment type enum
// export enum PaymentType {
//   PACKAGE_PAYMENT = 'package_payment',     // Sender paying for delivery
//   CARRIER_PAYOUT = 'carrier_payout',       // Paying carrier for completed delivery
//   REFUND = 'refund',                       // Refund to sender
//   PLATFORM_FEE = 'platform_fee',           // Platform fee
//   INSURANCE_FEE = 'insurance_fee',         // Insurance fee
//   TAX = 'tax'                              // Tax payment
// }

// // Payment status enum
// export enum PaymentStatus {
//   PENDING = 'pending',            // Payment initiated but not completed
//   COMPLETED = 'completed',        // Payment successfully completed
//   FAILED = 'failed',              // Payment attempt failed
//   REFUNDED = 'refunded',          // Payment refunded
//   PARTIALLY_REFUNDED = 'partially_refunded', // Payment partially refunded
//   CANCELLED = 'cancelled'         // Payment cancelled
// }

// // Payment method enum
// export enum PaymentMethod {
//   CREDIT_CARD = 'credit_card',
//   DEBIT_CARD = 'debit_card',
//   BANK_TRANSFER = 'bank_transfer',
//   WALLET = 'wallet',
//   UPI = 'upi',
//   CASH = 'cash',
//   OTHER = 'other'
// }

// // Payment attributes interface
// export interface PaymentAttributes {
//   id: string;
//   userId: string;      // User who made or received the payment
//   packageId?: string;  // Related package if applicable
//   matchId?: string;    // Related match if applicable
//   transactionId: string; // External transaction ID
//   type: PaymentType;
//   status: PaymentStatus;
//   amount: number;
//   currency: string;
//   method: PaymentMethod;
//   paymentMethodDetails?: string; // JSON string with payment method details
//   processingFee: number;
//   taxAmount: number;
//   description: string;
//   metadata?: string;   // JSON string with additional metadata
//   errorMessage?: string;
//   refundedAmount?: number;
//   refundReason?: string;
//   refundTransactionId?: string;
//   receiptUrl?: string;
//   paymentDate: Date;
//   dueDate?: Date;      // For pending payments
//   completedAt?: Date;  // When payment was completed
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// // Interface for creating a new Payment
// export interface PaymentCreationAttributes extends Optional<PaymentAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// // Payment model class
// class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
//   public id!: string;
//   public userId!: string;
//   public packageId?: string;
//   public matchId?: string;
//   public transactionId!: string;
//   public type!: PaymentType;
//   public status!: PaymentStatus;
//   public amount!: number;
//   public currency!: string;
//   public method!: PaymentMethod;
//   public paymentMethodDetails?: string;
//   public processingFee!: number;
//   public taxAmount!: number;
//   public description!: string;
//   public metadata?: string;
//   public errorMessage?: string;
//   public refundedAmount?: number;
//   public refundReason?: string;
//   public refundTransactionId?: string;
//   public receiptUrl?: string;
//   public paymentDate!: Date;
//   public dueDate?: Date;
//   public completedAt?: Date;
  
//   // Timestamps
//   public readonly createdAt!: Date;
//   public readonly updatedAt!: Date;
  
//   // Get payment method details as object
//   public get paymentMethodDetailsObj(): any {
//     return this.paymentMethodDetails ? JSON.parse(this.paymentMethodDetails) : {};
//   }
  
//   // Get metadata as object
//   public get metadataObj(): any {
//     return this.metadata ? JSON.parse(this.metadata) : {};
//   }
  
//   // Get total amount including fees and taxes
//   public get totalAmount(): number {
//     return this.amount + this.processingFee + this.taxAmount;
//   }
  
//   // Calculate refund percentage
//   public get refundPercentage(): number | null {
//     if (this.refundedAmount === undefined || this.amount === 0) {
//       return null;
//     }
//     return (this.refundedAmount / this.amount) * 100;
//   }
// }

// Payment.init(
//   {
//     id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//     },
//     userId: {
//       type: DataTypes.UUID,
//       allowNull: false,
//       references: {
//         model: 'users',
//         key: 'id',
//       },
//     },
//     packageId: {
//       type: DataTypes.UUID,
//       references: {
//         model: 'packages',
//         key: 'id',
//       },
//     },
//     matchId: {
//       type: DataTypes.UUID,
//       references: {
//         model: 'matches',
//         key: 'id',
//       },
//     },
//     transactionId: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       unique: true,
//     },
//     type: {
//       type: DataTypes.ENUM(...Object.values(PaymentType)),
//       allowNull: false,
//     },
//     status: {
//       type: DataTypes.ENUM(...Object.values(PaymentStatus)),
//       allowNull: false,
//       defaultValue: PaymentStatus.PENDING,
//     },
//     amount: {
//       type: DataTypes.DECIMAL(10, 2),
//       allowNull: false,
//     },
//     currency: {
//       type: DataTypes.STRING(3),
//       allowNull: false,
//       defaultValue: 'USD',
//     },
//     method: {
//       type: DataTypes.ENUM(...Object.values(PaymentMethod)),
//       allowNull: false,
//     },
//     paymentMethodDetails: {
//       type: DataTypes.TEXT, // JSON string with payment method details
//     },
//     processingFee: {
//       type: DataTypes.DECIMAL(10, 2),
//       allowNull: false,
//       defaultValue: 0,
//     },
//     taxAmount: {
//       type: DataTypes.DECIMAL(10, 2),
//       allowNull: false,
//       defaultValue: 0,
//     },
//     description: {
//       type: DataTypes.TEXT,
//       allowNull: false,
//     },
//     metadata: {
//       type: DataTypes.TEXT, // JSON string with additional metadata
//     },
//     errorMessage: {
//       type: DataTypes.TEXT,
//     },
//     refundedAmount: {
//       type: DataTypes.DECIMAL(10, 2),
//     },
//     refundReason: {
//       type: DataTypes.TEXT,
//     },
//     refundTransactionId: {
//       type: DataTypes.STRING,
//     },
//     receiptUrl: {
//       type: DataTypes.STRING,
//     },
//     paymentDate: {
//       type: DataTypes.DATE,
//       allowNull: false,
//       defaultValue: DataTypes.NOW,
//     },
//     dueDate: {
//       type: DataTypes.DATE,
//     },
//     completedAt: {
//       type: DataTypes.DATE,
//     },
//   },
//   {
//     sequelize,
//     modelName: 'Payment',
//     tableName: 'payments',
//     timestamps: true,
//     hooks: {
//       // Generate transaction ID if not provided
//       beforeCreate: async (payment: Payment) => {
//         if (!payment.transactionId) {
//           const prefix = payment.type === PaymentType.PACKAGE_PAYMENT ? 'PMT' : 
//                           payment.type === PaymentType.CARRIER_PAYOUT ? 'PAY' :
//                           payment.type === PaymentType.REFUND ? 'REF' : 'TXN';
          
//           const timestamp = Date.now().toString().slice(-6);
//           const random = Math.floor(1000 + Math.random() * 9000).toString();
          
//           payment.transactionId = `${prefix}-${timestamp}-${random}`;
//         }
//       },
      
//       // Set completedAt timestamp
//       beforeUpdate: async (payment: Payment) => {
//         // If status changed to completed, set completedAt
//         if (payment.changed('status') && payment.status === PaymentStatus.COMPLETED && !payment.completedAt) {
//           payment.completedAt = new Date();
//         }
//       },
//     },
//   }
// );

// export default Payment;