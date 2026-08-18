/** Date/สตริง → ISO string หรือ null (Date เพี้ยน/ค่าว่าง → null) */
export function isoDateOrNull(d: Date | string | null | undefined): string | null {
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString();
  return typeof d === 'string' && d ? d : null;
}
