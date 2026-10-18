# CSS Battle Royale

A Blooket-style Battle Royale for the Computer Science Society kickoff. The projector runs `/host`; members scan the QR (or open `/` and type the code) on their phones, pick a CSAR and duel 1v1 until one is left.

**Rules:** everyone starts with the same energy (1/3/5/7/10). Each round pairs players on the same question. Right beats wrong, faster beats slower, both wrong or both out of time is a draw. The loser drops one energy; at zero you're out. Odd player out fights the CSAR Bot. Last one standing wins.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the two Supabase values
pnpm dev
```

- **Supabase:** any project works (free tier is fine, about 60 players). On Vercel, add it from *Marketplace → Supabase* and the env vars are set for you. Only Realtime Broadcast is used: no tables, no auth.
- **No keys?** The app falls back to local test mode: tabs in the same browser talk to each other, phones can't join. Good for rehearsing the question set.
- **Phones on your LAN in dev:** `pnpm dev -H 0.0.0.0` and open the host page via your LAN IP so the QR points somewhere phones can reach.

## Questions

Paste or upload on the host screen. One block per question, blank line between blocks, `*` marks the right answer:

```
What does CPU stand for?
* Central Processing Unit
Computer Personal Unit
Core Processing Unit
```

A JSON array of `{ "text", "choices", "correct" }` works too. The set is saved in the host browser; **Save** downloads it.

## How it works

The host tab is the game server: it holds all state (`src/lib/engine.ts`, pure and unit-tested) and saves it to `localStorage`, so refreshing the projector resumes the game. Supabase only relays messages:

- `br:<code>`: host → phones, one snapshot per phase change. Correct answers are only sent after the round.
- `br:<code>:host`: phones → host over REST, so players never receive each other's traffic.

Answer speed is measured on each phone (question shown → tap) so Wi-Fi lag doesn't decide duels.

## Scripts

`pnpm test` (engine rules), `pnpm lint`, `pnpm build`.
