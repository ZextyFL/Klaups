import { getCurrentCreator } from '@/lib/get-current-creator';
import { DonationLinkForm } from './settings-form';
import { CopyField } from '../copy-field';

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export default async function DonationLinkPage() {
  const { settings } = await getCurrentCreator();

  const donateUrl = `${siteUrl()}/donate/${settings.donation_slug}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Donation link</h1>
        <p className="mt-1 text-white/60">Share this link anywhere — bio, live description, chat.</p>
      </div>

      <div className="card space-y-4">
        <CopyField label="Your donation page" value={donateUrl} />
      </div>

      <div className="card">
        <DonationLinkForm settings={settings} />
      </div>
    </div>
  );
}
