import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadados estendidos para a Play Store e ecrã inteiro nativo
export const metadata: Metadata = {
  title: 'IDTT',
  description: 'Consistência e Identidade Expandida',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IDTT',
  },
};

// Viewport mobile para trancar zoom e aplicar cor Outer Space de fundo
export const viewport: Viewport = {
  themeColor: '#1F2942',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-[#1F2942]`}
      suppressHydrationWarning={true} // <-- Esta linha ignora as interferências das extensões do browser
    >
      <body className="min-h-full flex flex-col bg-[#1F2942] text-white">
        {children}
      </body>
    </html>
  );
}