import Anthropic from "@anthropic-ai/sdk";
import { jlptExtractorTool } from "../jlptTool.js";
import { ExtractError, SYSTEM_PROMPT, buildUserPrompt } from "./common.js";

// ANTHROPIC_API_KEY 환경변수(.env)를 자동으로 읽는다.
const client = new Anthropic();

export const providerName = "Claude (claude-haiku-5-5)";

export async function extract(article, levels) {
  let response;
  try {
    response = await client.messages.create({
      // Haiku: 가장 저렴한 모델. 단어/문법 추출처럼 범위가 명확한 작업에 충분하다.
      model: "claude-haiku-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system: `${SYSTEM_PROMPT}\n반드시 ${jlptExtractorTool.name} 도구를 한 번 호출해서 기록해라.`,
      tools: [jlptExtractorTool],
      // 참고: 최신 Claude 모델은 tool_choice로 도구 호출을 "강제"할 수 없다(400 에러).
      // 그래서 기본값(auto) + 시스템 프롬프트로 호출을 유도한다.
      messages: [{ role: "user", content: buildUserPrompt(article, levels) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ExtractError(500, "API 키가 올바르지 않습니다. .env 를 확인하세요.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ExtractError(429, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new ExtractError(502, `Claude API 오류 (${error.status}): ${error.message}`);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new ExtractError(422, "모델이 이 요청을 처리하지 않았습니다.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ExtractError(422, "기사가 너무 길어 결과가 잘렸습니다. 기사를 나눠서 입력해주세요.");
  }

  // 응답 content 배열에서 우리 도구를 호출한 블록을 찾는다.
  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === jlptExtractorTool.name
  );
  if (!toolUse) {
    throw new ExtractError(502, "모델이 결과를 구조화된 형태로 돌려주지 않았습니다. 다시 시도해주세요.");
  }
  // toolUse.input 은 이미 파싱된 객체이며, strict 덕분에 스키마와 일치한다.
  return toolUse.input;
}
