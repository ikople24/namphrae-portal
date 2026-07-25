import type { Manual } from '@/types/portal';

// Downloadable PDF manuals. Rendered as document rows rather than cards to signal
// "reference material", distinct from the service grid above.
export default function ManualsSection({ manuals }: { manuals: Manual[] }) {
  if (!manuals || manuals.length === 0) return null;
  return (
    <section aria-labelledby="manuals" className="rise">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="h-5 w-1.5 rounded-full bg-ink/40"
          aria-hidden="true"
        />
        <h2
          id="manuals"
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          คู่มือการใช้งาน
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {manuals.map((m) => (
          <a
            key={m.url}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-black/[0.06] bg-surface px-4 py-3 transition hover:border-emerald/40 hover:bg-emerald-050/40"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-050 text-xs font-semibold text-emerald-deep"
              aria-hidden="true"
            >
              PDF
            </span>
            <span className="flex-1 text-sm font-medium text-ink">
              {m.label}
            </span>
            <span
              className="text-ink-soft transition group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              ↓
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
