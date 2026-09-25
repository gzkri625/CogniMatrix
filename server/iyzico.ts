// Minimal iyzico REST client (IYZWSv2 auth). Server-side only: the secret key
// must never reach the browser. Uses Web Crypto so it runs on Node (Vercel)
// and on Cloudflare Workers alike.
import type { Env } from './env';

const SANDBOX = 'https://sandbox-api.iyzipay.com';

export const config = (env: Env) => ({
  apiKey: env.IYZICO_API_KEY ?? '',
  secretKey: env.IYZICO_SECRET_KEY ?? '',
  baseUrl: (env.IYZICO_BASE_URL || SANDBOX).replace(/\/$/, ''),
});

export const isConfigured = (env: Env) => {
  const c = config(env);
  return Boolean(c.apiKey && c.secretKey);
};

export const isSandbox = (env: Env) => config(env).baseUrl.includes('sandbox');

export interface IyzicoResponse {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function authHeader(apiKey: string, secretKey: string, path: string, body: string, rnd: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = hex(await crypto.subtle.sign('HMAC', key, enc.encode(rnd + path + body)));
  return `IYZWSv2 ${btoa(`apiKey:${apiKey}&randomKey:${rnd}&signature:${signature}`)}`;
}

export async function iyzicoPost(env: Env, path: string, payload: object): Promise<IyzicoResponse> {
  const { apiKey, secretKey, baseUrl } = config(env);
  const body = JSON.stringify(payload);
  const rnd = Date.now().toString() + hex(crypto.getRandomValues(new Uint8Array(4)).buffer);
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-iyzi-rnd': rnd,
      Authorization: await authHeader(apiKey, secretKey, path, body, rnd),
    },
    body,
  });
  return (await res.json()) as IyzicoResponse;
}

/** iyzico expects prices as strings like "12.5" / "100.0". */
export const fmtPrice = (n: number) => {
  const s = (Math.round(n * 100) / 100).toString();
  return s.includes('.') ? s : `${s}.0`;
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
