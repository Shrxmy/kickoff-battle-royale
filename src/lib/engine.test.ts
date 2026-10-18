import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOT, MAX_PLAYERS, answer, allAnswered, end, finishRound, isOver, join, kick, newGame, pair, parseQuestions, publicView, rank, resolveDuel, startRound,
  type Game,
} from "./engine.ts";

const Q = [{ text: "2+2?", choices: ["3", "4", "5", "6"], correct: 1 }];
const seq = (...xs: number[]) => () => xs.length > 1 ? xs.shift()! : xs[0];

function lobby(n: number, energy = 1): Game {
  let g = newGame("123456", { energy, duration: 20 }, Q);
  for (let i = 0; i < n; i++) g = join(g, { id: `p${i}`, name: `P${i}`, avatar: "TECHDEV" });
  return g;
}

test("duel rules", () => {
  assert.equal(resolveDuel({ choice: 1, ms: 900 }, { choice: 0, ms: 100 }, 1), 0, "only a correct");
  assert.equal(resolveDuel(undefined, { choice: 1, ms: 5000 }, 1), 1, "a timed out, b correct");
  assert.equal(resolveDuel({ choice: 1, ms: 900 }, { choice: 1, ms: 400 }, 1), 1, "both correct: faster wins");
  assert.equal(resolveDuel({ choice: 1, ms: 400 }, { choice: 1, ms: 400 }, 1), null, "exact tie draws");
  assert.equal(resolveDuel({ choice: 0, ms: 1 }, { choice: 2, ms: 1 }, 1), null, "both wrong draws");
  assert.equal(resolveDuel(undefined, undefined, 1), null, "both timed out draws");
});

test("pairing gives the odd player the bot", () => {
  const duels = pair(["a", "b", "c"]);
  assert.equal(duels.length, 2);
  assert.deepEqual(duels.flat().sort(), ["a", "b", "bot", "c"]);
  assert.equal(duels.flat().filter((id) => id === BOT).length, 1);
});

test("join is lobby-only, trims names, caps players", () => {
  let g = lobby(MAX_PLAYERS);
  assert.equal(Object.keys(join(g, { id: "x", name: "X", avatar: "A" }).players).length, MAX_PLAYERS);
  g = lobby(1);
  assert.equal(join(g, { id: "y", name: "   ", avatar: "A" }), g, "blank name ignored");
  assert.equal(join(g, { id: "z", name: "a".repeat(40), avatar: "A" }).players.z.name.length, 16);
  for (const bad of [null, {}, { id: 1, name: "x", avatar: "A" }, { id: "q", name: 5, avatar: "A" }, { id: "q", name: "x" }]) {
    assert.equal(join(g, bad as never), g, `malformed join ${JSON.stringify(bad)}`);
  }
  g = startRound(lobby(2), 0);
  assert.equal(join(g, { id: "late", name: "Late", avatar: "A" }), g);
  assert.equal(answer(g, null as never, 0), g, "malformed answer");
  assert.equal(answer(g, { id: "p0", n: g.round, choice: 1, ms: 5 }, g.endsAt + 1), g, "after the grace deadline");
  const own = join(lobby(1), { id: "constructor", name: "Con", avatar: "A" });
  assert.equal(own.players["constructor"].energy, 1, "inherited keys are not treated as existing players");
  const kicked = kick(lobby(2), "p0");
  assert.equal(join(kicked, { id: "p0", name: "P0", avatar: "A" }), kicked, "kicked phones can't rejoin");
});

test("answers are validated and clamped", () => {
  const g = startRound(lobby(2), 0);
  assert.equal(answer(g, { id: "p0", n: g.round + 1, choice: 1, ms: 5 }, 0), g, "wrong round");
  assert.equal(answer(g, { id: "ghost", n: g.round, choice: 1, ms: 5 }, 0), g, "not in a duel");
  assert.equal(answer(g, { id: "p0", n: g.round, choice: 9, ms: 5 }, 0), g, "choice out of range");
  const g2 = answer(g, { id: "p0", n: g.round, choice: 1, ms: 999999 }, 0);
  assert.equal(g2.answers.p0.ms, 20000);
  assert.equal(answer(g2, { id: "p0", n: g.round, choice: 0, ms: 1 }, 0), g2, "first answer sticks");
  assert.equal(allAnswered(g2), false);
  assert.equal(allAnswered(answer(g2, { id: "p1", n: g.round, choice: 0, ms: 1 }, 0)), true);
});

test("loser drops energy, elimination, game over, ranking", () => {
  let g = startRound(lobby(2, 1), 0);
  g = answer(g, { id: "p0", n: 1, choice: 1, ms: 800 }, 0);
  g = answer(g, { id: "p1", n: 1, choice: 1, ms: 300 }, 0);
  g = finishRound(g);
  assert.equal(g.phase, "result");
  assert.equal(g.players.p1.energy, 1);
  assert.equal(g.players.p0.energy, 0);
  assert.equal(g.players.p0.place, 2);
  assert.equal(g.results[0].winner, "p1");
  assert.equal(isOver(g), true);
  g = end(g);
  assert.deepEqual(rank(g).map((p) => [p.id, p.place]), [["p1", 1], ["p0", 2]]);
});

test("draws cost nothing; same-round knockouts share a place; someone always survives", () => {
  for (let trial = 0; trial < 200; trial++) {
    let g = lobby(5, 1);
    while (!isOver(g)) {
      g = startRound(g, 0);
      for (const id of g.duels.flat()) {
        if (id !== BOT && Math.random() < 0.8) g = answer(g, { id, n: g.round, choice: Math.floor(Math.random() * 4), ms: Math.random() * 20000 }, 0);
      }
      g = finishRound(g);
      if (g.round > 500) break;
    }
    const left = Object.values(g.players).filter((p) => p.energy > 0);
    assert.ok(left.length >= 1, "at least one survivor");
  }
  let g = startRound(lobby(4, 1), 0, seq(0.5));
  // p? vs p? twice; everyone answers wrong -> all draws.
  for (const id of g.duels.flat()) g = answer(g, { id, n: 1, choice: 0, ms: 1 }, 0);
  g = finishRound(g);
  assert.ok(Object.values(g.players).every((p) => p.energy === 1));
  // Two winners, two losers -> both losers share 3rd.
  g = startRound(g, 0);
  for (const [a, b] of g.duels) {
    g = answer(g, { id: a, n: g.round, choice: 1, ms: 1 }, 0);
    g = answer(g, { id: b, n: g.round, choice: 0, ms: 1 }, 0);
  }
  g = finishRound(g);
  const places = Object.values(g.players).filter((p) => p.energy === 0).map((p) => p.place);
  assert.deepEqual(places, [3, 3]);
  g = end(g);
  assert.deepEqual(Object.values(g.players).map((p) => p.place).sort(), [1, 2, 3, 3], "end() keeps shared places");
});

test("parses pasted text and JSON question sets", () => {
  const qs = parseQuestions("What is 2+2?\n3\n* 4\n5\n\r\nCPU means?\r\n*Central Processing Unit\r\nComputer Power Unit");
  assert.deepEqual(qs, [
    { text: "What is 2+2?", choices: ["3", "4", "5"], correct: 1 },
    { text: "CPU means?", choices: ["Central Processing Unit", "Computer Power Unit"], correct: 0 },
  ]);
  assert.deepEqual(parseQuestions(JSON.stringify(Q)), Q);
  assert.throws(() => parseQuestions("Q?\n*a\n*b"), /exactly one correct/);
  assert.throws(() => parseQuestions("Q?\n*a"), /2-4/);
  assert.throws(() => parseQuestions('[{"text":"x","choices":["a","b"],"correct":5}]'), /correct/);
  assert.throws(() => parseQuestions("[oops"));
});

test("phones never see the correct answer during a question", () => {
  const g = startRound(lobby(3), 1000);
  const view = publicView(g, 1000);
  assert.equal(view.t, "round");
  assert.ok(!("correct" in view) && !("correct" in (view as { q: object }).q));
  assert.equal((view as { left: number }).left, 20000);
});
