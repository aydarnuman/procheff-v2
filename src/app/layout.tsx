import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CacheProvider } from "@/components/providers/cache-provider";
import { Sidebar } from "@/components/nav/Sidebar";
import { Topbar } from "@/components/nav/Topbar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProCheff AI | İhale Analiz Sistemi",
  description: "AI destekli ihale dokümanı analiz ve değerlendirme sistemi",
  keywords: ["ihale", "analiz", "AI", "dokument", "tender", "analysis"],
  authors: [{ name: "ProCheff AI Team" }],
};

export const viewport = "width=device-width, initial-scale=1";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased h-full bg-gray-900`}
      >
        <CacheProvider>
          <ThemeProvider>
            <div className="flex h-screen overflow-hidden">
              {/* Sidebar */}
              <Sidebar />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Topbar */}
                <Topbar />

                {/* Page Content */}
                <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
                  <div className="max-w-7xl mx-auto">{children}</div>
                </main>
              </div>
            </div>
          </ThemeProvider>
        </CacheProvider>
      </body>
    </html>
  );
}
