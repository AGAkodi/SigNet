import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nox Private Credit — Salary-backed Confidential Lending",
  description: "Private, TEE-verified income stream underwrites confidential Aave-style borrowing on Arbitrum Sepolia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
