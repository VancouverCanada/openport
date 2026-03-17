import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { calSans, dinDisplay, dmSerifDisplay, firaCode, notoSans } from './fonts'
import { AppMotionShell } from '../components/app-motion-shell'

export const metadata: Metadata = {
  title: 'OpenPort',
  description: 'OpenPort product shell for auth, dashboards, integrations and AI workspace.'
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${notoSans.variable} ${firaCode.variable} ${dmSerifDisplay.variable} ${dinDisplay.variable} ${calSans.variable}`}>
      <body>
        <AppMotionShell>{children}</AppMotionShell>
      </body>
    </html>
  )
}
