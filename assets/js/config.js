/* =========================================================
   Настройки радио
   Меняйте только этот файл, если ссылки обновятся.
   ========================================================= */

window.SOTG_CONFIG = {
  // Прямая ссылка на поток Shoutcast.
  streamUrl: "http://178.32.146.184:6660/stream",

  // Публичная статистика Shoutcast: название трека, битрейт, слушатели.
  // Сайт забирает её через JSONP (callback=...), поэтому CORS не нужен.
  metadataUrl: "http://178.32.146.184:6660/stats?sid=1&json=1",
  metadataType: "shoutcast",

  // Запасная ссылка, если прямой поток не открывается.
  fallbackPlayerUrl: "http://178.32.146.184:6660/stream",

  stationName: "S0uNd5 0f 7he Gr0unD",
  defaultTrack: "S0uNd5 0f 7he Gr0unD — эфир 24/7",
  defaultVolume: 0.8
};
