# Keeping the data safe

How the app's data is backed up, what can be lost, how fast it comes back, and
how to check that a restore works (Ressources/security-test-plan.md, §9).

## Where the data lives

- **Production:** one Neon Postgres database (the `production` branch).
- **Development and Previews:** a separate Neon database. Tests, the
  authorization suite and load tests run only there.
- **On each device:** drafts, read-only snapshots and the outbox of captures not
  yet sent (IndexedDB). They are cleared on sign-out and are not a backup.

## Backups

- **Neon instant restore (point-in-time).** Neon keeps the history of every
  change for the plan's restore window, so the database can be brought back to
  any second inside that window. Check the window in the Neon console:
  *Project settings → Instant restore*. The Free plan keeps a few hours; paid
  plans keep days.
- **Each person's export.** *My account → Export my data* downloads everything
  one person recorded as a file. It is their own copy, not ours.
- There is no second copy at another provider (decision D3). If the Neon
  project itself is lost, only the exports remain.

## Targets

| | Target | Why |
| --- | --- | --- |
| **RPO** (data that can be lost) | A few minutes, inside the restore window | Instant restore replays the history to the chosen second. |
| **RTO** (time to be back) | 1 hour | Create a branch at the restore point, check it, point production at it. |

Beyond the restore window, the RPO is "since the person's last export".

## Restoring production

1. In the Neon console, open the project and choose **Restore**. Pick the
   moment just before the problem.
2. Prefer **restoring to a new branch** first, so the current data is kept to
   compare with.
3. Check the branch (below). If it is right, restore the `production` branch
   itself to that moment, or point Vercel's `DATABASE_URL` at the new branch
   and redeploy.
4. Note what was lost between the restore point and the restore, and tell the
   people affected.

## Restore drill (monthly)

1. In Neon, create a branch from `production` at a moment about 10 minutes ago.
2. Compare it with production. The script only reads:

   ```
   SOURCE_DATABASE_URL=<production> RESTORED_DATABASE_URL=<drill branch> npx tsx scripts/verify-restore.ts
   ```

   Tables match, or differ only by rows written in the last 10 minutes.
3. Optionally run the app against the branch (`DATABASE_URL=<drill branch> npm run dev`)
   and open a few pages.
4. Delete the drill branch, and write the date and the time it took below.

| Date | Restore point | Time to a checked branch | Result |
| --- | --- | --- | --- |
| | | | |

## Before a risky migration

A migration that drops or rewrites a table or a column needs a restore point
written down just before it is deployed: note the time, or create a Neon
branch from `production`. If the migration goes wrong, restore to that moment.

## Deleting an account

*My account → Delete the account* asks for the password, then removes the user
and everything they recorded: the database deletes each record with its owner.
`npm run test:authz` checks that nothing of a deleted account is left in any
table that has a `userId`, and that the other account is untouched. A deleted
account is still in the restore history until the window passes.
