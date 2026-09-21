import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
});

// Platform cut taken from every donation, in basis points (500 = 5%).
export const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? '500');

export function applicationFeeCents(amountCents: number) {
  return Math.round((amountCents * PLATFORM_FEE_BPS) / 10000);
}
