import { useState } from 'react';
import Link from 'next/link';
import type { Category, PublicLink } from '@/types/portal';
import Icon from '@/components/Icon';
import { iconForService } from '@/lib/icons';
import { accentFor } from '@/lib/category-accent';

// 1c "บริการทั้งหมด": H2 + category pills + 3-column hairline grid.
// Hairline technique: container gets top/left border, every cell gets
// right/bottom border — no filler cells needed (handoff recommendation).
// Hover = green-hover fill, text colors unchanged (update note: no inversion).

function Cell({ link, index }: { link: PublicLink; index: number }) {
  return (
    <Link
      href={`/service/${encodeURIComponent(link.id)}`}
      className="flex min-h-[150px] flex-col gap-4 border-b border-r border-line bg-white p-6 transition-colors duration-[.18s] animate-np-rise hover:bg-green-hover focus-visible:outline-3"
      style={{ animationDelay: `${index * 55}ms`, outlineColor: accentFor(link.categoryId) }}
    >
      <span className="flex items-center justify-between">
        <Icon name={iconForService(link.id, link.icon)} size={34} className="text-green-deep" />
        <span className="font-display text-[11px] font-semibold tracking-[.14em] text-ink-mute">
          {String(index + 1).padStart(2, '0')}
        </span>
      </span>
      <span className="mt-auto">
        <span className="block font-display text-xl font-bold leading-[1.25] tracking-[-.01em] text-ink">
          {link.title}
        </span>
        {link.subtitle ? (
          <span className="mt-1.5 block text-[12.5px] leading-[1.55] text-ink-faint">
            {link.subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export default function ServicesGrid({
  categories,
  links,
}: {
  categories: Category[];
  links: PublicLink[];
}) {
  const [cat, setCat] = useState<string>('all');
  const shown = cat === 'all' ? links : links.filter((l) => l.categoryId === cat);
  const pills = [{ id: 'all', label: 'ทั้งหมด' }, ...categories.map((c) => ({ id: c.id, label: c.label }))];

  return (
    <section id="services" className="bg-white px-5 pb-[60px] pt-[52px] sm:px-11">
      <div className="mb-[30px] flex flex-wrap items-end gap-4">
        <h2 className="font-display text-[32px] font-bold leading-none tracking-[-.03em] text-green-deep sm:text-[44px]">
          บริการทั้งหมด
        </h2>
        <span className="pb-1.5 text-[13.5px] text-ink-faint">เลือกหมวดเพื่อกรอง</span>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {pills.map((p) => {
            const on = cat === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setCat(p.id)}
                aria-pressed={on}
                className={`rounded-full px-[17px] py-[9px] font-display text-[13px] font-semibold transition max-sm:min-h-[44px] ${
                  on
                    ? 'bg-green text-white'
                    : 'border border-black/[0.18] text-green-deep hover:bg-green-025'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      {shown.length ? (
        <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((link, i) => (
            <Cell key={link.id} link={link} index={i} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/[0.16] p-14 text-center">
          <p className="font-display text-base font-semibold text-ink">ไม่พบบริการในหมวดนี้</p>
        </div>
      )}
    </section>
  );
}
