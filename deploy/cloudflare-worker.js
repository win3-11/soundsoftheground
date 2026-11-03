/**
 * HTTPS-прокси для потока Shoutcast.
 *
 * Нужен только если сайт открывается по HTTPS: браузер блокирует
 * http-аудио как mixed content. Локально (file:// или http://) прокси
 * не требуется.
 *
 * Как развернуть в Cloudflare Workers:
 * 1. dash.cloudflare.com → Workers & Pages → Create Worker.
 * 2. Вставьте этот файл целиком и нажмите Deploy.
 * 3. Получите адрес вида https://sotg-stream.<аккаунт>.workers.dev.
 * 4. Пропишите его в assets/js/config.js:
 *      streamUrl: "https://sotg-stream.<аккаунт>.workers.dev/stream"
 *      metadataUrl: "https://sotg-stream.<аккаунт>.workers.dev/stats?sid=1&json=1"
 *      fallbackPlayerUrl: "https://sotg-stream.<аккаунт>.workers.dev/stream"
 *
 * Если поток переедет на другой сервер, поменяйте ORIGIN ниже.
 */

const ORIGIN = "http://178.32.146.184:6660";

// Заголовки, которые полезно сохранить при проксировании.
const PASS_HEADERS = [
  "content-type",
  "icy-name",
  "icy-genre",
  "icy-br",
  "icy-sr"
];

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("S0uNd5 0f 7he Gr0unD — stream proxy", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const upstream = await fetch(ORIGIN + url.pathname + url.search, {
      method: request.method,
      headers: {
        "User-Agent": "S0uNd5-0f-7he-Gr0unD/1.0",
        "Icy-MetaData": "1",
        "Accept": "*/*"
      },
      redirect: "follow"
    });

    const headers = new Headers();
    PASS_HEADERS.forEach(function (name) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    });

    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "no-store");
    if (!headers.has("Content-Type")) headers.set("Content-Type", "audio/mpeg");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: headers
    });
  }
};
