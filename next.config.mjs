/** @type {import('next').NextConfig} */
const nextConfig = {
  // kuromoji 는 사전 파일을 디스크에서 읽어서 번들하지 않고 그대로 쓴다.
  serverExternalPackages: ["kuromoji"],
  // 배포(Vercel 등) 시 kuromoji 사전과 JLPT 사전 파일도 함께 올라가도록 한다.
  outputFileTracingIncludes: {
    "/api/extract": ["./node_modules/kuromoji/dict/**", "./data/**"],
  },
};

export default nextConfig;
