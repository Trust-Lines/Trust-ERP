import type { Metadata } from "next";
import "@/components/platform/survey/nacsSurveyStyles.css";

export const metadata: Metadata = {
  title: "T LINES — Survey",
  robots: { index: false, follow: false },
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
