// 어떤 AI를 쓰든 공통으로 쓰는 프롬프트와 에러 타입.
import { jlptExtractorTool } from "../jlptTool.js";

export const SYSTEM_PROMPT = `너는 한국인 일본어 학습자를 돕는 JLPT 전문 강사다.
${jlptExtractorTool.description}

추출 기준:
- 학습자가 요청한 JLPT 레벨에 해당하는 항목만 고르고, 각 항목에 jlpt_level 을 표시한다.
- 요청한 레벨에 해당하면 빠짐없이 모두 기록한다. 몇 개만 골라 대표로 보여주지 않는다.
- 단어는 한자어뿐 아니라 고유어, 가타카나어, 부사, 복합동사도 포함한다. 조사나 고유명사(인명, 지명, 회사명)는 제외한다.
- 활용된 단어는 사전형으로 적는다. (예: 踏み切る)
- 같은 단어나 문법이 여러 번 나오면 한 번만 기록한다.
- 해당하는 항목이 없으면 빈 배열로 기록한다.`;

// 사용자 메시지: 선택한 레벨 + 기사 본문
export function buildUserPrompt(article, levels) {
  return `추출할 JLPT 레벨: ${levels.join(", ")}\n\n다음 기사를 분석해줘.\n\n${article}`;
}

// status: 프론트로 돌려줄 HTTP 상태 코드, message: 사용자에게 보여줄 문구
export class ExtractError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
