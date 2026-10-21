import "./globals.css";

export const metadata = {
  title: "JLPT 단어·문법 추출기",
};

// 신문 느낌을 내는 글꼴: 제호는 블랙레터·디도체, 본문은 명조(세리프).
const FONTS =
  "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400;1,600" +
  "&family=Playfair+Display:ital,wght@0,900;1,700&family=UnifrakturMaguntia" +
  "&family=Noto+Serif+JP:wght@400;600&family=Noto+Serif+KR:wght@400;600&display=swap";

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
