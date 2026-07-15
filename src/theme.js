// ============================================================
//  DESIGN TOKENS
// ============================================================
// Extracted from the original prototype's inline styles. Greys were
// raised for contrast (the prototype's #3A3A2E-on-#060A06 combo sat
// well under WCAG AA); everything else keeps the green-terminal look.
export const colors = {
  bg: "#060A06",
  bgPanel: "rgba(255,255,255,0.03)",
  bgPanelHover: "rgba(255,255,255,0.05)",
  border: "rgba(139,195,74,0.14)",
  borderSubtle: "rgba(255,255,255,0.07)",

  text: "#EDEBE1",
  textSecondary: "#B7B4A6", // was #7A7A6E
  textTertiary: "#9C9A8C", // was #6B6B5E
  textMuted: "#87857A", // was #5A5A4E / #3A3A2E

  green: "#8BC34A",
  greenBright: "#4CAF50",
  orange: "#FFA726", // was #FF9800, nudged brighter for contrast
  blue: "#4FC3F7",
  red: "#FF6B67", // was #EF5350, nudged brighter
  cyan: "#26C6DA",
  purple: "#CE93D8", // was #9C27B0, far too dark on black
  brown: "#C4AA9C", // was #A1887F

  focus: "#FFD54F",
};

export const fonts = {
  mono: "'Courier New', monospace",
  serif: "'Georgia', serif",
};

export const alertColor = (level) =>
  level === "critical" ? colors.red : level === "warning" ? colors.orange : colors.green;
