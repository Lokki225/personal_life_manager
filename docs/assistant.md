# The assistant

An AI assistant over the finance pages: the round button at the bottom right
opens it in a window. It works through the same operations as the API
(`application/api/operations.ts`), so it can read and change whatever the API
can.

The window has three parts:

- **Chat**: the person asks a question or says what they spent; the assistant
  reads their figures and records or changes things for them. It asks first
  before anything hard to undo that was not spelled out.
- **Notes** (opt-in): every evening a short note on the day; on Sundays the
  review of the week; on the last day of the month the review of the month.
  Kept for 120 days, and sent as a notification when notifications are on.
  Written by the daily job (`/api/cron/daily`). A notification opens the
  window on the notes (`/finance?assistant=notes`).
- **Settings**: which AI answers, and the person's own name and instructions
  for their assistant.

## AI providers

Each provider is switched on by putting its key in the server's settings
(Vercel → Settings → Environment Variables, then redeploy). Without any key
the button is hidden. With several, each person chooses one in Settings; the
first one with a key is used otherwise.

| Provider | Key | Model setting | Default model |
| --- | --- | --- | --- |
| Claude | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` | `claude-opus-5-5` |
| GPT | `OPENAI_API_KEY` | `OPENAI_MODEL` | `gpt-5` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` | `deepseek-chat` |
| Gemini | `GEMINI_API_KEY` | `GEMINI_MODEL` | `gemini-3.8-flash` |

Keys stay on the server; they are never stored in the database or shown in
the app. When a provider's account runs out of credit, the person is told to
choose another AI or add credit.

## Who the assistant is

What the model reads comes in this order:

1. **The rules of the app**, written in the code
   (`application/assistant/instructions.ts`). They always apply: read before
   answering, never invent figures, ask before deleting or changing the plan.
2. **The role**, the same for everyone. A default is written in
   `application/assistant/persona.ts`. Administrators can rename the assistant
   and rewrite its role on the Administration page, or go back to the default.
3. **The person's own instructions**, written in Settings, if the
   administrators allow it (on by default).
4. A last line saying the rules win over the role and the instructions.

The role and personal instructions are limited to 2,000 characters each.

## Cost control

Each message and each note is billed by the provider to the key's account.

- A person may send 60 messages a day.
- A note is a single call to the model, with the figures given up front.
- With Claude, the instructions and tool descriptions are cached between the
  steps of a conversation.
