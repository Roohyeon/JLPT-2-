import "dotenv/config";
import express from "express";
import { ExtractError } from "./extractors/common.js";
import { JLPT_LEVELS } from "./jlptTool.js";

// .env 에 GEMINI_API_KEY 가 있으면 Gemini, 없으면 Claude 를 쓴다.
// (동적 import: 쓰지 않는 쪽 SDK는 아예 불러오지 않는다)
const { extract, providerName } = process.env.GEMINI_API_KEY
  ? await import("./extractors/gemini.js")
  : await import("./extractors/claude.js");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/api/extract", async (req, res) => {
  const article = (req.body?.article ?? "").trim();
  if (!article) {
    return res.status(400).json({ error: "기사 본문을 입력해주세요." });
  }
  // 허용된 레벨만 남기고, 쉬운 레벨(N5)부터 정렬한다.
  const requested = Array.isArray(req.body?.levels) ? req.body.levels : [];
  const levels = JLPT_LEVELS.filter((level) => requested.includes(level));
  if (levels.length === 0) {
    return res.status(400).json({ error: "JLPT 레벨을 하나 이상 선택해주세요." });
  }

  try {
    res.json(await extract(article, levels));
  } catch (error) {
    if (error instanceof ExtractError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API 서버 실행 중: http://localhost:${PORT} (${providerName})`));
