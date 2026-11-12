// Minimal Web Push (RFC 8030 + VAPID, RFC 8292) uden payload. Uden payload
// slipper vi for kryptering, og serveren sender aldrig indhold – teksten
// vælges i service workeren (public/push-sw.js).

export interface VapidKeys {
  /** JWK (EC P-256) med x, y og d – sættes med `wrangler secret put VAPID_PRIVATE_KEY`. */
  privateJwk: JsonWebKey;
  /** fx 'mailto:dig@example.com' */
  subject: string;
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Den offentlige nøgle som browseren skal bruge (applicationServerKey). */
export function publicKeyFromJwk(jwk: JsonWebKey): string {
  const x = fromBase64url(jwk.x ?? '');
  const y = fromBase64url(jwk.y ?? '');
  const raw = new Uint8Array(65);
  raw[0] = 4;
  raw.set(x, 1);
  raw.set(y, 33);
  return base64url(raw);
}

async function vapidJwt(audience: string, keys: VapidKeys): Promise<string> {
  const enc = new TextEncoder();
  const header = base64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: keys.subject })),
  );
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

/** Sender en tom push. Returnerer HTTP-status fra push-tjenesten. */
export async function sendEmptyPush(endpoint: string, keys: VapidKeys): Promise<number> {
  const jwt = await vapidJwt(new URL(endpoint).origin, keys);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${publicKeyFromJwk(keys.privateJwk)}`,
      TTL: String(4 * 3600),
      Urgency: 'normal',
      'Content-Length': '0',
    },
  });
  return res.status;
}
