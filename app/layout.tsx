import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MODVAULT — Car Mod Tracker",
    template: "%s | MODVAULT",
  },
  description:
    "Track every modification, visualize your build, and connect with enthusiasts. The premium car modification tracker.",
  keywords: ["car modifications", "mod tracker", "car build", "automotive", "tuning"],
  openGraph: {
    title: "MODVAULT — Car Mod Tracker",
    description:
      "Track every modification, visualize your build, and connect with enthusiasts.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
