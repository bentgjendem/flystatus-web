import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flystatus Oslo → Bergen",
  description: "Sjekk om flyet fra Oslo til Bergen er i rute",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
