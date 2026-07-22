import { colors, fonts } from "../theme.js";

const TYPE_COPY = {
  success: { icon: "✅", color: colors.green },
  error: { icon: "⚠️", color: colors.red },
  info: { icon: "ℹ️", color: colors.blue },
};

export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div
      style={{ position: "fixed", right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 100, maxWidth: 320 }}
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const copy = TYPE_COPY[t.type] || TYPE_COPY.info;
        return (
          <div
            key={t.id}
            role="status"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#10140F",
              border: `1px solid ${copy.color}55`,
              color: copy.color,
              fontSize: 12,
              fontFamily: fonts.mono,
              boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            }}
          >
            {copy.icon} {t.message}
          </div>
        );
      })}
    </div>
  );
}
