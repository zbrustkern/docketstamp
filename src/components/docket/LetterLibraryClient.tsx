'use client';

import Link from 'next/link';
import { ArrowRight, FileText, RefreshCw } from 'lucide-react';
import { useTemplateAvailability } from '@/src/hooks/useTemplateAvailability';
import {
  buildCancellationStartingPointUrl,
  CANCELLATION_STARTING_POINTS,
  getAvailableLibraryLetters,
} from '@/src/lib/docket/letter-library';
import {
  STATUTORY_COMPLIANCE_DISCLOSURE,
  UPL_COMPLIANCE_FOOTER_TEXT,
} from '@/src/lib/docket/guardrails';

export function LetterLibraryClient() {
  const availability = useTemplateAvailability();
  const letters = availability.loading || availability.error
    ? []
    : getAvailableLibraryLetters(availability.data);
  const cancellationAvailable = letters.some((letter) => letter.slug === 'service-cancellation-request');
  const startingPoints = cancellationAvailable
    ? CANCELLATION_STARTING_POINTS.flatMap((point) => {
        const href = buildCancellationStartingPointUrl(point.value);
        return href ? [{ ...point, href }] : [];
      })
    : [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="font-mono text-sm font-bold tracking-wide text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            DOCKETSTAMP<span className="text-sky-400">™</span>
          </Link>
          <Link href="/" className="rounded-md px-3 py-2 text-sm text-sky-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            ← Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Letter library</p>
          <h1 className="mt-3 font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">Choose a letter to prepare and mail</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Select a supported letter, complete its form, review and sign it, then pay. DocketStamp prepares and mails the letter using an available USPS service.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Some letters may require additional information or a location check during preparation.
          </p>
        </section>

        <section className="mt-10 sm:mt-14" aria-labelledby="letters-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="letters-heading" className="font-serif text-2xl font-bold text-white sm:text-3xl">Available letters</h2>
              {!availability.loading && !availability.error && <p className="mt-1 text-sm text-slate-400">Showing {letters.length} {letters.length === 1 ? 'letter' : 'letters'} currently available to start.</p>}
            </div>
          </div>

          {availability.loading ? (
            <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-300">Checking current letter availability…</p>
          ) : availability.error ? (
            <div className="rounded-xl border border-amber-800/70 bg-slate-900 p-5" role="alert">
              <p className="text-slate-200">{availability.error}</p>
              <button type="button" onClick={availability.refresh} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
              </button>
            </div>
          ) : letters.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p role="status" className="text-slate-300">Letters are temporarily unavailable. Please check again later.</p>
              <button type="button" onClick={availability.refresh} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Check again
              </button>
            </div>
          ) : (
            <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {letters.map((letter) => (
                <li key={letter.slug}>
                  <Link href={`/notices/${encodeURIComponent(letter.slug)}`} className="group flex h-full min-h-36 flex-col rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-sky-700 hover:bg-slate-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
                    <FileText className="h-5 w-5 text-sky-400" aria-hidden="true" />
                    <span className="mt-3 font-semibold text-white">{letter.displayTitle}</span>
                    <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{letter.subtitle}</span>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-300">Start this letter <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {cancellationAvailable && startingPoints.length > 0 && (
          <section className="mt-12 border-t border-slate-800 pt-9 sm:mt-16 sm:pt-12" aria-labelledby="cancellation-heading">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Cancellation starting points</p>
            <h2 id="cancellation-heading" className="mt-2 font-serif text-2xl font-bold text-white sm:text-3xl">Choose what you want to cancel</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              Start with your service or policy type selected, then add your details and review your letter.
            </p>
            <ul className="mt-5 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {startingPoints.map((point) => (
                <li key={point.value}>
                  <Link href={point.href} className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm font-medium text-slate-100 hover:border-amber-700/80 hover:bg-slate-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
                    <span>{point.label}</span><ArrowRight className="h-4 w-4 shrink-0 text-amber-300 transition group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 rounded-xl border border-slate-800 bg-slate-900/70 p-5 sm:mt-16 sm:p-7" aria-labelledby="how-heading">
          <h2 id="how-heading" className="font-serif text-xl font-bold text-white">How it works</h2>
          <ol className="mt-4 grid list-inside list-decimal grid-cols-1 gap-3 pl-0 text-sm leading-relaxed text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <li className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">Choose a letter and complete its form.</li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">Review the prepared letter and adopt your signature.</li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">Choose an available mailing service and pay.</li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">DocketStamp prepares and mails the letter.</li>
          </ol>
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-7 text-xs leading-relaxed text-slate-400 sm:mt-16">
          <p><strong className="text-slate-300">SELF-HELP DISCLOSURE:</strong> {STATUTORY_COMPLIANCE_DISCLOSURE}</p>
          <p className="mt-3 font-mono text-[10px] text-slate-500">{UPL_COMPLIANCE_FOOTER_TEXT('DS-2026-DEMO')}</p>
          <p className="mt-4"><Link href="/" className="text-sky-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">Return to the homepage</Link></p>
        </footer>
      </div>
    </main>
  );
}
