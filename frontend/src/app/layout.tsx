import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { OfflineBanner } from "@/components/OfflineBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unified Asset & Operations Brain",
  description: "Universal operational control, knowledge graph cockpit, and RAG copilot for refinery management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-[#0b0f19] text-slate-100 font-sans">
        <NetworkProvider>
          <AuthProvider>
            <OfflineBanner />
            <div className="flex-1 flex flex-col">
              {children}
            </div>
          </AuthProvider>
        </NetworkProvider>
      </body>
    </html>
  );
}
