import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

/** "0300 1234567" + "PK" => "+923001234567". Invalid ho to null. */
export function toE164(phone: string, country: string): string | null {
  try {
    const parsed = parsePhoneNumberFromString(phone, country as CountryCode);
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}
