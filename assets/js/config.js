/* =========================================================
   Настройки радио
   Меняйте только этот файл, если ссылки обновятся.
   ========================================================= */

window.SOTG_CONFIG = {
  // HTTPS-прокси (Cloudflare Worker) — нужен, потому что GitHub Pages
  // открывается по HTTPS, а сам поток отдаётся только по HTTP.
  // Код прокси: deploy/cloudflare-worker.js
  streamUrl: "https://sotg-stream.vadym1608.workers.dev/stream",

  // Публичная статистика Shoutcast: название трека, битрейт, слушатели.
  // Сайт забирает её через JSONP (callback=...), поэтому CORS не нужен.
  metadataUrl: "https://sotg-stream.vadym1608.workers.dev/stats?sid=1&json=1",
  metadataType: "shoutcast",

  // История эфира (последние ~10 треков). Тот же воркер, обычный fetch:
  // воркер уже отдаёт Access-Control-Allow-Origin: *.
  playedUrl: "https://sotg-stream.vadym1608.workers.dev/played?sid=1&type=json",

  // Запасная ссылка, если прямой поток не открывается.
  fallbackPlayerUrl: "https://sotg-stream.vadym1608.workers.dev/stream",

  stationName: "S0uNd5 0f 7he Gr0unD",
  defaultTrack: "S0uNd5 0f 7he Gr0unD — эфир 24/7",
  defaultVolume: 0.8
};
