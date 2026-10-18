import Image from "next/image";
import { Zap } from "lucide-react";
import { titlePill } from "./ui";

// The ten committee CSARs double as Blooket-style "blooks".
export const AVATARS = [
  "TECHDEV", "ACADEMICS", "COMMDEV", "CREATIVES", "DOCU",
  "EXTERNALS", "FINANCE", "LOGISTICS", "PUBLICITY", "SPOTA",
];

export function Avatar({ id, size = 64, className = "" }: { id: string; size?: number; className?: string }) {
  const src = AVATARS.includes(id) || id === "bot" ? id : "TECHDEV";
  return (
    <Image
      src={`/csar/${src}.webp`}
      alt=""
      width={size}
      height={size}
      className={`object-contain drop-shadow-[0_6px_10px_rgba(19,70,135,0.18)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Energy as lightning pips. `lost` pips animate away once (when the key changes).
export function Energy({ value, lost = 0, size = 16 }: { value: number; lost?: number; size?: number }) {
  if (value < 0) return <span className="text-xs font-semibold text-[#134687]/60">Bot</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5" aria-label={`${value} energy`}>
      {Array.from({ length: value + lost }, (_, i) => (
        <Zap
          key={i}
          size={size}
          className={`fill-[#FFBC2B] text-[#CE9823] ${i >= value ? "animate-drain" : ""}`}
          aria-hidden
        />
      ))}
      {value + lost === 0 && <span className="text-xs font-semibold text-red-700">Out</span>}
    </span>
  );
}

export function Brand({ right }: { right?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 bg-white px-4 py-2 shadow-md shadow-black/20 sm:px-8">
      <div className="flex items-center gap-3">
        <Image src="/logo-blue.webp" alt="Computer Science Society" width={48} height={48} priority />
        <span className="font-poppins text-lg font-semibold sm:text-xl">Battle Royale</span>
      </div>
      {right}
    </header>
  );
}

export function TitlePill({ children }: { children: React.ReactNode }) {
  return <h1 className={`${titlePill} mx-auto animate-fade-in-up`}>{children}</h1>;
}
