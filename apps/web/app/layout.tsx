import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Atkinson_Hyperlegible, Jersey_15 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/authContext";
import { Toaster } from "sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const pixelify = Jersey_15({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixelify",
});
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});

export const metadata: Metadata = {
  title: "GEC Bilaspur Virtual Campus",
  description: "Walk the GEC Bilaspur campus as a pixel character and talk to whoever you walk up to.",
};

// no pinch-zoom: the game uses touch for the joystick, and zooming breaks its layout
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${pixelify.variable} ${atkinson.variable}`}>
        <Toaster />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
