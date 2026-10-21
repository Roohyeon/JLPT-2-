// 형태소 분석(kuromoji) + 공개 사전 데이터로 기사에서 단어와 문법을 뽑는다.
// - 단어 레벨은 JLPT 단어 목록 기준. 목록에 없는 단어는 가장 어려운 한자의 레벨로 추정한다.
// - 뜻은 한국어 위키낱말사전의 한국어 뜻, 없으면 영어 뜻 (브라우저에서 한국어 번역을 시도한다).
// - 문법은 lib/grammarPatterns.js 의 규칙으로 찾는다.
import fs from "node:fs";
import path from "node:path";
import kuromoji from "kuromoji";
import { JLPT_LEVELS } from "./levels.js";
import { GRAMMAR_PATTERNS } from "./grammarPatterns.js";

// 사전 파일(11MB)과 kuromoji 사전 로딩은 1~2초 걸려서 서버가 떠 있는 동안 한 번만 읽는다.
// data/jlpt-dictionary.json 은 scripts/build-dictionary.mjs 로 만든다.
let dictionary;
function getDictionary() {
  dictionary ??= JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "jlpt-dictionary.json"), "utf8")
  );
  return dictionary;
}

let tokenizerPromise;
function getTokenizer() {
  tokenizerPromise ??= new Promise((resolve, reject) => {
    const dicPath = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
    kuromoji.builder({ dicPath }).build((err, tokenizer) => (err ? reject(err) : resolve(tokenizer)));
  });
  return tokenizerPromise;
}

const POS_KO = { 名詞: "명사", 動詞: "동사", 形容詞: "い형용사", 副詞: "부사" };

function partOfSpeech(token) {
  if (token.pos === "名詞" && token.pos_detail_1 === "形容動詞語幹") return "な형용사";
  return POS_KO[token.pos] ?? "기타";
}

// 단어 속 한자 중 가장 어려운(N1 에 가까운) 레벨
function levelFromKanji(word) {
  const { kanji } = getDictionary();
  let hardest = -1;
  for (const c of word) {
    const i = JLPT_LEVELS.indexOf(kanji[c]);
    if (i > hardest) hardest = i;
  }
  return JLPT_LEVELS[hardest];
}

function splitSentences(article) {
  return article.split(/(?<=[。！？!?\n])/).map((s) => s.trim()).filter(Boolean);
}

// 한 문장에서 맞는 문법 규칙들. 겹치는 경우 더 긴 쪽만 남긴다.
// (예: 〜ことになっている 안의 〜ている 는 따로 세지 않는다)
function matchGrammar(sentence, tokens, rules) {
  const hits = [];
  for (const rule of rules) {
    if (rule.re) {
      const m = sentence.match(rule.re);
      if (m) hits.push({ rule, start: m.index, end: m.index + m[0].length });
    } else {
      const t = tokens.find(rule.token);
      if (t) hits.push({ rule, start: t.word_position - 1, end: t.word_position - 1 + t.surface_form.length });
    }
  }
  return hits
    .filter((h) => !hits.some((o) => o !== h && o.start <= h.start && h.end <= o.end && o.end - o.start > h.end - h.start))
    .map((h) => h.rule);
}

export async function extractWithDictionary({ article, levels }) {
  const tokenizer = await getTokenizer();
  const { words } = getDictionary();
  const sentences = splitSentences(article);
  const seen = new Set();
  const vocabulary = [];
  const grammar = [];
  const rules = GRAMMAR_PATTERNS.filter((r) => levels.includes(r.level));

  for (const sentence of sentences) {
    const tokens = tokenizer.tokenize(sentence);

    for (const rule of matchGrammar(sentence, tokens, rules)) {
      if (grammar.some((g) => g.pattern === rule.pattern)) continue;
      grammar.push({
        pattern: rule.pattern,
        meaning_ko: rule.meaning_ko,
        jlpt_level: rule.level,
        explanation: rule.explanation,
        sentence_from_article: sentence,
      });
    }

    for (const token of tokens) {
      // 고유명사(인명, 지명, 회사명)와 조사·조동사·기호는 제외
      if (token.pos_detail_1 === "固有名詞") continue;
      if (["助詞", "助動詞", "記号"].includes(token.pos)) continue;
      const word = token.basic_form === "*" ? token.surface_form : token.basic_form;
      const entry = words[word];
      if (!entry || seen.has(word)) continue;

      const [reading, meaningEn, meaningKo, listLevel] = entry;
      const level = listLevel || levelFromKanji(word);
      if (!levels.includes(level)) continue;

      seen.add(word);
      vocabulary.push({
        word,
        reading,
        meaning_ko: meaningKo || undefined,
        meaning_en: meaningEn,
        jlpt_level: level,
        level_estimated: !listLevel,
        part_of_speech: partOfSpeech(token),
        sentence_from_article: sentence,
      });
    }
  }

  return { vocabulary, grammar };
}
