// Genererer et VAPID-nøglepar til web push.
// Brug: npm run generate:vapid  → kopiér JWK-linjen til `wrangler secret put VAPID_PRIVATE_KEY`
const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
const { kty, crv, x, y, d } = jwk;
console.log('VAPID_PRIVATE_KEY (hemmelig – må ikke committes):\n');
console.log(JSON.stringify({ kty, crv, x, y, d }));
