import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const FAN = [
  { hex: "#9db39a", rotate: -22 },
  { hex: "#e6b48a", rotate: 0 },
  { hex: "#2f5e4e", rotate: 22 },
];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#f3f0ea" }}>
        {FAN.map((c) => (
          <div
            key={c.hex}
            style={{
              position: "absolute",
              left: 72,
              top: 34,
              width: 36,
              height: 112,
              background: c.hex,
              borderRadius: 7,
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
