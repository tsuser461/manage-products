export const ACTIVITY_TYPES = ["FA", "HA", "SW"];
export const CATEGORY_LIST = ["HELI", "FTR", "UAV", "TG"];
export const CATEGORY_BY_ACTIVITY_TYPE = { FA: CATEGORY_LIST, HA: CATEGORY_LIST, SW: CATEGORY_LIST };
export const UNITS = ["111", "112", "123", "134", "140", "142", "145"]; // ascending
export const VISIBLE_MONTHS = 6;
// Mapping Type and Code are separate fields. Each Type offers its own Codes.
export const MAPPING_TYPES = ["O", "T/X", "X"];
// EVAC, AL and AR (Type O) are system Mappings: one each, a fixed Activity Type (N EVAC, AL, AR), a fixed Category and Products from the FIXED Product Family.
// Users cannot create, open, change or delete them, and they are never scheduled. Listed oldest first, so the last one is the top row of the Mapping table.
export const SYSTEM_MAPPINGS = {
  EVAC: { activityType: "N EVAC", category: "HELI", products: ["SAVE15", "SAVE16"] },
  AL: { activityType: "AL", category: "TG", products: ["SAVE61", "SAVE65"] },
  AR: { activityType: "AR", category: "TG", products: ["SAVE10", "SAVE12"] },
};
export const SYSTEM_CODES = Object.keys(SYSTEM_MAPPINGS);
// Picking a Type fills in its Code: O and T/X start on Default, X has only PREP.
export const DEFAULT_CODE = { O: "Default", "T/X": "Default", X: "PREP" };
export const CODES_BY_TYPE = { O: ["Default", ...SYSTEM_CODES], "T/X": ["Default"], X: ["PREP"] };
// Year (and Month) column width in the Schedule for All Units tables
const YEAR_COL_W = 180;
export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_YEAR = 2026;
const YEAR_OPTIONS = ["2025", "2026", "2027", "2028", "2029", "2030"];

// Prototype personas. `access` says which tabs the persona can edit; a tab without access is view only
// (no CTAs, no action buttons). All personas share the same data.
export const PERSONAS = [
  {
    id: "A",
    label: "Persona A",
    role: "Full access",
    access: { mapping: true, schedule: true, products: true },
  },
  {
    id: "B",
    label: "Persona B",
    role: "View only",
    access: { mapping: false, schedule: false, products: false },
  },
];
// Schedule empty states for people who cannot create Mappings (no link to follow).
export const NO_MAPPING_COPY = { unit: "No Type T/X Mapping found.", activity: "No Type O Mapping found." };
// The Product Family that supplies each Unit's read-only Fixed Product. It cannot be deleted.
export const FIXED_FAMILY = "FIXED";
