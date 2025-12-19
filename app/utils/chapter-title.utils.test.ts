import { cleanChapterTitle } from "./chapter-title.utils";

function eq(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function run() {
  const cases: Array<{ input: any; expect: any; note?: string }> = [
    { input: "Chap 12 END", expect: { mode: "pill", label: "Chap 12" }, note: "clean to Chap 12" },
    { input: "Chapter 99!!!", expect: { mode: "text", labelStartsWith: "Chapter 99" }, note: "text mode (len>=13)" },
    { input: "  7  ", expect: { mode: "pill", label: "7" }, note: "single digit" },
    { input: "Ch.123abc", expect: { mode: "pill", label: "Ch.123" }, note: "clean to Ch.123" },
    { input: "Vol 1 Extra", expect: { mode: "pill", label: "Vol 1" }, note: "clean to Vol 1" },
    { input: "OnlyWords", expect: { mode: "pill", label: "OnlyWords" }, note: "no digits, keep" },
    { input: "123456789012", expect: { mode: "pill", label: "123456789012" }, note: "12 chars pill" },
    { input: "1234567890123", expect: { mode: "text", labelStartsWith: "1234567890123" }, note: "13 chars text" },
    { input: null, expect: { mode: "fallback" }, note: "null fallback" },
    { input: "AB", expect: { mode: "pill", label: "AB" }, note: "len 2 pill stays" },
    { input: "AB!!", expect: { mode: "pill", label: "AB!!" }, note: "after clean would be AB but undo because <3 -> revert to rawTrim" },
  ];

  const results = [] as any[];
  for (const c of cases) {
    const r = cleanChapterTitle(c.input as any);
    let ok = true;
    const e = c.expect as any;
    if (e.mode && r.mode !== e.mode) ok = false;
    if (e.label && r.label !== e.label) ok = false;
    if (e.labelStartsWith && typeof r.label === "string" && !r.label.startsWith(e.labelStartsWith)) ok = false;

    results.push({ input: c.input, note: c.note, ok, out: r });
  }

  // Print summary
  for (const res of results) {
    // eslint-disable-next-line no-console
    console.log(res.ok ? "[PASS]" : "[FAIL]", "input:", res.input, "note:", res.note, "out:", res.out);
  }

  const allOk = results.every((r) => r.ok);
  // eslint-disable-next-line no-console
  console.log(allOk ? "All tests passed" : "Some tests failed");
  return allOk ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = run();
}

export { run };
