// 브라우저가 보낸 기사를 서버에서 사전 데이터로 분석해 단어와 문법을 돌려준다.
import { JLPT_LEVELS } from "../../../lib/levels.js";
import { extractWithDictionary } from "../../../lib/dictionary.js";

export const runtime = "nodejs";

const MAX_ARTICLE_LENGTH = 8000;

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

  if (!article) return fail("기사를 입력해주세요.", 400);
  if (article.length > MAX_ARTICLE_LENGTH) {
    return fail(`기사는 ${MAX_ARTICLE_LENGTH}자까지 입력할 수 있습니다. 나눠서 입력해주세요.`, 400);
  }
  if (levels.length === 0) return fail("레벨을 하나 이상 골라주세요.", 400);

  try {
    return Response.json(await extractWithDictionary({ article, levels }));
  } catch (err) {
    return fail(err.message, 500);
  }
}
