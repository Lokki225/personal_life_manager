import { offlineDb } from './db'

// Drafts: what was typed in a capture form, kept until it is sent.

// The form's fields as text, the way FormData gives them. A password is never
// kept on the device.
export function formValues(form: HTMLFormElement): Record<string, string> {
  const passwords = new Set(
    Array.from(form.elements)
      .filter((element): element is HTMLInputElement => element instanceof HTMLInputElement && element.type === 'password')
      .map((element) => element.name),
  )
  const values: Record<string, string> = {}
  for (const [name, value] of new FormData(form).entries()) {
    if (typeof value === 'string' && !name.startsWith('$ACTION') && !passwords.has(name)) values[name] = value
  }
  return values
}

// Puts saved values back into a form's fields.
export function fillForm(form: HTMLFormElement, values: Record<string, string>) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue
    if (!element.name || !(element.name in values) || element.type === 'hidden' || element.type === 'password') continue

    if (element instanceof HTMLInputElement && (element.type === 'radio' || element.type === 'checkbox')) {
      element.checked = values[element.name] === element.value
    } else {
      element.value = values[element.name]
    }
  }
}

export async function loadDraft(userId: string, formId: string) {
  return (await offlineDb()?.drafts.get({ userId, formId }))?.values ?? null
}

export async function saveDraft(userId: string, formId: string, values: Record<string, string>) {
  await offlineDb()?.drafts.put({ userId, formId, values, savedAt: Date.now() })
}

export async function clearDraft(userId: string, formId: string) {
  await offlineDb()?.drafts.delete([userId, formId] as never)
}
