"use client";

import { useMemo, useRef } from "react";
import { Download, Upload } from "lucide-react";
import { parseQuestions, type Question } from "@/lib/engine";
import { card, input, letters, secondary } from "./ui";

export const SAMPLE = `What programming symbol inspired the stylized 'C' in the CSS logo?
Parenthesis
Angle Bracket
Square Bracket
* Open Curly Brace

Which of these sounds made up but is actually listed as a suggested CSS special role?
CSS Meme Administrator
CSS Head of Vibes
* CSS Dance Troupe Captain
CSS Chief Debugging Officer

In what year was Computer Science Society established?
2011
1998
* 2008
2021

Which CS Week event is also scheduled alongside the General Assembly?
CSSprint
OlympiCSS
Kickoff
* CS Night

Who is the Auditor of Computer Science Society?
* Nikolas Josef Dalisay
Jysrael Jan Coleen Bacinillo
Matthew Benedict Aquino
Delph Xander Mogro

What year did the College of Science Introduce the BS Mathematics major in Computer Science Program?
1989
* 1984
2014
1611

What is CSS' Motto?
It's Always Day One at CSS
* Say Yes To CSS
Once CSS, Always CSS
Think CSS

Who is the patron saint of CICS?
St. Thomas Aquinas
* St. Vincent Ferrer
St. Thomas More
St. Dominic de Guzman

What is the middle name of the President of CSS?
* Tumabing
Gumban
Gordon
Buizon

Who are the iconic duo-advisers of CSS for this Academic Year 2026-2027?
* Asst. Prof. Cherry Rose R. Estabillo and Asst. Prof. Charmaine S. Ponay
Asst. Prof. Jonathan B. Cabero and Prof. Donata D. Acula
Prof. Donata D. Acula and Asst. Prof. Charmaine S. Ponay
Asst. Prof. Darlene D. Alberto and Asst. Prof. Cecil Jose A. Delfinado

What was UST originally called? (Final boss spelling check!)
Colegio de San Ignacio
* Colegio de Nuestra Señora del Santísimo Rosario
Real Colegio de Manila
Universidad de Santo Rosario

Before finding its home in computing, which college originally housed the Computer Science program?
Faculty of Engineering
* College of Science
College of Education
College of Commerce and Business Administration

What does the sky-blue color of the CSS logo represent?
The color of our favorite IDE (VS Code)
The UST swimming pool
* Open-mindedness and imagination
The number of pending tasks

Who is the Internal Vice President of CSS this A.Y.?
* Marian Therese Pineza
Nigel Roland Anunciacion
Cc Hermoso
Cedrick James Eusebio

Which of these is the CORRECT year-level representative lineup, from 1st to 4th year?
* Zander → Alex → Cyprus → Matthew
Alex → Zander → Matthew → Cyprus
Zander → Cyprus → Alex → Matthew
Matthew → Cyprus → Alex → Zander

Which officer serves as the CSS Chief of Staff?
Marian Therese Pineza
Lorraine Alexandra Tamondong
* Alea Grasha Masiglat
Cc Hermoso

Who is the Thomasian Wellness Advocate?
Andrea Pauline Tan
Alea Grasha Masiglat
Lorraine Alexandra Tamondong
* Khristine Caryl Mirasol

How old is Computer Science Society?
15
* 18
20
67

What is the name of the CSS mascot?
* CSar
Ceecee
Daniel
Ceasar

What sequence surrounds the CSS logo to symbolize the Computer Science community?
A series of hashtags
* Ones and zeroes
The Fibonacci sequence
The alphabet`;

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
