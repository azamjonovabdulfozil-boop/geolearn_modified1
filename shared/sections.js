import { SECTION_OPTIONS } from "@shared/stores/settings";

/** Kontent bo'limi yorlig'i: "O'zbek sinflar" / "Rus sinflar" / "Barcha sinflar". */
export function sectionLabel(v) {
  return (SECTION_OPTIONS.find(o => o.value === (v || "all")) ?? SECTION_OPTIONS[0]).label;
}
export function sectionFlag(v) {
  return (SECTION_OPTIONS.find(o => o.value === (v || "all")) ?? SECTION_OPTIONS[0]).flag;
}
