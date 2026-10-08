// jlptSchema.js
// Gemini가 돌려줄 결과의 JSON 형식과 추출 지시문.

export const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

const levelField = {
  type: "string",
  enum: JLPT_LEVELS,
  description: "이 항목의 JLPT 레벨"
};

export const jlptSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    vocabulary: {
      type: "array",
      description: "기사에서 찾은 단어 목록 (한자어, 고유어, 가타카나어, 부사 등 포함)",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          word:      { type: "string", description: "사전형 표기 (예: 削減)" },
          reading:   { type: "string", description: "히라가나 읽기 (예: さくげん)" },
          meaning_ko:{ type: "string", description: "한국어 뜻" },
          jlpt_level: levelField,
          part_of_speech: {
            type: "string",
            enum: ["명사", "동사", "い형용사", "な형용사", "부사", "기타"],
            description: "품사"
          },
          sentence_from_article: {
            type: "string",
            description: "이 단어가 등장한 기사 속 원문 문장 (기사 그대로 복사)"
          }
        },
        required: ["word", "reading", "meaning_ko", "jlpt_level", "sentence_from_article"]
      }
    },
    grammar: {
      type: "array",
      description: "기사에서 찾은 문법 표현 목록",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pattern:    { type: "string", description: "문법 형태 (예: 〜に伴って)" },
          meaning_ko: { type: "string", description: "한국어 의미 (예: ~에 따라)" },
          jlpt_level: levelField,
          explanation:{ type: "string", description: "접속 방법과 뉘앙스에 대한 초보자용 짧은 설명" },
          sentence_from_article: {
            type: "string",
            description: "이 문법이 쓰인 기사 속 원문 문장 (기사 그대로 복사)"
          }
        },
        required: ["pattern", "meaning_ko", "jlpt_level", "sentence_from_article"]
      }
    }
  },
  required: ["vocabulary", "grammar"]
};

export const SYSTEM_PROMPT = `너는 한국인 일본어 학습자를 돕는 JLPT 전문 강사다.
일본어 기사에서 학습자가 선택한 JLPT 레벨에 해당하는 단어와 문법 표현을 골라 기록한다.

추출 기준:
- 학습자가 요청한 JLPT 레벨에 해당하는 항목만 고르고, 각 항목에 jlpt_level 을 표시한다.
- 요청한 레벨에 해당하면 빠짐없이 모두 기록한다. 몇 개만 골라 대표로 보여주지 않는다.
- 단어는 한자어뿐 아니라 고유어, 가타카나어, 부사, 복합동사도 포함한다. 조사나 고유명사(인명, 지명, 회사명)는 제외한다.
- 활용된 단어는 사전형으로 적는다. (예: 踏み切る)
- 같은 단어나 문법이 여러 번 나오면 한 번만 기록한다.
- sentence_from_article 은 기사 원문을 한 글자도 바꾸지 말고 그대로 복사한다.
- 반드시 기사 본문에 실제로 등장한 항목만 포함한다. 해당하는 항목이 없으면 빈 배열로 기록한다.`;

export function buildUserPrompt(article, levels) {
  return `추출할 JLPT 레벨: ${levels.join(", ")}\n\n다음 기사를 분석해줘.\n\n${article}`;
}
