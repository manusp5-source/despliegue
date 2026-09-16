#!/usr/bin/env node
/**
 * alta-cliente.mjs -- generates a client's deployment package.
 *
 *   node alta-cliente.mjs --cliente="Clinica Dental Ejemplo" --dominio=clinicaejemplo.es
 *   node alta-cliente.mjs --cliente="..." --dominio=... --pack=recepcion
 *   node alta-cliente.mjs --cliente="..." --dominio=... --pack=completo --marca="Sonrisa"
 *
 * Packs: recepcion (chatbot) | comercial (crm) | completo (all three)
 *
 * Writes into clientes/{slug}/ a .env per application, with the secrets
 * already generated and the domains already filled in, plus a summary for
 * onboarding in Dokploy.
 *
 * Why this exists: onboarding a client by hand is 35 variables spread
 * across three files, with three different secret formats and four places
 * where the same domain has to match itself. Doing it by hand the day you
 * have five clients ends in a broken deployment that takes an hour to
 * diagnose.
 *
 * The secret formats are NOT interchangeable. They're documented below, one
 * by one, with the exact symptom that getting it wrong produces.
 */

import { randomBytes } from 'crypto';
import { mkdir, writeFile, readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));

// --- secrets -----------------------------------------------------------

/**
 * Postgres password. HEX, never base64.
 *
 * It travels inside the connection URL (postgresql://user:PASSWORD@host/db)
 * and the symbols base64 introduces -- "+" and "/" -- split it in half.
 * Symptom: "password authentication failed for user" in a loop, with the
 * correct password right there. Both AndrIA and the CRM document this.
 */
const passwordDB = () => randomBytes(24).toString('hex');

/** Session signing key. 48-byte base64, which is what all three apps require. */
const jwtSecret = () => randomBytes(48).toString('base64');

/** CRM encryption key: 32 bytes in base64 (44 characters). */
const claveCifradoCRM = () => randomBytes(32).toString('base64');

/**
 * Chatbot encryption key: Fernet format (Python `cryptography`).
 *
 * It's URL-safe base64 of 32 bytes WITH padding. Regular base64 won't work:
 * Fernet rejects "+" and "/" and the backend fails to start. Exactly
 * equivalent to `Fernet.generate_key()`.
 */
const claveFernet = () =>
  randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

/** Human password: readable when dictated over the phone, and strong enough. */
const passwordHumana = () => randomBytes(18).toString('base64').replace(/[+/=]/g, '');

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// --- arguments -----------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);

const PACKS = {
  recepcion: ['chatbot'],
  comercial: ['crm'],
  completo: ['chatbot', 'crm', 'andria'],
};

const cliente = typeof args.cliente === 'string' ? args.cliente : '';
const dominio = typeof args.dominio === 'string' ? args.dominio.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
const pack = typeof args.pack === 'string' ? args.pack : 'completo';
const marca = typeof args.marca === 'string' ? args.marca : cliente;
const email = typeof args.email === 'string' ? args.email : '';

if (!cliente || !dominio) {
  console.error('Missing data.\n');
  console.error('  node alta-cliente.mjs --cliente="Clinica Dental Ejemplo" --dominio=clinicaejemplo.es [--pack=completo] [--marca="..."] [--email=admin@...]\n');
  console.error(`  packs: ${Object.keys(PACKS).join(' | ')}`);
  process.exit(1);
}

if (!PACKS[pack]) {
  console.error(`Pack "${pack}" does not exist. Options: ${Object.keys(PACKS).join(', ')}`);
  process.exit(1);
}

const slug = slugify(cliente);
const apps = PACKS[pack];
const destino = resolve(AQUI, 'clientes', slug);

// An already-onboarded client is never overwritten: its secrets are the
// ones running in production, and regenerating them leaves the
// installation inaccessible.
try {
  const existentes = await readdir(destino);
  if (existentes.length) {
    console.error(`clientes/${slug}/ already exists with files in it. Not touching it.`);
    console.error('If you really want to redo it, move it aside by hand first.');
    process.exit(1);
  }
} catch {
  // doesn't exist: proceed
}

const adminEmail = email || `admin@${dominio}`;
const adminPassword = passwordHumana();

// --- files -----------------------------------------------------------

const cabecera = (app) => `# ${app} -- ${cliente}
# Generated on ${new Date().toISOString().slice(0, 10)} by alta-cliente.mjs
#
# Paste this into Dokploy -> the service -> Environment. It is NOT versioned
# and NOT sent over WhatsApp or email: hand it over via a password manager.
#
# The administrator password is at the end of the file.
`;

const ficheros = {};

if (apps.includes('crm')) {
  ficheros['crm.env'] = `${cabecera('Eskailet CRM')}
JWT_SECRET=${jwtSecret()}
JWT_EXPIRATION=8h
# If this key is lost, the credentials stored inside the CRM (AI, email)
# cannot be recovered and all of them have to be re-entered.
ENCRYPTION_KEY=${claveCifradoCRM()}
DB_PASSWORD=${passwordDB()}

NODE_ENV=production
PORT=3000
APP_URL=https://crm.${dominio}
# Empty on purpose: the CRM lives on a single domain and nginx proxies /api.
CORS_ORIGIN=
UPLOADS_DIR=/data/uploads
VITE_API_BASE_URL=/api/v1

SEED_ADMIN_EMAIL=${adminEmail}
SEED_ADMIN_PASSWORD=${adminPassword}
`;
}

if (apps.includes('chatbot')) {
  ficheros['chatbot.env'] = `${cabecera('Multichannel chatbot')}
APP_NAME=${marca}
APP_BASE_URL=https://api.${dominio}
FRONTEND_BASE_URL=https://chat.${dominio}
MCP_BASE_URL=https://mcp.${dominio}

POSTGRES_USER=app
POSTGRES_DB=chatbot
POSTGRES_PASSWORD=${passwordDB()}

JWT_SECRET=${jwtSecret()}
# Fernet format (URL-safe base64 with padding). With plain base64 the
# backend won't start.
ENCRYPTION_KEY=${claveFernet()}

INITIAL_ADMIN_EMAIL=${adminEmail}
INITIAL_ADMIN_PASSWORD=${adminPassword}

# Number of proxies in front. With Dokploy (Traefik) it's 1. If you leave it
# at 0, rate limiting always sees the proxy's IP and throttles everyone at
# once.
TRUSTED_PROXY_COUNT=1
DEFAULT_LLM_MODEL=gpt-4o-mini
`;
}

if (apps.includes('andria')) {
  ficheros['andria.env'] = `${cabecera('AndrIA')}
POSTGRES_USER=andria_user
POSTGRES_DB=andria
POSTGRES_PASSWORD=${passwordDB()}

ADMIN_USERNAME=admin
ADMIN_PASSWORD=${adminPassword}

# No trailing slash: FRONTEND_URL is compared against the Origin header,
# which never carries one. With the extra slash, the browser blocks every
# call and no error shows up on the server.
FRONTEND_URL=https://andria.${dominio}
NEXT_PUBLIC_API_URL=https://andria-api.${dominio}
NEXT_PUBLIC_WS_URL=wss://andria-api.${dominio}

# These two are build args: changing them requires rebuilding the image, a
# restart isn't enough.
NEXT_PUBLIC_APP_NAME=${marca}
NEXT_PUBLIC_APP_TAGLINE=Tu asistente
`;
}

// --- domains and services -----------------------------------------------------

const DOMINIOS = {
  crm: [['crm', 'frontend', 80, 'The entire CRM. The only domain the user sees.']],
  chatbot: [
    ['chat', 'frontend', 80, "The panel. Used by the client's team."],
    ['api', 'app', 8000, 'The API. WhatsApp and Instagram webhooks point here.'],
    ['mcp', 'mcp', 8080, 'MCP server. Only if the client is going to connect external agents.'],
  ],
  andria: [
    ['andria', 'web', 3000, 'The dashboard.'],
    ['andria-api', 'api', 3001, 'The API and the WebSocket.'],
  ],
};

const NOMBRES = { crm: 'Eskailet CRM', chatbot: 'Multichannel chatbot', andria: 'AndrIA' };
const REPOS = { crm: 'eskailet-crm', chatbot: 'eskailet-chatbot', andria: 'andria' };

const filasDNS = apps.flatMap((a) => DOMINIOS[a].map(([sub, svc, puerto, nota]) => ({ app: a, sub, svc, puerto, nota })));

const resumen = `# Onboarding — ${cliente}

**Pack:** ${pack} · **Domain:** ${dominio} · **Date:** ${new Date().toISOString().slice(0, 10)}

## 1 · DNS (before touching Dokploy)

One A record per subdomain, pointing at the server's IP. If DNS hasn't
propagated, Traefik can't get the certificate and the deployment looks
broken when it's just waiting.

| Subdomain | Points to service | Port | What for |
|---|---|---|---|
${filasDNS.map((f) => `| \`${f.sub}.${dominio}\` | \`${f.svc}\` (${NOMBRES[f.app]}) | ${f.puerto} | ${f.nota} |`).join('\n')}

## 2 · In Dokploy, once per application

${apps
  .map(
    (a, i) => `### ${i + 1}. ${NOMBRES[a]}

1. **Create → Compose**, name \`${slug}-${a}\`.
2. Private repository \`${REPOS[a]}\`, branch \`main\`.
3. Compose Path: \`docker-compose.easypanel.yml\`.
4. **Environment**: paste the entirety of \`${a}.env\`.
5. **Domains**: ${DOMINIOS[a].map(([sub, svc, puerto]) => `\`${sub}.${dominio}\` → \`${svc}\`:${puerto}`).join(' · ')}
6. Deploy. The first boot applies migrations: it can take over a minute.`
  )
  .join('\n\n')}

## 3 · Login credentials

| | |
|---|---|
| Username | \`${adminEmail}\` |
| Password | \`${adminPassword}\` |

It's the same across the pack's ${apps.length === 1 ? 'application' : `${apps.length} applications`}, on purpose:
the client only has to remember one. **It gets changed on first login** and
that's on the handoff checklist.

## 4 · What's left before calling it delivered

${apps.includes('chatbot') ? `- Chatbot: real keys in \`/admin/connections\` (OpenAI, YCloud or Meta) and copy the webhook URLs into each provider's panel.
- Chatbot: fill in both agents' prompts. They ship with \`[[ RELLENAR: … ]]\` placeholders and the Home checklist won't stop complaining until none are left.
- Chatbot: load the client's documentation into the Knowledge Base.
` : ''}${apps.includes('crm') ? `- CRM: Settings → General (logo, legal name, tax details) or the quote PDFs come out blank.
- CRM: Settings → Backups. Destination, frequency and **one test restore**.
- CRM: Settings → AI, with a monthly spend cap. Without a cap, it doesn't activate.
` : ''}${apps.includes('andria') ? `- AndrIA: Settings → Services, OpenAI key. Without it there's no chat.
` : ''}
Full detail in [\`../entrega-cliente.md\`](../entrega-cliente.md).
`;

// --- writing -----------------------------------------------------------

await mkdir(destino, { recursive: true });
for (const [nombre, contenido] of Object.entries(ficheros)) {
  await writeFile(resolve(destino, nombre), contenido, 'utf-8');
}
await writeFile(resolve(destino, 'ALTA.md'), resumen, 'utf-8');

console.log(`\n✓ clientes/${slug}/`);
for (const n of Object.keys(ficheros)) console.log(`   ${n}`);
console.log("   ALTA.md          ← this client's runbook\n");
console.log(`   Pack:       ${pack} (${apps.map((a) => NOMBRES[a]).join(', ')})`);
console.log(`   Subdomains: ${filasDNS.map((f) => `${f.sub}.${dominio}`).join(', ')}`);
console.log(`   Admin:      ${adminEmail} / ${adminPassword}\n`);
console.log('   These files carry plaintext secrets. They are not versioned and');
console.log("   don't leave here except to a password manager.\n");
