import type React from "react";
import "./globals.css";
import ShellLayout from "./shell";

export const metadata = {
  title: "RAVEN",
  description: "RAVEN Agent Reliability Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ShellLayout>{children}</ShellLayout>
      </body>
    </html>
  );
}
