# The assistant

An AI assistant inside the app, under **Finance → Assistant**. It works through
the same operations as the API (`application/api/operations.ts`), so it can
read and change whatever the API can.

- **Chat**: the person asks a question or says what they spent; the assistant
  reads their figures and records or changes things for them. It asks first
  before anything hard to undo that was not spelled out.
- **Evening notes** (opt-in, on the Assistant page): every evening a short
  note on the day; on Sundays the review of the week; on the last day of the
  month the review of the month. Kept in the app for 120 days, and sent as a
  notification when notifications are on. Written by the daily job
  (`/api/cron/daily`).

## Switching it on

Set these on the server (Vercel → Settings → Environment Variables), then
redeploy:

| Variable | Needed | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | A key from console.anthropic.com. Without it the assistant is hidden. |
| `ASSISTANT_MODEL` | no | The Claude model to use. Default `claude-opus-5-5`. A cheaper one, such as `claude-haiku-4-5-20251001`, costs much less per message. |

## Cost control

Each message and each note is billed by Anthropic to the key's account.

- A person may send 60 messages a day.
- A note is a single call to the model, with the figures given up front.
- The instructions and tool descriptions are cached between the steps of a
  conversation.
