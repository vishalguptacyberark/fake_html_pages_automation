import { redirect } from 'next/navigation'

/**
 * Root route — redirect straight to the autofill login page.
 */
export default function RootPage() {
  redirect('/login')
}
