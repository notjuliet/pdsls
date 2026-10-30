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

/**
 * How far a time is from now, in its largest whole unit: "3 days ago" for the past, or
 * "in 3 days" for the future.
 */
export const relativeTimeFromTimestamp = (timestamp: number) => {
  const elapsed = Date.now() - timestamp;
  const distance = Math.abs(elapsed);
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (distance >= ms) {
      const count = Math.floor(distance / ms);
      return relativeTimeFormat.format(elapsed >= 0 ? -count : count, unit);
    }
  }
  return "just now";
};
