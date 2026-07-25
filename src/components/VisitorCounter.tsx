import { useEffect, useState } from 'react';

// Registers one visit per browser session and shows the running total, continued
// from the legacy site's counter. Sessioned via sessionStorage so a reload does
// not double-count. Falls back to the server-rendered initial value on error.
export default function VisitorCounter({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const alreadyCounted =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('np_visited') === '1';

    async function register() {
      try {
        const res = await fetch('/api/visit', {
          method: alreadyCounted ? 'GET' : 'POST',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { visitorCount: number };
        if (!cancelled && typeof data.visitorCount === 'number') {
          setCount(data.visitorCount);
        }
        if (!alreadyCounted && typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('np_visited', '1');
        }
      } catch {
        // Keep the server-rendered value.
      }
    }
    register();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="tabular-nums font-medium text-ink">
      {count.toLocaleString('th-TH')}
    </span>
  );
}
