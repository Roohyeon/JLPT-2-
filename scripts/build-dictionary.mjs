// 사전 모드용 데이터(data/jlpt-dictionary.json)를 세 가지 공개 자료로 만든다.
//
// 1. AnchorI/jlpt-kanji-dictionary (MIT)     : 단어 읽기·영어 뜻, 한자별 JLPT 레벨
// 2. elzup/jlpt-word-list (MIT, tanos.co.uk 기반) : 단어별 JLPT 레벨
// 3. 한국어 위키낱말사전 일본어 항목 (CC BY-SA, kaikki.org 추출본) : 한국어 뜻
//
// 사용법:
//   git clone --depth 1 https://github.com/AnchorI/jlpt-kanji-dictionary.git ../jlpt-kanji-dictionary
//   git clone --depth 1 https://github.com/elzup/jlpt-word-list.git ../jlpt-word-list
//   curl -L -o ../ko-wiktionary-ja.jsonl "https://kaikki.org/kowiktionary/%EC%9D%BC%EB%B3%B8%EC%96%B4/kaikki.org-dictionary-%EC%9D%BC%EB%B3%B8%EC%96%B4.jsonl"
//   node scripts/build-dictionary.mjs ../jlpt-kanji-dictionary ../jlpt-word-list ../ko-wiktionary-ja.jsonl
//
// 결과: { kanji: { 字: "N3" }, words: { 単語: [읽기, 영어 뜻, 한국어 뜻, 목록 레벨] } }
// 목록 레벨이 빈 문자열이면 서버에서 한자 레벨로 추정한다.
import fs from "node:fs";
import path from "node:path";

const [kanjiDir, wordListDir, koFile] = process.argv.slice(2);
if (!kanjiDir || !wordListDir || !koFile) {
  console.error("세 자료의 경로를 넘겨주세요. 파일 맨 위의 사용법을 참고하세요.");
  process.exit(1);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const KANA = /[぀-ヿ]/;
const JAPANESE = /[぀-ヿ一-鿿]/;

// 한자 → JLPT 레벨
const kanji = {};
for (const k of readJson(path.join(kanjiDir, "jlpt-kanji.json"))) {
  if (k.jlpt) kanji[k.kanji] = k.jlpt;
}

// 단어 → [읽기, 영어 뜻], 자주 쓰는 단어 우선
const base = {};
for (let i = 1; fs.existsSync(path.join(kanjiDir, `dictionary_part_${i}.json`)); i++) {
  for (const w of readJson(path.join(kanjiDir, `dictionary_part_${i}.json`))) {
    const chars = [...w.kanji];
    // 한자가 하나 이상 있고, 들어간 한자가 모두 JLPT 한자인 단어만 (가나는 허용)
    if (!chars.some((c) => kanji[c])) continue;
    if (!chars.every((c) => kanji[c] || KANA.test(c))) continue;
    const common = w.pos.startsWith("1 ");
    if (base[w.kanji] && !(common && !base[w.kanji].common)) continue;
    // glossary_en 에는 일본어 예문과 그 영어 번역이 섞여 있어서 뜻만 남긴다.
    const meaning = (w.glossary_en ?? [])
      .filter((g) => !JAPANESE.test(g))
      .filter((g) => !/^[A-Z].* .*[.?!"]$/.test(g))
      .slice(0, 3)
      .join("; ");
    if (meaning) base[w.kanji] = { reading: w.reading, en: meaning, common };
  }
}

// 단어 → JLPT 레벨 (같은 단어가 여러 레벨에 있으면 쉬운 쪽)
function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

const listed = {};
for (const level of LEVELS) {
  const file = path.join(wordListDir, "src", `${level.toLowerCase()}.csv`);
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [expression, reading, meaning] = parseCsvLine(line);
    // "いい; よい", "足; 脚" 처럼 표기가 여러 개인 항목은 나눠서 넣는다.
    const forms = expression.split(/;\s*/).map((f) => f.replace(/^[～〜~]/, "").trim());
    const readings = reading.split(/;\s*/);
    forms.forEach((form, i) => {
      if (!form || listed[form]) return;
      let r = (readings[i] ?? readings[0]).trim();
      // "生活,せいかつする" 처럼 する 동사 표시가 붙은 읽기는 する 를 뗀다.
      if (r.endsWith("する") && !form.endsWith("する")) r = r.slice(0, -2);
      listed[form] = { level, reading: r, en: meaning.replace(/,\s*/g, "; ") };
    });
  }
}

// 단어 → 한국어 뜻
// 위키낱말사전에는 뜻이 아니라 설명만 적힌 항목이 섞여 있어서 걸러낸다.
const NOT_A_MEANING = /어간의 하나|다음 단어를 만듦|다음 지명에 쓰임|성의 하나|상용한자|표외한자|가나 중에서|뜻풀이가 필요/;
const ko = {};
for (const line of fs.readFileSync(koFile, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const entry = JSON.parse(line);
  const glosses = (entry.senses ?? [])
    .flatMap((s) => s.glosses ?? [])
    .filter((g) => !NOT_A_MEANING.test(g) && /[가-힣]/.test(g));
  if (glosses.length === 0) continue;
  (ko[entry.word] ??= []).push(...glosses.map((g) => g.trim().replace(/\.$/, "")));
}

const words = {};
for (const word of new Set([...Object.keys(base), ...Object.keys(listed)])) {
  const b = base[word];
  const l = listed[word];
  const koMeaning = [...new Set(ko[word] ?? [])].slice(0, 3).join("; ");
  words[word] = [b?.reading ?? l.reading, b?.en ?? l.en, koMeaning, l?.level ?? ""];
}

const out = path.join(import.meta.dirname, "..", "data", "jlpt-dictionary.json");
fs.writeFileSync(out, JSON.stringify({ kanji, words }));

const all = Object.values(words);
console.log(`한자 ${Object.keys(kanji).length}개, 단어 ${all.length}개 → ${out}`);
console.log(`  JLPT 목록 레벨 있음 ${all.filter((w) => w[3]).length}개, 한국어 뜻 있음 ${all.filter((w) => w[2]).length}개`);
