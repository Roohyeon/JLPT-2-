// 브라우저 없이 추출 기능만 바로 테스트한다.
// 실행: node scripts/try-extract.js
import "dotenv/config";

const { extract, providerName } = process.env.GEMINI_API_KEY
  ? await import("../server/extractors/gemini.js")
  : await import("../server/extractors/claude.js");

const article =
  "政府は物価の上昇に伴って、家計の負担を軽減するための新たな対策を検討している。" +
  "中小企業にとってはコストの削減が難しく、経営を維持するのは容易ではない。";

console.log(`${providerName} 로 추출 중...`);
const started = Date.now();
try {
  const result = await extract(article);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("실패:", error.status ?? "", error.message);
} finally {
  console.log(`걸린 시간: ${((Date.now() - started) / 1000).toFixed(1)}초`);
}
