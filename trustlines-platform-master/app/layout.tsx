import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { AmountsMasker } from "@/components/platform/shared/AmountsMasker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trust-Lines Platform",
  description: "Production & Delivery Operations Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* "Hide amounts" — flag the page before first paint so real figures never flash (see AmountsMasker). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('tl.hideAmounts')==='1'){var d=document.documentElement;d.setAttribute('data-hide-amounts','');setTimeout(function(){d.setAttribute('data-amounts-masked','')},4000)}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full">
        <AmountsMasker />
        {children}
      </body>
    </html>
  );
}
