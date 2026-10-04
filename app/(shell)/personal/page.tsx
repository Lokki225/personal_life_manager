import { redirect } from 'next/navigation'

// Personal opens on its Today view.
export default function PersonalHome() {
  redirect('/personal/today')
}
