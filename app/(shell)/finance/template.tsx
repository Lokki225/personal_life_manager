import type { PropsWithChildren } from 'react'

// Remounted on every navigation between finance pages, so the page arriving plays its entrance.
export default function Template({ children }: PropsWithChildren) {
  return <div className="page-enter">{children}</div>
}
