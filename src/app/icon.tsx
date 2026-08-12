import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a1626",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            width: 6,
            height: 20,
            background: "#c2402c",
            marginRight: 4,
            borderRadius: 1,
          }}
        />
        <div
          style={{
            width: 14,
            height: 20,
            background: "#f4efe2",
            borderRadius: 1,
          }}
        />
      </div>
    ),
    size,
  );
}
