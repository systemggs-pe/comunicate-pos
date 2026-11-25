import serverless from 'serverless-http';
import { resolve } from 'node:path';

process.env.NODE_ENV = 'production';
const connection = process.env.DATABASE_URL;
if (connection) {
  const url = new URL(connection);
  if (url.hostname.endsWith('.pooler.supabase.com') && !url.searchParams.has('sslcert')) {
    url.searchParams.set('sslcert', resolve('supabase-ca.crt'));
    process.env.DATABASE_URL = url.toString();
  }
}

const handlerPromise = import('../../server/app.js').then(({ app }) => serverless(app, {
  binary: ['application/pdf', 'application/zip', 'application/octet-stream', 'image/*'],
}));

const functionPath = '/.netlify/functions/api';
function apiPath(path: string) {
  if (path === functionPath || path.startsWith(functionPath + '/')) {
    return '/api' + path.slice(functionPath.length);
  }
  return path;
}

export async function handler(event: {path?: string; requestPath?: string; rawPath?: string}, context: object) {
  const handle = await handlerPromise;
  const path = apiPath(event.requestPath ?? event.rawPath ?? event.path ?? '/api');
  return handle({...event, requestPath: path, path, rawPath: path}, context);
}
