import { sendPush, type PushMessage } from '../../infrastructure/push/sendPush'
import { pushRepository, type StoredSubscription } from '../../infrastructure/repositories/pushRepository'

type NotifyDeps = {
  send: typeof sendPush
  forget: (endpoint: string) => Promise<void>
}

const defaultDeps: NotifyDeps = { send: sendPush, forget: pushRepository.forgetEndpoint }

// Sends one message to each device of a person, and forgets the devices that
// no longer accept messages. Resolves to how many devices received it.
export async function notifyDevices(
  subscriptions: StoredSubscription[],
  message: PushMessage,
  deps: NotifyDeps = defaultDeps,
): Promise<number> {
  let delivered = 0

  for (const subscription of subscriptions) {
    const outcome = await deps.send(subscription, message)

    if (outcome === 'sent') {
      delivered += 1
    } else if (outcome === 'gone') {
      await deps.forget(subscription.endpoint)
    }
  }

  return delivered
}
