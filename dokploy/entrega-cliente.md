# Client handoff

What gets done **before** saying "it's all yours," and what gets handed
over.

The rule that governs all of this: **the client configures nothing
technical**. If something requires pasting a key, choosing a model, or
understanding what a webhook is, you do it before handing off. What they
touch afterward is text, schedules and people.

---

## 1 · Checklist before handoff

### Chatbot (`recepcion` pack)

- [ ] Real API keys in `/admin/connections`: AI provider and WhatsApp provider
- [ ] Webhook URLs copied into the provider's panel (YCloud or Meta) — without this not a single message gets in
- [ ] Both agents' prompts (text and voice) with no `[[ RELLENAR: … ]]` left
- [ ] Client's documentation loaded into the Knowledge Base
- [ ] Real test: message from a phone that isn't yours, and a correct reply
- [ ] Handoff test: ask to speak to a person and confirm the alert arrives
- [ ] **Clinical guardrail tested**: write a symptom and verify it refers without opining
- [ ] Business hours and after-hours message configured

### CRM (`comercial` pack)

- [ ] Settings → General: logo, legal name and tax details — without this the PDFs come out blank
- [ ] Settings → Email: SMTP tested with "Test connection," or Gmail connected
- [ ] Settings → AI: provider, key and **monthly spend cap**. Without a cap, it doesn't activate
- [ ] Settings → Backups: destination, frequency and **one test restore**
- [ ] Pipeline stages adapted to their process, not the factory defaults
- [ ] Catalog loaded with their products or packages
- [ ] Their team's users created with the right roles

### Assistant (`completo` pack)

- [ ] OpenAI key in Settings → Services
- [ ] Installation name and tagline
- [ ] Integrations it will use (Telegram, Google, Notion…) connected

### All three

- [ ] Admin password **changed by the client** on first login
- [ ] Backups verified by restoring, not just configured
- [ ] Every domain opens over HTTPS with no browser warning

---

## 2 · What gets handed over

| What | How |
|---|---|
| The URLs of their applications | In the handoff email |
| Username and password | **Password manager**, never over WhatsApp or email |
| The user manual | PDF for whichever product they contracted |
| Who to contact if something breaks | Your support channel, with real hours |

**What never gets handed over:** the code, the ZIP, the repository or the
`.env`. The license prohibits it, and besides it's of no use to them. What's
theirs is **their data**, and they export that themselves from the
application whenever they want.

Worth saying before they ask, because they will ask. The line that works:
*"the installation is yours and the data is yours; the software is ours and
we maintain it."*

---

## 3 · First steps, for the client

This gets sent to them as-is. Five things, in this order.

> **1. Log in and change your password.**
> Using the username and password we gave you. First thing: change it from
> your profile.
>
> **2. Look at the home dashboard.**
> That's what needs your attention today. If there's nothing there, there's
> nothing there: you don't have to go looking for it.
>
> **3. Do one real thing.**
> Text the number from your own phone and see what it replies. Or create a
> contact and an opportunity. Touch something real on day one, or you won't
> come back to it.
>
> **4. Tell us what sounds off.**
> The assistant replies with what we've taught it about you. If it says
> something you wouldn't say, send it to us and we'll fix it. The first two
> weeks are for fine-tuning, and that's normal.
>
> **5. Show it to whoever will actually use it.**
> Fifteen minutes with whoever answers the phone is worth more than the
> entire manual.

---

## 4 · The following two weeks

| When | What |
|---|---|
| Day 2 | Review real conversations and fix the prompt based on anything that felt off |
| Day 7 | 15-minute call: what they're using, what they're not, and why |
| Day 14 | First number: messages handled outside business hours, appointments booked, no-shows |

That day-14 number is what renews the contract. It comes from the
application itself, not an estimate: that's why how it's measured gets
promised before the sale, not after.
