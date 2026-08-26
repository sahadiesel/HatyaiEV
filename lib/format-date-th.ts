/** วันที่เก็บในระบบเป็น YYYY-MM-DD (ค.ศ.) — แสดงผลเป็น วัน-เดือน-ปี พ.ศ. */

/** แปลง Date / string → YYYY-MM-DD ตามเวลาท้องถิ่น */
export function toYmdLocal(input: Date | string | null | undefined): string {
  if (!input) return "";
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return toYmdLocal(d);
  }
  if (!(input instanceof Date) || Number.isNaN(input.getTime())) return "";
  const y = input.getFullYear();
  const m = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * แสดงวันที่แบบ วัน-เดือน-ปี พ.ศ. เช่น 26-08-2569
 * รับ Date หรือ YYYY-MM-DD (ค.ศ.)
 */
export function formatDateThBE(input: Date | string | null | undefined): string {
  const ymd = toYmdLocal(input);
  if (!ymd) return "—";
  const [ys, ms, ds] = ymd.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return "—";
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y + 543}`;
}
