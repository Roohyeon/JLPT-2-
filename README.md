# JLPT N2 단어·문법 추출기

일본어 기사를 붙여넣으면 AI가 **JLPT N2 수준의 한자 단어와 문법 표현**만 골라 카드로 보여주는 웹앱입니다.

- 단어: 한자 · 후리가나 · 품사 · 한국어 뜻 · 기사 속 원문 문장
- 문법: 패턴 · 한국어 의미 · 접속/뉘앙스 설명 · 기사 속 원문 문장

## 기술 스택

- **프론트엔드:** React 18 + Vite
- **백엔드:** Express (API 키를 브라우저에 노출하지 않기 위한 프록시 서버)
- **AI:** Google Gemini (기본, 무료 사용량 있음) 또는 Claude API

## 구조

```
server/
  index.js              API 서버 (/api/extract)
  n2Tool.js             추출 결과 JSON 스키마
  extractors/
    gemini.js           Gemini로 추출 (GEMINI_API_KEY 가 있으면 사용)
    claude.js           Claude로 추출 (ANTHROPIC_API_KEY 만 있으면 사용)
    common.js           공통 프롬프트, 에러 타입
src/
  App.jsx               입력 화면 + 결과 카드
scripts/
  list-gemini-models.js 내 키로 쓸 수 있는 Gemini 모델 목록
  try-extract.js        브라우저 없이 추출 테스트
```

## 실행 방법

1. [Node.js](https://nodejs.org) LTS 설치
2. 패키지 설치

   ```bash
   npm install
   ```

3. `.env.example` 을 복사해 `.env` 를 만들고 API 키 입력
   - Gemini 키: https://aistudio.google.com/apikey
4. 개발 서버 실행 후 http://localhost:5173 접속

   ```bash
   npm run dev
   ```

> `.env` 에는 실제 키가 들어가므로 절대 커밋하지 마세요. (`.gitignore` 에 포함되어 있습니다)
