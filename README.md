# JLPT 단어·문법 추출기

## 서비스 이름

**JLPT 단어·문법 추출기**

일본어 기사를 넣고 원하는 **JLPT 레벨(N5~N1)** 을 고르면, 기사 속에서 그 레벨의 단어와 문법을 표시해 주고, 누르면 뜻을 보여주는 웹앱입니다.

## 서비스 목적

- **실제 일본어 기사로 JLPT 공부하기**: 교재 예문이 아니라 오늘 나온 뉴스 속 단어와 문법을 내 레벨에 맞춰 골라 봅니다.
- **한국인 학습자 기준으로 정리하기**: 단어는 읽기(후리가나)·품사·한국어 뜻을, 문법은 한국어 의미와 접속 설명을 보여 줍니다. 기사를 읽다가 모르는 곳을 누르면 그 자리에서 뜻이 나옵니다.
- **키나 비용 없이 누구나 쓰기**: AI API 없이 공개 사전 데이터만으로 동작해서, 회원가입이나 API 키 발급 없이 바로 쓸 수 있습니다.

## 이용 방법

1. **기사 넣기** (둘 중 하나)
   - **오늘의 NHK 뉴스**: 분야 탭(주요·사회·생활·과학·문화·정치·경제·국제·스포츠)을 고르고 뉴스를 누르면 제목과 요약을 **바로 분석**해 보여 줍니다.
     기사 전체로 분석하려면 함께 나오는 **원문** 링크에서 본문을 복사해 「직접 붙여넣기」에 넣으세요.
   - **직접 붙여넣기**: 어떤 일본어 기사든 입력칸에 붙여넣으면 됩니다. (최대 8000자)
2. **레벨 고르기**: N5~N1 중 원하는 레벨을 여러 개 선택합니다 (맨 위 레벨 줄). 기사를 보는 중에 레벨을 바꾸면 바로 다시 분석합니다.
3. **「단어·문법 추출」** 을 누르면 기사 본문이 나오고, 고른 레벨의 단어·문법이 표시됩니다.
   - **단어**는 레벨 색 밑줄, **문법**은 주황 배경으로 표시됩니다. 누르면 그 자리에 뜻이 열리고, 다시 누르면 닫힙니다.
   - 단어: 읽기·한국어 뜻·영어 뜻·레벨·품사 / 문법: 패턴·한국어 의미·접속 설명·레벨
   - 「추정」: JLPT 단어 목록에 없어서 한자 레벨로 추정한 단어
   - 「기계 번역」: 사전에 한국어 뜻이 없어 Chrome 내장 번역으로 채운 뜻 (영어 뜻은 아래에 함께 표시)
4. **한국어 번역**: 기사의 문단마다 바로 밑에 한국어 번역이 나옵니다. 「한국어 숨기기」로 가릴 수 있습니다. (Chrome 138+ 데스크톱)

### 어떻게 찾나요

| | 방식 |
|---|---|
| 단어 | 형태소 분석으로 기사를 단어로 나눈 뒤(활용형은 사전형으로) 사전에서 찾습니다 |
| 단어 레벨 | JLPT 단어 목록(약 7,800개) 기준. 목록에 없으면 단어 속 가장 어려운 한자의 레벨로 추정 |
| 단어 뜻 | 한국어 위키낱말사전 → 없으면 Chrome 내장 번역 → 그것도 안 되면 영어 |
| 문법 | 규칙 기반 (약 150개 패턴, 한국어 의미·접속 설명) |

- 문법은 `lib/grammarPatterns.js` 에 직접 정리한 패턴으로 찾습니다. 규칙에 없는 문법은 찾지 못하고 가끔 잘못 잡을 수 있습니다.
  패턴은 목록에 한 줄씩 추가할 수 있습니다.
- 2010년 이후 JLPT 공식 어휘 목록은 공개되지 않아, 레벨은 참고용입니다.

## API 사용 내역

**키가 필요하거나 비용이 드는 외부 API는 쓰지 않습니다.**

| 이름 | 무엇인가 | 키·비용 | 언제 쓰나 |
|---|---|---|---|
| `/api/extract` | 이 앱 안의 서버 코드 (Next.js Route Handler). 입력 검사 후 사전 데이터로 분석 | 없음 | 「단어·문법 추출」을 누를 때 |
| `/api/news` | 이 앱 안의 서버 코드. NHK RSS 를 대신 가져와 목록으로 돌려줌 | 없음 | 「오늘의 NHK 뉴스」를 열 때 |
| NHK 공식 RSS (`news.web.nhk/n-data/conf/na/rss/cat0~7.xml`) | NHK 가 공개한 뉴스 피드. 제목·요약·링크만 제공 | 없음 | `/api/news` 가 호출 (10분 캐시) |
| [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api) | Chrome 에 내장된 기기 안 번역 기능 (Chrome 138+ 데스크톱) | 없음 | 한국어 뜻이 없는 단어가 있을 때, 「기사 번역」을 펼쳤을 때 브라우저에서 호출 |

### API 를 이렇게 썼습니다

- **NHK 뉴스는 공개 RSS 만 씁니다.** NHK RSS 는 브라우저에서 직접 부를 수 없어서(CORS) 서버(`/api/news`)가 대신 가져오고,
  NHK 서버에 부담을 주지 않도록 10분 동안 캐시합니다. 기사 전문은 NHK 로그인 토큰이 있어야 받을 수 있어서 자동으로 가져오지 않습니다.
  예전에 쓰이던 `www3.nhk.or.jp/news/easy/news-list.json` 은 지금 `news.web.nhk` 로 이동되며 JWT 토큰을 요구(401)해서 쓰지 않습니다.
  같은 이유로 [nhk-easy-api](https://github.com/nhk-news-web-easy/nhk-easy-api) 도 쓰지 않습니다.
- **단어·문법 분석은 API 호출 없이 서버 안에서 끝납니다.** 형태소 분석기 [kuromoji](https://github.com/takuyaa/kuromoji.js),
  사전 데이터 파일(`data/jlpt-dictionary.json`), 문법 규칙(`lib/grammarPatterns.js`)이 모두 서버에 들어 있습니다.
  사전 데이터는 개발할 때 한 번 내려받아 만든 것이고, 서비스 중에는 외부에서 다시 받지 않습니다.
- **Chrome 번역은 사용자 브라우저 안에서 돌아갑니다.** 서버나 외부로 단어·기사를 보내지 않습니다.
  단어 번역과 기사 번역은 번역기 하나를 같이 씁니다. 처음 한 번은 Chrome 이 번역 모델을 내려받고,
  지원하지 않는 브라우저(Firefox, Safari, 모바일)에서는 영어 뜻을 그대로 보여 줍니다.

### 사용한 공개 데이터

| 자료 | 쓰는 부분 | 라이선스 |
|---|---|---|
| [AnchorI/jlpt-kanji-dictionary](https://github.com/AnchorI/jlpt-kanji-dictionary) | 읽기, 영어 뜻, 한자별 JLPT 레벨 | MIT |
| [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) (tanos.co.uk 기반) | 단어별 JLPT 레벨 | MIT |
| [한국어 위키낱말사전](https://ko.wiktionary.org/) 일본어 항목 ([kaikki.org](https://kaikki.org/kowiktionary/) 추출본) | 한국어 뜻 | CC BY-SA |

자세한 출처와 라이선스는 `data/NOTICE.md` 를 보세요.

## 기술 스택

- Next.js (App Router) + React
- `kuromoji` (형태소 분석)

## 구조

```
app/
  layout.jsx              공통 레이아웃
  page.jsx                화면 (뉴스, 레벨 선택, 단어·문법을 누를 수 있는 기사, 기사 번역)
  globals.css
  api/extract/route.js    서버 API: 입력 검사, 단어·문법 분석
  api/news/route.js       서버 API: NHK RSS 뉴스 목록
lib/
  dictionary.js           단어·문법 분석
  grammarPatterns.js      문법 규칙 목록
  news.js                 NHK RSS 가져오기 (10분 캐시)
  levels.js               JLPT 레벨 목록
data/
  jlpt-dictionary.json    사전 데이터 (scripts/build-dictionary.mjs 로 생성)
  NOTICE.md               데이터 출처·라이선스
scripts/
  build-dictionary.mjs    공개 자료 세 가지를 합쳐 사전 데이터를 만드는 스크립트
```

## 로컬에서 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에 접속하세요. 따로 설정할 키는 없습니다.

## 배포

서버 코드가 있어서 **GitHub Pages 로는 배포할 수 없습니다.** Vercel 을 추천합니다.

1. https://vercel.com 에서 이 GitHub 저장소를 Import 후 Deploy (환경변수 설정 필요 없음)
2. 이후 `main` 에 push 하면 자동 배포

## 사전 데이터 다시 만들기

```bash
git clone --depth 1 https://github.com/AnchorI/jlpt-kanji-dictionary.git ../jlpt-kanji-dictionary
git clone --depth 1 https://github.com/elzup/jlpt-word-list.git ../jlpt-word-list
curl -L -o ../ko-wiktionary-ja.jsonl "https://kaikki.org/kowiktionary/%EC%9D%BC%EB%B3%B8%EC%96%B4/kaikki.org-dictionary-%EC%9D%BC%EB%B3%B8%EC%96%B4.jsonl"
node scripts/build-dictionary.mjs ../jlpt-kanji-dictionary ../jlpt-word-list ../ko-wiktionary-ja.jsonl
```
