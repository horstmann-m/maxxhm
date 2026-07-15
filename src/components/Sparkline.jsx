import { fonts } from "../theme.js";

// Mini inline trend line. Guards against undefined/NaN values in the
// history array (prototype bug: an undefined reading pushed into
// history broke min/max and produced a NaN polyline).
export default function Sparkline({ data, color, min, max, width = 120, height = 32 }) {
  const clean = (data || []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (clean.length < 2) {
    return (
      <div
        style={{ width, height, display: "flex", alignItems: "center", fontSize: 10, fontFamily: fonts.mono, color: "#5A5A4E" }}
        aria-hidden="true"
      >
        …
      </div>
    );
  }
  const lo = min ?? Math.min(...clean);
  const hi = max ?? Math.max(...clean);
  const range = hi - lo || 1;
  const pts = clean
    .map((v, i) => {
      const x = (i / (clean.length - 1)) * width;
      const y = height - ((v - lo) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
