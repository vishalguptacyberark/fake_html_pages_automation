import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Automation Pages',
  description: 'QA automation test pages',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
