import { signOut } from 'next-auth/react'

import { clearDevice } from './db'

// Signs out after wiping what the app kept on this device (drafts, snapshots,
// the outbox), so a shared phone shows nothing of the person who left.
export async function signOutAndClear() {
  try {
    await clearDevice()
  } catch {
    // Signing out must never be blocked by local storage.
  }
  await signOut({ callbackUrl: '/' })
}
