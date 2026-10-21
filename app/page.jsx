"use client";

import { useEffect, useState } from "react";
import { JLPT_LEVELS as LEVELS } from "../lib/levels.js";
import { NEWS_CATEGORIES } from "../lib/news.js";

// 한국어 뜻이 없는 단어를 Chrome 내장 번역(Translator API)으로 번역한다.
// 내 컴퓨터 안에서 돌아가서 키도 비용도 없다. 지원하지 않는 브라우저면 영어 뜻을 그대로 둔다.
async function translateMissing(vocabulary, onTranslated) {
  if (!("Translator" in self)) return;
  const missing = vocabulary.filter((v) => !v.meaning_ko);
  if (missing.length === 0) return;
  try {
    const options = { sourceLanguage: "ja", targetLanguage: "ko" };
    if ((await Translator.availability(options)) === "unavailable") return;
    const translator = await Translator.create(options);
    for (const v of missing) {
      const ko = (await translator.translate(v.word)).trim();
      if (ko && ko !== v.word) onTranslated(v.word, ko);
    }
  } catch {
    // 번역 모델을 받지 못했거나 막힌 경우: 영어 뜻으로 둔다.
  }
}

// 쉬운 레벨(N5)이 먼저 오도록 정렬
function byLevel(a, b) {
  return LEVELS.indexOf(a.jlpt_level) - LEVELS.indexOf(b.jlpt_level);
}

async function requestExtract({ article, levels }) {
  let res;
  try {
    res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article, levels }),
    });
  } catch {
    throw new Error("서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `서버 오류 (${res.status})`);
  return data;
}

export default function Page() {
  const [article, setArticle] = useState("");
  const [picked, setPicked] = useState(null); // 불러온 NHK 뉴스 { title, link }
  const [levels, setLevels] = useState(["N3", "N2", "N1"]);
  const [result, setResult] = useState(null); // { vocabulary: [], grammar: [] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleLevel(level) {
    setLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  // RSS 에는 요약만 있어서 제목 + 요약을 넣고, 전문은 원문에서 붙여넣도록 안내한다.
  function pickNews(item) {
    setArticle(`${item.title}
${item.summary.replace(/…$/, "")}`);
    setPicked(item);
    setResult(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await requestExtract({ article: article.trim(), levels });
      setResult(data);
      translateMissing(data.vocabulary, (word, ko) =>
        setResult((prev) => ({
          ...prev,
          vocabulary: prev.vocabulary.map((v) =>
            v.word === word ? { ...v, meaning_ko: ko, machine_translated: true } : v
          ),
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>JLPT 단어·문법 추출기</h1>

      <NewsPicker onPick={pickNews} />

      <form onSubmit={handleSubmit}>

        <fieldset className="levels">
          <legend>추출할 레벨</legend>
          {LEVELS.map((level) => (
            <label key={level} className={`level-chip ${levels.includes(level) ? "on" : ""}`}>
              <input
                type="checkbox"
                checked={levels.includes(level)}
                onChange={() => toggleLevel(level)}
              />
              {level}
            </label>
          ))}
        </fieldset>

        {picked && (
          <p className="hint">
            NHK 뉴스의 제목과 요약을 넣었어요. 기사 전체로 분석하려면{" "}
            <a href={picked.link} target="_blank" rel="noreferrer">원문</a>
            에서 본문을 복사해 아래에 붙여넣으세요.
          </p>
        )}
        <textarea
          value={article}
          onChange={(e) => setArticle(e.target.value)}
          placeholder="일본어 기사를 붙여넣으세요…"
          rows={10}
        />
        <button type="submit" disabled={loading || !article.trim() || levels.length === 0}>
          {loading ? "분석 중…" : "단어·문법 추출"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <VocabularyList items={[...result.vocabulary].sort(byLevel)} />
          <GrammarList items={[...result.grammar].sort(byLevel)} />
        </>
      )}
    </main>
  );
}

function NewsPicker({ onPick }) {
  const [category, setCategory] = useState("0");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/news?category=${category}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `서버 오류 (${res.status})`);
        if (!cancelled) setItems(data.items);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category]);

  return (
    <section className="news-box">
      <h2>오늘의 NHK 뉴스</h2>
      <div className="news-tabs">
        {NEWS_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`level-chip ${category === c.id ? "on" : ""}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {loading && <p className="empty">불러오는 중…</p>}
      {error && <p className="error">{error} 기사를 직접 붙여넣어 주세요.</p>}
      {!loading && !error && (
        <ul className="news-list">
          {items.map((item) => (
            <li key={item.link}>
              <button type="button" className="news-item" onClick={() => onPick(item)}>
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LevelBadge({ level }) {
  return <span className={`badge badge-${level}`}>{level}</span>;
}

function VocabularyList({ items }) {
  return (
    <section>
      <h2>단어 ({items.length})</h2>
      {items.length === 0 && <p className="empty">선택한 레벨의 단어를 찾지 못했습니다.</p>}
      <ul className="cards">
        {items.map((v, i) => (
          <li key={`${v.word}-${i}`} className="card">
            <div className="card-head">
              <ruby>
                {v.word}
                <rt>{v.reading}</rt>
              </ruby>
              <div className="tags">
                <LevelBadge level={v.jlpt_level} />
                {v.level_estimated && (
                  <span className="tag" title="JLPT 단어 목록에 없어 한자 레벨로 추정했어요">추정</span>
                )}
                {v.part_of_speech && <span className="tag">{v.part_of_speech}</span>}
              </div>
            </div>
            <p className="meaning">
              {v.meaning_ko ?? v.meaning_en}
              {v.machine_translated && <span className="sub"> (기계 번역)</span>}
            </p>
            {v.meaning_ko && v.meaning_en && <p className="sub">{v.meaning_en}</p>}
            <blockquote>{v.sentence_from_article}</blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GrammarList({ items }) {
  return (
    <section>
      <h2>문법 ({items.length})</h2>
      {items.length === 0 && <p className="empty">선택한 레벨의 문법을 찾지 못했습니다.</p>}
      <ul className="cards">
        {items.map((g, i) => (
          <li key={`${g.pattern}-${i}`} className="card">
            <div className="card-head">
              <strong className="pattern">{g.pattern}</strong>
              <LevelBadge level={g.jlpt_level} />
            </div>
            <p className="meaning">{g.meaning_ko}</p>
            {g.explanation && <p className="explanation">{g.explanation}</p>}
            <blockquote>{g.sentence_from_article}</blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}
