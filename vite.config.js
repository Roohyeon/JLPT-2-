import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // React에서 fetch("/api/...")를 부르면 Express 서버(3001)로 전달된다.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
