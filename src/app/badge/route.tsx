import { ImageResponse } from "next/og";

const FAN = [-22, 0, 22];

// The paint-chip fan as a notification badge: Android draws only its shape,
// in white, in the status bar.
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        {FAN.map((rotate) => (
          <div
            key={rotate}
            style={{
              position: "absolute",
              left: 38,
              top: 12,
              width: 20,
              height: 68,
              background: "white",
              borderRadius: 4,
              transform: `rotate(${rotate}deg)`,
              transformOrigin: "50% 92%",
              opacity: rotate === 0 ? 1 : 0.85,
            }}
          />
        ))}
      </div>
    ),
    { width: 96, height: 96, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
