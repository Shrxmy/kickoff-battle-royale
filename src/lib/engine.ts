// Pure Battle Royale rules. The host tab owns a Game and feeds it player messages;
// nothing here touches the network or the clock, so it runs under `node --test` as-is.

export const BOT = "bot";
export const MAX_PLAYERS = 60;
export const GRACE_MS = 1500; // REST answers from phones need a moment to arrive

export type Question = { text: string; choices: string[]; correct: number };
export type Settings = { energy: number; duration: number }; // duration in seconds
export type Player = {
  id: string;
  name: string;
  avatar: string;
  energy: number;
  correct: number;
  answered: number;
  totalMs: number;
  place?: number; // set when eliminated or when the game ends
};
export type Answer = { choice: number; ms: number };
export type Duel = [string, string];
export type DuelResult = { a: string; b: string; winner: string | null; aChoice: number | null; bChoice: number | null };
export type Phase = "lobby" | "question" | "result" | "end";

export type Game = {
  code: string;
  settings: Settings;
  questions: Question[];
  phase: Phase;
  players: Record<string, Player>;
  deck: number[];
  round: number;
  q: number;
  duels: Duel[];
  answers: Record<string, Answer>;
  endsAt: number;
  results: DuelResult[];
  kicked?: string[]; // removed by the host or left mid-game: can't rejoin, left off the ranking
};

type Rand = () => number;

// Messages the host broadcasts. `players` maps id -> [name, avatar, energy]; `out` lists removed phones.
export type PlayerMap = Record<string, [string, string, number]>;
export type HostMsg = (
  | { t: "lobby"; players: [string, string, string][] }
  | { t: "round"; n: number; q: { text: string; choices: string[] }; duration: number; left: number; duels: Duel[]; players: PlayerMap }
  | { t: "result"; n: number; q: { text: string; choices: string[] }; correct: number; results: DuelResult[]; players: PlayerMap }
  | { t: "end"; ranking: { id: string; name: string; avatar: string; energy: number; place: number; correct: number }[] }
) & { out: string[] };
export type PlayerMsg =
  | { t: "join"; id: string; name: string; avatar: string }
  | { t: "answer"; id: string; n: number; choice: number; ms: number }
  | { t: "leave"; id: string };

// Throws a readable error for anything a phone couldn't play.
export function checkQuestion(raw: unknown): Question {
  const q = raw as Partial<Question>;
  const text = typeof q?.text === "string" ? q.text.trim() : "";
  const choices = Array.isArray(q?.choices) ? q.choices.map((c) => String(c).trim()) : [];
  if (!text || choices.length < 2 || choices.length > 4 || choices.some((c) => !c)) {
    throw new Error(`"${text || "(blank question)"}" needs 2-4 non-empty answers`);
  }
  if (!Number.isInteger(q.correct) || q.correct! < 0 || q.correct! >= choices.length) {
    throw new Error(`"${text}" needs exactly one correct answer`);
  }
  return { text, choices, correct: q.correct! };
}

// Accepts a JSON array of {text, choices, correct}, or plain text blocks separated by a
// blank line: first line is the question, then one answer per line, the right one starting with *.
export function parseQuestions(input: string): Question[] {
  const t = input.trim();
  if (t.startsWith("[")) {
    const arr: unknown = JSON.parse(t);
    if (!Array.isArray(arr)) throw new Error("Expected a JSON array of questions");
    return arr.map(checkQuestion);
  }
  return t.split(/\r?\n\s*\r?\n/).map((block) => {
    const [text, ...lines] = block.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const stars = lines.filter((l) => l.startsWith("*")).length;
    return checkQuestion({
      text,
      choices: lines.map((l) => l.replace(/^\*\s*/, "")),
      correct: stars === 1 ? lines.findIndex((l) => l.startsWith("*")) : -1,
    });
  });
}

export function shuffle<T>(items: T[], rand: Rand = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(code: string, settings: Settings, questions: Question[]): Game {
  return { code, settings, questions, phase: "lobby", players: {}, deck: [], round: 0, q: 0, duels: [], answers: {}, endsAt: 0, results: [], kicked: [] };
}

export function join(g: Game, p: { id: string; name: string; avatar: string }): Game {
  // Payloads come from anyone holding the room code, so check shapes before touching them.
  if (typeof p?.id !== "string" || typeof p.name !== "string" || typeof p.avatar !== "string" || p.id.length > 64) return g;
  const name = p.name.trim().slice(0, 16);
  if (g.phase !== "lobby" || !p.id || !name || p.id === BOT || g.kicked?.includes(p.id)) return g;
  const prev = Object.hasOwn(g.players, p.id) ? g.players[p.id] : undefined;
  if (!prev && Object.keys(g.players).length >= MAX_PLAYERS) return g;
  const player: Player = prev
    ? { ...prev, name, avatar: p.avatar.slice(0, 16) }
    : { id: p.id, name, avatar: p.avatar.slice(0, 16), energy: g.settings.energy, correct: 0, answered: 0, totalMs: 0 };
  return { ...g, players: { ...g.players, [p.id]: player } };
}

const isOut = (g: Game, id: string) => !!g.kicked?.includes(id);

function drop(g: Game, id: string): Game {
  const players = { ...g.players };
  delete players[id];
  return { ...g, players };
}

// Lobby: gone, and the phone can't rejoin. Mid-game: out on the spot, their answer is void
// (the duel plays on without them), and they're left off the ranking.
export function kick(g: Game, id: string): Game {
  if (typeof id !== "string" || !Object.hasOwn(g.players, id) || isOut(g, id) || g.phase === "end") return g;
  const kicked = [...(g.kicked ?? []), id];
  if (g.phase === "lobby") return { ...drop(g, id), kicked };
  const gone = g.players[id];
  const players: Record<string, Player> = {};
  // Everyone placed behind them moves up one, so places stay gap-free (ties stay tied).
  for (const p of Object.values(g.players)) {
    players[p.id] = p.place !== undefined && p.place > (gone.place ?? 0) ? { ...p, place: p.place - 1 } : p;
  }
  players[id] = { ...gone, energy: 0, place: undefined };
  const answers = { ...g.answers };
  delete answers[id];
  return { ...g, players, answers, kicked };
}

// A phone tapping Leave: free to come back while in the lobby, removed once the game is on,
// but a phone already knocked out keeps the place it earned.
export function leave(g: Game, id: string): Game {
  if (typeof id !== "string" || !Object.hasOwn(g.players, id)) return g;
  if (g.phase === "lobby") return drop(g, id);
  return g.players[id].energy > 0 ? kick(g, id) : g;
}

export const alive = (g: Game) => Object.values(g.players).filter((p) => p.energy > 0);
export const isOver = (g: Game) => g.phase !== "lobby" && alive(g).length <= 1;

export function pair(ids: string[], rand: Rand = Math.random): Duel[] {
  const s = shuffle(ids, rand);
  const duels: Duel[] = [];
  for (let i = 0; i < s.length; i += 2) duels.push([s[i], s[i + 1] ?? BOT]);
  return duels;
}

export function startRound(g: Game, now: number, rand: Rand = Math.random): Game {
  const deck = g.deck.length ? g.deck : shuffle(g.questions.map((_, i) => i), rand);
  return {
    ...g,
    phase: "question",
    round: g.round + 1,
    q: deck[0],
    deck: deck.slice(1),
    duels: pair(alive(g).map((p) => p.id), rand),
    answers: {},
    results: [],
    endsAt: now + g.settings.duration * 1000 + GRACE_MS,
  };
}

const inDuel = (g: Game, id: string) => g.duels.some((d) => d.includes(id));

// `now` is the host clock: anything after the grace deadline is too late, even if the timer fired late.
export function answer(g: Game, a: { id: string; n: number; choice: number; ms: number }, now: number): Game {
  const q = g.questions[g.q];
  if (g.phase !== "question" || now > g.endsAt || a?.n !== g.round || typeof a.id !== "string" || a.id === BOT || isOut(g, a.id)) return g;
  if (Object.hasOwn(g.answers, a.id) || !inDuel(g, a.id)) return g;
  if (!Number.isInteger(a.choice) || a.choice < 0 || a.choice >= q.choices.length) return g;
  const ms = Math.min(Math.max(Number(a.ms) || 0, 0), g.settings.duration * 1000);
  return { ...g, answers: { ...g.answers, [a.id]: { choice: a.choice, ms } } };
}

// Removed players will never answer, so the round doesn't wait for them.
export const allAnswered = (g: Game) => g.duels.flat().every((id) => id === BOT || Object.hasOwn(g.answers, id) || isOut(g, id));

// Returns which side won: 0 (a), 1 (b) or null for a draw.
export function resolveDuel(a: Answer | undefined, b: Answer | undefined, correct: number): 0 | 1 | null {
  const aOk = a?.choice === correct;
  const bOk = b?.choice === correct;
  if (aOk && bOk) return a!.ms < b!.ms ? 0 : b!.ms < a!.ms ? 1 : null;
  return aOk ? 0 : bOk ? 1 : null;
}

export function botAnswer(q: Question, duration: number, rand: Rand = Math.random): Answer {
  const right = rand() < 0.65;
  const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.correct);
  const choice = right || !wrong.length ? q.correct : wrong[Math.floor(rand() * wrong.length)];
  return { choice, ms: Math.round(3000 + rand() * Math.max(0, duration * 700 - 3000)) };
}

export function finishRound(g: Game, rand: Rand = Math.random): Game {
  if (g.phase !== "question") return g;
  const q = g.questions[g.q];
  const answers: Record<string, Answer> = { ...g.answers, [BOT]: botAnswer(q, g.settings.duration, rand) };
  const players = { ...g.players };
  const results: DuelResult[] = [];
  const out: string[] = [];

  for (const [a, b] of g.duels) {
    const w = resolveDuel(answers[a], answers[b], q.correct);
    const winner = w === null ? null : w === 0 ? a : b;
    results.push({ a, b, winner, aChoice: answers[a]?.choice ?? null, bChoice: answers[b]?.choice ?? null });
    for (const id of [a, b]) {
      if (id === BOT) continue;
      const p = { ...players[id] };
      const ans = answers[id];
      if (ans) {
        p.answered++;
        p.totalMs += ans.ms;
        if (ans.choice === q.correct) p.correct++;
      }
      if (winner && winner !== id && p.energy > 0) {
        p.energy = Math.max(0, p.energy - 1);
        if (p.energy === 0) out.push(id);
      }
      players[id] = p;
    }
  }
  // Everyone knocked out in the same round shares the best place still open.
  const place = Object.values(players).filter((p) => p.energy > 0).length + 1;
  for (const id of out) players[id] = { ...players[id], place };
  return { ...g, phase: "result", players, results };
}

const avgMs = (p: Player) => (p.answered ? p.totalMs / p.answered : Infinity);

export function rank(g: Game): Player[] {
  return Object.values(g.players).filter((p) => !isOut(g, p.id)).sort(
    (x, y) =>
      y.energy - x.energy ||
      (x.place ?? 0) - (y.place ?? 0) ||
      y.correct - x.correct ||
      avgMs(x) - avgMs(y),
  );
}

export function end(g: Game): Game {
  const players = { ...g.players };
  // Survivors get 1..k; knocked-out players keep the (possibly shared) place they earned.
  rank(g).forEach((p, i) => (players[p.id] = { ...p, place: p.place ?? i + 1 }));
  return { ...g, phase: "end", players };
}

function playerMap(g: Game): PlayerMap {
  const m: PlayerMap = { [BOT]: ["CSAR Bot", BOT, -1] };
  for (const p of Object.values(g.players)) m[p.id] = [p.name, p.avatar, p.energy];
  return m;
}

// What phones are allowed to see. During a question the correct answer stays on the host.
export function publicView(g: Game, now: number): HostMsg {
  const q = g.questions[g.q];
  const view = q && { text: q.text, choices: q.choices };
  const out = g.kicked ?? [];
  switch (g.phase) {
    case "lobby":
      return { t: "lobby", out, players: Object.values(g.players).map((p) => [p.id, p.name, p.avatar]) };
    case "question":
      return {
        t: "round",
        out,
        n: g.round,
        q: view,
        duration: g.settings.duration,
        left: Math.max(0, g.endsAt - GRACE_MS - now),
        duels: g.duels,
        players: playerMap(g),
      };
    case "result":
      return { t: "result", out, n: g.round, q: view, correct: q.correct, results: g.results, players: playerMap(g) };
    case "end":
      return {
        t: "end",
        out,
        ranking: rank(g).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, energy: p.energy, place: p.place ?? 0, correct: p.correct })),
      };
  }
}
