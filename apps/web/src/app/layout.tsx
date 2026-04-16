import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Header } from "@/components/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Weather Pulse",
  description: "Realtime weather dashboard powered by Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.9),transparent_55%),radial-gradient(900px_circle_at_80%_0%,rgba(96,165,250,0.22),transparent_50%),radial-gradient(900px_circle_at_30%_70%,rgba(167,139,250,0.16),transparent_55%)] text-zinc-900 dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(900px_circle_at_80%_0%,rgba(96,165,250,0.18),transparent_50%),radial-gradient(900px_circle_at_30%_70%,rgba(167,139,250,0.14),transparent_55%)] dark:text-zinc-50">
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
