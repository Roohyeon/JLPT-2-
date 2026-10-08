# JLPT 단어·문법 추출기

일본어 기사를 붙여넣고 원하는 **JLPT 레벨(N5~N1)** 을 고르면, AI(Google Gemini)가 그 레벨의 단어와 문법을 골라 카드로 보여주는 웹앱입니다.

👉 **바로 사용하기:** https://roohyeon.github.io/JLPT-2-/

- 단어: 표기 · 후리가나 · 레벨 · 품사 · 한국어 뜻 · 기사 속 원문 문장
- 문법: 패턴 · 레벨 · 한국어 의미 · 접속/뉘앙스 설명 · 기사 속 원문 문장
- 레벨은 AI의 추정치입니다. (2010년 이후 JLPT 공식 어휘 목록은 공개되지 않음)

## API 키

이 앱은 서버 없이 브라우저에서 바로 Gemini를 호출합니다. 그래서 **사용자가 자신의 Gemini API 키를 화면에 입력**해야 합니다.

- 키 발급(무료): https://aistudio.google.com/apikey
- 입력한 키는 내 브라우저(localStorage)에만 저장되고, Google 외에는 어디에도 전송되지 않습니다.
- 공용 PC에서는 "이 브라우저에 기억하기"를 해제하거나, 사용 후 "키 삭제"를 누르세요.

## 기술 스택

- React 18 + Vite
- `@google/genai` (Gemini SDK, 브라우저에서 직접 호출)
- GitHub Actions → GitHub Pages 자동 배포

## 구조

```
src/
  JLPT.jsx            앱 시작점
  App.jsx             API 키 입력, 레벨 선택, 결과 카드
  lib/
    gemini.js         Gemini 호출 (모델 이름은 여기서 변경)
    jlptSchema.js     결과 JSON 형식, 추출 지시문
.github/workflows/
  deploy.yml          main 에 push 하면 자동 빌드 & Pages 배포
```

## 로컬에서 실행

```bash
npm install
npm run dev
```

http://localhost:5173 접속 후 화면에서 API 키를 입력하세요.

## 배포

`main` 브랜치에 push 하면 GitHub Actions 가 자동으로 빌드해서 Pages 에 올립니다.
처음 한 번만 저장소 **Settings → Pages → Source** 를 **GitHub Actions** 로 바꿔주세요.
