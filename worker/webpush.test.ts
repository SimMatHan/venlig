import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicKeyFromJwk, sendEmptyPush } from './webpush';

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

describe('web push', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sender en gyldigt signeret VAPID-header uden indhold', async () => {
    const { privateKey } = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey('jwk', privateKey)) as JsonWebKey;
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const status = await sendEmptyPush('https://push.example.com/send/abc', { privateJwk: jwk, subject: 'mailto:test@example.com' });
    expect(status).toBe(201);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const [, jwt, k] = headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(publicKeyFromJwk(jwk));
    expect(headers['Content-Length']).toBe('0');

    const [h, p, sig] = jwt.split('.');
    const payload = JSON.parse(new TextDecoder().decode(b64(p)));
    expect(payload.aud).toBe('https://push.example.com');
    expect(payload.sub).toBe('mailto:test@example.com');

    const pub = await crypto.subtle.importKey('raw', b64(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64(sig), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
  });
});
