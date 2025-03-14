import { db, createDocument, getDocument, updateDocument, queryDocuments, Timestamp, FieldValue } from '../config/database';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

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

// Interface for creating a new User
export interface UserCreationAttributes extends Omit<UserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// User model class - Firestore version
export class User implements UserAttributes {
  public id: string;
  public firstName: string;
  public lastName: string;
  public email: string;
  public password: string;
  public phoneNumber: string;
  public role: 'sender' | 'carrier' | 'admin';
  public isVerified: boolean;
  public verificationToken?: string;
  public resetPasswordToken?: string;
  public resetPasswordExpires?: Date;
  public profileImageUrl?: string;
  public lastLoginAt?: Date;
  public createdAt?: Date;
  public updatedAt?: Date;

  // Collection name
  private static collectionName = 'users';

  // Constructor
  constructor(data: UserAttributes) {
    this.id = data.id;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.email = data.email;
    this.password = data.password;
    this.phoneNumber = data.phoneNumber;
    this.role = data.role;
    this.isVerified = data.isVerified;
    this.verificationToken = data.verificationToken;
    this.resetPasswordToken = data.resetPasswordToken;
    this.resetPasswordExpires = data.resetPasswordExpires;
    this.profileImageUrl = data.profileImageUrl;
    this.lastLoginAt = data.lastLoginAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Get full name
  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  // Check if password matches
  public async isPasswordMatch(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Convert to public JSON (no sensitive data)
  public toPublicJSON(): Omit<UserAttributes, 'password' | 'verificationToken' | 'resetPasswordToken' | 'resetPasswordExpires'> {
    const {
      password,
      verificationToken,
      resetPasswordToken,
      resetPasswordExpires,
      ...publicUser
    } = this;

    return publicUser;
  }

  // Save the user (create or update)
  public async save(): Promise<string> {
    // Hash password if it's a new user or password has changed
    if (!this.id || this.id === '') {
      // Creating a new user
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      
      // Generate a UUID for new users
      this.id = uuidv4();
      
      // Set defaults
      this.isVerified = this.isVerified ?? false;
      this.role = this.role ?? 'sender';
      
      // Create document
      await db.collection(User.collectionName).doc(this.id).set(this.toFirestore());
      return this.id;
    } else {
      // Updating an existing user
      const currentUser = await User.findById(this.id);
      
      // If password has changed, hash it
      if (currentUser && this.password !== currentUser.password) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
      }
      
      // Update document
      await db.collection(User.collectionName).doc(this.id).update(this.toFirestore());
      return this.id;
    }
  }

  // Convert to Firestore format
  private toFirestore(): any {
    const userData: any = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
      phoneNumber: this.phoneNumber,
      role: this.role,
      isVerified: this.isVerified,
    };

    // Add optional fields if they exist
    if (this.verificationToken) userData.verificationToken = this.verificationToken;
    if (this.resetPasswordToken) userData.resetPasswordToken = this.resetPasswordToken;
    if (this.resetPasswordExpires) userData.resetPasswordExpires = Timestamp.fromDate(this.resetPasswordExpires);
    if (this.profileImageUrl) userData.profileImageUrl = this.profileImageUrl;
    if (this.lastLoginAt) userData.lastLoginAt = Timestamp.fromDate(this.lastLoginAt);

    return userData;
  }

  // Create a new user
  public static async create(userData: UserCreationAttributes): Promise<User> {
    // Create a new User instance
    const user = new User({
      ...userData,
      id: uuidv4(),
      isVerified: userData.isVerified ?? false,
      role: userData.role ?? 'sender',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(userData.password, salt);

    // Save to Firestore
    await db.collection(User.collectionName).doc(user.id).set({
      ...user.toFirestore(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return user;
  }

  // Find a user by ID
  public static async findById(id: string): Promise<User | null> {
    const doc = await getDocument(User.collectionName, id);
    if (!doc) return null;
    
    // Convert Firestore timestamp to Date if needed
    const userData = {
      ...doc,
      resetPasswordExpires: doc.resetPasswordExpires ? 
        (doc.resetPasswordExpires instanceof Timestamp ? 
          doc.resetPasswordExpires.toDate() : doc.resetPasswordExpires) : undefined,
      lastLoginAt: doc.lastLoginAt ?
        (doc.lastLoginAt instanceof Timestamp ? 
          doc.lastLoginAt.toDate() : doc.lastLoginAt) : undefined,
      createdAt: doc.createdAt ?
        (doc.createdAt instanceof Timestamp ? 
          doc.createdAt.toDate() : doc.createdAt) : undefined,
      updatedAt: doc.updatedAt ?
        (doc.updatedAt instanceof Timestamp ? 
          doc.updatedAt.toDate() : doc.updatedAt) : undefined
    };

    return new User(userData);
  }

  // Find a user by email
  public static async findByEmail(email: string): Promise<User | null> {
    const results = await queryDocuments(User.collectionName, [['email', '==', email]], undefined, 1);
    if (results.length === 0) return null;
    
    // Convert Firestore timestamp to Date if needed
    const userData = {
      ...results[0],
      resetPasswordExpires: results[0].resetPasswordExpires ? 
        (results[0].resetPasswordExpires instanceof Timestamp ? 
          results[0].resetPasswordExpires.toDate() : results[0].resetPasswordExpires) : undefined,
      lastLoginAt: results[0].lastLoginAt ?
        (results[0].lastLoginAt instanceof Timestamp ? 
          results[0].lastLoginAt.toDate() : results[0].lastLoginAt) : undefined,
      createdAt: results[0].createdAt ?
        (results[0].createdAt instanceof Timestamp ? 
          results[0].createdAt.toDate() : results[0].createdAt) : undefined,
      updatedAt: results[0].updatedAt ?
        (results[0].updatedAt instanceof Timestamp ? 
          results[0].updatedAt.toDate() : results[0].updatedAt) : undefined
    };

    return new User(userData);
  }

  // Find users by role
  public static async findByRole(role: 'sender' | 'carrier' | 'admin'): Promise<User[]> {
    const results = await queryDocuments(User.collectionName, [['role', '==', role]]);
    
    return results.map(userData => new User({
      ...userData,
      resetPasswordExpires: userData.resetPasswordExpires ? 
        (userData.resetPasswordExpires instanceof Timestamp ? 
          userData.resetPasswordExpires.toDate() : userData.resetPasswordExpires) : undefined,
      lastLoginAt: userData.lastLoginAt ?
        (userData.lastLoginAt instanceof Timestamp ? 
          userData.lastLoginAt.toDate() : userData.lastLoginAt) : undefined,
      createdAt: userData.createdAt ?
        (userData.createdAt instanceof Timestamp ? 
          userData.createdAt.toDate() : userData.createdAt) : undefined,
      updatedAt: userData.updatedAt ?
        (userData.updatedAt instanceof Timestamp ? 
          userData.updatedAt.toDate() : userData.updatedAt) : undefined
    }));
  }

  // Delete a user
  public static async delete(id: string): Promise<boolean> {
    try {
      await db.collection(User.collectionName).doc(id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  // Update login timestamp
  public async updateLoginTimestamp(): Promise<void> {
    this.lastLoginAt = new Date();
    await db.collection(User.collectionName).doc(this.id).update({
      lastLoginAt: Timestamp.fromDate(this.lastLoginAt),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
}

export default User;