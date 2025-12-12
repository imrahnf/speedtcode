import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Speed(t)Code",
  description: "Fast coding challenges to improve your skills.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-transparent text-black selection:bg-teal-200 selection:text-teal-900`}
      >
        {/* Global Background */}
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-gray-50">
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          
          {/* Radial Gradient Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_200px,#C7D2FE,transparent)] opacity-40"></div>
          
          {/* Floating Orbs */}
          <div className="absolute top-[-10%] left-[-10%] w-[50rem] h-[50rem] bg-purple-200 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-blob"></div>
          <div className="absolute top-[-10%] right-[-10%] w-[50rem] h-[50rem] bg-teal-200 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[50rem] h-[50rem] bg-blue-200 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
