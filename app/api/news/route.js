// NHK RSS 는 브라우저에서 바로 부를 수 없어서(CORS) 서버가 대신 가져온다.
import { NEWS_CATEGORIES, fetchNews } from "../../../lib/news.js";

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("category") ?? "0";
  if (!NEWS_CATEGORIES.some((c) => c.id === id)) {
    return Response.json({ error: "없는 분야입니다." }, { status: 400 });
  }

  try {
    return Response.json({ items: await fetchNews(id) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
