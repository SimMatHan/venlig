import { AuthorizationError, CimdFetchError, type ConsentDescription, type OAuthHelpers } from '@cloudflare/workers-oauth-provider';

// Login til MCP-forbindelsen. Der er kun én bruger, så "login" er en
// adgangskode (MCP_PASSWORD) på selve samtykkesiden.

export const SCOPE = 'venlig:read';

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function passwordMatches(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function page(body: string, status = 200, headers = new Headers()): Response {
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(
    `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Venlig – forbind Claude</title>
<style>
  :root { --bg:#f6f1e7; --card:#fffcf6; --ink:#2c2924; --muted:#625a50; --sage:#4e6f57; --line:#e2d8c5; --clay:#a8644a; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1b1d1a; --card:#252823; --ink:#ece7dc; --muted:#b1aa9d; --sage:#9cbca2; --line:#3a3e37; --clay:#e0a58c; } }
  body { margin:0; background:var(--bg); color:var(--ink); font:18px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width:28rem; margin:0 auto; padding:2rem 1rem; }
  .card { background:var(--card); border-radius:1.5rem; padding:1.5rem; }
  h1 { font-size:1.5rem; margin:0 0 .5rem; }
  p { color:var(--muted); }
  strong { color:var(--ink); }
  input[type=password] { width:100%; box-sizing:border-box; min-height:48px; border:1px solid var(--line); border-radius:1rem; padding:.75rem 1rem; font:inherit; background:var(--bg); color:var(--ink); }
  .row { display:flex; gap:.5rem; margin-top:1rem; }
  button { flex:1; min-height:48px; border:0; border-radius:999px; font:inherit; font-weight:600; cursor:pointer; }
  .ok { background:var(--sage); color:var(--card); }
  .no { background:transparent; color:var(--sage); }
  .warn { color:var(--clay); }
</style></head>
<body><main><div class="card">${body}</div></main></body></html>`,
    { status, headers },
  );
}

function consentPage(d: ConsentDescription, handle: string, error?: string): string {
  const who = d.clientDomain
    ? `<strong>${escape(d.clientName)}</strong> fra <strong>${escape(d.clientDomain)}</strong>`
    : `<strong>${escape(d.clientName)}</strong> (navnet er ikke bekræftet)`;
  return `<h1>Giv Claude adgang til Venlig?</h1>
<p>${who} vil gerne <strong>læse</strong> dine tjek-ins, dagbog, vaner, bøger og værdier. Den kan ikke ændre noget.</p>
<p>Adgangen sendes til <strong>${escape(d.redirectHost)}</strong>.</p>
${d.redirectIsLoopback ? '<p class="warn"><strong>Adgangen sendes til et program på din computer.</strong> Fortsæt kun, hvis du selv lige har startet forbindelsen.</p>' : ''}
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <label for="pw">Adgangskode til Venlig</label>
  <input id="pw" type="password" name="password" autocomplete="current-password" autofocus>
  ${error ? `<p class="warn" role="alert">${escape(error)}</p>` : ''}
  <div class="row">
    <button class="no" name="decision" value="deny">Afvis</button>
    <button class="ok" name="decision" value="approve">Giv adgang</button>
  </div>
</form>`;
}

export async function handleAuthorize(request: Request, oauth: OAuthHelpers, password: string | undefined): Promise<Response> {
  if (!password) {
    return page('<h1>Ikke sat op endnu</h1><p>Sæt hemmeligheden <strong>MCP_PASSWORD</strong> på Workeren (se README).</p>', 503);
  }
  try {
    if (request.method === 'GET') {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return page(consentPage(details, consent.handle), 200, consent.headers);
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const form = await request.formData();
    const handle = String(form.get('handle') ?? '');
    if (form.get('decision') !== 'approve') {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    if (!(await passwordMatches(String(form.get('password') ?? ''), password))) {
      // Langsommere ved forkert kode, så den ikke kan gættes hurtigt.
      await new Promise((r) => setTimeout(r, 1000));
      return page(
        '<h1>Forkert adgangskode</h1><p>Gå tilbage til Claude og start forbindelsen igen.</p>',
        401,
      );
    }
    const approved = await oauth.approveConsent(request, handle, { scope: [SCOPE] });
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: 'owner',
      metadata: {},
      scope: [SCOPE],
      props: { userId: 'owner' },
    });
    approved.headers.set('Location', redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
      const message = error instanceof AuthorizationError ? error.description : 'Appen kunne ikke bekræftes.';
      return page(`<h1>Det gik ikke</h1><p>${escape(message ?? 'Ugyldig anmodning.')}</p><p>Start forbindelsen igen fra Claude.</p>`, 400);
    }
    throw error;
  }
}
