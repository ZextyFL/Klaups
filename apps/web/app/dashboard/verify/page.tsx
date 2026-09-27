import { redirect } from 'next/navigation';

// Payout verification is now email + IBAN on the Payouts page.
export default function VerifyAccountPage() {
  redirect('/dashboard/payouts');
}
