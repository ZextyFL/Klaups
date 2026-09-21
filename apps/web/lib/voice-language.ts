// Human-readable name for a BCP-47 tag, e.g. "en-US" -> "American English".
export function languageLabel(code: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
