export function escapeWifiValue(value: string): string {
  return value.replace(/([\\;,:"\\])/g, '\\$1');
}

export function escapeVcardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function buildWifiString(
  security: string,
  ssid: string,
  password: string,
  hidden: boolean
): string {
  if (!ssid) return '';
  const type = security === 'none' ? 'nopass' : security;
  const parts = [`T:${type}`, `S:${escapeWifiValue(ssid)}`];
  if (security !== 'none') parts.push(`P:${escapeWifiValue(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

export interface VcardFields {
  first: string;
  last: string;
  phone: string;
  email: string;
  company: string;
  title: string;
  website: string;
}

export function buildVcardString(fields: VcardFields): string {
  const { first, last, phone, email, company, title, website } = fields;
  if (!first && !last && !phone && !email) return '';

  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (last || first) {
    lines.push(`N:${escapeVcardValue(last)};${escapeVcardValue(first)};;;`);
    lines.push(`FN:${escapeVcardValue(`${first} ${last}`.trim())}`);
  }
  if (phone) lines.push(`TEL:${escapeVcardValue(phone)}`);
  if (email) lines.push(`EMAIL:${escapeVcardValue(email)}`);
  if (company) lines.push(`ORG:${escapeVcardValue(company)}`);
  if (title) lines.push(`TITLE:${escapeVcardValue(title)}`);
  if (website) lines.push(`URL:${escapeVcardValue(website)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function buildEmailString(email: string, subject: string, body: string): string {
  if (!email) return '';
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}${params.length ? `?${params.join('&')}` : ''}`;
}

export function buildSmsString(phone: string, message: string): string {
  if (!phone) return '';
  return message ? `sms:${phone}?body=${encodeURIComponent(message)}` : `sms:${phone}`;
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error('Color must use six-digit hexadecimal notation.');
  const value = Number.parseInt(match[1], 16);
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  );
}

export function colorContrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
