import Image from "next/image";
import { useEffect, useState } from "react";
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

// Whole seconds left, counting down from `ms` at mount. Remount (key) to restart.
export function Countdown({ ms, className = "" }: { ms: number; className?: string }) {
  const [end] = useState(() => Date.now() + ms);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return <span className={`tabular-nums ${className}`}>{Math.max(0, Math.ceil((end - now) / 1000))}</span>;
}

const CONFETTI = ["#2F7EE3", "#134687", "#FFBC2B", "#0077FF", "#CE9823"];

// One CSS-only burst; reduced-motion users get none (the global rule ends it instantly off-screen).
export function Confetti({ count = 70 }: { count?: number }) {
  const [bits] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.6 + Math.random() * 2,
      size: 6 + Math.random() * 7,
      spin: 360 + Math.random() * 720,
      color: CONFETTI[i % CONFETTI.length],
    })),
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti absolute top-0 block rounded-[2px]"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * 0.45,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            "--spin": `${b.spin}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function TitlePill({ children }: { children: React.ReactNode }) {
  return <h1 className={`${titlePill} mx-auto animate-fade-in-up`}>{children}</h1>;
}

// Jagged comic sticker ("VS", "K.O.!", "WIN!"). Slams in once on mount.
export function Burst({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`burst animate-slam grid place-items-center font-poppins font-black italic ${className}`} style={style}>
      {children}
    </span>
  );
}

// Full-screen comic split shown for `ms` before a question: `top` slides in from the right,
// `bottom` from the left, then `center` slams down the middle. Unmounts itself when done.
export function VsIntro({ ms, top, bottom, center }: { ms: number; top: React.ReactNode; bottom: React.ReactNode; center: string }) {
  const [on, setOn] = useState(ms > 150);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  if (!on) return null;
  return (
    <div
      className="comic-navy fixed inset-0 z-40 overflow-hidden"
      style={{ animation: `intro-out 0.3s ease-in ${Math.max(0, ms - 300)}ms forwards` }}
      role="presentation"
    >
      <div className="absolute inset-0 animate-jolt" style={{ animationDelay: "0.75s" }}>
        <div className="comic-amber absolute inset-0 flex items-start justify-end p-6 pt-[10vh] [clip-path:polygon(0_0,100%_0,100%_44%,0_58%)] sm:pr-[12vw]">
          <div className="animate-slide-in-right">{top}</div>
        </div>
        <div className="comic-blue absolute inset-0 flex items-end justify-start p-6 pb-[10vh] [clip-path:polygon(0_60%,100%_46%,100%_100%,0_100%)] sm:pl-[12vw]">
          <div className="animate-slide-in-left" style={{ animationDelay: "0.15s" }}>{bottom}</div>
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <Burst
            className={`bg-white text-[#E5383B] drop-shadow-[0_6px_0_rgba(0,0,0,0.35)] ${
              center.length > 3 ? "size-56 text-4xl sm:size-80 sm:text-7xl" : "size-40 text-6xl sm:size-56 sm:text-8xl"
            }`}
            style={{ animationDelay: "0.55s" }}
          >
            {center}
          </Burst>
        </div>
      </div>
    </div>
  );
}

// One fighter in the VS intro: big avatar on a tilted name banner.
export function Fighter({ avatar, name, tilt = "-rotate-3" }: { avatar: string; name: string; tilt?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar id={avatar} size={150} className="drop-shadow-[0_10px_0_rgba(0,0,0,0.25)]" />
      <span className={`${tilt} max-w-[70vw] truncate rounded-md bg-white px-4 py-1 font-poppins text-2xl font-black text-[#0E2A4D] uppercase shadow-[4px_4px_0_#0E2A4D]`}>
        {name}
      </span>
    </div>
  );
}
