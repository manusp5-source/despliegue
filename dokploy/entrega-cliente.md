# Entrega al cliente

Lo que se hace **antes** de decir «ya lo tenéis», y lo que se le da.

La regla que ordena todo esto: **el cliente no configura nada técnico**. Si algo
exige pegar una clave, elegir un modelo o entender qué es un webhook, lo haces
tú antes de entregar. Lo que él toca después son textos, horarios y personas.

---

## 1 · Checklist antes de entregar

### Chatbot (pack `recepcion`)

- [ ] Claves reales en `/admin/connections`: proveedor de IA y de WhatsApp
- [ ] URLs de webhook copiadas al panel del proveedor (YCloud o Meta) — sin esto no entra ni un mensaje
- [ ] Prompt de los **dos** agentes (texto y voz) sin ningún `[[ RELLENAR: … ]]`
- [ ] Documentación del cliente cargada en la Base de Conocimiento
- [ ] Prueba real: mensaje desde un móvil que no sea el tuyo, y respuesta correcta
- [ ] Prueba de derivación: pedir hablar con una persona y comprobar que llega el aviso
- [ ] **Guardarraíl clínico probado**: escribir un síntoma y verificar que deriva sin opinar
- [ ] Horario de atención y mensaje de fuera de horario configurados

### CRM (pack `comercial`)

- [ ] Ajustes → General: logo, razón social y datos fiscales — sin esto los PDF salen en blanco
- [ ] Ajustes → Email: SMTP probado con «Probar conexión», o Gmail conectado
- [ ] Ajustes → IA: proveedor, clave y **tope de gasto mensual**. Sin tope, no se activa
- [ ] Ajustes → Copias de seguridad: destino, frecuencia y **una restauración de prueba**
- [ ] Etapas del pipeline adaptadas a su proceso, no las de fábrica
- [ ] Catálogo cargado con sus productos o paquetes
- [ ] Usuarios de su equipo creados con el rol que les toca

### Asistente (pack `completo`)

- [ ] Clave de OpenAI en Configuración → Servicios
- [ ] Nombre y lema de la instalación
- [ ] Integraciones que vaya a usar (Telegram, Google, Notion…) conectadas

### Los tres

- [ ] Contraseña del administrador **cambiada por el cliente** en el primer acceso
- [ ] Copias de seguridad verificadas restaurando, no solo configuradas
- [ ] Cada dominio abre por HTTPS y sin aviso del navegador

---

## 2 · Lo que se le entrega

| Qué | Cómo |
|---|---|
| Las URL de sus aplicaciones | En el correo de entrega |
| Usuario y contraseña | **Gestor de contraseñas**, nunca por WhatsApp ni por correo |
| El manual de usuario | PDF del producto que haya contratado |
| A quién escribir si algo falla | Tu canal de soporte, con el horario real |

**Lo que no se entrega nunca:** el código, el ZIP, el repositorio ni el `.env`.
La licencia lo prohíbe y además no le sirve de nada. Lo que es suyo son **sus
datos**, y esos los exporta él mismo desde la aplicación cuando quiera.

Conviene decirlo antes de que lo pregunten, porque lo van a preguntar. La frase
que funciona: *«la instalación es vuestra y los datos son vuestros; el programa
es nuestro y lo mantenemos nosotros»*.

---

## 3 · Primeros pasos, para el cliente

Esto se le manda tal cual. Cinco cosas, en este orden.

> **1. Entra y cambia la contraseña.**
> Con el usuario y la contraseña que te hemos dado. Lo primero, cambiarla desde
> tu perfil.
>
> **2. Mira el panel de inicio.**
> Ahí está lo que requiere tu atención hoy. Si no hay nada, no hay nada: no
> tienes que buscarlo.
>
> **3. Haz una cosa de verdad.**
> Escribe al número desde tu propio móvil y ve qué contesta. O crea un contacto
> y una oportunidad. Toca algo real el primer día o no volverás a entrar.
>
> **4. Dinos qué suena raro.**
> El asistente responde con lo que le hemos enseñado de vosotros. Si contesta
> algo que tú no dirías, mándanoslo y lo corregimos. Las dos primeras semanas
> son de ajuste y es normal.
>
> **5. Enséñaselo a quien lo va a usar.**
> Quince minutos con quien coge el teléfono valen más que el manual entero.

---

## 4 · Las dos semanas siguientes

| Cuándo | Qué |
|---|---|
| Día 2 | Revisar las conversaciones reales y corregir el prompt con lo que haya chirriado |
| Día 7 | Llamada de 15 minutos: qué usan, qué no y por qué |
| Día 14 | Primer número: mensajes atendidos fuera de horario, citas agendadas, ausencias |

Ese número del día 14 es el que renueva el contrato. Sale de la propia
aplicación, no de una estimación: por eso se promete cómo se mide antes de
vender, y no después.
