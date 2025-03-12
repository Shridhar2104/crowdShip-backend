import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Payment method type enum
export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_ACCOUNT = 'bank_account',
  UPI = 'upi',
  WALLET = 'wallet'
}

// PaymentMethod attributes interface
export interface PaymentMethodAttributes {
  id: string;
  userId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  stripePaymentMethodId?: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: string;
  holderName?: string;
  country?: string;
  metadata?: string; // JSON string with additional metadata
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new PaymentMethod
export interface PaymentMethodCreationAttributes extends Optional<PaymentMethodAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// PaymentMethod model class
class PaymentMethod extends Model<PaymentMethodAttributes, PaymentMethodCreationAttributes> implements PaymentMethodAttributes {
  public id!: string;
  public userId!: string;
  public type!: PaymentMethodType;
  public isDefault!: boolean;
  public stripePaymentMethodId?: string;
  public last4!: string;
  public expiryMonth?: number;
  public expiryYear?: number;
  public brand?: string;
  public holderName?: string;
  public country?: string;
  public metadata?: string;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Get metadata as object
  public get metadataObj(): any {
    return this.metadata ? JSON.parse(this.metadata) : {};
  }
  
  // Set this payment method as default
  public async setAsDefault(): Promise<void> {
    // First, unset default for all other payment methods for this user
    await PaymentMethod.update(
      { isDefault: false },
      { where: { userId: this.userId } }
    );
    
    // Set this one as default
    this.isDefault = true;
    await this.save();
  }
}

PaymentMethod.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM(...Object.values(PaymentMethodType)),
      allowNull: false,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    stripePaymentMethodId: {
      type: DataTypes.STRING,
      unique: true,
    },
    last4: {
      type: DataTypes.STRING(4),
      allowNull: false,
    },
    expiryMonth: {
      type: DataTypes.INTEGER,
    },
    expiryYear: {
      type: DataTypes.INTEGER,
    },
    brand: {
      type: DataTypes.STRING,
    },
    holderName: {
      type: DataTypes.STRING,
    },
    country: {
      type: DataTypes.STRING(2),
    },
    metadata: {
      type: DataTypes.TEXT, // JSON string with additional metadata
    },
  },
  {
    sequelize,
    modelName: 'PaymentMethod',
    tableName: 'payment_methods',
    timestamps: true,
    hooks: {
      // Set as default if it's the only payment method for this user
      afterCreate: async (paymentMethod: PaymentMethod) => {
        const count = await PaymentMethod.count({
          where: { userId: paymentMethod.userId }
        });
        
        if (count === 1) {
          await paymentMethod.setAsDefault();
        }
      },
    },
  }
);

export default PaymentMethod;