import "./globals.css";

export const metadata = {
  title: "JLPT 단어·문법 추출기",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
