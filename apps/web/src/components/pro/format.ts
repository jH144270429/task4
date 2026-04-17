export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatDateISO(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTimeISO(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleString();
}

export function cToF(c: number) {
  return (c * 9) / 5 + 32;
}

export function kmhToMph(kmh: number) {
  return kmh / 1.60934;
}
