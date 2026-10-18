import { useMemo } from "react";
import { encode } from "uqr";

// One <path> of 1x1 squares scales crisply to any size without a canvas.
export function JoinQR({ url, className = "" }: { url: string; className?: string }) {
  const { d, n } = useMemo(() => {
    const { data } = encode(url, { ecc: "M", border: 2 });
    let d = "";
    data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)));
    return { d, n: data.length };
  }, [url]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label={`QR code to join at ${url}`} className={className}>
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#134687" />
    </svg>
  );
}
