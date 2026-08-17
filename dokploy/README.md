# Kit de alta de cliente — Dokploy

Cómo se monta una instalación nueva. Un cliente, un servidor, tres aplicaciones
posibles. El objetivo de este kit es que dar de alta a alguien sean **cuarenta
minutos y ningún secreto escrito a mano**.

```bash
node alta-cliente.mjs --cliente="Clínica Dental Ejemplo" --dominio=clinicaejemplo.es --pack=recepcion
```

Eso escribe `clientes/{slug}/` con un `.env` por aplicación —secretos ya
generados, dominios ya escritos— y un `ALTA.md` que es el runbook de ese cliente
concreto: qué DNS crear, qué pegar en Dokploy y qué falta antes de dar la
entrega por buena.

---

## Los packs

| Pack | Aplicaciones | Para quién | Subdominios |
|---|---|---|---|
| `recepcion` | Chatbot multicanal | Clínicas. Es el producto | 3 |
| `comercial` | CRM Agendia | Negocios con ciclo de venta B2B | 1 |
| `completo` | Chatbot + CRM + asistente | Cliente grande, o tu propia instalación | 6 |

Se venden por separado y se instalan por separado. Un cliente que empieza por
`recepcion` y luego quiere el CRM no se reinstala: se le añade un servicio más en
Dokploy, con su propio `.env`.

---

## Por qué Dokploy y no EasyPanel

Las guías que traen las tres apps (`DEPLOY_EASYPANEL.md`) están escritas para
EasyPanel, pero **no hace falta instalarlo**. Los `docker-compose.easypanel.yml`
no publican puertos, no traen etiquetas de Traefik y no declaran redes: delegan
el dominio y el TLS en la plataforma. Eso es exactamente lo que hace Dokploy.

Se traduce así:

| La guía dice | En Dokploy |
|---|---|
| «Pega esto en EasyPanel → Compose» | Create → **Compose**, apuntando al repositorio |
| «EasyPanel → Env» | Pestaña **Environment** |
| «Asigna el Dominio a este servicio» | **Domains** → servicio + puerto |
| «EasyPanel gestiona el TLS» | Traefik lo gestiona igual |

**Lo único que hay que añadir:** el servicio que lleva dominio tiene que estar en
la red `dokploy-network` para que Traefik lo alcance. Comprueba en tu instancia
si Dokploy la adjunta solo al asignar el dominio; si no, se declara externa en el
compose y se añade al servicio.

---

## Antes de la primera alta, una sola vez

1. **Tres repositorios privados**, uno por aplicación: `eskailet-crm`,
   `eskailet-chatbot`, `andria`. Dokploy construye desde el código fuente
   (los compose usan `build:`, no imágenes publicadas), así que necesita acceso.

   **Privados no es una preferencia.** La licencia de las tres prohíbe publicar
   el código. Un repositorio público sería un incumplimiento, no un descuido.

2. **Conectar el proveedor de Git** en Dokploy (GitHub App o clave de despliegue).

3. **Apagar el auto-despliegue.** Si está activo, cualquier push a `main` sale a
   producción de todos los clientes a la vez. Se despliega a mano, cliente por
   cliente.

---

## El alta, paso a paso

### 1 · Generar el paquete

```bash
node alta-cliente.mjs --cliente="Clínica Dental Ejemplo" \
                      --dominio=clinicaejemplo.es \
                      --pack=recepcion \
                      --marca="Clínica Ejemplo" \
                      --email=direccion@clinicaejemplo.es
```

`--marca` es el nombre que verá el cliente dentro de la aplicación. Si no lo
pones, se usa el nombre del cliente.

El script **no pisa un cliente ya dado de alta**: si la carpeta existe con
ficheros dentro, para. Regenerar los secretos de una instalación en marcha la
deja inaccesible y sin forma obvia de volver atrás.

### 2 · DNS

Un registro A por subdominio a la IP del servidor, según la tabla del `ALTA.md`.
**Antes de tocar Dokploy.** Si el DNS no ha propagado, Traefik no consigue el
certificado y el despliegue parece roto cuando solo está esperando.

### 3 · Crear el servicio en Dokploy

Por cada aplicación del pack: Compose → repositorio → `docker-compose.easypanel.yml`
→ pegar el `.env` en Environment → asignar dominios → Deploy.

El primer arranque aplica todas las migraciones y siembra el administrador. En un
servidor modesto pasa del minuto: el `start_period` del healthcheck está puesto en
180 s justo por eso. **No lo des por fallido antes de tiempo.**

### 4 · Configuración inicial dentro de cada app

Está en el `ALTA.md` del cliente y en detalle en
[`entrega-cliente.md`](entrega-cliente.md). Lo que no se puede saltar:

- **Chatbot:** claves reales, URLs de webhook copiadas al panel del proveedor, y
  el prompt de los dos agentes sin marcadores `[[ RELLENAR: … ]]`.
- **CRM:** marca y datos fiscales (sin ellos los PDF de presupuesto salen en
  blanco) y **copias de seguridad con una restauración probada**.
- **Asistente:** clave de OpenAI.

### 5 · Entrega

Checklist en [`entrega-cliente.md`](entrega-cliente.md). Las credenciales van por
gestor de contraseñas, nunca por WhatsApp ni por correo.

---

## Recursos por servidor

Una instalación por cliente. Lo que ocupa cada pack:

| Pack | Contenedores | RAM mínima | Notas |
|---|---|---|---|
| `recepcion` | 7 | 4 GB | Postgres con pgvector, Redis, API, worker, beat, panel y MCP |
| `comercial` | 3 | 2 GB | Postgres, backend y frontend |
| `completo` | 13 | 8 GB | Los dos anteriores más el asistente y su Postgres |

**Dos avisos que no son opinables:**

- **El backend del CRM va a una sola réplica.** Rate-limit, sincronización de
  Gmail, disparador de copias y cola de Calendar guardan estado en memoria del
  proceso. Con dos réplicas esos trabajos se ejecutan por duplicado. Si se queda
  corto, sube CPU y RAM.
- **Cada aplicación lleva su propio Postgres.** El chatbot y el asistente exigen
  `pgvector/pgvector:pg16`; el CRM exige `postgres:16` exacto, porque su backend
  trae `pg_dump` 16 dentro para las copias y servidor y cliente tienen que
  coincidir. No los unifiques en una sola instancia para ahorrar memoria: te
  ahorra 200 MB y te cuesta las copias.

---

## Los secretos, y por qué cada uno tiene su formato

El script los genera bien. Esto es para cuando toque diagnosticar por qué algo no
arranca:

| Secreto | Formato | Qué pasa si te equivocas |
|---|---|---|
| Contraseña de Postgres | **hex**, nunca base64 | Viaja dentro de la URL de conexión; `+` y `/` la parten. Síntoma: `password authentication failed` en bucle con la contraseña correcta delante |
| `JWT_SECRET` | base64, 48 bytes | Si cambia, se cae la sesión de todo el mundo |
| `ENCRYPTION_KEY` del CRM | base64, 32 bytes | **Si se pierde, las credenciales guardadas dentro del CRM son irrecuperables** |
| `ENCRYPTION_KEY` del chatbot | **Fernet** (base64 URL-safe con relleno) | Con base64 normal el backend no arranca |
| `TRUSTED_PROXY_COUNT` | `1` con Dokploy | Con `0`, el rate-limit ve siempre la IP de Traefik y limita a todos a la vez |

---

## Qué NO hay aquí

`clientes/` está en `.gitignore` y no se versiona: son secretos en claro de
instalaciones en producción. La copia buena vive en el gestor de contraseñas.

Si pierdes un `.env` y la instalación sigue en pie, los secretos se leen desde
Dokploy → Environment. Si pierdes los dos, hay que rotar y reintroducir las
credenciales guardadas dentro de cada app.
