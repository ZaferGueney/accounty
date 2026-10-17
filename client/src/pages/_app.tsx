import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Commissioner } from 'next/font/google';
import { appWithTranslation } from 'next-i18next';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import '../styles/globals.css';

// Commissioner: a Greek-designed sans with full Greek coverage and tabular figures.
const sans = Commissioner({
  subsets: ['latin', 'latin-ext', 'greek'],
  variable: '--font-sans',
  display: 'swap',
});

function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>BillMou</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#f6f5f1" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#111110" media="(prefers-color-scheme: dark)" />
      </Head>
      {/* Expose the font variable on <html> so portals (modals, toasts) inherit it */}
      <style jsx global>{`
        :root {
          --font-sans: ${sans.style.fontFamily};
        }
      `}</style>
      <Provider store={store}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <Component {...pageProps} />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </Provider>
    </>
  );
}

export default appWithTranslation(App);
