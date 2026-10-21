"use client";

import { useEffect, useState } from "react";
import { JLPT_LEVELS as LEVELS } from "../lib/levels.js";
import { NEWS_CATEGORIES } from "../lib/news.js";

// Chrome 내장 번역(Translator API, 일본어 → 한국어). 내 컴퓨터 안에서 돌아가서 키도 비용도 없다.
// 번역기는 한 번 만들어 단어 번역과 기사 번역이 같이 쓴다. 지원하지 않는 브라우저면 null.
const TRANSLATE_OPTIONS = { sourceLanguage: "ja", targetLanguage: "ko" };
let translatorPromise;
let onDownloadProgress; // 모델 다운로드 진행률을 지금 보고 있는 화면에 알린다.

// 처음 한 번은 번역 모델을 내려받는데, 이때 사용자 클릭이 필요해서 클릭 핸들러에서 먼저 불러 둔다.
function getTranslator() {
  if (typeof self === "undefined" || !("Translator" in self))
    return Promise.resolve(null);
  translatorPromise ??= (async () => {
    if ((await Translator.availability(TRANSLATE_OPTIONS)) === "unavailable")
      return null;
    return Translator.create({
      ...TRANSLATE_OPTIONS,
      monitor: (m) =>
        m.addEventListener("downloadprogress", (e) =>
          onDownloadProgress?.(e.loaded),
        ),
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

// 기사 문단(줄)마다 한국어 번역을 만든다. 끝나는 대로 하나씩 채운다.
function useParagraphTranslation(article) {
  const [translations, setTranslations] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | unsupported | error
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!article) return;
    let cancelled = false;
    setTranslations([]);
    setStatus("loading");
    setProgress(null);
    onDownloadProgress = (loaded) => !cancelled && setProgress(loaded);

    (async () => {
      try {
        const translator = await getTranslator();
        if (cancelled) return;
        if (!translator) return setStatus("unsupported");
        for (const line of article
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)) {
          const ko = await translator.translate(line);
          if (cancelled) return;
          setTranslations((prev) => [...prev, ko]);
        }
        setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [article]);

  return { translations, status, progress };
}

export default function Page() {
  const [article, setArticle] = useState("");
  const [picked, setPicked] = useState(null); // 불러온 NHK 뉴스 { title, summary, link }
  const [levels, setLevels] = useState(["N3", "N2", "N1"]);
  const [result, setResult] = useState(null); // { vocabulary, grammar, paragraphs, article }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [today, setToday] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false); // 직접 붙여넣기는 접어 두고 필요할 때 연다

  // 날짜는 서버 렌더와 어긋나지 않게 브라우저에서 채운다.
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }),
    );
  }, []);

  // 레벨을 바꾸면 보고 있던 기사를 그 레벨로 다시 분석한다.
  function toggleLevel(level) {
    const next = levels.includes(level)
      ? levels.filter((l) => l !== level)
      : [...levels, level];
    setLevels(next);
    if (result && next.length > 0) analyze(result.article, next);
  }

  async function analyze(text, targetLevels = levels) {
    if (!text || targetLevels.length === 0) return;
    getTranslator().catch(() => {}); // 클릭한 순간에 번역 모델 준비를 시작한다.
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await requestExtract({
        article: text,
        levels: targetLevels,
      });
      setResult({ ...data, article: text });
      translateMissing(data.vocabulary, (word, ko) =>
        setResult((prev) => ({
          ...prev,
          vocabulary: prev.vocabulary.map((v) =>
            v.word === word
              ? { ...v, meaning_ko: ko, machine_translated: true }
              : v,
          ),
        })),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // RSS 에는 요약만 있어서 제목 + 요약을 넣고 바로 분석한다. 전문은 원문에서 붙여넣도록 안내한다.
  function pickNews(item) {
    const text = `${item.title}\n${item.summary.replace(/…$/, "")}`;
    setArticle(text);
    setPicked(item);
    analyze(text);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setPicked(null);
    analyze(article.trim());
  }

  return (
    <main className="paper">
      <header className="masthead">
        <div className="mast-top">
          <span className="mast-side">TOKYO, JP</span>
          <div className="mast-center">
            <span className="edition">SPECIAL EDITION</span>
            <span className="series">
              <i>✻</i> Daily Reading <i>✻</i>
            </span>
          </div>
          <span className="mast-side right">{today}</span>
        </div>
        <h1 className="mast-title">JLPT TIMES</h1>
      </header>

      <section className="levels-row">
        <fieldset className="levels">
          <legend className="sr-only">추출할 레벨</legend>
          {LEVELS.map((level) => (
            <label
              key={level}
              className={`level-chip ${levels.includes(level) ? "on" : ""}`}
            >
              <input
                type="checkbox"
                checked={levels.includes(level)}
                onChange={() => toggleLevel(level)}
              />
              <span className="level-name">{level}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="box">
        <h3 className="box-title">TODAY&apos;S NHK NEWS</h3>
        <NewsPicker onPick={pickNews} activeLink={picked?.link} />
      </section>

      <section className="box article-box">
        <div className="headline">
          <span className="drop">読</span>
          <h2 lang={picked ? "ja" : undefined}>
            {picked
              ? picked.title
              : result
                ? "직접 붙여넣은 기사"
                : "THE NEWS THAT NEVER SLEEPS"}
          </h2>
        </div>
        <div className="article-body">
          {loading && <p className="empty">분석 중…</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && !result && (
            <p className="empty">
              위에서 NHK 뉴스를 고르면 바로 단어·문법을 찾아 기사와 한국어
              번역을 보여 드려요.
            </p>
          )}
          {result && (
            <ArticleReader
              article={result.article}
              paragraphs={result.paragraphs}
              vocabulary={result.vocabulary}
              grammar={result.grammar}
            />
          )}
          {result && picked && (
            <p className="hint">
              NHK 뉴스의 제목과 요약만 분석했어요. 기사 전체로 보려면{" "}
              <a href={picked.link} target="_blank" rel="noreferrer">
                원문
              </a>
              에서 본문을 복사해 아래 「Paste your own」에 넣어 주세요.
            </p>
          )}
        </div>
      </section>

      <form
        className={`box paste ${pasteOpen ? "" : "closed"}`}
        onSubmit={handleSubmit}
      >
        <h3 className="box-title">
          <button
            type="button"
            className="box-toggle"
            onClick={() => setPasteOpen(!pasteOpen)}
            aria-expanded={pasteOpen}
          >
            PASTE YOUR OWN
            <span className="caret" aria-hidden="true">
              {pasteOpen ? "▲" : "▼"}
            </span>
          </button>
        </h3>
        {pasteOpen && (
          <>
            <textarea
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder="일본어 기사를 붙여넣으세요… (최대 8000자)"
              rows={7}
            />
            <button
              type="submit"
              disabled={loading || !article.trim() || levels.length === 0}
            >
              {loading ? "분석 중…" : "단어·문법 추출"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

function NewsPicker({ onPick, activeLink }) {
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
    <>
      <div className="news-tabs">
        {NEWS_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`tab ${category === c.id ? "on" : ""}`}
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
              <button
                type="button"
                className={`news-item ${activeLink === item.link ? "on" : ""}`}
                onClick={() => onPick(item)}
              >
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function LevelBadge({ level }) {
  return <span className={`badge badge-${level}`}>{level}</span>;
}

// 기사 본문을 문단마다 보여주고, 바로 밑에 한국어 번역을 붙인다.
// 뽑은 단어·문법을 누르면 그 자리에서 뜻이 열린다. 다시 누르면 닫힌다.
// 브라우저 내장 음성(Web Speech API)으로 일본어 문단을 읽어 준다. 키도 비용도 없다.
// 한 번에 한 문단만 읽고, 읽는 중인 문단을 다시 누르면 멈춘다.
function useSpeech() {
  const [speakingIndex, setSpeakingIndex] = useState(null);

  // 화면을 떠나거나 기사가 바뀌면 읽던 것을 멈춘다.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function speak(index, text) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    if (speakingIndex === index) return setSpeakingIndex(null);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").startsWith("ja"));
    if (voice) utterance.voice = voice;
    utterance.onend = utterance.onerror = () =>
      setSpeakingIndex((current) => (current === index ? null : current));
    setSpeakingIndex(index);
    synth.speak(utterance);
  }

  return { speakingIndex, speak };
}

function SpeakButton({ speaking, onSpeak }) {
  return (
    <button
      type="button"
      className={`speak ${speaking ? "on" : ""}`}
      onClick={onSpeak}
      aria-label={speaking ? "읽기 멈추기" : "일본어로 읽어 주기"}
      title={speaking ? "읽기 멈추기" : "일본어로 읽어 주기"}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {speaking ? (
          <path d="M16 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        ) : (
          <path
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>
    </button>
  );
}

function ArticleReader({ article, paragraphs, vocabulary, grammar }) {
  const [openKey, setOpenKey] = useState(null);
  const [showKo, setShowKo] = useState(true);
  const { translations, status, progress } = useParagraphTranslation(article);
  const { speakingIndex, speak } = useSpeech();
  const byWord = new Map(vocabulary.map((v) => [v.word, v]));
  const byPattern = new Map(grammar.map((g) => [g.pattern, g]));
  const empty = vocabulary.length === 0 && grammar.length === 0;

  return (
    <>
      <div className="reader-head">
        <p className="sub">
          {empty
            ? "선택한 레벨의 단어·문법을 찾지 못했습니다."
            : "밑줄 친 단어, 색칠한 문법을 누르면 뜻이 나와요."}
        </p>
        {status !== "unsupported" && (
          <button
            type="button"
            className="toggle"
            onClick={() => setShowKo(!showKo)}
            aria-pressed={showKo}
          >
            {showKo ? "한국어 숨기기" : "한국어 보기"}
          </button>
        )}
      </div>

      {paragraphs.map((segments, p) => (
        <div key={p} className="para">
          <p className="reader-text">
            <SpeakButton
              speaking={speakingIndex === p}
              onSpeak={() => speak(p, segments.map((seg) => seg.text).join(""))}
            />
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
                  {open &&
                    (g ? <GrammarPopover g={g} /> : <WordPopover v={v} />)}
                </span>
              );
            })}
          </p>
          {showKo && translations[p] && <p className="ko">{translations[p]}</p>}
          {showKo && status === "loading" && translations.length === p && (
            <p className="ko pending">
              {progress !== null && progress < 1
                ? `번역 모델 내려받는 중… ${Math.round(progress * 100)}%`
                : "번역 중…"}
            </p>
          )}
        </div>
      ))}

      {status === "unsupported" && (
        <p className="sub">
          이 브라우저는 내장 번역을 지원하지 않아요. Chrome 138
          이상(데스크톱)에서 한국어 번역을 볼 수 있어요.
        </p>
      )}
      {status === "error" && (
        <p className="error">번역하지 못했어요. 뉴스를 다시 눌러 주세요.</p>
      )}
      {showKo && status === "done" && (
        <p className="sub">
          한국어는 Chrome 내장 번역으로 기계 번역한 내용이에요.
        </p>
      )}
    </>
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
            <span
              className="tag"
              title="JLPT 단어 목록에 없어 한자 레벨로 추정했어요"
            >
              추정
            </span>
          )}
          {v.part_of_speech && <span className="tag">{v.part_of_speech}</span>}
        </span>
      </span>
      <span className="meaning">
        {v.meaning_ko ?? v.meaning_en}
        {v.machine_translated && <span className="sub"> (기계 번역)</span>}
      </span>
      {v.meaning_ko && v.meaning_en && (
        <span className="sub">{v.meaning_en}</span>
      )}
    </span>
  );
}
