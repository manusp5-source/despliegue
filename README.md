# Despliegue y decisiones técnicas

> ## El kit vigente es [`dokploy/`](dokploy/)
>
> Un cliente se da de alta con:
>
> ```bash
> node dokploy/alta-cliente.mjs --cliente="..." --dominio=... --pack=recepcion
> ```
>
> La pila anterior —Caddy sobre `UnicornIA-CRM`— **se jubiló el 17/08/2026** y
> vive en [`obsoleto/`](obsoleto/), con el porqué escrito en su `LEEME.md`:
> `UnicornIA-CRM` se retira (DEC-021) y Caddy se sustituye por Dokploy (DEC-022).
>
> **Lo que sigue de este documento describe esa pila jubilada.** Se conserva
> porque el razonamiento sigue siendo válido —por qué tres capas de
> observabilidad, por qué TypeScript y no LangGraph, por qué una instalación por
> cliente— pero **los comandos y los servicios ya no**. Para desplegar, ve a
> `dokploy/`; esto es lectura, no ejecución.

Cómo se pone esto en marcha en una clínica, qué se usa para vigilarlo, y por
qué está escrito en lo que está escrito.

---

## Índice

1. [Dónde se ejecutan los workflows](#1-dónde-se-ejecutan-los-workflows)
2. [Observabilidad: qué mira cada herramienta](#2-observabilidad)
3. [Por qué TypeScript y no Python/LangChain/LangGraph](#3-por-qué-typescript-y-no-python)
4. [El despliegue, servicio por servicio](#4-el-despliegue)

---

## 1. Dónde se ejecutan los workflows

**Hasta ahora, en ningún sitio.** Es la respuesta honesta.

Los 14 workflows son ficheros JSON en `clinicas-web/automatizaciones/workflows/`.
Nadie los ha importado. No había ningún n8n en el Docker de este proyecto —
solo Postgres, Redis y MinIO, que son las dependencias del CRM.

Con este compose, n8n pasa a ser un servicio más de la pila y los workflows
quedan montados en `/workflows` dentro del contenedor, listos para importar
desde la interfaz.

**Lo que sigue sin estar comprobado**, y solo se ve al importarlos: que n8n
interprete bien las expresiones, que las credenciales de Gmail, Drive y Google
Places sean válidas, y que los disparadores salten a su hora. Calcula media
mañana la primera vez.

Lo que **sí** está comprobado es el contrato: cada llamada que hará un
workflow existe en el CRM, acepta lo que le manda y devuelve las claves que el
nodo `Code` va a leer (`npx tsx scripts/simular-workflows.ts`, 27/27). Eso es
lo que de verdad rompe una integración: un workflow con la URL bien y el
nombre de un campo mal se importa sin quejarse, se activa, y falla en silencio
durante semanas.

---

## 2. Observabilidad

Tres capas que miran cosas distintas. No se solapan.

| Capa | Responde a | Dónde |
|------|-----------|-------|
| **Historial de n8n** | ¿se ejecutó el workflow y fue bien? | `n8n.tuclinica.es` |
| **Registro de auditoría del CRM** | ¿quién tocó qué dato y cuándo? | Panel → Admin |
| **Langfuse** | ¿qué le dijo el modelo al paciente y por qué? | `logs.tuclinica.es` |

### Por qué las tres, y no solo n8n

El historial de n8n dice que un workflow terminó en verde. No dice qué
escribió el modelo. Y cuando una clínica pregunta —**y va a preguntar**—
*«¿qué le contestó vuestro asistente a este señor?»*, «salió en verde» no es
una respuesta.

Langfuse guarda cada llamada al modelo: el prompt exacto, la respuesta, el
coste y cuánto tardó. Sirve para tres cosas distintas:

- **Depurar.** Cuando el triaje clasifica mal un correo, se ve el texto que
  entró y la categoría que salió, en vez de adivinar.
- **Controlar el gasto.** Cada ejecución tiene su coste. Sin esto, la factura
  de OpenAI es un número al final de mes sin desglose.
- **Acreditar cumplimiento.** Poder enseñar que el guardarraíl clínico se
  disparó y derivó, con fecha y hora, es la prueba de que el sistema hizo lo
  que dices que hace.

### Autoalojado, no en la nube de Langfuse

Por ahí pasan mensajes de pacientes. Es un tratamiento de datos de salud, y
mandarlos a un tercero fuera de la instalación de la clínica abriría una
conversación de RGPD que no hace falta tener. El contenedor va en la misma
pila, contra la misma Postgres, y los datos no salen.

### Lo que falta por conectar

Los workflows con IA (recepción 24/7, triaje, asistente del equipo) todavía no
envían trazas a Langfuse. Hay que añadir el `callback` de Langfuse en los
nodos de modelo. Es trabajo de una tarde y no bloquea el despliegue.

---

## 3. Por qué TypeScript y no Python

La pregunta correcta no es «¿cuál es mejor lenguaje?», sino **«¿qué falla si
elijo el otro?»**. Aquí:

### El CRM: TypeScript, y no había mucha discusión

| Motivo | Detalle |
|--------|---------|
| **Es una aplicación web, no un modelo** | El 95 % del código es formularios, tablas, calendario y permisos. Ahí Python no aporta nada y obliga a mantener dos lenguajes: uno para el backend y JavaScript igualmente para el navegador |
| **Un solo lenguaje de punta a punta** | El tipo `Reminder` es el mismo en la base, en la API y en la pantalla. Con FastAPI + React hay que redefinirlo dos veces y mantenerlas sincronizadas a mano |
| **Prisma** | El esquema es la fuente de verdad y genera los tipos. Al añadir `EXPIRED` al enum, el compilador señaló los sitios donde había que tratarlo. SQLAlchemy no da eso |
| **Una persona** | Trabajando solo, dos lenguajes es el doble de dependencias, de CI y de cosas que se rompen al actualizar |

### Y entonces, ¿por qué no LangChain o LangGraph?

Esta es la parte que merece explicación, porque **sí** hay un agente hablando
con pacientes.

**Porque la parte de IA de este producto es minúscula, y a propósito.**

Mira lo que hace de verdad el sistema:

- Un recordatorio de cita es una plantilla con una fecha. No hay modelo.
- El relleno de huecos es ordenar candidatos por cuatro criterios. Es una
  función pura de 40 líneas, probada con 34 casos. Un modelo lo haría peor y
  no sabrías por qué eligió a quien eligió.
- El seguimiento de presupuestos son tres mensajes a 3, 10 y 30 días.
- El guardarraíl clínico es una **lista de palabras**. Deliberadamente. Un
  clasificador con LLM sería más elegante y menos fiable, y aquí un falso
  negativo es un sistema opinando sobre el síntoma de un paciente.

LangGraph resuelve grafos de agentes con estado, ciclos y decisiones
complejas. Este producto no tiene eso: tiene **un** agente conversacional, con
memoria de conversación y un guardarraíl determinista delante. Meter LangGraph
para eso es añadir una dependencia grande, un lenguaje más y un runtime más
para resolver un problema que no tienes.

**Y donde sí hace falta un agente, ya hay algo mejor para este caso: n8n.**

| | LangGraph | n8n |
|---|---|---|
| Quién puede tocarlo | quien programe Python | tú, y con el tiempo la clínica |
| Ver por qué falló | leer trazas | mirar el nodo rojo |
| Añadir «avisa por Telegram» | escribir código | arrastrar un nodo |
| Vendible como producto | no se enseña | **se enseña en pantalla** |

Ese último punto no es menor: puedes abrir n8n delante del doctor y **enseñarle
el dibujo** de lo que hace su sistema. Un grafo de LangGraph no se enseña.

### Cuándo cambiaría de opinión

Sería deshonesto decir que TypeScript gana siempre. Pasaría a Python si:

- Hubiera que **entrenar o afinar** un modelo con datos de la clínica.
- El RAG del asistente creciera a miles de documentos con reordenamiento y
  evaluación seria — ahí el ecosistema Python está años por delante.
- Apareciera un agente con **muchos pasos y vuelta atrás** (por ejemplo, un
  agente que negocia un plan de tratamiento por fases). Eso sí es LangGraph.

Ninguna de las tres se cumple hoy. La primera probablemente no se cumpla nunca
en una clínica de 4 sillones.

### El resumen en una frase

> Este producto no es una aplicación de IA con un CRM pegado. Es un CRM que
> usa IA en dos sitios muy concretos, y esos dos sitios están mejor servidos
> por un workflow que se puede enseñar que por un framework que no.

---

## 4. El despliegue

### Los servicios

| Servicio | Para qué | Expuesto |
|----------|----------|----------|
| `proxy` (Caddy) | TLS automático y única puerta de entrada | **80, 443** |
| `crm` | La aplicación | no |
| `n8n` | Los 14 workflows | no |
| `langfuse` | Trazas de IA | no |
| `db` (Postgres 16) | Datos del CRM, de n8n y de Langfuse | no |
| `redis` | Cola de trabajos | no |
| `minio` | Radiografías, consentimientos | no |

Solo el proxy tiene puertos publicados. El resto habla por la red interna de
Docker, así que `n8n` llama al CRM en `http://crm:3000` sin dar la vuelta por
internet.

### Tres bases en un solo Postgres

La base del CRM, `n8n` y `langfuse`, creadas por `init-db.sh`. Comparten
servidor pero no base: si el historial de n8n crece sin control o una
migración de Langfuse sale mal, no se lleva por delante los datos de los
pacientes, que son los únicos irrecuperables.

**Esto ya no se hace así.** El kit de `dokploy/` da a cada aplicación su propio
Postgres, y no por gusto: el chatbot y el asistente exigen
`pgvector/pgvector:pg16` y el CRM exige `postgres:16` exacto, porque su backend
trae `pg_dump` 16 dentro para las copias y servidor y cliente tienen que
coincidir. Ver [`dokploy/README.md`](dokploy/README.md) → «Recursos por servidor».

### Puesta en marcha

```bash
cd despliegue
cp .env.example .env       # rellenar dominios y secretos
docker compose up -d --build
docker compose logs -f crm # esperar a que quede sano

# esquema y usuario inicial
docker compose exec crm npx prisma db push
docker compose exec crm npx tsx prisma/seed.ts
```

Después, en n8n: importar los workflows de `/workflows`, asignar las
credenciales `REEMPLAZAR_CON_*` y **activar solo el latido**. Esperar diez
minutos y comprobar que salen ejecuciones verdes cada cinco.

### Copias de seguridad

Lo único irrecuperable es Postgres. MinIO conviene, Redis no importa.

```bash
docker compose exec -T db pg_dump -U $POSTGRES_USER "$POSTGRES_DB" | gzip > copia-$(date +%F).sql.gz
```

(En la pila vigente el CRM hace sus propias copias desde Ajustes › Copias de
seguridad, y ahí es donde hay que probar una restauración antes de entregar.)

Ponlo en un cron diario fuera del servidor. **Una copia que vive en la misma
máquina que la base no es una copia.**

### Cambios de esquema en producción

Se usa `db push`, no `migrate dev`. En este proyecto `migrate dev` pide
resetear la base (ver `DEC-D02` en el registro de decisiones), y eso en una
clínica es perder el historial de pacientes. Antes de cualquier cambio:
volcado, y comprobar el recuento antes y después.

### Antes de vender a la segunda clínica

**Una instalación por clínica.** Ningún modelo lleva `organizationId`, así que
dos clínicas en la misma pila verían los datos de la otra. Está documentado
como `DEC-D06` y es la mayor deuda pendiente del producto.

Mientras tanto, se levanta una pila por cliente cambiando el `name:` del
compose y los dominios.
