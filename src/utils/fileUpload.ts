import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { Express } from 'express'; // Use Express.Multer.File

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const bucketName = process.env.AWS_S3_BUCKET || 'crowdship-uploads';

/**
 * Upload file to S3
 * @param file The file to upload
 * @param prefix Path prefix in S3 bucket
 * @returns The URL of the uploaded file
 */
export const uploadToS3 = async (file: Express.Multer.File, prefix: string = 'uploads'): Promise<string> => {
  try {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${prefix}/${uuidv4()}.${fileExtension}`;
    
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype
    };
    
    await s3Client.send(new PutObjectCommand(params));
    
    // Return the file URL
    return `https://${bucketName}.s3.amazonaws.com/${fileName}`;
  } catch (error) {
    logger.error('Error uploading file to S3:', error);
    throw new Error('File upload failed');
  }
};

/**
 * Generate a signed URL for S3 object
 * @param key S3 object key
 * @param expiresIn Expiration time in seconds (default: 3600)
 * @returns Signed URL
 */
export const generateSignedUrl = async (key: string, expiresIn: number = 3600): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    throw new Error('Failed to generate signed URL');
  }
};
