import { getCurrentCreator } from '@/lib/get-current-creator';
import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const { profile } = await getCurrentCreator();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-white/60">
          Your photo and banner appear on your donation page and creator card.
        </p>
      </div>
      <div className="card">
        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}
