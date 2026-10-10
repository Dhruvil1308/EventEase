import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { BackgroundFX } from "@/components/layout/BackgroundFX";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "EventEase — College event registration & check-in",
    template: "%s · EventEase",
  },
  description:
    "Create events with a capacity, register participants with unique QR entry codes, and check them in at the gate in a second — duplicates rejected automatically.",
  applicationName: "EventEase",
};

export const viewport: Viewport = {
  themeColor: "#04040b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${hanken.variable} ${jetbrains.variable}`}>
      <body className="grain font-sans antialiased">
        <noscript>
          <style>{`[data-reveal="self"],[data-reveal="group"]>*,[data-intro]{opacity:1!important}[data-hero-line]{transform:none!important}#how-it-works{height:auto!important}#how-it-works>div{position:static!important;height:auto!important}[data-chapter]{opacity:1!important;position:relative!important;top:auto!important;translate:none!important;margin-bottom:3rem}`}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-ink-950"
        >
          Skip to content
        </a>
        <BackgroundFX />
        <ScrollProgress />
        <Navbar />
        <main id="main" className="relative z-10 overflow-x-clip">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
