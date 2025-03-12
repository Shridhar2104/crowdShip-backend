import { Model, DataTypes, Optional } from 'sequelize';
import bcrypt from 'bcrypt';
import { sequelize } from '../config/database';

// User interface
export interface UserAttributes {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: 'sender' | 'carrier' | 'admin';
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  profileImageUrl?: string;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new User (optional: id, createdAt, updatedAt)
export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// User model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public firstName!: string;
  public lastName!: string;
  public email!: string;
  public password!: string;
  public phoneNumber!: string;
  public role!: 'sender' | 'carrier' | 'admin';
  public isVerified!: boolean;
  public verificationToken?: string;
  public resetPasswordToken?: string;
  public resetPasswordExpires?: Date;
  public profileImageUrl?: string;
  public lastLoginAt?: Date;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Virtual field for full name
  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
  
  // Instance method to check password
  public async isPasswordMatch(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
  
  // Convert to safe public user object (no password)
  public toPublicJSON(): Omit<UserAttributes, 'password' | 'verificationToken' | 'resetPasswordToken' | 'resetPasswordExpires'> {
    const { 
      password, 
      verificationToken, 
      resetPasswordToken, 
      resetPasswordExpires, 
      ...publicUser 
    } = this.toJSON();
    
    return publicUser;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    role: {
      type: DataTypes.ENUM('sender', 'carrier', 'admin'),
      allowNull: false,
      defaultValue: 'sender',
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verificationToken: {
      type: DataTypes.STRING,
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
    },
    profileImageUrl: {
      type: DataTypes.STRING,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    hooks: {
      // Hash password before saving
      beforeCreate: async (user: User) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      // Hash password before updating (if changed)
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

export default User;