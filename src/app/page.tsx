// Kök adres (bahcelabs.com/) tarayıcı diline göre /tr, /en veya /es'e yönlendirir.
export default function RootPage() {
  const script = `(function(){var l=(navigator.languages&&navigator.languages[0]||navigator.language||'tr').slice(0,2).toLowerCase();var m={tr:'tr',en:'en',es:'es'};location.replace('/'+(m[l]||'tr')+'/');})();`;
  return (
    <html lang="tr">
      <head>
        <meta name="robots" content="noindex" />
        <link rel="canonical" href="https://bahcelabs.com/tr/" />
        <script dangerouslySetInnerHTML={{ __html: script }} />
      </head>
      <body>
        <noscript>
          <a href="/tr/">Türkçe</a> · <a href="/en/">English</a> · <a href="/es/">Español</a>
        </noscript>
      </body>
    </html>
  );
}
