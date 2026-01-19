const CACHE_NAME = "adding-calculator-pro-v1.2.0";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-maskable-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

self.addEventListener("activate", e => {
  self.clients.claim();
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      return (
        cachedResponse ||
        fetch(e.request).catch(() => {
          if (e.request.mode === "navigate") {
            return new Response(
              `<!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline</title>
                <style>
                  body { background: #1f1f1f; color: #eee; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                  h1 { font-size: 24px; margin-bottom: 10px; }
                  p { color: #aaa; }
                  button { background: #4caf50; border: none; padding: 10px 20px; color: white; border-radius: 5px; font-size: 16px; margin-top: 20px; cursor: pointer; }
                </style>
              </head>
              <body>
                <h1>You are Offline</h1>
                <p>You have cleared all cache and reset the app</p>
                <p>Please connect internet to load latest version.</p>
                <button onclick="window.location.reload()">Reload</button>
              </body>
              </html>`,
              {
                headers: { "Content-Type": "text/html" }
              }
            );
          }
        })
      );
    })
  );
});
