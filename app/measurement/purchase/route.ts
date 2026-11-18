// Standalone document: the Next layout, private receipt, query string, and all
// other marketing destinations are deliberately outside this tag's document.
export function GET() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Payment receipt | DocketStamp</title>
<style>body{font:1rem/1.5 system-ui;color:#0f172a;max-width:36rem;margin:12vh auto;padding:1.5rem}a{color:#075985}</style>
</head><body><h1>Opening your order record</h1><p><a id="continue" href="/">Continue to DocketStamp</a></p>
<script src="/google-purchase-receipt.js"></script></body></html>`, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none'",
  } });
}
