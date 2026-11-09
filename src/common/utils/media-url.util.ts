export function mediaUrl(key: string): string {
  const base = (process.env.MEDIA_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/${key}`;
}

