import { redirect } from 'next/navigation'

// Career opens on its Week view.
export default function CareerHome() {
  redirect('/career/week')
}
