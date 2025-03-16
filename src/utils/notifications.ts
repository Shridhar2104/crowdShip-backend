import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from './logger';

// Configure SES client for emails
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

// Configure SNS client for SMS
const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

/**
 * Send email notification
 * @param to Recipient email address
 * @param subject Email subject
 * @param body Email body
 */
export const sendEmail = async (to: string, subject: string, body: string): Promise<void> => {
  try {
    const params = {
      Source: process.env.EMAIL_FROM || 'noreply@crowdship.com',
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: body,
            Charset: 'UTF-8'
          },
          Html: {
            Data: body.replace(/\n/g, '<br/>'),
            Charset: 'UTF-8'
          }
        }
      }
    };
    
    await sesClient.send(new SendEmailCommand(params));
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send SMS notification
 * @param phoneNumber Recipient phone number
 * @param message SMS message
 */
export const sendSMS = async (phoneNumber: string, message: string): Promise<void> => {
  try {
    // Format phone number to E.164 format if not already
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    
    const params = {
      Message: message,
      PhoneNumber: formattedPhone
    };
    
    await snsClient.send(new PublishCommand(params));
    logger.info(`SMS sent to ${formattedPhone}`);
  } catch (error) {
    logger.error('Error sending SMS:', error);
    throw new Error('Failed to send SMS');
  }
};