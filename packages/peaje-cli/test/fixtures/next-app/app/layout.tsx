import type { Metadata } from 'next'
import {
  Inter,
  Lora,
} from 'next/font/google'
import './globals.css'

export const metadata: Metadata = { title: 'Café Andino' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#111" />
      </head>
      <body>{children}</body>
    </html>
  )
}
