import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "8 Dreams",
  description: "A 2-player card game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}