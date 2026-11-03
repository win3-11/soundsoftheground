/**
 * HTTPS-прокси для потока Shoutcast.
 *
 * Нужен только если сайт открывается по HTTPS: браузер блокирует
 * http-аудио как mixed content. Локально (file:// или http://) прокси
 * не требуется.
 *
 * Как развернуть в Cloudflare Workers:
 * 1. Workers & Pages → Create application → Start with Hello World! → Deploy.
 * 2. Edit code → заменить содержимое worker.js этим файлом → Deploy.
 * 3. Получить адрес вида https://sotg-stream.<аккаунт>.workers.dev.
 * 4. Прописать его в assets/js/config.js.
 *
 * Если поток переедет на другой сервер, поменяйте ORIGIN ниже.
 */

// Cloudflare Workers не делают fetch по IP-адресу — только по домену.
// Поэтому используем PTR-имя сервера, оно резолвится в тот же 178.32.146.184.
const ORIGIN = "http://ip184.ip-178-32-146.eu:6660";

// Заголовки, которые полезно сохранить при проксировании.
//
// icy-metaint обязателен: если Shoutcast вставляет блоки метаданных в поток,
// браузер должен узнать их размер, иначе он примет служебные байты за звук
// и воспроизведение начнёт «икать» и останавливаться.
const PASS_HEADERS = [
  "content-type",
  "icy-name",
  "icy-genre",
  "icy-br",
  "icy-sr",
  "icy-metaint"
];

// Значения по умолчанию, если сервер их не прислал.
const FALLBACK_HEADERS = {
  "icy-name": "soundsoftheground",
  "icy-genre": "Hardcore",
  "icy-br": "96"
};

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

    let upstream;
    try {
      upstream = await fetch(ORIGIN + url.pathname + url.search, {
        method: request.method,
        headers: {
          "User-Agent": "S0uNd5-0f-7he-Gr0unD/1.0",
          // Метаданные сайт берёт из /stats (JSONP), поэтому просим у сервера
          // чистый звук без служебных вставок внутри потока.
          "Icy-MetaData": "0",
          "Accept": "*/*"
        },
        redirect: "follow"
      });
    } catch (err) {
      return new Response("Stream origin is unreachable", {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    const headers = new Headers();
    PASS_HEADERS.forEach(function (name) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    });

    Object.keys(FALLBACK_HEADERS).forEach(function (name) {
      if (!headers.has(name)) headers.set(name, FALLBACK_HEADERS[name]);
    });

    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "no-store");
    if (!headers.has("Content-Type")) headers.set("Content-Type", "audio/mpeg");

    // JSONP: Shoutcast отдаёт callback-ответ как application/json.
    // Для <script> надёжнее явный JavaScript-тип.
    if (url.pathname === "/stats" && url.searchParams.has("callback")) {
      headers.set("Content-Type", "application/javascript; charset=utf-8");
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: headers
    });
  }
};
