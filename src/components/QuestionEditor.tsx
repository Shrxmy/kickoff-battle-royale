"use client";

import { useMemo, useRef } from "react";
import { Download, Upload } from "lucide-react";
import { parseQuestions, type Question } from "@/lib/engine";
import { card, input, letters, secondary } from "./ui";

export const SAMPLE = `What does CPU stand for?
* Central Processing Unit
Computer Personal Unit
Central Program Utility
Core Processing Unit

Which data structure is First-In, First-Out?
Stack
* Queue
Tree
Graph

What is 1010 in binary as a decimal number?
8
12
* 10
5

Which language runs natively in web browsers?
Python
* JavaScript
C++
Java

What does HTML stand for?
* HyperText Markup Language
High Tech Modern Language
Hyperlink Text Machine Language
Home Tool Markup Language

Big-O of binary search on a sorted array?
O(n)
O(n log n)
* O(log n)
O(1)

Who is known as the first computer programmer?
Alan Turing
* Ada Lovelace
Grace Hopper
Charles Babbage

Which of these is NOT a programming paradigm?
Functional
Object-oriented
* Hypertextual
Procedural`;

// Text-first editor: hosts paste from a doc, preview shows exactly what phones will get.
export function QuestionEditor({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const parsed = useMemo((): { questions: Question[]; error?: string } => {
    try {
      return { questions: text.trim() ? parseQuestions(text) : [] };
    } catch (e) {
      return { questions: [], error: e instanceof Error ? e.message : "Couldn't read these questions" };
    }
  }, [text]);

  async function upload(f: File | undefined) {
    if (f) onChange(await f.text());
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    Object.assign(document.createElement("a"), { href: url, download: "battle-royale-questions.txt" }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={`${card} flex min-w-0 flex-col gap-4 p-4 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-poppins text-xl font-semibold">Questions</h2>
        <div className="flex gap-2">
          <button type="button" className={`${secondary} inline-flex items-center gap-1`} onClick={() => file.current?.click()}>
            <Upload size={16} aria-hidden /> Upload
          </button>
          <button type="button" className={`${secondary} inline-flex items-center gap-1`} onClick={download} disabled={!text.trim()}>
            <Download size={16} aria-hidden /> Save
          </button>
          <input ref={file} type="file" accept=".txt,.json,text/plain,application/json" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </div>
      <p className="text-sm text-[#134687]/70">
        One question per block, blank line between blocks. First line is the question, then 2–4 answers. Start the
        right answer with <code className="rounded bg-[#E8F2FF] px-1 font-semibold">*</code>. JSON arrays of{" "}
        <code className="rounded bg-[#E8F2FF] px-1">{"{text, choices, correct}"}</code> work too.
      </p>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="sr-only">Question set</span>
          <textarea
            className={`${input} h-80 resize-y font-mono text-sm leading-relaxed`}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            aria-invalid={!!parsed.error}
            aria-describedby="qs-status"
          />
        </label>
        <div className="flex h-80 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl bg-[#F3F8FF] p-3">
          <p id="qs-status" role="status" className={`text-sm font-semibold ${parsed.error ? "text-red-700" : ""}`}>
            {parsed.error ?? `${parsed.questions.length} question${parsed.questions.length === 1 ? "" : "s"} ready`}
          </p>
          {parsed.questions.map((q, i) => (
            <div key={i} className="rounded-lg bg-white p-3 text-sm">
              <p className="font-semibold">
                {i + 1}. {q.text}
              </p>
              <ul className="mt-1 grid gap-0.5">
                {q.choices.map((c, j) => (
                  <li key={j} className={j === q.correct ? "font-semibold text-green-800" : "text-[#134687]/70"}>
                    {letters[j]}. {c} {j === q.correct && "✓"}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function questionsOf(text: string): Question[] {
  try {
    return parseQuestions(text);
  } catch {
    return [];
  }
}
