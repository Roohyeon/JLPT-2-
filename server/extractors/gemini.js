import { GoogleGenAI, ApiError } from "@google/genai";
import { jlptExtractorTool } from "../jlptTool.js";
import { ExtractError, SYSTEM_PROMPT, buildUserPrompt } from "./common.js";

// 빠른 Flash 모델. .env 의 GEMINI_MODEL 로 바꿀 수 있다.
// 쓸 수 있는 모델 목록: node scripts/list-gemini-models.js
// (최신 3.7/3.8 Flash는 무료 사용량에서 503 혼잡이 잦아 3.5를 기본으로 쓴다)
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  // 무료 사용량에서는 503(서버 혼잡)이 자주 난다. 최대 4번까지 간격을 늘려가며 자동 재시도.
  httpOptions: { retryOptions: { attempts: 4, initialDelay: 1, maxDelay: 8 } },
});

export const providerName = `Gemini (${MODEL})`;

export async function extract(article, levels) {
  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: buildUserPrompt(article, levels),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        // Claude의 tool 스키마를 그대로 재사용: 응답이 이 JSON 형식을 따르도록 강제한다.
        responseMimeType: "application/json",
        responseJsonSchema: jlptExtractorTool.input_schema,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const badKey = error.status === 401 || error.status === 403 || /API key/i.test(error.message);
      if (badKey) {
        throw new ExtractError(500, "Gemini API 키가 올바르지 않습니다. .env 의 GEMINI_API_KEY 를 확인하세요.");
      }
      if (error.status === 429) {
        throw new ExtractError(429, "무료 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.");
      }
      if (error.status === 503) {
        throw new ExtractError(503, "Gemini 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.");
      }
      throw new ExtractError(502, `Gemini API 오류 (${error.status}): ${error.message}`);
    }
    throw error;
  }

  if (response.promptFeedback?.blockReason) {
    throw new ExtractError(422, "Gemini가 이 요청을 처리하지 않았습니다.");
  }
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    throw new ExtractError(422, "기사가 너무 길어 결과가 잘렸습니다. 기사를 나눠서 입력해주세요.");
  }

  try {
    return JSON.parse(response.text ?? "");
  } catch {
    throw new ExtractError(502, "모델이 결과를 올바른 JSON으로 돌려주지 않았습니다. 다시 시도해주세요.");
  }
}
