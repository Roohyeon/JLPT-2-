// jlptTool.js
// 추출 결과의 JSON 형식. Claude에는 tool로, Gemini에는 응답 스키마로 그대로 쓴다.

export const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

const levelField = {
  type: "string",
  enum: JLPT_LEVELS,
  description: "이 항목의 JLPT 레벨"
};

export const jlptExtractorTool = {
  name: "extract_jlpt_items",
  description:
    "일본어 기사에서 학습자가 선택한 JLPT 레벨에 해당하는 단어와 문법 표현을 골라 기록한다. " +
    "선택하지 않은 레벨의 항목은 제외한다. " +
    "반드시 기사 본문에 실제로 등장한 항목만 포함한다.",
  // strict: Claude가 만든 입력이 아래 스키마를 정확히 따르도록 API가 보장한다.
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false, // strict 모드의 필수 조건
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
              description: "이 단어가 등장한 기사 속 원문 문장"
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
              description: "이 문법이 쓰인 기사 속 원문 문장"
            }
          },
          required: ["pattern", "meaning_ko", "jlpt_level", "sentence_from_article"]
        }
      }
    },
    required: ["vocabulary", "grammar"]
  }
};
