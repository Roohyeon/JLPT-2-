// 사전 모드: AI 없이 형태소 분석(kuromoji) + JLPT 한자 사전으로 단어를 뽑는다.
// - 단어 사전에는 JLPT 레벨이 없어서, 단어 속 가장 어려운 한자의 레벨을 단어 레벨로 본다. (추정치)
// - 뜻은 원본 데이터에 있는 영어 뜻이다.
// - 문법은 찾지 않는다.
import fs from "node:fs";
import path from "node:path";
import kuromoji from "kuromoji";
import { JLPT_LEVELS } from "./jlptSchema.js";

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
function levelOf(word) {
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

export async function extractWithDictionary({ article, levels }) {
  const tokenizer = await getTokenizer();
  const { words } = getDictionary();
  const sentences = splitSentences(article);
  const seen = new Set();
  const vocabulary = [];

  for (const sentence of sentences) {
    for (const token of tokenizer.tokenize(sentence)) {
      // 고유명사(인명, 지명, 회사명)는 제외
      if (token.pos_detail_1 === "固有名詞") continue;
      const word = token.basic_form === "*" ? token.surface_form : token.basic_form;
      const entry = words[word];
      if (!entry || seen.has(word)) continue;

      const level = levelOf(word);
      if (!levels.includes(level)) continue;

      seen.add(word);
      vocabulary.push({
        word,
        reading: entry[0],
        meaning_en: entry[1],
        jlpt_level: level,
        part_of_speech: partOfSpeech(token),
        sentence_from_article: sentence,
      });
    }
  }

  return { vocabulary, grammar: [] };
}
