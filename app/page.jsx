import Extractor from "./Extractor.jsx";

// AI 분석은 서버에 GEMINI_API_KEY 가 있을 때만 보여준다. 키 값 자체는 브라우저로 보내지 않는다.
export default function Page() {
  return <Extractor aiAvailable={Boolean(process.env.GEMINI_API_KEY)} />;
}
