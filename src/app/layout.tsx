import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Limelight, Roboto_Slab } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Slab-serif for casino names on supply / discard panels. */
const robotoSlab = Roboto_Slab({
  variable: "--font-serif",
  subsets: ["latin"],
});

/** Art-deco marquee lettering for titles — very Las Vegas. */
const limelight = Limelight({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lords of Vegas Online",
  description:
    "Play the Lords of Vegas board game online with 3-6 remote players, complete with a YouTube-friendly Spectator view.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0d14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${robotoSlab.variable} ${limelight.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
