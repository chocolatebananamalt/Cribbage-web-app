import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACC Tournament Desk",
  description: "Accessible tournament operations prototype for American Cribbage Congress events.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
