/** shared 1200×630 social card for Open Graph / Twitter images */
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({ eyebrow, title, stats = [], footer }: { eyebrow: string; title: string; stats?: Array<[string, string]>; footer: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#fafbf9", color: "#202d29", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>PROMETEO</div>
          <div style={{ width: 1, height: 34, background: "#bacabd" }} />
          <div style={{ fontSize: 22, letterSpacing: 6, color: "#63716a" }}>CHILE</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: "#2f7c7a" }}>{eyebrow}</div>
          <div style={{ fontSize: title.length > 70 ? 54 : 68, lineHeight: 1.1, fontWeight: 600, letterSpacing: -1.5, maxWidth: 1050 }}>{title}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 48 }}>
            {stats.map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 40, fontWeight: 600, color: "#234f43" }}>{v}</div>
                <div style={{ fontSize: 22, color: "#63716a" }}>{k}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 22, color: "#63716a" }}>{footer}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
