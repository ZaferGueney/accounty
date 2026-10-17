import { Html, Head, Main, NextScript } from 'next/document';

// Applies the saved theme before first paint so dark mode never flashes white.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.add(t)}catch(e){}})();`;

export default function Document() {
  return (
    <Html>
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
