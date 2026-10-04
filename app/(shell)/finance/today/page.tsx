import { redirect } from 'next/navigation'

// Today is now the finance home. Kept so old links and bookmarks still work.
export default function FinanceTodayRedirect() {
  redirect('/finance')
}
