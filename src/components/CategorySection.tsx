import type { Category, PublicLink } from '@/types/portal';
import ServiceCard from '@/components/ServiceCard';
import { accentFor } from '@/lib/category-accent';

// A titled group of service cards. The eyebrow rule is tinted with the category
// accent so the three groups read as distinct without heavy chrome.
export default function CategorySection({
  category,
  links,
}: {
  category: Category;
  links: PublicLink[];
}) {
  if (links.length === 0) return null;
  const accent = accentFor(category.id);

  return (
    <section
      aria-labelledby={`cat-${category.id}`}
      className="rise"
      style={{ animationDelay: `${category.order * 60}ms` }}
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className="h-5 w-1.5 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <h2
          id={`cat-${category.id}`}
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          {category.label}
        </h2>
        <span className="text-xs font-medium text-ink-soft/70">
          {links.length} บริการ
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {links.map((link) => (
          <ServiceCard key={link.id} link={link} accent={accent} />
        ))}
      </div>
    </section>
  );
}
