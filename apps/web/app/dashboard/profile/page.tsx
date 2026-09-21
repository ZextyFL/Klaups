import { getCurrentCreator } from '@/lib/get-current-creator';
import { ProfileForm } from './profile-form';
import { PageHeader } from '@/components/dashboard/PageHeader';

export default async function ProfilePage() {
  const { profile } = await getCurrentCreator();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Profile" description="Your photo and banner appear on your donation page and creator card." />
      <div className="card">
        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}
