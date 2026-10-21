// 서버(app/api/extract)에서만 불러 쓴다. 키는 서버 환경변수 GEMINI_API_KEY 에만 있고
// 브라우저로는 절대 전달되지 않는다.
import { GoogleGenAI, ApiError } from "@google/genai";
import { jlptSchema, SYSTEM_PROMPT, buildUserPrompt } from "./jlptSchema.js";

// 쓸 수 있는 모델은 계정마다 다를 수 있다. 404가 나면 여기를 바꾼다.
// (최신 3.7/3.8 Flash는 무료 사용량에서 503 혼잡이 잦아 3.5를 쓴다)
export const MODEL = "gemini-3.5-flash";

export async function extract({ article, levels }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("서버에 GEMINI_API_KEY 가 설정되지 않았습니다.");

  const ai = new GoogleGenAI({
    apiKey,
    // 무료 사용량에서는 503(서버 혼잡)이 자주 난다. 최대 4번까지 간격을 늘려가며 자동 재시도.
    httpOptions: { retryOptions: { attempts: 4, initialDelay: 1, maxDelay: 8 } },
  });

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: buildUserPrompt(article, levels),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        // 응답이 jlptSchema 형식의 JSON으로만 오도록 강제한다.
        responseMimeType: "application/json",
        responseJsonSchema: jlptSchema,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const badKey = error.status === 401 || error.status === 403 || /API key/i.test(error.message);
      if (badKey) throw new Error("서버의 API 키가 올바르지 않습니다. 관리자에게 알려주세요.");
      if (error.status === 429) throw new Error("무료 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.");
      if (error.status === 503) throw new Error("Gemini 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.");
      throw new Error(`Gemini API 오류 (${error.status}): ${error.message}`);
    }
    throw new Error("Gemini 서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.");
  }

  if (response.promptFeedback?.blockReason) {
    throw new Error("Gemini가 이 요청을 처리하지 않았습니다.");
  }
  if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    throw new Error("기사가 너무 길어 결과가 잘렸습니다. 기사를 나눠서 입력해주세요.");
  }

  try {
    return JSON.parse(response.text ?? "");
  } catch {
    throw new Error("결과를 올바른 형식으로 받지 못했습니다. 다시 시도해주세요.");
  }
}
