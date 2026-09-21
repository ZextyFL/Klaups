import { getCurrentCreator } from '@/lib/get-current-creator';
import { PasswordForm } from './password-form';
import { PageHeader } from '@/components/dashboard/PageHeader';

export default async function AccountPage() {
  const { user, profile } = await getCurrentCreator();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Account" description="Your login details." />

      <div className="card space-y-4">
        <div>
          <label className="label">Email</label>
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white/70">
            {user.email}
          </p>
          <p className="mt-1 text-xs text-white/40">
            Your login email can&apos;t be changed here. Contact support if you need it updated.
          </p>
        </div>
        <div>
          <label className="label">Username</label>
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white/70">
            @{profile.username}
          </p>
          <p className="mt-1 text-xs text-white/40">
            Fixed for your account. Your public donation link slug can still be customized under
            Donation link.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
