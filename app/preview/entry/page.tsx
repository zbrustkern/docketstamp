import { Suspense } from "react";
import { EntryPrototypeClient } from "./client";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
  title: "SendMyNotes - Choose a Card (Prototype)",
};

export default function EntryPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-stone-300 border-t-emerald-700 rounded-full animate-spin mx-auto" />
            <p className="text-xs uppercase tracking-widest text-stone-500">
              Loading preview...
            </p>
          </div>
        </div>
      }
    >
      <EntryPrototypeClient />
    </Suspense>
  );
}
