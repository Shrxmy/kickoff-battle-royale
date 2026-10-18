// Class tokens in the style of css-apply's src/components/admin/ui.ts.
export const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] focus-visible:ring-offset-2";
export const button = `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
export const primary = `${button} bg-[#134687] px-4 py-2 text-white hover:bg-[#0F376B]`;
export const secondary = `${button} border border-[#005FD9]/20 bg-white text-[#134687] hover:bg-[#F3F8FF]`;
export const danger = `${button} border border-red-200 bg-white text-red-700 hover:bg-red-50`;
export const input = `w-full min-w-0 rounded-lg border-2 border-[#CDCECF] bg-white px-4 py-3 text-base text-[#134687] placeholder:text-[#134687]/40 focus:border-[#044FAF] ${focus}`;
export const card = "rounded-[20px] bg-white shadow-[0_4px_4px_0_rgba(0,0,0,0.31)]";
export const panel = "rounded-xl bg-[#F3F8FF]";
export const pill = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold";
export const titlePill =
  "w-fit max-w-full rounded-[45px] px-6 py-2 text-center font-poppins text-lg font-medium text-white [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] lg:px-12 lg:py-4 lg:text-4xl";
// The glossy hero CTA from css-apply's landing page.
export const cta = `rounded-full bg-[#0077FF] px-10 py-3 font-semibold text-white shadow-[inset_0_4px_15px_rgba(255,255,255,0.8)] transition-all duration-200 hover:scale-105 hover:bg-[#0056CC] active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${focus}`;

// Answer tiles: distinct fills plus a letter so color is never the only cue.
export const tiles = [
  "bg-[#2F7EE3] text-white",
  "bg-[#134687] text-white",
  "bg-[#FFBC2B] text-[#134687]",
  "bg-[#0E2A4D] text-white",
];
export const letters = ["A", "B", "C", "D"];
