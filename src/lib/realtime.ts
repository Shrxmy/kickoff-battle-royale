import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Two channels per game keep the free tier's per-delivery message quota low:
// the room is host -> everyone, the inbox is everyone -> host only.
export const roomName = (code: string) => `br:${code}`;
export const inboxName = (code: string) => `br:${code}:host`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Without Supabase keys, tabs of one browser talk over BroadcastChannel: handy for rehearsing locally.
export const localOnly = !url || !key;

let client: Promise<SupabaseClient> | undefined;

// Loaded on demand so the landing page stays tiny.
function supabase() {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, key!, { auth: { persistSession: false } }),
  );
  return client;
}

export type Status = "connecting" | "live" | "offline";

// Listens on a channel; `send` broadcasts over the open socket.
export function subscribe<T>(name: string, onMessage: (msg: T) => void, onStatus: (s: Status) => void) {
  if (localOnly) {
    const bc = new BroadcastChannel(name);
    bc.onmessage = (e) => onMessage(e.data as T);
    setTimeout(() => onStatus("live"));
    return { send: (msg: unknown) => bc.postMessage(msg), close: () => bc.close() };
  }

  let channel: RealtimeChannel | undefined;
  let closed = false;
  onStatus("connecting");
  supabase().then(
    (sb) => {
      if (closed) return;
      channel = sb
        .channel(name, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "m" }, ({ payload }) => onMessage(payload as T))
        .subscribe((s) => onStatus(s === "SUBSCRIBED" ? "live" : s === "CLOSED" ? "offline" : "connecting"));
    },
    (e) => {
      console.error(e);
      onStatus("offline");
    },
  );
  return {
    send: (msg: unknown) => channel?.send({ type: "broadcast", event: "m", payload: msg }),
    close: () => {
      closed = true;
      if (channel) supabase().then((sb) => sb.removeChannel(channel!));
    },
  };
}

// Fire-and-forget over REST, without joining the channel (so we never receive its traffic).
export async function post(name: string, msg: unknown) {
  if (localOnly) {
    const bc = new BroadcastChannel(name);
    bc.postMessage(msg);
    bc.close();
    return true;
  }
  const sb = await supabase();
  const res = await sb.channel(name).httpSend("m", msg);
  return res.success;
}
