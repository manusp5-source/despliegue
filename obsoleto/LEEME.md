# Pila jubilada — Caddy + UnicornIA-CRM

**No ejecutes nada de esta carpeta.** Se conserva por el razonamiento, no por los
comandos.

Jubilada el 17 de agosto de 2026, Oleada 4 del refactor del paraguas. Lo que hay
aquí ya venía marcado como obsoleto en el `README.md` de la carpeta padre desde el
15 de agosto; esto solo lo hace efectivo moviendo los ficheros, para que nadie
ejecute por costumbre un `docker compose up` que apunta a un proyecto retirado.

## Qué hay aquí

| Fichero | Qué era |
|---|---|
| `docker-compose.yml` | La pila completa de una clínica: `crm`, `n8n`, `langfuse`, `db`, `redis`, `minio` y `proxy` |
| `Caddyfile` | TLS automático y enrutado de los tres dominios hacia `crm:3000`, `n8n:5678` y `langfuse:3000` |
| `init-db.sh` | Creaba las bases `unicornia_crm`, `n8n` y `langfuse` en el primer arranque. Solo lo montaba el compose de arriba |
| `.env.example` | Las variables de esta pila (`DOMINIO_CRM`, `NEXTAUTH_SECRET`, `MINIO_USER`…). Declaraba `POSTGRES_DB=unicornia_crm`, una base que ya no existe |

## Por qué se jubila

Dos motivos, ambos anteriores a esta oleada:

- **DEC-021 — `UnicornIA-CRM` se retira.** El compose construía desde
  `../UnicornIA-CRM` (`docker-compose.yml:75`). Ese es el CRM que la decisión 1 del
  `CLAUDE.md` del paraguas descarta en favor de `eskailet-crm`.
- **DEC-022 — Caddy se sustituye por Dokploy.** El TLS y los dominios los gestiona
  Traefik desde Dokploy, así que el servicio `proxy` y este `Caddyfile` sobran.

**Aviso:** `DEC-021` y `DEC-022` se citan en el `README.md` padre pero **no están
documentadas en ningún `DECISIONS.md` del paraguas**. Una búsqueda por esos
identificadores no devuelve nada fuera de aquí. Conviene escribirlas donde toca.

## Qué se usa en su lugar

[`../dokploy/`](../dokploy/). Ya apunta a `eskailet-crm`
(`alta-cliente.mjs:223` → `REPOS = { crm: 'eskailet-crm', … }`) y cubre las tres
aplicaciones por packs.

## Por qué no se ha reescrito hacia `eskailet-crm`

Era la opción evidente y es la equivocada. Esta pila mete `crm`, `n8n` y
`langfuse` en **un solo Postgres compartido**, y el kit vigente dice lo contrario
por una razón concreta (`../dokploy/README.md:140-144`):

> Cada aplicación lleva su propio Postgres. El chatbot y el asistente exigen
> `pgvector/pgvector:pg16`; el CRM exige `postgres:16` exacto, porque su backend
> trae `pg_dump` 16 dentro para las copias y servidor y cliente tienen que
> coincidir.

Además `eskailet-crm` no es un servicio, son **dos** (backend Express + frontend
nginx), así que el bloque `crm:` de este compose no le vale. Adaptarlo habría
dejado dos pilas de despliegue que mantener en paralelo.

## Si alguna vez hay que volver

Los ficheros están enteros y el historial de git los sigue por el rename. Para
recuperar la pila tal cual estaba:

```bash
git log --follow -- despliegue/obsoleto/docker-compose.yml
```

El `.env.example` se ha movido aquí con el resto: solo servía a esta pila y
declaraba `POSTGRES_DB=unicornia_crm`. El kit vigente no lo usa — genera un `.env`
por cliente y por aplicación con `alta-cliente.mjs`.

El `.env` real de la carpeta padre sigue donde estaba y **no se versiona**
(`.gitignore`). Si tenía secretos de una instalación viva, siguen ahí.
