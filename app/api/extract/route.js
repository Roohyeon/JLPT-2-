// 브라우저는 이 주소로 기사만 보내고, Gemini 키는 서버에서만 쓴다.
import { JLPT_LEVELS } from "../../../lib/jlptSchema.js";
import { extract } from "../../../lib/gemini.js";
import { extractWithDictionary } from "../../../lib/dictionary.js";

export const runtime = "nodejs";

const MAX_ARTICLE_LENGTH = 8000;

// 키를 서버가 가지고 있으니 누구나 마구 호출하지 못하게 IP 당 횟수를 제한한다.
// (서버 메모리에만 있어서 서버가 재시작되면 초기화된다. 사전 모드는 제한 없음)
const AI_LIMIT_PER_HOUR = 20;
const hits = new Map(); // ip → [호출 시각, ...]

function allowAiCall(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= AI_LIMIT_PER_HOUR) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

function fail(message, status) {
  return Response.json({ error: message }, { status });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("잘못된 요청입니다.", 400);
  }

  const article = typeof body.article === "string" ? body.article.trim() : "";
  const levels = Array.isArray(body.levels) ? JLPT_LEVELS.filter((l) => body.levels.includes(l)) : [];
  const mode = body.mode === "dictionary" ? "dictionary" : "ai";

  if (!article) return fail("기사를 입력해주세요.", 400);
  if (article.length > MAX_ARTICLE_LENGTH) {
    return fail(`기사는 ${MAX_ARTICLE_LENGTH}자까지 입력할 수 있습니다. 나눠서 입력해주세요.`, 400);
  }
  if (levels.length === 0) return fail("레벨을 하나 이상 골라주세요.", 400);

  try {
    if (mode === "dictionary") {
      return Response.json(await extractWithDictionary({ article, levels }));
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    if (!allowAiCall(ip)) {
      return fail(`AI 분석은 한 시간에 ${AI_LIMIT_PER_HOUR}번까지 가능합니다. 사전 모드를 이용하거나 잠시 후 다시 시도해주세요.`, 429);
    }
    return Response.json(await extract({ article, levels }));
  } catch (err) {
    return fail(err.message, 500);
  }
}
