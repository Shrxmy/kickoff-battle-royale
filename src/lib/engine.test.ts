import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOT, FINAL_INTRO_MS, INTRO_MS, MAX_PLAYERS, READ_MS, stages, alive, answer, allAnswered, end, finishRound, isOver, join, kick, leave, newGame, pair, parseQuestions, publicView, rank, resolveDuel, startRound,
  type Game,
} from "./engine.ts";

const Q = [{ text: "2+2?", choices: ["3", "4", "5", "6"], correct: 1 }];
const seq = (...xs: number[]) => () => xs.length > 1 ? xs.shift()! : xs[0];

function lobby(n: number, energy = 1): Game {
  let g = newGame("123456", { energy, duration: 20, shuffleAnswers: false }, Q);
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

test("pairing is fair: the bot rotates and nobody faces the same opponent twice in a row", () => {
  for (let trial = 0; trial < 200; trial++) {
    // 5 players with plenty of energy and all-draw rounds, so the field stays the same.
    let g = lobby(5, 10);
    let prev: string[] = [];
    for (let r = 0; r < 10; r++) {
      g = startRound(g, -(FINAL_INTRO_MS + READ_MS));
      const humans = g.duels.filter(([, b]) => b !== BOT).map((d) => [...d].sort().join());
      assert.ok(humans.every((d) => !prev.includes(d)), "no back-to-back rematch");
      prev = humans;
      const bots = Object.values(g.players).map((p) => p.bots ?? 0);
      assert.ok(Math.max(...bots) - Math.min(...bots) <= 1, "bot duels stay spread evenly");
      g = { ...g, phase: "result" };
    }
  }
  // Three left: c is owed the bot, but giving it to c would force an a-b rematch.
  for (let i = 0; i < 50; i++) {
    const d = pair(["a", "b", "c"], Math.random, { a: "b", b: "a" }, { a: 1, b: 1, c: 0 });
    assert.ok(!d.some(([x, y]) => [x, y].sort().join() === "a,b"), "endgame dodges the rematch");
  }
  // Two players left can only face each other.
  assert.deepEqual(pair(["a", "b"], Math.random, { a: "b", b: "a" }).flat().sort(), ["a", "b"]);
});

test("three left: one duel and a rotating sit-out, so the game always ends in a 1v1 final", () => {
  for (let trial = 0; trial < 200; trial++) {
    let g = lobby(3, 1);
    let sawFinal = false;
    while (!isOver(g) && g.round < 300) {
      g = startRound(g, -(FINAL_INTRO_MS + READ_MS));
      if (alive(g).length === 3) {
        assert.equal(g.duels.length, 1);
        assert.ok(!g.duels[0].includes(BOT), "no bot with three left");
      }
      if (alive(g).length === 2) sawFinal = true;
      for (const id of g.duels.flat()) if (id !== BOT) g = answer(g, { id, n: g.round, choice: Math.floor(Math.random() * 4), ms: Math.random() * 20000 }, 0);
      g = finishRound(g, Math.random);
    }
    assert.ok(sawFinal, "reached a two-player final");
    assert.deepEqual(rank(end(g)).map((p) => p.place), [1, 2, 3], "no shared places from a double knockout");
  }
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
  g = startRound(lobby(2), -(FINAL_INTRO_MS + READ_MS));
  assert.equal(join(g, { id: "late", name: "Late", avatar: "A" }), g);
  assert.equal(answer(g, null as never, 0), g, "malformed answer");
  assert.equal(answer(g, { id: "p0", n: g.round, choice: 1, ms: 5 }, g.endsAt + 1), g, "after the grace deadline");
  assert.equal(answer(g, { id: "p0", n: g.round, choice: 1, ms: 5 }, -1), g, "during the VS intro");
  assert.ok(answer(g, { id: "p0", n: g.round, choice: 1, ms: 5 }, 0).answers.p0, "right after the intro");
  const own = join(lobby(1), { id: "constructor", name: "Con", avatar: "A" });
  assert.equal(own.players["constructor"].energy, 1, "inherited keys are not treated as existing players");
  const kicked = kick(lobby(2), "p0");
  assert.equal(join(kicked, { id: "p0", name: "P0", avatar: "A" }), kicked, "kicked phones can't rejoin");
});

test("answers are validated and clamped", () => {
  const g = startRound(lobby(2), -(FINAL_INTRO_MS + READ_MS));
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
  let g = startRound(lobby(2, 1), -(FINAL_INTRO_MS + READ_MS));
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
      g = startRound(g, -(FINAL_INTRO_MS + READ_MS));
      for (const id of g.duels.flat()) {
        if (id !== BOT && Math.random() < 0.8) g = answer(g, { id, n: g.round, choice: Math.floor(Math.random() * 4), ms: Math.random() * 20000 }, 0);
      }
      g = finishRound(g);
      if (g.round > 500) break;
    }
    const left = Object.values(g.players).filter((p) => p.energy > 0);
    assert.ok(left.length >= 1, "at least one survivor");
  }
  let g = startRound(lobby(4, 1), -(FINAL_INTRO_MS + READ_MS), seq(0.5));
  // p? vs p? twice; everyone answers wrong -> all draws.
  for (const id of g.duels.flat()) g = answer(g, { id, n: 1, choice: 0, ms: 1 }, 0);
  g = finishRound(g);
  assert.ok(Object.values(g.players).every((p) => p.energy === 1));
  // Two winners, two losers -> both losers share 3rd.
  g = startRound(g, -(FINAL_INTRO_MS + READ_MS));
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

test("removing players: lobby kicks ban, leaves don't, mid-game removal knocks out and unranks", () => {
  let g = lobby(3);
  assert.equal(kick(g, "nobody"), g, "unknown id");
  g = leave(g, "p2");
  assert.ok(!g.players.p2);
  assert.ok(join(g, { id: "p2", name: "P2", avatar: "A" }).players.p2, "a phone that left can come back");
  assert.deepEqual(publicView(kick(g, "p1"), 0).out, ["p1"], "phones learn they were removed");

  g = startRound(lobby(4, 3), -(FINAL_INTRO_MS + READ_MS), seq(0.5));
  const [a, b] = g.duels[0];
  g = kick(g, a);
  assert.equal(g.players[a].energy, 0);
  assert.equal(kick(g, a), g, "removing twice is a no-op");
  assert.equal(answer(g, { id: a, n: g.round, choice: 1, ms: 1 }, 0), g, "removed players can't answer");
  for (const id of g.duels.flat()) if (id !== a) g = answer(g, { id, n: g.round, choice: 1, ms: 1 }, 0);
  assert.equal(allAnswered(g), true, "the round doesn't wait for a removed player");
  g = finishRound(g);
  assert.equal(g.players[a].place, undefined, "no place for the removed player");
  assert.equal(g.players[b].energy, 3, "their opponent wins the duel");
  assert.equal(leave(g, a), g, "a removed player leaving changes nothing");
  g = leave(g, "p0" === a ? "p1" : "p0");
  g = end(g);
  assert.ok(rank(g).every((p) => !g.kicked!.includes(p.id)), "removed players are off the ranking");
  assert.deepEqual(rank(g).map((p) => p.place), [1, 2]);
});

test("a removed player's answer no longer decides the duel", () => {
  let g = startRound(lobby(2, 3), -(FINAL_INTRO_MS + READ_MS));
  const [a, b] = g.duels[0];
  g = answer(g, { id: a, n: 1, choice: 1, ms: 1 }, 0);
  g = answer(g, { id: b, n: 1, choice: 1, ms: 900 }, 0);
  g = finishRound(kick(g, a));
  assert.equal(g.results[0].winner, b);
  assert.equal(g.players[b].energy, 3);
});

test("removals keep places gap-free; the host can remove knocked-out players, Leave can't", () => {
  // 5 players, 1 energy: two duels knock out two players (shared 4th), p? sits with the bot.
  let g = startRound(lobby(5, 1), -(FINAL_INTRO_MS + READ_MS), seq(0.5));
  for (const [x, y] of g.duels) {
    if (y === BOT) continue;
    g = answer(g, { id: x, n: 1, choice: 1, ms: 1 }, 0);
    g = answer(g, { id: y, n: 1, choice: 0, ms: 1 }, 0);
  }
  g = finishRound(g, seq(0.99)); // bot answers wrong
  const outs = Object.values(g.players).filter((p) => p.energy === 0);
  assert.deepEqual(outs.map((p) => p.place), [4, 4]);
  assert.equal(leave(g, outs[0].id), g, "a knocked-out phone leaving keeps its place");

  const survivor = alive(g)[0].id;
  g = kick(g, survivor);
  assert.deepEqual(Object.values(g.players).filter((p) => p.place).map((p) => p.place), [3, 3], "everyone behind moves up");
  g = kick(g, outs[0].id);
  assert.ok(g.kicked!.includes(outs[0].id), "the host can still remove a knocked-out player");
  g = end(g);
  assert.deepEqual(rank(g).map((p) => p.place), [1, 2, 3]);
});

test("questions are shuffled with no repeats until the deck runs out, never back-to-back", () => {
  const qs = [0, 1, 2, 3].map((i) => ({ ...Q[0], text: `Q${i}` }));
  for (let trial = 0; trial < 200; trial++) {
    let g: Game = { ...lobby(2, 10), questions: qs };
    const seen: number[] = [];
    for (let r = 0; r < 12; r++) {
      g = startRound(g, -(FINAL_INTRO_MS + READ_MS));
      seen.push(g.q);
      g = { ...g, phase: "result" };
    }
    for (let d = 0; d < 12; d += 4) assert.deepEqual(seen.slice(d, d + 4).sort(), [0, 1, 2, 3], "each pass uses every question once");
    assert.ok(seen.every((q, i) => i === 0 || q !== seen[i - 1]), "no question twice in a row");
  }
});

test("shuffle settings: answers move but the right answer follows; in-order mode keeps order; finals get a longer intro", () => {
  const four = [{ text: "Q", choices: ["w", "x", "right", "z"], correct: 2 }];
  const orders = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const g = startRound({ ...lobby(4), questions: four, settings: { energy: 1, duration: 20 } }, -(FINAL_INTRO_MS + READ_MS));
    const q = g.questions[g.q];
    assert.equal(q.choices[q.correct], "right");
    assert.deepEqual([...q.choices].sort(), ["right", "w", "x", "z"]);
    orders.add(q.choices.join());
  }
  assert.ok(orders.size > 1, "answer order changes");
  const qs = [0, 1, 2, 3].map((i) => ({ ...Q[0], text: `Q${i}` }));
  let g: Game = { ...lobby(4, 10), questions: qs, settings: { energy: 10, duration: 20, shuffleQuestions: false, shuffleAnswers: false } };
  const seen: number[] = [];
  for (let r = 0; r < 6; r++) {
    g = startRound(g, 0);
    seen.push(g.q);
    g = { ...g, phase: "result" };
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 0, 1], "in order, then around again");
  const final = startRound(lobby(2), 0);
  assert.equal(final.endsAt, FINAL_INTRO_MS + READ_MS + 20000 + 1500, "two left: standoff intro");
  assert.equal(startRound({ ...final, phase: "result" }, 0).endsAt, INTRO_MS + READ_MS + 20000 + 1500, "later final rounds: normal intro");
  assert.deepEqual(stages(INTRO_MS + READ_MS), { splash: INTRO_MS, read: READ_MS }, "fresh round: splash then reading");
  assert.deepEqual(stages(3000), { splash: 0, read: 3000 }, "joined mid-read: no splash, the rest of the reading time");
  assert.deepEqual(stages(-5), { splash: 0, read: 0 }, "joined after answering opened");
  assert.equal((publicView(final, 2500) as { final: boolean }).final, true, "phones are told it's the final, even joining mid-intro");
  assert.equal((publicView(startRound({ ...final, phase: "result" }, 0), 0) as { final: boolean }).final, false);
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
  assert.equal((view as { left: number }).left, 20000 + INTRO_MS + READ_MS, "left includes the intro and reading time");
});
