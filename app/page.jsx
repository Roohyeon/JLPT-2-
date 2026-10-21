"use client";

import { useEffect, useState } from "react";
import { JLPT_LEVELS as LEVELS } from "../lib/levels.js";
import { NEWS_CATEGORIES } from "../lib/news.js";

// Chrome 내장 번역(Translator API, 일본어 → 한국어). 내 컴퓨터 안에서 돌아가서 키도 비용도 없다.
// 번역기는 한 번 만들어 단어 번역과 기사 번역이 같이 쓴다. 지원하지 않는 브라우저면 null.
const TRANSLATE_OPTIONS = { sourceLanguage: "ja", targetLanguage: "ko" };
let translatorPromise;

function getTranslator(onProgress) {
  if (typeof self === "undefined" || !("Translator" in self)) return Promise.resolve(null);
  translatorPromise ??= (async () => {
    if ((await Translator.availability(TRANSLATE_OPTIONS)) === "unavailable") return null;
    return Translator.create({
      ...TRANSLATE_OPTIONS,
      // 처음 한 번은 번역 모델을 내려받는다.
      monitor: (m) => m.addEventListener("downloadprogress", (e) => onProgress?.(e.loaded)),
    });
  })().catch((err) => {
    translatorPromise = undefined; // 실패하면 다음에 다시 시도할 수 있게
    throw err;
  });
  return translatorPromise;
}

// 한국어 뜻이 없는 단어를 번역한다. 번역할 수 없으면 영어 뜻을 그대로 둔다.
async function translateMissing(vocabulary, onTranslated) {
  const missing = vocabulary.filter((v) => !v.meaning_ko);
  if (missing.length === 0) return;
  try {
    const translator = await getTranslator();
    if (!translator) return;
    for (const v of missing) {
      const ko = (await translator.translate(v.word)).trim();
      if (ko && ko !== v.word) onTranslated(v.word, ko);
    }
  } catch {
    // 번역 모델을 받지 못했거나 막힌 경우: 영어 뜻으로 둔다.
  }
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
    setArticle(`${item.title}\n${item.summary.replace(/…$/, "")}`);
    setPicked(item);
    setResult(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const text = article.trim();
      const data = await requestExtract({ article: text, levels });
      setResult({ ...data, article: text });
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
          <ArticleReader
            paragraphs={result.paragraphs}
            vocabulary={result.vocabulary}
            grammar={result.grammar}
          />
          <ArticleTranslation article={result.article} />
        </>
      )}
    </main>
  );
}

const SHOW_TRANSLATION_KEY = "show-article-translation";

function loadShowTranslation() {
  try {
    return localStorage.getItem(SHOW_TRANSLATION_KEY) === "1";
  } catch {
    return false;
  }
}

// 분석한 기사 전체를 한국어로 번역해 보여준다. 토글로 접고 펼 수 있다.
// 번역은 펼쳤을 때만 하고(모델 다운로드에 사용자 클릭이 필요), 펼친 상태는 다음 방문에도 기억한다.
function ArticleTranslation({ article }) {
  const [open, setOpen] = useState(false);
  const [paragraphs, setParagraphs] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | unsupported | error
  const [progress, setProgress] = useState(null);

  useEffect(() => setOpen(loadShowTranslation()), []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(SHOW_TRANSLATION_KEY, next ? "1" : "0");
    } catch {
      // 기억하지 못해도 이번에는 동작한다.
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setParagraphs([]);
    setStatus("loading");
    setProgress(null);

    (async () => {
      try {
        const translator = await getTranslator((loaded) => !cancelled && setProgress(loaded));
        if (cancelled) return;
        if (!translator) return setStatus("unsupported");
        // 문단마다 번역해서 끝나는 대로 바로 보여준다.
        for (const line of article.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
          const ko = await translator.translate(line);
          if (cancelled) return;
          setParagraphs((prev) => [...prev, ko]);
        }
        setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, article]);

  return (
    <section className="news-box translation">
      <div className="translation-head">
        <h2>기사 번역 (한국어)</h2>
        <button type="button" className="toggle" onClick={toggle} aria-expanded={open}>
          {open ? "숨기기" : "보기"}
        </button>
      </div>
      {open && (
        <>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {status === "loading" && (
            <p className="empty">
              {progress !== null && progress < 1
                ? `번역 모델 내려받는 중… ${Math.round(progress * 100)}%`
                : "번역 중…"}
            </p>
          )}
          {status === "unsupported" && (
            <p className="empty">
              이 브라우저는 내장 번역을 지원하지 않아요. Chrome 138 이상(데스크톱)에서 볼 수 있어요.
            </p>
          )}
          {status === "error" && (
            <p className="error">번역하지 못했어요. 「숨기기」 후 다시 「보기」를 눌러 주세요.</p>
          )}
          {status === "done" && <p className="sub">Chrome 내장 번역으로 기계 번역한 내용이에요.</p>}
        </>
      )}
    </section>
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

// 기사 본문을 그대로 보여주고, 뽑은 단어·문법을 누르면 그 자리에서 뜻이 열린다. 다시 누르면 닫힌다.
function ArticleReader({ paragraphs, vocabulary, grammar }) {
  const [openKey, setOpenKey] = useState(null);
  const byWord = new Map(vocabulary.map((v) => [v.word, v]));
  const byPattern = new Map(grammar.map((g) => [g.pattern, g]));
  const empty = vocabulary.length === 0 && grammar.length === 0;

  return (
    <section className="news-box reader">
      <h2>
        단어 {vocabulary.length} · 문법 {grammar.length}
      </h2>
      {empty ? (
        <p className="empty">선택한 레벨의 단어·문법을 찾지 못했습니다.</p>
      ) : (
        <p className="sub">밑줄 친 단어, 색칠한 문법을 누르면 뜻이 나와요.</p>
      )}
      {paragraphs.map((segments, p) => (
        <p key={p} className="reader-text">
          {segments.map((seg, i) => {
            const v = seg.word && byWord.get(seg.word);
            const g = seg.grammar && byPattern.get(seg.grammar);
            const item = v ?? g;
            if (!item) return seg.text;
            const key = `${p}-${i}`;
            const open = openKey === key;
            return (
              <span key={key} className="word-wrap">
                <button
                  type="button"
                  className={`${g ? "grammar" : "word"} word-${item.jlpt_level} ${open ? "on" : ""}`}
                  onClick={() => setOpenKey(open ? null : key)}
                  aria-expanded={open}
                >
                  {seg.text}
                </button>
                {open && (g ? <GrammarPopover g={g} /> : <WordPopover v={v} />)}
              </span>
            );
          })}
        </p>
      ))}
    </section>
  );
}

function GrammarPopover({ g }) {
  return (
    <span className="popover" role="tooltip">
      <span className="card-head">
        <strong className="pattern">{g.pattern}</strong>
        <LevelBadge level={g.jlpt_level} />
      </span>
      <span className="meaning">{g.meaning_ko}</span>
      {g.explanation && <span className="explanation">{g.explanation}</span>}
    </span>
  );
}

function WordPopover({ v }) {
  return (
    <span className="popover" role="tooltip">
      <span className="card-head">
        <ruby>
          {v.word}
          <rt>{v.reading}</rt>
        </ruby>
        <span className="tags">
          <LevelBadge level={v.jlpt_level} />
          {v.level_estimated && (
            <span className="tag" title="JLPT 단어 목록에 없어 한자 레벨로 추정했어요">추정</span>
          )}
          {v.part_of_speech && <span className="tag">{v.part_of_speech}</span>}
        </span>
      </span>
      <span className="meaning">
        {v.meaning_ko ?? v.meaning_en}
        {v.machine_translated && <span className="sub"> (기계 번역)</span>}
      </span>
      {v.meaning_ko && v.meaning_en && <span className="sub">{v.meaning_en}</span>}
    </span>
  );
}
