// 어떤 AI를 쓰든 공통으로 쓰는 프롬프트와 에러 타입.

export const SYSTEM_PROMPT = `너는 한국인 일본어 학습자를 돕는 JLPT 전문 강사다.
사용자가 일본어 기사를 주면 extract_jlpt_n2_items 형식으로 결과를 기록해라.
- N2 수준의 한자 단어와 문법만 고른다. N3 이하나 N1 수준은 제외한다.
- 기사에 실제로 등장한 표현만, 등장한 원문 문장과 함께 기록한다.
- 해당하는 항목이 없으면 빈 배열로 기록한다.`;

// status: 프론트로 돌려줄 HTTP 상태 코드, message: 사용자에게 보여줄 문구
export class ExtractError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
