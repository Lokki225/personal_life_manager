import { redirect } from 'next/navigation'

// The assistant lives in a window over the finance pages. This address stays
// for the notes already sent with it.
export default function AssistantPage() {
  redirect('/finance?assistant=notes')
}
