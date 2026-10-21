// NHK 공식 RSS 에서 최신 뉴스 목록을 가져온다. (로그인 없이 공개된 피드)
// RSS 에는 제목과 요약(100자 안팎)만 있다. 기사 전문은 NHK 에서 로그인 토큰이 있어야 받을 수 있어서
// 전문은 사용자가 원문 링크에서 직접 복사해 붙여넣는다.
export const NEWS_CATEGORIES = [
  { id: "0", label: "주요" },
  { id: "1", label: "사회" },
  { id: "2", label: "생활" },
  { id: "3", label: "과학·문화" },
  { id: "4", label: "정치" },
  { id: "5", label: "경제" },
  { id: "6", label: "국제" },
  { id: "7", label: "스포츠" },
];

const feedUrl = (id) => `https://news.web.nhk/n-data/conf/na/rss/cat${id}.xml`;

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(item, name) {
  const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
}

export async function fetchNews(categoryId) {
  const res = await fetch(feedUrl(categoryId), {
    headers: { "User-Agent": "Mozilla/5.0 (JLPT extractor)" },
    next: { revalidate: 600 }, // 10분 동안은 같은 목록을 재사용해 NHK 서버에 부담을 주지 않는다.
  });
  if (!res.ok) throw new Error(`NHK 뉴스를 불러오지 못했습니다. (${res.status})`);
  const xml = await res.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
    title: tag(item, "title"),
    summary: tag(item, "description"),
    link: tag(item, "link"),
    publishedAt: tag(item, "pubDate"),
  }));
}
