export function apiBase(raw: string | undefined, production = true): string {
  if (!raw || raw === '/api') return '/api';
  const url = new URL(raw);
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/api' ||
      (url.protocol !== 'https:' && !(local && !production && url.protocol === 'http:')) || url.href !== raw)
    throw new Error('INVALID_PUBLIC_API_BASE');
  return raw;
}

export function publicEnvironment(env: Record<string, string | undefined>, production: boolean) {
  if (Object.keys(env).some(key => key.startsWith('VITE_') && key !== 'VITE_API_BASE_URL'))
    throw new Error('UNEXPECTED_PUBLIC_VARIABLE');
  return apiBase(env.VITE_API_BASE_URL, production);
}

export function quotaLevel(used: number, limit: number) {
  if (!Number.isFinite(used) || used < 0 || !Number.isFinite(limit) || limit <= 0) throw new Error('INVALID_QUOTA');
  const percent = used / limit * 100;
  return { percent, level: percent >= 95 ? 'CRITICAL' : percent >= 85 ? 'WARNING' : percent >= 70 ? 'NOTICE' : 'OK' };
}

export function backupEstimate(bytesPerCopy: number, copies: number, manifestBytes = 1048576, margin = 0.2) {
  if (![bytesPerCopy, copies, manifestBytes].every(Number.isSafeInteger) || bytesPerCopy < 0 || copies < 1 || manifestBytes < 0 || !Number.isFinite(margin) || margin < 0 || margin > 1)
    throw new Error('INVALID_BACKUP_ESTIMATE');
  const bytes = Math.ceil((bytesPerCopy + manifestBytes) * copies * (1 + margin));
  if (!Number.isSafeInteger(bytes)) throw new Error('INVALID_BACKUP_ESTIMATE');
  return { bytes, freeBudgetBytes: 10_000_000_000, ...quotaLevel(bytes, 10_000_000_000) };
}
