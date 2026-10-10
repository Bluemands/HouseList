import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const FAN = [
  { hex: "#9db39a", rotate: -22 },
  { hex: "#e6b48a", rotate: 0 },
  { hex: "#2f5e4e", rotate: 22 },
];

// The paint-chip fan from the wordmark.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#f3f0ea", borderRadius: 14 }}>
        {FAN.map((c) => (
          <div
            key={c.hex}
            style={{
              position: "absolute",
              left: 25,
              top: 10,
              width: 14,
              height: 44,
              background: c.hex,
              borderRadius: 3,
              transform: `rotate(${c.rotate}deg)`,
              transformOrigin: "50% 92%",
            }}
          />
        ))}
      </div>
    ),
    size,
  );
}
