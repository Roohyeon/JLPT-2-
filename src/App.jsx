import { useState } from "react";

export default function App() {
  const [article, setArticle] = useState("");
  const [result, setResult] = useState(null); // { vocabulary: [], grammar: [] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article }),
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
      <h1>JLPT N2 단어·문법 추출기</h1>

      <form onSubmit={handleSubmit}>
        <textarea
          value={article}
          onChange={(e) => setArticle(e.target.value)}
          placeholder="일본어 기사를 붙여넣으세요…"
          rows={10}
        />
        <button type="submit" disabled={loading || !article.trim()}>
          {loading ? "분석 중…" : "N2 항목 추출"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <VocabularyList items={result.vocabulary} />
          <GrammarList items={result.grammar} />
        </>
      )}
    </main>
  );
}

function VocabularyList({ items }) {
  return (
    <section>
      <h2>단어 ({items.length})</h2>
      {items.length === 0 && <p className="empty">N2 단어를 찾지 못했습니다.</p>}
      <ul className="cards">
        {items.map((v, i) => (
          <li key={`${v.word}-${i}`} className="card">
            <div className="card-head">
              <ruby>
                {v.word}
                <rt>{v.reading}</rt>
              </ruby>
              {v.part_of_speech && <span className="tag">{v.part_of_speech}</span>}
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
      {items.length === 0 && <p className="empty">N2 문법을 찾지 못했습니다.</p>}
      <ul className="cards">
        {items.map((g, i) => (
          <li key={`${g.pattern}-${i}`} className="card">
            <div className="card-head">
              <strong className="pattern">{g.pattern}</strong>
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
