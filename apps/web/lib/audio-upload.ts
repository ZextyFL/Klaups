// Audio upload validation shared by the soundboard and gift sounds.
//
// Browsers are inconsistent about File.type for audio: Windows often reports
// MP3 as "audio/x-mpeg" or even "" and M4A as "audio/x-m4a". Trust the
// extension when the type is missing, and always send an explicit content
// type so Storage's MIME allowlist sees a value it recognises.

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
};

export const AUDIO_ACCEPT = '.mp3,.wav,.ogg,.oga,.opus,.webm,.m4a,.aac,.flac,audio/*';

export function prepareAudioUpload(file: File):
  | { ok: true; contentType: string; extension: string }
  | { ok: false; error: string } {
  const extension = (file.name.split('.').pop() ?? '').toLowerCase();
  const fromExtension = BY_EXTENSION[extension];
  const contentType = fromExtension ?? (file.type.startsWith('audio/') ? file.type : '');

  if (!contentType) {
    return { ok: false, error: 'Use an audio file: MP3, WAV, OGG, M4A, AAC, WEBM or FLAC.' };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: 'Sounds can be up to 15 MB.' };
  }
  return { ok: true, contentType, extension: fromExtension ? extension : 'mp3' };
}
