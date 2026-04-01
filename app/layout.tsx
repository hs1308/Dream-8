import type { Metadata } from "next";
import "./globals.css";
import GlobalRematchWatcher from "./GlobalRematchWatcher";

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
      <body>
        {children}
        <GlobalRematchWatcher />
      </body>
    </html>
  );
}
