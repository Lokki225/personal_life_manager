import { OfflineScreens } from '@/components/offline/offline-screens'

// Shown by the service worker when a page cannot be loaded without a
// connection. Kept on the device from the start. It draws the screen that was
// asked for from what the last online visit left on this device, or says the
// page has not been opened here yet.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-10">
      <OfflineScreens />
    </main>
  )
}
