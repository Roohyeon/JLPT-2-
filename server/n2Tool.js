// n2Tool.js
export const n2ExtractorTool = {
  name: "extract_jlpt_n2_items",
  description:
    "일본어 기사에서 JLPT N2 수준에 해당하는 한자 단어와 문법 표현만 골라 기록한다. " +
    "N3 이하의 쉬운 단어나 N1 수준의 어려운 단어는 제외한다. " +
    "반드시 기사 본문에 실제로 등장한 항목만 포함한다.",
  // ★ strict: Claude가 만든 입력이 아래 스키마를 정확히 따르도록 API가 보장한다.
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false, // ★ strict 모드의 필수 조건
    properties: {
      vocabulary: {
        type: "array",
        description: "기사에서 찾은 N2 수준 한자 단어 목록",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            word:      { type: "string", description: "한자 표기 (예: 削減)" },
            reading:   { type: "string", description: "히라가나 읽기 (예: さくげん)" },
            meaning_ko:{ type: "string", description: "한국어 뜻" },
            part_of_speech: {
              type: "string",
              enum: ["명사", "동사", "い형용사", "な형용사", "부사", "기타"],
              description: "품사"
            },
            sentence_from_article: {
              type: "string",
              description: "이 단어가 등장한 기사 속 원문 문장"
            }
          },
          required: ["word", "reading", "meaning_ko", "sentence_from_article"]
        }
      },
      grammar: {
        type: "array",
        description: "기사에서 찾은 N2 수준 문법 표현 목록",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            pattern:    { type: "string", description: "문법 형태 (예: 〜に伴って)" },
            meaning_ko: { type: "string", description: "한국어 의미 (예: ~에 따라)" },
            explanation:{ type: "string", description: "접속 방법과 뉘앙스에 대한 초보자용 짧은 설명" },
            sentence_from_article: {
              type: "string",
              description: "이 문법이 쓰인 기사 속 원문 문장"
            }
          },
          required: ["pattern", "meaning_ko", "sentence_from_article"]
        }
      }
    },
    required: ["vocabulary", "grammar"]
  }
};
