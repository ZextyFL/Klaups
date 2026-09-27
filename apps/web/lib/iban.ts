// IBAN normalisation and validation (ISO 13616), shared by the browser form
// and the server route so both reject the same inputs.

// Official lengths for SEPA countries plus common non-SEPA IBAN countries.
const LENGTHS: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31,
  NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27,
  VA: 22, AE: 23, TR: 26, SA: 24, IL: 23, UA: 29, RS: 22, BA: 20, ME: 22,
  MK: 19, AL: 28, XK: 20, MD: 24, GE: 22, AZ: 28, KZ: 20, QA: 29, KW: 30,
  BH: 22, JO: 30, LB: 28, PK: 24, BR: 29, MU: 30, TN: 24, EG: 29,
};

export function normalizeIban(value: string) {
  return value.replace(/[\s-]+/g, '').toUpperCase();
}

/** "NL91ABNA0417164300" -> "NL91 ABNA 0417 1643 00" */
export function formatIban(value: string) {
  return normalizeIban(value).replace(/(.{4})/g, '$1 ').trim();
}

export type IbanCheck = { ok: true; iban: string; country: string; last4: string } | { ok: false; error: string };

export function validateIban(input: string): IbanCheck {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return { ok: false, error: 'That doesn’t look like an IBAN. It starts with 2 letters, e.g. NL91 ABNA 0417 1643 00.' };
  }
  const country = iban.slice(0, 2);
  const expected = LENGTHS[country];
  if (!expected) return { ok: false, error: `IBANs from ${country} aren’t supported yet.` };
  if (iban.length !== expected) {
    return { ok: false, error: `A ${country} IBAN has ${expected} characters — this one has ${iban.length}.` };
  }

  // Mod-97: move the first 4 chars to the end, letters -> 10..35, remainder 1.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  if (remainder !== 1) return { ok: false, error: 'This IBAN has a typo — the check digits don’t match.' };

  return { ok: true, iban, country, last4: iban.slice(-4) };
}

export function validateHolderName(value: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return { ok: false, error: 'Enter the name exactly as it appears on the bank account.' };
  if (name.length > 70) return { ok: false, error: 'Account holder name can be at most 70 characters.' };
  // SEPA allows a restricted Latin set; reject control chars and obvious junk.
  if (!/^[\p{L}\p{M}0-9 .,'&()/+-]+$/u.test(name)) {
    return { ok: false, error: 'Use letters, spaces and . , \' - & only in the account holder name.' };
  }
  return { ok: true, name };
}
