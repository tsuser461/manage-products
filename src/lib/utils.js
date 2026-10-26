export const up = (s) => (s || "").toUpperCase();
let fictionalNow = new Date("2026-09-26T15:00:00");
export function nowStamp() {
  fictionalNow = new Date(fictionalNow.getTime() + 6e4);
  return fictionalNow.toISOString();
}
export function formatDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())} ${d.toLocaleString("en-US", { month: "short" })} ${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const productTextList = (products) => products.join(" \xB7 ");
export const without = (arr, v) => arr.filter((x) => x !== v);
export const withAdded = (arr, v) => (arr.includes(v) ? arr : [...arr, v]);
export const toggle = (arr, v) => (arr.includes(v) ? without(arr, v) : [...arr, v]);
// Type and Code are separate Mapping fields. Stored as type "O" | "T/X" | "X" and code "Default" | "EVAC" | "AL" | "AR" | "PREP" (X has one Code, PREP).
// Default: Type O links Product Families per Category (scheduled in Schedule > Activity Type); Type T/X links Product Families (scheduled in Schedule > Unit).
// EVAC, AL and AR (Type O) are system Mappings (system: true): Activity Type N EVAC, AL or AR, a fixed Category, and Products from FIXED per Category. Read-only, not deletable, not scheduled.
// X · PREP: not scheduled; one Product Family; Activity Type = PREP.
export const isSystem = (m) => !!m.system;
export const typeCodeKey = (m) => `${m.type}-${m.code}`;
export const typeCodeLabel = (m) => `${m.type} \u00B7 ${m.code}`;
export const byUnit = (a, b) => a.localeCompare(b, undefined, { numeric: true });
export const isCategoryType = (c) => c === "O";
// Mappings that link per Category: Type O (Default links Product Families, EVAC, AL and AR link Products).
export const hasGroups = (m) => isCategoryType(m.type);
export const groupsOf = (m) => (isCategoryType(m.type) ? m.category || [] : []);
export function monthAt(offset) {
  const d = new Date(2024, offset, 1);
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-US", { month: "short" }) + " " + d.getFullYear() };
}
export const CURRENT_MONTH_KEY = monthAt(32).key;
// Where a Product Family is already mapped. A Product Family can be mapped once: to one Type, and within Type O to one Activity Type + Category.
// A Mapping being edited is skipped, so its own Product Families stay selectable.
export function ownershipLabels(db, familyName, { excludeCategory = null, editingId = null, formLinks = {} } = {}) {
  const labels = [];
  db.mappings.forEach((m) => {
    if (m.id === editingId || !m.families.includes(familyName)) return;
    if (hasGroups(m)) {
      groupsOf(m).forEach((p) => {
        if (((m.links || {})[p] || []).includes(familyName)) labels.push(`${m.type} · ${m.activityType} · ${p}`);
      });
    } else {
      labels.push(typeCodeLabel(m));
    }
  });
  Object.keys(formLinks).forEach((p) => {
    if (p !== excludeCategory && (formLinks[p] || []).includes(familyName)) labels.push(p);
  });
  return [...new Set(labels)];
}
