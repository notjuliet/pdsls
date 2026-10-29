export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KiB", "MiB", "GiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

export const localDateFromTimestamp = (timestamp: number) =>
  new Date(timestamp - new Date().getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .split(".")[0]
    .replace("T", " ");

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/** How long ago a time was, in its largest whole unit, e.g. "3 days ago" or "1 week ago". */
export const relativeTimeFromTimestamp = (timestamp: number) => {
  const elapsed = Date.now() - timestamp;
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (elapsed >= ms) return relativeTimeFormat.format(-Math.floor(elapsed / ms), unit);
  }
  return "just now";
};
