import { redirect } from 'next/navigation'

// Projection opens on Vision until Ideas are built.
export default function ProjectionHome() {
  redirect('/projection/vision')
}
