import { colors, fonts } from "../theme.js";

export default function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: fonts.mono,
        color: colors.textTertiary,
        letterSpacing: 2,
        textTransform: "uppercase",
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}
