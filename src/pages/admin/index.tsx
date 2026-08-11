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
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import {
  adminFetcher,
  deleteLink,
  reorderLinks,
  toLinkInput,
  updateLink,
} from '@/lib/admin-api';
import { accentOf } from '@/lib/category-accent';
import { iconForService } from '@/lib/icons';
import type { PortalConfig, ServiceLink } from '@/types/portal';

type SortMode = 'order' | 'clicks';

const GRID_COLS =
  'grid grid-cols-[34px_minmax(240px,1fr)_128px_82px_64px_88px] items-center gap-3';

function AdminDashboard() {
  const { data, error, isLoading, mutate } = useSWR<PortalConfig>(
    '/api/admin/config',
    adminFetcher
  );
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const categoryLabel = useMemo(() => {
    const m = new Map<string, string>();
    data?.categories.forEach((c) => m.set(c.id, c.label));
    return m;
  }, [data]);

  const categoryById = useMemo(() => {
    const m = new Map<string, PortalConfig['categories'][number]>();
    data?.categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [data]);

  const needle = q.trim().toLowerCase();
  const links = useMemo(() => {
    let list = [...(data?.links ?? [])];
    if (needle) {
      list = list.filter((l) =>
        `${l.title} ${l.subtitle ?? ''} ${l.url}`.toLowerCase().includes(needle)
      );
    }
    if (sortMode === 'clicks') {
      return list.sort((a, b) => b.clickCount - a.clickCount);
    }
    return list.sort((a, b) => a.order - b.order);
  }, [data, sortMode, needle]);

  // Dragging only makes sense over the full, manually-ordered list.
  const canDrag = sortMode === 'order' && !needle;

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
        <>
          <label className="flex w-[230px] items-center gap-2 rounded-[10px] border border-black/[0.09] bg-white px-[13px] py-[9px]">
            <Icon name="search" size={19} className="text-ink-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="ค้นหาลิงก์"
              placeholder="ค้นหาลิงก์"
              className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-mute"
            />
          </label>
          <Link
            href="/admin/links/new"
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-green px-[17px] py-2.5 font-display text-[13.5px] font-semibold text-white transition hover:bg-green-deep"
          >
            <Icon name="add" size={19} />
            เพิ่มลิงก์
          </Link>
        </>
      }
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
        </p>
      ) : null}
      {msg ? (
        <p className="mb-4 rounded-lg bg-green-050 px-4 py-2 text-sm text-green-deep">
          {msg}
        </p>
      ) : null}

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSortMode('order')}
          className={`rounded-full px-[13px] py-[7px] font-display text-[12.5px] font-medium ${
            sortMode === 'order'
              ? 'bg-green-050 text-green-deep'
              : 'text-ink-faint hover:bg-black/[0.04]'
          }`}
        >
          ลำดับที่ตั้งไว้
        </button>
        <button
          onClick={() => setSortMode('clicks')}
          className={`rounded-full px-[13px] py-[7px] font-display text-[12.5px] font-medium ${
            sortMode === 'clicks'
              ? 'bg-green-050 text-green-deep'
              : 'text-ink-faint hover:bg-black/[0.04]'
          }`}
        >
          ความนิยม (คลิก)
        </button>
        <span className="ml-auto text-[11.5px] text-ink-mute">
          {canDrag
            ? 'ลากที่จับ ⠿ เพื่อจัดลำดับ'
            : 'ลากจัดลำดับได้เฉพาะโหมด “ลำดับที่ตั้งไว้” และไม่ได้กรองค้นหา'}
        </span>
      </div>

      {isLoading ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-black/[0.08] bg-white">
          <div
            className={`${GRID_COLS} border-b border-black/[0.07] bg-surface-sunken px-4 py-[11px] font-display text-[11px] font-semibold tracking-[.06em] text-ink-mute`}
          >
            <span />
            <span>บริการ</span>
            <span>หมวด</span>
            <span className="text-right">คลิก</span>
            <span className="text-center">แสดง</span>
            <span />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={links.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul>
                {links.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    categoryLabel={categoryLabel.get(link.categoryId) ?? link.categoryId}
                    draggable={canDrag}
                    busy={busy === link.id}
                    onToggle={() => onToggleActive(link)}
                    onDelete={() => onDelete(link)}
                    accent={accentOf(categoryById.get(link.categoryId), link.categoryId)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {!links.length ? (
            <p className="px-4 py-6 text-sm text-ink-faint">
              ไม่พบลิงก์ที่ตรงกับ “{q}”
            </p>
          ) : null}
        </div>
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
  accent,
}: {
  link: ServiceLink;
  categoryLabel: string;
  draggable: boolean;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  accent: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id, disabled: !draggable });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : link.isActive ? 1 : 0.55,
      }}
      className={`${GRID_COLS} border-b border-black/[0.05] px-4 py-3 last:border-b-0 hover:bg-surface-sunken`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="ลากเพื่อจัดลำดับ"
        disabled={!draggable}
        className={`grid h-8 w-8 place-items-center rounded-md ${
          draggable
            ? 'cursor-grab text-black/20 hover:bg-black/[0.05]'
            : 'cursor-not-allowed text-black/10'
        }`}
      >
        <Icon name="drag_indicator" size={20} />
      </button>

      <span className="flex min-w-0 items-center gap-[11px]">
        <span
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px]"
          style={{
            background: `color-mix(in srgb, ${accent} 12%, #fff)`,
            color: accent,
          }}
        >
          <Icon name={iconForService(link.id, link.icon)} size={19} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-[7px]">
            <span className="truncate font-display text-[13.5px] font-semibold text-ink">
              {link.title}
            </span>
            {link.isFeatured ? (
              <span className="rounded-[5px] bg-amber-500/15 px-1.5 py-0.5 font-display text-[10px] font-semibold text-amber-800">
                เด่น
              </span>
            ) : null}
          </span>
          <span className="block max-w-[330px] truncate text-[11px] text-ink-mute">
            {link.url || '— ไม่มี URL —'}
          </span>
        </span>
      </span>

      <span
        className="inline-flex items-center gap-1.5 font-display text-xs font-medium"
        style={{ color: accent }}
      >
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: accent }} />
        {categoryLabel}
      </span>

      <span className="text-right font-display text-[13px] font-semibold text-ink [font-variant-numeric:tabular-nums]">
        {link.clickCount.toLocaleString('th-TH')}
      </span>

      <span className="flex justify-center">
        <button
          onClick={onToggle}
          disabled={busy}
          role="switch"
          aria-checked={link.isActive}
          aria-label={link.isActive ? 'กำลังแสดง — กดเพื่อซ่อน' : 'ซ่อนอยู่ — กดเพื่อแสดง'}
          className={`relative h-[22px] w-10 rounded-full transition ${
            link.isActive ? 'bg-green' : 'bg-black/[0.18]'
          } ${busy ? 'opacity-50' : ''}`}
        >
          <span
            className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all ${
              link.isActive ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
      </span>

      <span className="flex justify-end gap-1">
        <Link
          href={`/admin/links/${encodeURIComponent(link.id)}`}
          aria-label={`แก้ไข ${link.title}`}
          className="grid h-8 w-8 place-items-center rounded-[9px] text-ink-faint transition hover:bg-black/[0.06]"
        >
          <Icon name="edit" size={19} />
        </Link>
        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={`ลบ ${link.title}`}
          className="grid h-8 w-8 place-items-center rounded-[9px] text-danger transition hover:bg-danger/10 disabled:opacity-50"
        >
          <Icon name="delete" size={19} />
        </button>
      </span>
    </li>
  );
}

export const getServerSideProps = getFeatureSsrProps('links');

export default withMemberGuard(AdminDashboard);
