# JLPT 단어·문법 추출기

일본어 기사를 붙여넣고 원하는 **JLPT 레벨(N5~N1)** 을 고르면, 그 레벨의 단어와 문법을 골라 카드로 보여주는 웹앱입니다.

## 기사 넣기

- **오늘의 NHK 뉴스**: NHK 공식 RSS 에서 분야별 최신 뉴스를 불러옵니다. 누르면 제목 + 요약이 입력칸에 들어갑니다.
  RSS 에는 요약(100자 안팎)만 있고, 기사 전문은 NHK 로그인 토큰이 있어야 받을 수 있어서 자동으로 가져오지 않습니다.
  전문으로 분석하려면 원문 링크에서 본문을 복사해 붙여넣으세요.
- **직접 붙여넣기**: 어떤 일본어 기사든 입력칸에 붙여넣으면 됩니다.

> 예전에 쓰이던 `www3.nhk.or.jp/news/easy/news-list.json` 은 지금 `news.web.nhk` 로 이동되며 JWT 토큰을 요구(401)해서 쓸 수 없습니다.

## 분석 방식 두 가지

**기본은 사전 모드이고, Google AI Studio(Gemini) 키 없이 동작합니다.** AI 분석은 서버에 키를 넣었을 때만 화면에 나타나는 선택 기능입니다.

| | 사전 모드 (기본, AI 없음) | AI 분석 (선택) |
|---|---|---|
| 단어 레벨 | JLPT 단어 목록(약 7,800개) 기준. 목록에 없으면 한자 레벨로 추정(「추정」 표시) | AI 추정 |
| 단어 뜻 | 한국어 위키낱말사전 → 없으면 Chrome 내장 번역 → 그것도 안 되면 영어 | 한국어 |
| 문법 | 규칙 기반 (약 150개 패턴, 한국어 설명) | AI 가 찾음 |
| 비용·제한 | 무료, 제한 없음 | Gemini 사용량, IP 당 한 시간 20회 |

- 형태소 분석은 [kuromoji](https://github.com/takuyaa/kuromoji.js) 를 서버에서 돌립니다.
- 한국어 뜻이 없는 단어는 브라우저의 [Translator API](https://developer.chrome.com/docs/ai/translator-api)
  (Chrome 138+ 데스크톱, 기기 안에서 번역)로 번역하고 「기계 번역」으로 표시합니다. 처음 한 번은 번역 모델을 내려받습니다.
- 사전 모드의 문법은 `lib/grammarPatterns.js` 에 직접 정리한 패턴으로 찾습니다.
  규칙에 없는 문법은 찾지 못하고 가끔 잘못 잡을 수 있습니다. 패턴은 목록에 한 줄씩 추가할 수 있습니다.
- 데이터 출처와 라이선스는 `data/NOTICE.md` 를 보세요.
- 2010년 이후 JLPT 공식 어휘 목록은 공개되지 않아, 어느 방식이든 레벨은 참고용입니다.

## API 키 보호 (AI 분석을 쓸 때만)

Gemini 키는 **서버 환경변수(`GEMINI_API_KEY`)** 에만 있고 브라우저로 전달되지 않습니다.
브라우저는 `/api/extract` 로 기사만 보내고, 서버(Next.js Route Handler)가 Gemini 를 호출합니다.
누구나 호출해 키 사용량을 소모하지 않도록 기사 길이(8000자)와 IP 당 호출 횟수를 제한합니다.

## 기술 스택

- Next.js (App Router) + React
- `@google/genai` (서버에서만 호출)
- `kuromoji` (사전 모드 형태소 분석)

## 구조

```
app/
  layout.jsx              공통 레이아웃
  page.jsx                서버에 키가 있는지 확인해 화면에 전달
  Extractor.jsx           화면 (뉴스, 분석 방식·레벨 선택, 결과 카드, Chrome 번역)
  globals.css
  api/extract/route.js    서버 API: 입력 검사, 호출 제한, 모드별 분석
  api/news/route.js       서버 API: NHK RSS 뉴스 목록
lib/
  gemini.js               Gemini 호출 (모델 이름은 여기서 변경)
  jlptSchema.js           결과 JSON 형식, 추출 지시문
  dictionary.js           사전 모드 분석 (단어 + 문법)
  grammarPatterns.js      사전 모드 문법 규칙 목록
  news.js                 NHK RSS 가져오기 (10분 캐시)
data/
  jlpt-dictionary.json    사전 모드 데이터 (scripts/build-dictionary.mjs 로 생성)
scripts/
  build-dictionary.mjs    원본 사전(60MB)을 필요한 부분만 남겨 줄이는 스크립트
```

## 로컬에서 실행

```bash
npm install
npm run dev
# AI 분석도 쓰려면: cp .env.example .env.local 후 GEMINI_API_KEY= 뒤에 키 입력
```

http://localhost:3000 에 접속하세요. 키 없이도 사전 모드로 바로 쓸 수 있습니다.

## 배포

서버 코드(API)가 있어서 **GitHub Pages 로는 배포할 수 없습니다.** Vercel 을 추천합니다.

1. https://vercel.com 에서 이 GitHub 저장소를 Import
2. (AI 분석을 쓸 때만) Settings → Environment Variables 에 `GEMINI_API_KEY` 추가 후 다시 배포
3. 이후 `main` 에 push 하면 자동 배포

## 사전 데이터 다시 만들기

```bash
git clone --depth 1 https://github.com/AnchorI/jlpt-kanji-dictionary.git ../jlpt-kanji-dictionary
git clone --depth 1 https://github.com/elzup/jlpt-word-list.git ../jlpt-word-list
curl -L -o ../ko-wiktionary-ja.jsonl "https://kaikki.org/kowiktionary/%EC%9D%BC%EB%B3%B8%EC%96%B4/kaikki.org-dictionary-%EC%9D%BC%EB%B3%B8%EC%96%B4.jsonl"
node scripts/build-dictionary.mjs ../jlpt-kanji-dictionary ../jlpt-word-list ../ko-wiktionary-ja.jsonl
```
