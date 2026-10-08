import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 빌드 결과물의 경로를 상대 경로로 만든다.
  // GitHub Pages 주소(https://roohyeon.github.io/JLPT-2-/)처럼 하위 폴더에 올려도 파일을 찾을 수 있다.
  base: "./",
});
