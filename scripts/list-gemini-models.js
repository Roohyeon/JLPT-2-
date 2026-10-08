// 내 GEMINI_API_KEY 로 사용할 수 있는 Gemini 모델 목록을 출력한다.
// 실행: node scripts/list-gemini-models.js
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const pager = await ai.models.list();
for await (const model of pager) {
  if (model.supportedActions?.includes("generateContent")) {
    console.log(model.name, "-", model.displayName);
  }
}
