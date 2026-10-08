import { useState } from "react";
import { JLPT_LEVELS as LEVELS } from "./lib/jlptSchema.js";
import { extract } from "./lib/gemini.js";

const KEY_STORAGE = "gemini-api-key";

// 쉬운 레벨(N5)이 먼저 오도록 정렬
function byLevel(a, b) {
  return LEVELS.indexOf(a.jlpt_level) - LEVELS.indexOf(b.jlpt_level);
}

// localStorage 는 사생활 보호 모드 등에서 막힐 수 있어 try/catch 로 감싼다.
function loadSavedKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState(loadSavedKey);
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
      // 레벨은 N5 → N1 순서로 정리해서 보낸다.
      const sortedLevels = LEVELS.filter((l) => levels.includes(l));
      setResult(await extract({ apiKey, article: article.trim(), levels: sortedLevels }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>JLPT 단어·문법 추출기</h1>

      <ApiKeyBox apiKey={apiKey} onChange={setApiKey} />

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
        <button
          type="submit"
          disabled={loading || !apiKey || !article.trim() || levels.length === 0}
        >
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

function ApiKeyBox({ apiKey, onChange }) {
  const [draft, setDraft] = useState("");
  const [remember, setRemember] = useState(true);

  function save(e) {
    e.preventDefault();
    const key = draft.trim();
    if (!key) return;
    try {
      if (remember) localStorage.setItem(KEY_STORAGE, key);
    } catch {
      // 저장이 막혀도 이번 접속 동안은 쓸 수 있다.
    }
    onChange(key);
    setDraft("");
  }

  function forget() {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {
      // 무시
    }
    onChange("");
  }

  if (apiKey) {
    return (
      <div className="key-box saved">
        <span>🔑 API 키 입력됨 (…{apiKey.slice(-4)})</span>
        <button type="button" className="link" onClick={forget}>키 삭제</button>
      </div>
    );
  }

  return (
    <form className="key-box" onSubmit={save}>
      <label htmlFor="api-key"><strong>Gemini API 키</strong></label>
      <p className="hint">
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>
        에서 무료로 발급받을 수 있어요. 키는 이 브라우저에만 저장되고, Google 외에는 어디에도 전송되지 않아요.
      </p>
      <div className="key-row">
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="API 키 붙여넣기"
        />
        <button type="submit" disabled={!draft.trim()}>저장</button>
      </div>
      <label className="remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        이 브라우저에 기억하기 (공용 PC에서는 해제하세요)
      </label>
    </form>
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
