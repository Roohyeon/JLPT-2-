// AnchorI/jlpt-kanji-dictionary (MIT) 데이터를 사전 모드용 작은 파일로 줄인다.
// 원본은 60MB 라서 그대로 쓰지 않고, JLPT 한자로만 이루어진 단어만 남긴다.
//
// 사용법:
//   git clone --depth 1 https://github.com/AnchorI/jlpt-kanji-dictionary.git ../jlpt-kanji-dictionary
//   node scripts/build-dictionary.mjs ../jlpt-kanji-dictionary
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("원본 저장소 경로를 넘겨주세요. 예: node scripts/build-dictionary.mjs ../jlpt-kanji-dictionary");
  process.exit(1);
}

const read = (name) => JSON.parse(fs.readFileSync(path.join(src, name), "utf8"));

// 한자 → JLPT 레벨 (원본에서 단어에는 레벨이 없고, 한자에만 있다)
const kanji = {};
for (const k of read("jlpt-kanji.json")) {
  if (k.jlpt) kanji[k.kanji] = k.jlpt;
}

const words = {};
for (let i = 1; fs.existsSync(path.join(src, `dictionary_part_${i}.json`)); i++) {
  for (const w of read(`dictionary_part_${i}.json`)) {
    const chars = [...w.kanji];
    // 한자가 하나 이상 있고, 들어간 한자가 모두 JLPT 한자인 단어만 (가나는 허용)
    if (!chars.some((c) => kanji[c])) continue;
    if (!chars.every((c) => kanji[c] || /[぀-ヿ]/.test(c))) continue;
    // 같은 표기가 여러 개면 자주 쓰는 단어(pos 가 "1 " 로 시작)를 우선한다.
    const common = w.pos.startsWith("1 ");
    if (words[w.kanji] && !(common && !words[w.kanji].common)) continue;
    // glossary_en 에는 일본어 예문과 그 영어 번역이 섞여 있어서 뜻만 남긴다.
    const meaning = (w.glossary_en ?? [])
      .filter((g) => !/[぀-ヿ一-鿿]/.test(g))
      .filter((g) => !/^[A-Z].* .*[.?!"]$/.test(g))
      .slice(0, 3)
      .join("; ");
    if (meaning) words[w.kanji] = { entry: [w.reading, meaning], common };
  }
}
for (const k in words) words[k] = words[k].entry;

const out = path.join(import.meta.dirname, "..", "data", "jlpt-dictionary.json");
fs.writeFileSync(out, JSON.stringify({ kanji, words }));
console.log(`한자 ${Object.keys(kanji).length}개, 단어 ${Object.keys(words).length}개 → ${out}`);
