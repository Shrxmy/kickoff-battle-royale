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
  // Knocked out: a clear label instead of a faded leftover pip.
  if (value === 0) return <span className="animate-pop text-xs font-bold tracking-wide text-red-700 uppercase">Out</span>;
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

// Hides an intro after `ms` (it also fades itself out with CSS just before).
function useShown(ms: number) {
  const [on, setOn] = useState(ms > 150);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return on;
}

// A ring of sparks bursting from the centre of the nearest positioned parent.
export function Sparks({ delay = 0, count = 16, distance = 190 }: { delay?: number; count?: number; distance?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const d = distance * (0.65 + (i % 3) * 0.2);
        return (
          <span
            key={i}
            className="spark block size-3 rounded-sm"
            style={{
              "--dx": `${Math.cos(a) * d}px`,
              "--dy": `${Math.sin(a) * d}px`,
              animationDelay: `${delay}s`,
              background: i % 2 ? "#FFBC2B" : "#FFFFFF",
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

// Full-screen comic split shown for `ms` before a question: `top` slides in from the right,
// `bottom` from the left, then `center` slams down the middle with a flash. Unmounts itself when done.
export function VsIntro({ ms, top, bottom, center }: { ms: number; top: React.ReactNode; bottom: React.ReactNode; center: string }) {
  const shown = useShown(ms);
  if (!shown) return null;
  return (
    <div
      className="comic-navy fixed inset-0 z-40 overflow-hidden"
      style={{ animation: `intro-out 0.3s ease-in ${Math.max(0, ms - 300)}ms forwards` }}
      role="presentation"
    >
      <div className="absolute inset-0 animate-jolt" style={{ animationDelay: "0.6s" }}>
        <div className="comic-amber absolute inset-0 flex items-start justify-end overflow-hidden p-6 pt-[10vh] [clip-path:polygon(0_0,100%_0,100%_44%,0_58%)] sm:pr-[12vw]">
          <div className="speedlines" />
          <div className="relative animate-slide-in-right">{top}</div>
        </div>
        <div className="comic-blue absolute inset-0 flex items-end justify-start overflow-hidden p-6 pb-[10vh] [clip-path:polygon(0_60%,100%_46%,100%_100%,0_100%)] sm:pl-[12vw]">
          <div className="speedlines [animation-direction:reverse]" />
          <div className="relative animate-slide-in-left" style={{ animationDelay: "0.15s" }}>{bottom}</div>
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <Sparks delay={0.6} />
          <Burst
            className={`bg-white text-[#E5383B] drop-shadow-[0_6px_0_rgba(0,0,0,0.35)] ${
              center.length > 3 ? "size-56 text-4xl sm:size-80 sm:text-7xl" : "size-40 text-6xl sm:size-56 sm:text-8xl"
            }`}
            style={{ animationDelay: "0.5s" }}
          >
            {center}
          </Burst>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 animate-flash bg-white" style={{ animationDelay: "0.6s" }} />
    </div>
  );
}

export type FighterInfo = { avatar: string; name: string; energy?: number };

// One fighter: big avatar on a tilted name banner, with energy pips when known.
export function Fighter({ avatar, name, energy, tilt = "-rotate-3", size = 150 }: FighterInfo & { tilt?: string; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar id={avatar} size={size} className="drop-shadow-[0_10px_0_rgba(0,0,0,0.25)]" />
      <span
        className={`${tilt} max-w-[40vw] truncate rounded-md bg-white px-3 py-1 font-poppins font-black text-[#0E2A4D] uppercase shadow-[4px_4px_0_#0E2A4D] sm:max-w-[30vw] ${
          size < 140 ? "text-base" : "text-2xl"
        }`}
      >
        {name}
      </span>
      {energy !== undefined && energy >= 0 && <Energy value={energy} size={size < 140 ? 14 : 20} />}
    </div>
  );
}

// The last two players square off: spotlight glows, FINAL DUEL banner, crackling bolt, then VS with a flash.
export function Standoff({ ms, a, b, caption }: { ms: number; a: FighterInfo; b: FighterInfo; caption: string }) {
  // Client-only (it only renders mid-round), so the viewport is known.
  const [size] = useState(() => Math.max(96, Math.min(230, Math.round(window.innerWidth * 0.28))));
  const shown = useShown(ms);
  if (!shown) return null;
  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden bg-[#060D1C]"
      style={{ animation: `intro-out 0.4s ease-in ${Math.max(0, ms - 400)}ms forwards` }}
      role="presentation"
    >
      <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(circle_at_35%_55%,rgba(47,126,227,0.6),transparent_65%)]" />
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_65%_55%,rgba(229,56,59,0.55),transparent_65%)]" />
      <div className="speedlines opacity-50" />
      <div className="absolute inset-0 animate-jolt" style={{ animationDelay: "1.5s" }}>
        <h2
          className="absolute inset-x-0 top-[9vh] animate-banner text-center font-poppins text-5xl font-black text-[#FFBC2B] italic drop-shadow-[0_5px_0_#7A4E00] sm:text-8xl"
          style={{ animationDelay: "0.15s" }}
        >
          FINAL DUEL
        </h2>
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-[3vw] sm:px-[8vw]">
          <div className="animate-slide-in-left" style={{ animationDelay: "0.55s" }}>
            <div className="animate-lean" style={{ "--lean": "10px", "--tilt": "3deg", animationDelay: "1.2s" } as React.CSSProperties}>
              <Fighter {...a} size={size} />
            </div>
          </div>
          <div className="relative grid size-24 place-items-center sm:size-40">
            <Zap
              className="absolute size-20 animate-flicker fill-[#FFBC2B] text-[#FFE7B4] drop-shadow-[0_0_24px_#FFBC2B] sm:size-32"
              style={{ animationDelay: "0.9s" }}
              aria-hidden
            />
            <Sparks delay={1.5} count={20} distance={size * 1.3} />
            <Burst className="relative size-24 bg-white text-4xl text-[#E5383B] sm:size-40 sm:text-7xl" style={{ animationDelay: "1.45s" }}>
              VS
            </Burst>
          </div>
          <div className="animate-slide-in-right" style={{ animationDelay: "0.75s" }}>
            <div className="animate-lean" style={{ "--lean": "-10px", "--tilt": "-3deg", animationDelay: "1.2s" } as React.CSSProperties}>
              <Fighter {...b} size={size} tilt="rotate-3" />
            </div>
          </div>
        </div>
        <p
          className="absolute inset-x-0 bottom-[9vh] animate-fade-in-up text-center font-poppins text-base font-bold tracking-[0.3em] text-white/80 uppercase sm:text-2xl"
          style={{ animationDelay: "2.1s" }}
        >
          {caption}
        </p>
      </div>
      <div className="pointer-events-none absolute inset-0 animate-flash bg-white" style={{ animationDelay: "1.5s" }} />
    </div>
  );
}

const SOCIALS = [
  { href: "mailto:css.cics@ust.edu.ph", icon: "/icons/email.svg", label: "Email css.cics@ust.edu.ph" },
  { href: "https://www.facebook.com/ustcss", icon: "/icons/facebook.svg", label: "UST Computer Science Society on Facebook" },
  { href: "https://www.instagram.com/ustcss", icon: "/icons/instagram.svg", label: "@ustcss on Instagram" },
];

// Slim take on the css-apply footer; pages leave it out mid-game.
export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-b-4 border-[#287FEB] bg-[#044FAF] px-5 py-3 text-white sm:justify-between md:px-20">
      <div className="flex items-center gap-3">
        <Image src="/logo-white.webp" alt="" width={28} height={28} />
        <div className="leading-tight">
          <p className="text-sm font-semibold">Computer Science Society</p>
          <p className="text-[11px] text-white/70">© {new Date().getFullYear()} Computer Science Society. All rights reserved.</p>
        </div>
      </div>
      <nav className="flex items-center gap-3" aria-label="Computer Science Society links">
        {SOCIALS.map((s) => (
          <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} className="rounded opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white">
            <Image src={s.icon} alt="" width={20} height={20} />
          </a>
        ))}
      </nav>
    </footer>
  );
}

// Reading time before the choices appear: an amber bar draining over `ms` and a seconds count.
export function ReadBar({ ms }: { ms: number }) {
  return (
    <div className="flex w-full flex-col items-center gap-2" role="status">
      <p className="font-poppins text-sm font-semibold sm:text-base">
        Read the question · answers in <Countdown ms={ms} className="text-lg text-[#CE9823] sm:text-2xl" />
      </p>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#FFE7B4]" role="presentation">
        <div className="timer-bar h-full w-full rounded-full bg-[#FFBC2B]" style={{ "--t": `${ms}ms` } as React.CSSProperties} />
      </div>
    </div>
  );
}
