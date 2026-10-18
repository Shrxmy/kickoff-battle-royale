"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Crown, LogOut } from "lucide-react";
import { BOT, INTRO_MS, type HostMsg, type PlayerMap, type PlayerMsg } from "@/lib/engine";
import { inboxName, post, roomName, subscribe, type Status } from "@/lib/realtime";
import { AVATARS, Avatar, Brand, Burst, Confetti, Countdown, Energy, Fighter, TitlePill, VsIntro } from "@/components/game";
import { card, cta, focus, input, letters, pill, tiles } from "@/components/ui";

type Me = { code: string; id: string; name: string; avatar: string };
const ME_KEY = "br-player";

function load(): Me | null {
  try {
    return JSON.parse(sessionStorage.getItem(ME_KEY) ?? "null");
  } catch {
    return null;
  }
}

export default function PlayPage() {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [draft, setDraft] = useState({ code: "", name: "" });

  useEffect(() => {
    const saved = load();
    const code = new URLSearchParams(window.location.search).get("code")?.replace(/\D/g, "").slice(0, 6) ?? "";
    // A QR scan for a different game wins over a stale session.
    if (saved && (!code || code === saved.code)) setMe(saved);
    else setDraft((d) => ({ ...d, code }));
    setReady(true);
  }, []);

  function enter(avatar: string) {
    // getRandomValues, not randomUUID: the latter is missing on plain-http LAN dev pages.
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    const next = { code: draft.code, name: draft.name.trim().slice(0, 16), avatar, id };
    try {
      sessionStorage.setItem(ME_KEY, JSON.stringify(next));
    } catch {
      // Without storage a refresh just means joining again.
    }
    setMe(next);
  }

  function leave() {
    // Tell the host so we don't linger in the lobby or keep getting paired.
    if (me) post(inboxName(me.code), { t: "leave", id: me.id } satisfies PlayerMsg).catch(() => {});
    try {
      sessionStorage.removeItem(ME_KEY);
    } catch {}
    setDraft({ code: "", name: "" });
    setMe(null);
    history.replaceState(null, "", "/");
  }

  if (!ready) return null;
  return (
    <div className="flex min-h-dvh flex-col">
      <Brand
        right={
          me && (
            <button type="button" onClick={() => confirm("Leave this game?") && leave()} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold ${focus}`}>
              <LogOut size={16} aria-hidden /> Leave
            </button>
          )
        }
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-4">
        {me ? <Game me={me} onLeave={leave} /> : <JoinForm draft={draft} setDraft={setDraft} onEnter={enter} />}
      </main>
    </div>
  );
}

function JoinForm({ draft, setDraft, onEnter }: {
  draft: { code: string; name: string }; setDraft: (d: { code: string; name: string }) => void; onEnter: (avatar: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const valid = /^\d{6}$/.test(draft.code) && draft.name.trim().length > 0;

  if (picking) {
    return (
      <div className="flex animate-fade-in-up flex-col gap-4">
        <TitlePill>Pick your CSAR</TitlePill>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {AVATARS.map((a) => (
            <li key={a}>
              <button
                type="button"
                onClick={() => onEnter(a)}
                className={`${card} flex w-full flex-col items-center gap-1 p-2 transition-transform hover:scale-105 active:scale-95 ${focus}`}
              >
                <Avatar id={a} size={72} />
                <span className="text-[11px] font-semibold tracking-wide">{a}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="self-center text-sm font-semibold underline" onClick={() => setPicking(false)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-1 animate-fade-in-up flex-col justify-center gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setPicking(true);
      }}
    >
      <Image src="/csar/bot.webp" alt="" width={140} height={120} className="mx-auto" priority />
      <TitlePill>Battle Royale</TitlePill>
      <div className={`${card} flex flex-col gap-4 p-5`}>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Game code
          <input
            className={`${input} text-center font-poppins text-2xl tracking-[0.3em]`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            maxLength={6}
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            autoFocus={!draft.code}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Nickname
          <input
            className={input}
            autoComplete="nickname"
            maxLength={16}
            placeholder="Your name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoFocus={!!draft.code}
          />
        </label>
        <button type="submit" className={cta} disabled={!valid}>
          Enter
        </button>
      </div>
    </form>
  );
}

// Re-sent snapshots for the same round (rejoins, removals) update the data but keep the
// first `left`, so the answer timer and the measured answer time don't restart.
function accept(prev: HostMsg | null, next: HostMsg): HostMsg {
  if (prev?.t === "round" && next.t === "round" && prev.n === next.n) return { ...next, left: prev.left };
  return next;
}

const buzz = (pattern: number | number[]) => navigator.vibrate?.(pattern);

function Game({ me, onLeave }: { me: Me; onLeave: () => void }) {
  const [msg, setMsg] = useState<HostMsg | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const removed = !!msg?.out?.includes(me.id);
  const joined = removed || (!!msg && (msg.t !== "lobby" || msg.players.some(([id]) => id === me.id)));
  const joinedRef = useRef(joined);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    const hello: PlayerMsg = { t: "join", id: me.id, name: me.name, avatar: me.avatar };
    const sayHello = () => post(inboxName(me.code), hello).catch(() => {});
    const room = subscribe<HostMsg>(roomName(me.code), (m) => setMsg((p) => accept(p, m)), (s) => {
      setStatus(s);
      if (s === "live") sayHello(); // also after a reconnect, so the host re-sends the snapshot
    });
    // Until the host lists us, keep knocking: the host may still be loading.
    const retry = setInterval(() => !joinedRef.current && sayHello(), 3000);
    return () => {
      clearInterval(retry);
      room.close();
    };
  }, [me]);

  return (
    <>
      {status !== "live" && (
        <p className={`${pill} self-center bg-[#FFF8E7] text-[#8A5A00]`} role="status">
          {status === "offline" ? "Offline, reconnecting…" : "Connecting…"}
        </p>
      )}
      {removed ? (
        <Notice title="Removed by the host" text="You're no longer in this game." img="sad">
          <button type="button" className={`${cta} mt-2`} onClick={onLeave}>
            Join another game
          </button>
        </Notice>
      ) : !msg || msg.t === "lobby" ? (
        <Waiting me={me} joined={joined} players={msg?.t === "lobby" ? msg.players : []} />
      ) : msg.t === "end" ? (
        <End me={me} msg={msg} />
      ) : !msg.players[me.id] ? (
        <Notice title="Game in progress" text="This game started without you. Wait for the next one!" />
      ) : msg.t === "round" ? (
        <Question key={msg.n} me={me} msg={msg} />
      ) : (
        <Result key={msg.n} me={me} msg={msg} />
      )}
    </>
  );
}

function Notice({ title, text, img = "bot", children }: { title: string; text: string; img?: string; children?: React.ReactNode }) {
  return (
    <div className={`${card} flex animate-pop flex-col items-center gap-3 p-6 text-center`}>
      <Image src={`/csar/${img}.webp`} alt="" width={120} height={120} />
      <h2 className="font-poppins text-2xl font-semibold">{title}</h2>
      <p className="text-[#134687]/70">{text}</p>
      {children}
    </div>
  );
}

function Waiting({ me, joined, players }: { me: Me; joined: boolean; players: [string, string, string][] }) {
  const count = players.length;
  const others = players.filter(([id]) => id !== me.id);
  return (
    <div className={`${card} flex animate-pop flex-col items-center gap-3 p-6 text-center`}>
      <Avatar id={me.avatar} size={120} className={joined ? "animate-pop" : "opacity-50"} />
      <h2 className="font-poppins text-2xl font-semibold">{joined ? "You're in!" : "Joining…"}</h2>
      <p className="text-lg font-semibold">{me.name}</p>
      <p className="text-sm text-[#134687]/70">
        {joined ? `${count} player${count === 1 ? "" : "s"} in the lobby. Eyes on the big screen!` : `Game ${me.code}. Make sure the host has the lobby open.`}
      </p>
      {joined && others.length > 0 && (
        <ul className="mt-1 flex flex-wrap justify-center -space-x-2" aria-label="Other players">
          {others.slice(-12).map(([id, name, avatar]) => (
            <li key={id} title={name} className="animate-bounce-in rounded-full bg-[#F3F8FF] p-0.5 ring-2 ring-white">
              <Avatar id={avatar} size={32} />
            </li>
          ))}
          {others.length > 12 && (
            <li className="grid size-9 place-items-center rounded-full bg-[#134687] text-xs font-semibold text-white ring-2 ring-white">
              +{others.length - 12}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Duelists({ me, opp, players, lost }: { me: string; opp: string; players: PlayerMap; lost?: string | null }) {
  const side = (id: string, align: string) => {
    const [name, avatar, energy] = players[id];
    return (
      <div className={`flex min-w-0 flex-1 flex-col gap-1 ${align} ${lost === id ? "animate-shake" : ""}`}>
        <Avatar id={id === BOT ? BOT : avatar} size={52} />
        <span className="max-w-full truncate text-sm font-semibold">{id === me ? "You" : name}</span>
        <Energy key={String(lost)} value={energy} lost={lost === id ? 1 : 0} size={14} />
      </div>
    );
  };
  return (
    <div className={`${card} flex items-center gap-2 p-3`}>
      {side(me, "items-start")}
      <span className="font-poppins text-sm font-bold text-[#134687]/50">VS</span>
      {side(opp, "items-end text-right")}
    </div>
  );
}

const opponent = (duels: [string, string][], id: string) => {
  const d = duels.find((x) => x.includes(id));
  return d && (d[0] === id ? d[1] : d[0]);
};

function Question({ me, msg }: { me: Me; msg: Extract<HostMsg, { t: "round" }> }) {
  const opp = opponent(msg.duels, me.id);
  // Whatever is left beyond the answer window is VS intro; a phone rejoining mid-round gets none.
  const [intro] = useState(() => Math.max(0, Math.min(INTRO_MS, msg.left - msg.duration * 1000)));
  const [asking, setAsking] = useState(intro === 0);
  useEffect(() => {
    const t = setTimeout(() => setAsking(true), intro);
    return () => clearTimeout(t);
  }, [intro]);

  if (!opp) {
    const [, , energy] = msg.players[me.id];
    return energy > 0 ? (
      <Notice title="Sit this one out" text="You'll be paired next round." />
    ) : (
      <Notice title="You're out!" text="Out of energy. Watch the big screen to see who wins." img="sad" />
    );
  }
  const [oppName, oppAvatar] = msg.players[opp];
  return (
    <>
      <VsIntro
        ms={intro}
        center="VS"
        top={<Fighter avatar={opp === BOT ? BOT : oppAvatar} name={opp === BOT ? "CSAR Bot" : oppName} tilt="rotate-3" />}
        bottom={<Fighter avatar={me.avatar} name="You" />}
      />
      {asking && <Ask me={me} msg={msg} opp={opp} left={Math.max(0, msg.left - intro)} />}
    </>
  );
}

function Ask({ me, msg, opp, left }: { me: Me; msg: Extract<HostMsg, { t: "round" }>; opp: string; left: number }) {
  const shownAt = useRef(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);

  useEffect(() => {
    // Time from when the choices first appeared this round, so refreshing mid-question can't reset the speed clock.
    shownAt.current = performance.now() - Math.max(0, msg.duration * 1000 - left);
    const t = setTimeout(() => setTimeUp(true), left);
    return () => clearTimeout(t);
  }, [left, msg.duration]);

  async function pick(choice: number) {
    if (picked !== null || timeUp) return;
    const ms = Math.round(performance.now() - shownAt.current);
    setPicked(choice);
    buzz(15);
    const a: PlayerMsg = { t: "answer", id: me.id, n: msg.n, choice, ms };
    // One retry covers a dropped request; the host ignores duplicates.
    if (!(await post(inboxName(me.code), a).catch(() => false))) post(inboxName(me.code), a).catch(() => {});
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-xs font-semibold text-[#134687]/60">
        <span>Round {msg.n}</span>
        <span className="flex items-center gap-1">
          <Countdown ms={left} className="font-poppins text-base text-[#134687]" />s left
        </span>
      </div>
      <Duelists me={me.id} opp={opp} players={msg.players} />
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E8F2FF]" role="presentation">
        <div
          className="timer-bar h-full rounded-full bg-[linear-gradient(90deg,#2F7EE3,#0349A2)]"
          style={{ "--t": `${left}ms`, width: `${(left / (msg.duration * 1000)) * 100}%` } as React.CSSProperties}
        />
      </div>
      <h2 className={`${card} animate-fade-in-up p-4 text-center font-poppins text-lg font-semibold sm:text-xl`}>{msg.q.text}</h2>
      <div className="grid flex-1 grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        {msg.q.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            disabled={picked !== null || timeUp}
            onClick={() => pick(i)}
            className={`flex min-h-20 animate-pop items-center gap-3 rounded-xl p-4 text-left text-base font-semibold shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-none ${tiles[i]} ${focus} ${
              picked !== null && picked !== i ? "opacity-30" : ""
            } ${picked === i ? "ring-4 ring-[#134687]/40 ring-offset-2" : ""} disabled:cursor-default`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/25 text-sm">{letters[i]}</span>
            <span className="min-w-0 break-words">{c}</span>
          </button>
        ))}
      </div>
      <p className="min-h-6 text-center font-semibold text-[#134687]/70" role="status">
        {picked !== null ? "Locked in! Waiting for your opponent…" : timeUp ? "Time's up!" : ""}
      </p>
    </div>
  );
}

function Result({ me, msg }: { me: Me; msg: Extract<HostMsg, { t: "result" }> }) {
  const r = msg.results.find((x) => x.a === me.id || x.b === me.id);
  const energy = msg.players[me.id][2];
  const verdict = !r || r.winner === null ? null : r.winner === me.id;
  useEffect(() => {
    if (verdict !== null) buzz(verdict ? [30, 60, 30] : 250);
  }, [verdict]);
  if (!r) {
    return energy > 0 ? (
      <Notice title="Round over" text="Get ready for the next one." />
    ) : (
      <Notice title="You're out!" text="Out of energy. Watch the big screen to see who wins." img="sad" />
    );
  }
  const opp = r.a === me.id ? r.b : r.a;
  const mine = r.a === me.id ? r.aChoice : r.bChoice;
  const outcome = r.winner === null ? "draw" : r.winner === me.id ? "won" : "lost";
  const title = { won: "You won!", lost: energy === 0 ? "Eliminated!" : "-1 Energy", draw: "Draw!" }[outcome];
  return (
    <div className="flex flex-col gap-4">
      <Duelists me={me.id} opp={opp} players={msg.players} lost={r.winner && (r.winner === me.id ? opp : me.id)} />
      <div className={`${card} flex animate-pop flex-col items-center gap-2 p-6 text-center`}>
        <div className="relative">
          <Image src={`/csar/${outcome === "won" ? "excited" : outcome === "lost" ? "sad" : "bot"}.webp`} alt="" width={120} height={120} />
          <Burst
            className={`absolute -top-3 -right-16 size-24 text-2xl ${
              outcome === "won" ? "bg-[#FFBC2B] text-[#0E2A4D]" : outcome === "lost" ? "bg-[#E5383B] text-white" : "bg-[#E8F2FF] text-[#134687]"
            }`}
            style={{ animationDelay: "0.2s" }}
          >
            {{ won: "WIN!", lost: "K.O.", draw: "TIE" }[outcome]}
          </Burst>
        </div>
        <h2 className={`font-poppins text-3xl font-bold ${outcome === "won" ? "text-green-700" : outcome === "lost" ? "text-red-700" : ""}`}>{title}</h2>
        <p className="text-sm text-[#134687]/70">
          {mine === null ? "You didn't answer." : mine === msg.correct ? "You got it right." : "Not quite."} Answer:{" "}
          <span className="font-semibold text-[#134687]">{msg.q.choices[msg.correct]}</span>
        </p>
      </div>
    </div>
  );
}

function End({ me, msg }: { me: Me; msg: Extract<HostMsg, { t: "end" }> }) {
  const mine = msg.ranking.find((p) => p.id === me.id);
  return (
    <div className="flex flex-col gap-4">
      {mine?.place === 1 && <Confetti />}
      {mine && (
        <div className={`${card} flex animate-pop flex-col items-center gap-2 p-6 text-center`}>
          <Avatar id={mine.avatar} size={110} />
          {mine.place === 1 && <Crown size={32} className="fill-[#FFBC2B] text-[#CE9823]" aria-hidden />}
          <h2 className="font-poppins text-4xl font-bold">#{mine.place}</h2>
          <p className="text-[#134687]/70">
            {mine.place === 1 ? "Last CSAR standing!" : `of ${msg.ranking.length}`} · {mine.correct} correct
          </p>
        </div>
      )}
      <ol className={`${card} divide-y divide-[#005FD9]/10 p-2`}>
        {msg.ranking.slice(0, 5).map((p, i) => (
          <li key={p.id} className={`flex animate-fade-in-up items-center gap-3 px-3 py-2 ${p.id === me.id ? "font-semibold" : ""}`} style={{ animationDelay: `${300 + i * 80}ms` }}>
            <span className="w-7">#{p.place}</span>
            <Avatar id={p.avatar} size={32} />
            <span className="flex-1 truncate">{p.name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
