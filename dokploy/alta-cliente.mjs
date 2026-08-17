#!/usr/bin/env node
/**
 * alta-cliente.mjs -- genera el paquete de despliegue de un cliente.
 *
 *   node alta-cliente.mjs --cliente="Clinica Dental Ejemplo" --dominio=clinicaejemplo.es
 *   node alta-cliente.mjs --cliente="..." --dominio=... --pack=recepcion
 *   node alta-cliente.mjs --cliente="..." --dominio=... --pack=completo --marca="Sonrisa"
 *
 * Packs: recepcion (chatbot) | comercial (crm) | completo (los tres)
 *
 * Escribe en clientes/{slug}/ un .env por aplicacion, con los secretos ya
 * generados y los dominios ya escritos, mas un resumen para el alta en Dokploy.
 *
 * Por que existe: dar de alta un cliente a mano son 35 variables repartidas en
 * tres ficheros, con tres formatos de secreto distintos y cuatro sitios donde
 * el mismo dominio tiene que coincidir consigo mismo. Hacerlo a mano el dia que
 * tengas cinco clientes acaba en un despliegue roto que tarda una hora en
 * diagnosticarse.
 *
 * Los formatos de secreto NO son intercambiables. Estan documentados abajo, uno
 * por uno, con el sintoma exacto que produce equivocarse.
 */

import { randomBytes } from 'crypto';
import { mkdir, writeFile, readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));

// --- secretos ---------------------------------------------------------------

/**
 * Contraseña de Postgres. HEX, nunca base64.
 *
 * Viaja dentro de la URL de conexion (postgresql://user:CLAVE@host/bd) y los
 * simbolos que mete base64 -- "+" y "/" -- la parten por la mitad. Sintoma:
 * "password authentication failed for user" en bucle, con la contraseña
 * correcta delante. Lo documentan tanto AndrIA como el CRM.
 */
const passwordDB = () => randomBytes(24).toString('hex');

/** Firma de sesion. base64 de 48 bytes, que es lo que piden las tres apps. */
const jwtSecret = () => randomBytes(48).toString('base64');

/** Clave de cifrado del CRM: 32 bytes en base64 (44 caracteres). */
const claveCifradoCRM = () => randomBytes(32).toString('base64');

/**
 * Clave de cifrado del chatbot: formato Fernet (Python `cryptography`).
 *
 * Es base64 URL-safe de 32 bytes CON relleno. No vale el base64 normal: Fernet
 * rechaza "+" y "/" y aborta el arranque del backend. Equivale exactamente a
 * `Fernet.generate_key()`.
 */
const claveFernet = () =>
  randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

/** Contraseña de persona: legible al dictarla por telefono, y suficiente. */
const passwordHumana = () => randomBytes(18).toString('base64').replace(/[+/=]/g, '');

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// --- argumentos -------------------------------------------------------------

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
  console.error('Faltan datos.\n');
  console.error('  node alta-cliente.mjs --cliente="Clinica Dental Ejemplo" --dominio=clinicaejemplo.es [--pack=completo] [--marca="..."] [--email=admin@...]\n');
  console.error(`  packs: ${Object.keys(PACKS).join(' | ')}`);
  process.exit(1);
}

if (!PACKS[pack]) {
  console.error(`Pack "${pack}" no existe. Opciones: ${Object.keys(PACKS).join(', ')}`);
  process.exit(1);
}

const slug = slugify(cliente);
const apps = PACKS[pack];
const destino = resolve(AQUI, 'clientes', slug);

// Nunca se pisa un cliente ya dado de alta: sus secretos son los que estan
// funcionando en produccion y regenerarlos deja la instalacion inaccesible.
try {
  const existentes = await readdir(destino);
  if (existentes.length) {
    console.error(`Ya existe clientes/${slug}/ con ficheros dentro. No se toca.`);
    console.error('Si de verdad quieres rehacerlo, muevelo a mano antes.');
    process.exit(1);
  }
} catch {
  // no existe: seguimos
}

const adminEmail = email || `admin@${dominio}`;
const adminPassword = passwordHumana();

// --- ficheros ---------------------------------------------------------------

const cabecera = (app) => `# ${app} -- ${cliente}
# Generado el ${new Date().toISOString().slice(0, 10)} por alta-cliente.mjs
#
# Esto se pega en Dokploy -> el servicio -> Environment. NO se versiona y NO se
# manda por WhatsApp ni por correo: se entrega en un gestor de contraseñas.
#
# La contraseña del administrador va al final del fichero.
`;

const ficheros = {};

if (apps.includes('crm')) {
  ficheros['crm.env'] = `${cabecera('CRM Eskailet')}
JWT_SECRET=${jwtSecret()}
JWT_EXPIRATION=8h
# Si esta clave se pierde, las credenciales guardadas dentro del CRM (IA,
# correo) no se pueden recuperar y hay que reintroducirlas todas.
ENCRYPTION_KEY=${claveCifradoCRM()}
DB_PASSWORD=${passwordDB()}

NODE_ENV=production
PORT=3000
APP_URL=https://crm.${dominio}
# Vacio a proposito: el CRM vive en un solo dominio y nginx proxya /api.
CORS_ORIGIN=
UPLOADS_DIR=/data/uploads
VITE_API_BASE_URL=/api/v1

SEED_ADMIN_EMAIL=${adminEmail}
SEED_ADMIN_PASSWORD=${adminPassword}
`;
}

if (apps.includes('chatbot')) {
  ficheros['chatbot.env'] = `${cabecera('Chatbot multicanal')}
APP_NAME=${marca}
APP_BASE_URL=https://api.${dominio}
FRONTEND_BASE_URL=https://chat.${dominio}
MCP_BASE_URL=https://mcp.${dominio}

POSTGRES_USER=app
POSTGRES_DB=chatbot
POSTGRES_PASSWORD=${passwordDB()}

JWT_SECRET=${jwtSecret()}
# Formato Fernet (base64 URL-safe con relleno). Con base64 normal el backend
# no arranca.
ENCRYPTION_KEY=${claveFernet()}

INITIAL_ADMIN_EMAIL=${adminEmail}
INITIAL_ADMIN_PASSWORD=${adminPassword}

# Numero de proxies delante. Con Dokploy (Traefik) es 1. Si lo dejas en 0, el
# rate-limit ve siempre la IP del proxy y limita a todo el mundo a la vez.
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

# Sin barra final: FRONTEND_URL se compara con la cabecera Origin, que nunca la
# lleva. Con la barra de mas, el navegador bloquea todas las llamadas y en el
# servidor no aparece ningun error.
FRONTEND_URL=https://andria.${dominio}
NEXT_PUBLIC_API_URL=https://andria-api.${dominio}
NEXT_PUBLIC_WS_URL=wss://andria-api.${dominio}

# Estos dos son build args: cambiarlos exige reconstruir la imagen, no basta
# reiniciar.
NEXT_PUBLIC_APP_NAME=${marca}
NEXT_PUBLIC_APP_TAGLINE=Tu asistente
`;
}

// --- dominios y servicios ---------------------------------------------------

const DOMINIOS = {
  crm: [['crm', 'frontend', 80, 'El CRM entero. Es el unico dominio que ve el usuario.']],
  chatbot: [
    ['chat', 'frontend', 80, 'El panel. Es el que usa el equipo del cliente.'],
    ['api', 'app', 8000, 'La API. Aqui apuntan los webhooks de WhatsApp e Instagram.'],
    ['mcp', 'mcp', 8080, 'Servidor MCP. Solo si el cliente va a conectar agentes externos.'],
  ],
  andria: [
    ['andria', 'web', 3000, 'El dashboard.'],
    ['andria-api', 'api', 3001, 'La API y el WebSocket.'],
  ],
};

const NOMBRES = { crm: 'CRM Eskailet', chatbot: 'Chatbot multicanal', andria: 'AndrIA' };
const REPOS = { crm: 'eskailet-crm', chatbot: 'eskailet-chatbot', andria: 'andria' };

const filasDNS = apps.flatMap((a) => DOMINIOS[a].map(([sub, svc, puerto, nota]) => ({ app: a, sub, svc, puerto, nota })));

const resumen = `# Alta — ${cliente}

**Pack:** ${pack} · **Dominio:** ${dominio} · **Fecha:** ${new Date().toISOString().slice(0, 10)}

## 1 · DNS (antes de tocar Dokploy)

Un registro A por subdominio, apuntando a la IP del servidor. Si el DNS no ha
propagado, Traefik no consigue el certificado y el despliegue parece roto
cuando solo está esperando.

| Subdominio | Va al servicio | Puerto | Para qué |
|---|---|---|---|
${filasDNS.map((f) => `| \`${f.sub}.${dominio}\` | \`${f.svc}\` (${NOMBRES[f.app]}) | ${f.puerto} | ${f.nota} |`).join('\n')}

## 2 · En Dokploy, una vez por aplicación

${apps
  .map(
    (a, i) => `### ${i + 1}. ${NOMBRES[a]}

1. **Create → Compose**, nombre \`${slug}-${a}\`.
2. Repositorio privado \`${REPOS[a]}\`, rama \`main\`.
3. Compose Path: \`docker-compose.easypanel.yml\`.
4. **Environment**: pegar \`${a}.env\` entero.
5. **Domains**: ${DOMINIOS[a].map(([sub, svc, puerto]) => `\`${sub}.${dominio}\` → \`${svc}\`:${puerto}`).join(' · ')}
6. Deploy. El primer arranque aplica migraciones: puede pasar del minuto.`
  )
  .join('\n\n')}

## 3 · Credenciales de entrada

| | |
|---|---|
| Usuario | \`${adminEmail}\` |
| Contraseña | \`${adminPassword}\` |

Es la misma en las ${apps.length === 1 ? 'aplicación' : `${apps.length} aplicaciones`} del pack, a propósito: el cliente
solo memoriza una. **Se cambia en el primer acceso** y eso va en el checklist de
entrega.

## 4 · Lo que falta antes de dar por entregado

${apps.includes('chatbot') ? `- Chatbot: claves reales en \`/admin/connections\` (OpenAI, YCloud o Meta) y copiar las URLs de webhook al panel de cada proveedor.
- Chatbot: rellenar el prompt de los dos agentes. Vienen con marcadores \`[[ RELLENAR: … ]]\` y el checklist de Inicio no se calla hasta que no quede ninguno.
- Chatbot: cargar la documentación del cliente en la Base de Conocimiento.
` : ''}${apps.includes('crm') ? `- CRM: Ajustes → General (logo, razón social, datos fiscales) o los PDF de presupuesto salen en blanco.
- CRM: Ajustes → Copias de seguridad. Destino, frecuencia y **una restauración de prueba**.
- CRM: Ajustes → IA, con tope de gasto mensual. Sin tope, no se activa.
` : ''}${apps.includes('andria') ? `- AndrIA: Configuración → Servicios, clave de OpenAI. Sin ella no hay chat.
` : ''}
Detalle completo en [\`../entrega-cliente.md\`](../entrega-cliente.md).
`;

// --- escritura --------------------------------------------------------------

await mkdir(destino, { recursive: true });
for (const [nombre, contenido] of Object.entries(ficheros)) {
  await writeFile(resolve(destino, nombre), contenido, 'utf-8');
}
await writeFile(resolve(destino, 'ALTA.md'), resumen, 'utf-8');

console.log(`\n✓ clientes/${slug}/`);
for (const n of Object.keys(ficheros)) console.log(`   ${n}`);
console.log('   ALTA.md          ← el runbook de este cliente\n');
console.log(`   Pack:       ${pack} (${apps.map((a) => NOMBRES[a]).join(', ')})`);
console.log(`   Subdominios: ${filasDNS.map((f) => `${f.sub}.${dominio}`).join(', ')}`);
console.log(`   Admin:      ${adminEmail} / ${adminPassword}\n`);
console.log('   Estos ficheros llevan secretos en claro. No se versionan y no salen');
console.log('   de aqui salvo a un gestor de contraseñas.\n');
