import Stripe from 'stripe';
import { config } from './index';
import { logger } from '../utils/logger';

// Initialize Stripe with API key from config
const stripeApiKey = config.stripe.secretKey;

if (!stripeApiKey) {
  logger.error('Stripe API key is not set. Payment features will not work.');
}

// Create Stripe instance with API version specified
export const stripe = new Stripe(stripeApiKey || 'dummy_key_for_development', {
  apiVersion: '2025-02-24.acacia', // Use the latest stable API version
  maxNetworkRetries: 3, // Automatically retry requests that fail due to network issues
  timeout: 30000, // 30 seconds timeout
  appInfo: {
    name: 'CrowdShip',
    version: '1.0.0',
  },
});

// Utility functions for stripe operations

/**
 * Format amount for Stripe (convert to cents)
 * @param amount Amount in dollars/primary currency unit
 * @returns Amount in cents/smallest currency unit
 */
export const formatAmountForStripe = (amount: number, currency: string = 'usd'): number => {
  const currencies = {
    usd: 100, // 1 USD = 100 cents
    eur: 100, // 1 EUR = 100 cents
    gbp: 100, // 1 GBP = 100 pence
    jpy: 1,   // JPY doesn't use cents
    inr: 100  // 1 INR = 100 paise
  };
  
  const multiplier = currencies[currency.toLowerCase() as keyof typeof currencies] || 100;
  return Math.round(amount * multiplier);
};

/**
 * Format amount from Stripe (convert from cents to dollars)
 * @param amount Amount in cents/smallest currency unit
 * @returns Amount in dollars/primary currency unit
 */
export const formatAmountFromStripe = (amount: number, currency: string = 'usd'): number => {
  const currencies = {
    usd: 100,
    eur: 100,
    gbp: 100,
    jpy: 1,
    inr: 100
  };
  
  const divisor = currencies[currency.toLowerCase() as keyof typeof currencies] || 100;
  return amount / divisor;
};

/**
 * Calculate Stripe fee for a transaction (approximate)
 * @param amount Amount in dollars
 * @param currency Currency code
 * @returns Approximate Stripe fee in dollars
 */
export const calculateStripeFee = (amount: number, currency: string = 'usd'): number => {
  // Default Stripe fee is 2.9% + $0.30 per successful transaction
  // This varies by country and payment method
  const percentageFee = amount * 0.029;
  const fixedFee = 0.30;
  
  return Number((percentageFee + fixedFee).toFixed(2));
};

/**
 * Validate webhook signature
 * @param payload Request body as a string
 * @param signature Stripe signature from headers
 * @returns Boolean indicating if signature is valid
 */
export const validateWebhookSignature = (
  payload: string,
  signature: string,
  webhookSecret: string
): boolean => {
  try {
    stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return true;
  } catch (error) {
    logger.error('Webhook signature validation failed:', error);
    return false;
  }
};

export default stripe;