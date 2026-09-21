import { getCurrentCreator } from '@/lib/get-current-creator';
import { DonationLinkForm } from './settings-form';
import { CopyField } from '../copy-field';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';


export default async function DonationLinkPage() {
  const { settings } = await getCurrentCreator();

  const donateUrl = `${siteUrl()}/donate/${settings.donation_slug}`;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Donation link" description="Share this link anywhere — bio, live description, chat." />

      <div className="card space-y-4">
        <CopyField label="Your donation page" value={donateUrl} />
      </div>

      <div className="card">
        <DonationLinkForm settings={settings} />
      </div>
    </div>
  );
}
