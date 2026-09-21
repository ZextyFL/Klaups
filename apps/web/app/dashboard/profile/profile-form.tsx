'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/database.types';

export function ProfileForm({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [bannerUrl, setBannerUrl] = useState(profile.banner_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(kind: 'avatar' | 'banner', file: File) {
    setUploading(kind);
    setError(null);
    try {
      const bucket = kind === 'avatar' ? 'avatars' : 'banners';
      const path = `${profile.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (kind === 'avatar') setAvatarUrl(data.publicUrl);
      else setBannerUrl(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <div
        className="h-40 w-full rounded-2xl bg-cover bg-center bg-ink-800"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
      >
        <div className="flex h-full items-end justify-end p-3">
          <button
            className="btn-secondary text-xs"
            onClick={() => bannerInput.current?.click()}
            disabled={uploading === 'banner'}
            type="button"
          >
            {uploading === 'banner' ? 'Uploading…' : 'Change banner'}
          </button>
          <input
            ref={bannerInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload('banner', e.target.files[0])}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="h-20 w-20 shrink-0 rounded-full border-2 border-ink-900 bg-ink-800 bg-cover bg-center"
          style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
        />
        <button
          className="btn-secondary text-sm"
          onClick={() => avatarInput.current?.click()}
          disabled={uploading === 'avatar'}
          type="button"
        >
          {uploading === 'avatar' ? 'Uploading…' : 'Change photo'}
        </button>
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload('avatar', e.target.files[0])}
        />
      </div>

      <div>
        <label className="label">Display name</label>
        <input
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Bio</label>
        <textarea
          className="input"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button className="btn-primary" onClick={save} disabled={saving} type="button">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
