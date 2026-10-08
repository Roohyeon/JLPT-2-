import { useState } from "react";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

// 쉬운 레벨(N5)이 먼저 오도록 정렬
function byLevel(a, b) {
  return LEVELS.indexOf(a.jlpt_level) - LEVELS.indexOf(b.jlpt_level);
}

export default function App() {
  const [article, setArticle] = useState("");
  const [levels, setLevels] = useState(["N3", "N2", "N1"]);
  const [result, setResult] = useState(null); // { vocabulary: [], grammar: [] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleLevel(level) {
    setLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, levels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>JLPT 단어·문법 추출기</h1>

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
                {v.part_of_speech && <span className="tag">{v.part_of_speech}</span>}
              </div>
            </div>
            <p className="meaning">{v.meaning_ko}</p>
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
