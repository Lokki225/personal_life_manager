import type { PropsWithChildren } from 'react'

// Remounted on every navigation between sections of the app, so the page arriving plays its entrance.
export default function Template({ children }: PropsWithChildren) {
  return <div className="page-enter">{children}</div>
}
