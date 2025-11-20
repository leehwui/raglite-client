import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAGLite - AI-Powered Chat Assistant",
  description: "Experience intelligent conversations with RAGLite, your AI assistant powered by advanced retrieval-augmented generation technology.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}