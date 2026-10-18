"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Crown, Play, Users, X } from "lucide-react";
import {
  BOT, GRACE_MS, MAX_PLAYERS, allAnswered, alive, answer, end, finishRound, isOver, join, kick, newGame, publicView, rank, startRound,
  type DuelResult, type Game, type PlayerMsg, type Settings,
} from "@/lib/engine";
import { inboxName, localOnly, roomName, subscribe, type Status } from "@/lib/realtime";
import { Avatar, Brand, Energy, TitlePill } from "@/components/game";
import { JoinQR } from "@/components/JoinQR";
import { QuestionEditor, SAMPLE, questionsOf } from "@/components/QuestionEditor";
import { card, cta, danger, focus, letters, pill, secondary, tiles } from "@/components/ui";

const GAME_KEY = "br-host-game";
const TEXT_KEY = "br-host-questions";
const SETTINGS_KEY = "br-host-settings";
const RESULT_MS = 5000;

const randomCode = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));

function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or full storage: the game still runs, it just can't survive a refresh.
  }
}

export default function HostPage() {
  const [ready, setReady] = useState(false);
  const [origin, setOrigin] = useState("");
  const [text, setText] = useState(SAMPLE);
  const [settings, setSettings] = useState<Settings>({ energy: 5, duration: 20 });
  const [game, setGame] = useState<Game | null>(null);
  const [roomStatus, setRoomStatus] = useState<Status>("offline");
  const [inboxStatus, setInboxStatus] = useState<Status>("offline");

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const g = localStorage.getItem(GAME_KEY);
      if (g) setGame(JSON.parse(g));
      const t = localStorage.getItem(TEXT_KEY);
      if (t !== null) setText(t);
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) setSettings(JSON.parse(s));
    } catch {
      // Corrupt or blocked storage: start fresh.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    save(TEXT_KEY, text);
    save(SETTINGS_KEY, JSON.stringify(settings));
    save(GAME_KEY, game && JSON.stringify(game));
  }, [ready, text, settings, game]);

  // --- Realtime: host broadcasts snapshots on the room, reads players from the inbox. ---
  const gameRef = useRef(game);
  const roomRef = useRef<ReturnType<typeof subscribe> | null>(null);
  const sent = useRef({ key: "", at: 0 });
  const pending = useRef<number | undefined>(undefined);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const broadcast = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = undefined;
    const g = gameRef.current;
    if (!g || !roomRef.current) return;
    roomRef.current.send(publicView(g, Date.now()));
    sent.current.at = Date.now();
  }, []);

  // At most one snapshot per second for lobby churn and rejoin requests.
  const throttled = useCallback(() => {
    if (pending.current !== undefined) return;
    pending.current = window.setTimeout(broadcast, Math.max(0, sent.current.at + 1000 - Date.now()));
  }, [broadcast]);

  const code = game?.code;
  useEffect(() => {
    if (!code) return;
    const room = subscribe(roomName(code), () => {}, (s) => {
      setRoomStatus(s);
      if (s === "live") throttled();
    });
    roomRef.current = room;
    const inbox = subscribe<PlayerMsg>(inboxName(code), (m) => {
      if (m?.t === "join") {
        setGame((g) => g && join(g, m));
        throttled(); // a refreshed phone needs the current snapshot
      } else if (m?.t === "answer") {
        setGame((g) => g && answer(g, m, Date.now()));
      }
    }, setInboxStatus);
    return () => {
      room.close();
      inbox.close();
      roomRef.current = null;
      clearTimeout(pending.current);
      pending.current = undefined;
    };
  }, [code, throttled]);

  useEffect(() => {
    if (!game) return;
    const key = `${game.code}:${game.phase}:${game.round}`;
    if (key !== sent.current.key) {
      sent.current.key = key;
      broadcast();
    } else if (game.phase === "lobby") throttled();
  }, [game, broadcast, throttled]);

  // --- Game clock ---
  useEffect(() => {
    if (game?.phase !== "question") return;
    const n = game.round;
    const finish = () => setGame((g) => (g?.phase === "question" && g.round === n ? finishRound(g) : g));
    // A short beat after the last answer keeps the inbound answer burst and the result
    // fan-out in different seconds of Supabase's per-second quota.
    const t = setTimeout(finish, allAnswered(game) ? 1000 : Math.max(0, game.endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [game]);

  const phase = game?.phase;
  const round = game?.round ?? 0;
  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(
      () =>
        setGame((g) =>
          g?.phase === "result" && g.round === round ? (isOver(g) ? end(g) : startRound(g, Date.now())) : g,
        ),
      RESULT_MS,
    );
    return () => clearTimeout(t);
  }, [phase, round]);

  // Keep the projector awake while a game is open.
  useEffect(() => {
    if (!code || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    const take = () => navigator.wakeLock.request("screen").then((l) => (lock = l), () => {});
    take();
    const onVisible = () => document.visibilityState === "visible" && take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release();
    };
  }, [code]);

  if (!ready) return null;

  const live = roomStatus === "live" && inboxStatus === "live";
  const joinUrl = game ? `${origin}/?code=${game.code}` : "";
  const status = game && (
    <span className={`${pill} ${live && !localOnly ? "bg-green-50 text-green-800" : "bg-[#FFF8E7] text-[#8A5A00]"}`} role="status">
      {localOnly ? "Local test mode: phones can't join" : live ? "Live" : roomStatus === "offline" ? "Offline" : "Connecting…"}
    </span>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <Brand right={status} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-8">
        {!game && (
          <Setup
            text={text}
            setText={setText}
            settings={settings}
            setSettings={setSettings}
            onOpen={() => setGame(newGame(randomCode(), settings, questionsOf(text)))}
          />
        )}
        {game?.phase === "lobby" && (
          <Lobby
            game={game}
            joinUrl={joinUrl}
            onKick={(id) => setGame((g) => g && kick(g, id))}
            onStart={() => setGame((g) => g && startRound(g, Date.now()))}
            onCancel={() => setGame(null)}
          />
        )}
        {(game?.phase === "question" || game?.phase === "result") && (
          <Round game={game} joinUrl={joinUrl} onEnd={() => confirm("End the game now?") && setGame((g) => g && end(g))} />
        )}
        {game?.phase === "end" && <Podium game={game} onNew={() => setGame(null)} />}
      </main>
    </div>
  );
}

function Choice<T extends number>({ label, value, options, onChange, unit = "" }: {
  label: string; value: T; options: T[]; onChange: (v: T) => void; unit?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={`min-w-12 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${focus} ${
              o === value ? "bg-[#134687] text-white" : "bg-[#F3F8FF] text-[#134687] hover:bg-[#E8F2FF]"
            }`}
          >
            {o}
            {unit}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Setup({ text, setText, settings, setSettings, onOpen }: {
  text: string; setText: (t: string) => void; settings: Settings; setSettings: (s: Settings) => void; onOpen: () => void;
}) {
  const count = questionsOf(text).length;
  return (
    <>
      <TitlePill>Host a Battle Royale</TitlePill>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <QuestionEditor text={text} onChange={setText} />
        <section className={`${card} flex flex-col gap-6 p-4 sm:p-6`}>
          <h2 className="font-poppins text-xl font-semibold">Settings</h2>
          <Choice label="Starting energy" value={settings.energy} options={[1, 3, 5, 7, 10]} onChange={(energy) => setSettings({ ...settings, energy })} />
          <Choice label="Time per question" value={settings.duration} options={[10, 20, 30]} unit="s" onChange={(duration) => setSettings({ ...settings, duration })} />
          <p className="text-sm text-[#134687]/70">
            Players duel 1v1 on the same question. Right beats wrong, faster beats slower. The loser drops one energy; at
            zero they&apos;re out. Last CSAR standing wins.
          </p>
          <button type="button" className={`${cta} mt-auto`} disabled={!count} onClick={onOpen}>
            Open lobby
          </button>
        </section>
      </div>
    </>
  );
}

function Lobby({ game, joinUrl, onKick, onStart, onCancel }: {
  game: Game; joinUrl: string; onKick: (id: string) => void; onStart: () => void; onCancel: () => void;
}) {
  const players = Object.values(game.players);
  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <section className={`${card} flex flex-col items-center gap-4 p-6 text-center`}>
        <p className="font-poppins text-lg">
          Join at <span className="font-semibold">{joinUrl.replace(/^https?:\/\//, "").replace(/\/\?.*/, "")}</span>
        </p>
        <JoinQR url={joinUrl} className="aspect-square w-full max-w-72 rounded-xl" />
        <p className="text-sm text-[#134687]/70">or enter game code</p>
        <p className="font-poppins text-6xl font-bold tracking-[0.15em] sm:text-7xl" aria-label={`Game code ${game.code.split("").join(" ")}`}>
          {game.code}
        </p>
      </section>
      <section className={`${card} flex min-w-0 flex-col gap-4 p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-poppins text-2xl font-semibold">
            <Users aria-hidden /> {players.length}
            <span className="text-base font-normal text-[#134687]/60">/ {MAX_PLAYERS} players</span>
          </h2>
          <div className="flex gap-2">
            <button type="button" className={secondary} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className={`${cta} inline-flex items-center gap-2 px-8 py-2`} disabled={players.length < 2} onClick={onStart}>
              <Play size={18} aria-hidden /> Start
            </button>
          </div>
        </div>
        {players.length === 0 ? (
          <p className="m-auto animate-pulse text-lg text-[#134687]/60">Waiting for players…</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {players.map((p) => (
              <li key={p.id} className="group relative flex animate-pop flex-col items-center gap-1 rounded-xl bg-[#F3F8FF] p-3">
                <Avatar id={p.avatar} size={64} />
                <span className="w-full truncate text-center text-sm font-semibold">{p.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => onKick(p.id)}
                  className={`absolute top-1 right-1 rounded-full bg-white p-1 text-red-700 opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100 ${focus}`}
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TimerBar({ endsAt, duration }: { endsAt: number; duration: number }) {
  const [left] = useState(() => Math.max(0, endsAt - GRACE_MS - Date.now()));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-[#E8F2FF]" role="presentation">
      <div
        className="timer-bar h-full rounded-full bg-[linear-gradient(90deg,#2F7EE3,#0349A2)]"
        style={{ "--t": `${left}ms`, width: `${(left / (duration * 1000)) * 100}%` } as React.CSSProperties}
      />
    </div>
  );
}

function Round({ game, joinUrl, onEnd }: { game: Game; joinUrl: string; onEnd: () => void }) {
  const q = game.questions[game.q];
  const reveal = game.phase === "result";
  const left = alive(game).length;
  const results = new Map(game.results.map((r) => [r.a, r]));
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`${pill} bg-[#134687] px-4 py-1.5 text-sm text-white`}>Round {game.round}</span>
        <span className="flex items-center gap-2 font-semibold">
          <Users size={18} aria-hidden /> {left} of {Object.keys(game.players).length} still in
        </span>
        <button type="button" className={danger} onClick={onEnd}>
          End game
        </button>
      </div>
      {reveal ? (
        <p className="text-center text-sm font-semibold text-[#134687]/60">Next round in a moment…</p>
      ) : (
        <TimerBar key={game.round} endsAt={game.endsAt} duration={game.settings.duration} />
      )}
      <section className={`${card} p-5 sm:p-8`}>
        <h2 className="text-center font-poppins text-2xl font-semibold sm:text-4xl">{q.text}</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {q.choices.map((c, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl p-4 text-lg font-semibold transition-opacity sm:text-2xl ${tiles[i]} ${
                reveal && i !== q.correct ? "opacity-30" : ""
              } ${reveal && i === q.correct ? "animate-pop ring-4 ring-green-500 ring-offset-2" : ""}`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/25 text-base">{letters[i]}</span>
              <span className="min-w-0 break-words">{c}</span>
              {reveal && i === q.correct && <Check className="ml-auto shrink-0" aria-label="Correct answer" />}
            </div>
          ))}
        </div>
      </section>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {game.duels.map(([a, b]) => (
          <DuelCard key={a} game={game} a={a} b={b} result={reveal ? results.get(a) : undefined} />
        ))}
      </ul>
      <div className="fixed right-4 bottom-4 hidden flex-col items-center gap-1 rounded-xl bg-white p-2 shadow-md lg:flex">
        <JoinQR url={joinUrl} className="size-24" />
        <span className="text-xs font-semibold">Rejoin · {game.code}</span>
      </div>
    </div>
  );
}

function DuelCard({ game, a, b, result }: { game: Game; a: string; b: string; result?: DuelResult }) {
  const side = (id: string) => {
    const p = game.players[id];
    const won = result?.winner === id;
    const lost = !!result?.winner && !won;
    return (
      <div className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl p-2 ${won ? "bg-green-50 ring-2 ring-green-500" : ""} ${lost ? "animate-shake" : ""}`}>
        <div className="relative">
          <Avatar id={id === BOT ? BOT : p.avatar} size={56} className={p && p.energy === 0 ? "grayscale" : ""} />
          {won && <Crown size={20} className="absolute -top-2 -right-2 fill-[#FFBC2B] text-[#CE9823]" aria-label="Winner" />}
          {!result && id !== BOT && game.answers[id] && (
            <Check size={18} className="absolute -right-1 -bottom-1 rounded-full bg-green-600 p-0.5 text-white" aria-label="Answered" />
          )}
        </div>
        <span className="w-full truncate text-center text-sm font-semibold">{id === BOT ? "CSAR Bot" : p.name}</span>
        {id === BOT ? <Energy value={-1} /> : <Energy key={`${game.round}${!!result}`} value={p.energy} lost={lost ? 1 : 0} size={14} />}
      </div>
    );
  };
  return (
    <li className={`${card} flex items-center gap-1 p-2`}>
      {side(a)}
      <span className="shrink-0 font-poppins text-sm font-bold text-[#134687]/50">{result && !result.winner ? "DRAW" : "VS"}</span>
      {side(b)}
    </li>
  );
}

function Podium({ game, onNew }: { game: Game; onNew: () => void }) {
  const ranking = rank(game);
  const top = [ranking[1], ranking[0], ranking[2]];
  const heights = ["h-28", "h-40", "h-20"];
  return (
    <div className="flex flex-col items-center gap-8">
      <TitlePill>Battle Royale Champions</TitlePill>
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {top.map((p, i) =>
          p ? (
            <div key={p.id} className="flex w-28 animate-fade-in-up flex-col items-center gap-2 sm:w-40" style={{ animationDelay: `${[300, 900, 0][i]}ms` }}>
              {i === 1 && <Crown size={36} className="fill-[#FFBC2B] text-[#CE9823]" aria-hidden />}
              <Avatar id={p.avatar} size={i === 1 ? 112 : 84} />
              <span className="w-full truncate text-center font-poppins font-semibold">{p.name}</span>
              <div className={`${heights[i]} flex w-full items-start justify-center rounded-t-2xl pt-2 font-poppins text-3xl font-bold text-white [background:linear-gradient(180deg,#2F7EE3_0%,#0349A2_100%)]`}>
                {p.place}
              </div>
            </div>
          ) : (
            <div key={i} className="w-28 sm:w-40" />
          ),
        )}
      </div>
      {ranking.length > 3 && (
        <ol className={`${card} w-full max-w-xl divide-y divide-[#005FD9]/10 p-2`}>
          {ranking.slice(3).map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-8 font-semibold">#{p.place}</span>
              <Avatar id={p.avatar} size={32} />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-sm text-[#134687]/60">{p.correct} correct</span>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className={cta} onClick={onNew}>
        New game
      </button>
    </div>
  );
}
