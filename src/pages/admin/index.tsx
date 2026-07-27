import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AdminLayout from '@/components/admin/AdminLayout';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import {
  adminFetcher,
  deleteLink,
  reorderLinks,
  toLinkInput,
  updateLink,
} from '@/lib/admin-api';
import { accentFor } from '@/lib/category-accent';
import type { PortalConfig, ServiceLink } from '@/types/portal';

type SortMode = 'order' | 'clicks';

function AdminDashboard() {
  const { data, error, isLoading, mutate } = useSWR<PortalConfig>(
    '/api/admin/config',
    adminFetcher
  );
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const categoryLabel = useMemo(() => {
    const m = new Map<string, string>();
    data?.categories.forEach((c) => m.set(c.id, c.label));
    return m;
  }, [data]);

  const links = useMemo(() => {
    const list = [...(data?.links ?? [])];
    if (sortMode === 'clicks') {
      return list.sort((a, b) => b.clickCount - a.clickCount);
    }
    return list.sort((a, b) => a.order - b.order);
  }, [data, sortMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function onToggleActive(link: ServiceLink) {
    setBusy(link.id);
    setMsg(null);
    try {
      await updateLink(link.id, { ...toLinkInput(link), isActive: !link.isActive });
      await mutate();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onDelete(link: ServiceLink) {
    if (!confirm(`ลบลิงก์ “${link.title}” ?\nการลบไม่สามารถย้อนกลับได้`)) return;
    setBusy(link.id);
    setMsg(null);
    try {
      await deleteLink(link.id);
      await mutate();
      setMsg(`ลบ “${link.title}” แล้ว`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;
    const ordered = [...data.links].sort((a, b) => a.order - b.order);
    const oldIndex = ordered.findIndex((l) => l.id === active.id);
    const newIndex = ordered.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(ordered, oldIndex, newIndex);

    // Optimistic: renumber and update the cache immediately.
    const renumbered = moved.map((l, i) => ({ ...l, order: i + 1 }));
    await mutate({ ...data, links: renumbered }, { revalidate: false });
    try {
      await reorderLinks(moved.map((l) => l.id));
      await mutate();
    } catch (e) {
      setMsg((e as Error).message);
      await mutate();
    }
  }

  return (
    <AdminLayout
      title="ลิงก์บริการ"
      actions={
        <Link
          href="/admin/links/new"
          className="rounded-full bg-emerald px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-deep"
        >
          + เพิ่มลิงก์
        </Link>
      }
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
        </p>
      ) : null}
      {msg ? (
        <p className="mb-4 rounded-lg bg-emerald-050 px-4 py-2 text-sm text-emerald-deep">
          {msg}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-ink-soft">
        <span>{links.length} ลิงก์</span>
        <div className="flex items-center gap-1">
          <span>เรียงตาม:</span>
          <button
            onClick={() => setSortMode('order')}
            className={`rounded-full px-3 py-1 ${sortMode === 'order' ? 'bg-emerald-050 text-emerald-deep' : 'hover:bg-black/[0.04]'}`}
          >
            ลำดับที่ตั้งไว้
          </button>
          <button
            onClick={() => setSortMode('clicks')}
            className={`rounded-full px-3 py-1 ${sortMode === 'clicks' ? 'bg-emerald-050 text-emerald-deep' : 'hover:bg-black/[0.04]'}`}
          >
            ความนิยม (คลิก)
          </button>
        </div>
        {sortMode === 'clicks' ? (
          <span className="text-xs text-amber-700">
            โหมดดูอย่างเดียว — ลากจัดลำดับได้เฉพาะโหมด “ลำดับที่ตั้งไว้”
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={links.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  categoryLabel={categoryLabel.get(link.categoryId) ?? link.categoryId}
                  draggable={sortMode === 'order'}
                  busy={busy === link.id}
                  onToggle={() => onToggleActive(link)}
                  onDelete={() => onDelete(link)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </AdminLayout>
  );
}

function LinkRow({
  link,
  categoryLabel,
  draggable,
  busy,
  onToggle,
  onDelete,
}: {
  link: ServiceLink;
  categoryLabel: string;
  draggable: boolean;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id, disabled: !draggable });
  const accent = accentFor(link.categoryId);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className={`flex items-center gap-3 rounded-xl border border-black/[0.07] bg-surface p-3 ${
        link.isActive ? '' : 'opacity-60'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="ลากเพื่อจัดลำดับ"
        disabled={!draggable}
        className={`shrink-0 rounded-md px-1.5 py-2 text-ink-soft ${
          draggable ? 'cursor-grab hover:bg-black/[0.05]' : 'cursor-not-allowed opacity-30'
        }`}
      >
        ⠿
      </button>

      <span
        className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold sm:grid"
        style={{ background: `color-mix(in srgb, ${accent} 14%, #fff)`, color: accent }}
      >
        {Array.from(link.title.trim())[0] ?? '•'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-ink">{link.title}</p>
          {link.isFeatured ? (
            <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
              เด่น
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-ink-soft">
          {categoryLabel} · {link.url || '— ไม่มี URL —'}
        </p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-sm font-semibold tabular-nums text-ink">
          {link.clickCount.toLocaleString('th-TH')}
        </p>
        <p className="text-[10px] text-ink-soft">คลิก</p>
      </div>

      <button
        onClick={onToggle}
        disabled={busy}
        role="switch"
        aria-checked={link.isActive}
        aria-label={link.isActive ? 'กำลังแสดง — กดเพื่อซ่อน' : 'ซ่อนอยู่ — กดเพื่อแสดง'}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          link.isActive ? 'bg-emerald' : 'bg-black/20'
        } ${busy ? 'opacity-50' : ''}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            link.isActive ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>

      <Link
        href={`/admin/links/${encodeURIComponent(link.id)}`}
        className="shrink-0 rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-black/[0.04]"
      >
        แก้ไข
      </Link>
      <button
        onClick={onDelete}
        disabled={busy}
        aria-label={`ลบ ${link.title}`}
        className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        ลบ
      </button>
    </li>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(AdminDashboard);
