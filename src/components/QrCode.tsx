import qrcode from "qrcode-generator";

/** A QR code drawn as plain SVG squares, crisp at any print size. */
export function QrCode({ value, size, label }: { value: string; size: string; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 2;
  const cells: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) if (qr.isDark(r, c)) cells.push(`M${c + quiet},${r + quiet}h1v1h-1z`);
  }
  const span = count + quiet * 2;
  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#fff" />
      <path d={cells.join("")} fill="#000" />
    </svg>
  );
}
