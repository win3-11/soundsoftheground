/* =========================================================
   S0uNd5 0f 7he Gr0unD — player, metadata, UI
   ========================================================= */

(function () {
  "use strict";

  var CONFIG = window.SOTG_CONFIG || {};

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var doc = document;
  var body = doc.body;

  /* ---------------------------------------------
     Equalizer bars
     --------------------------------------------- */

  function buildEq() {
    $$("[data-eq]").forEach(function (el) {
      if (el.children.length) return;
      var isLarge = el.getAttribute("data-eq") === "lg";
      var count = isLarge ? 42 : 14;
      var frag = doc.createDocumentFragment();

      for (var i = 0; i < count; i++) {
        var bar = doc.createElement("span");
        bar.className = "eq__bar";
        bar.style.height = (25 + Math.random() * 75).toFixed(0) + "%";
        bar.style.setProperty("--dur", (560 + Math.random() * 720).toFixed(0) + "ms");
        bar.style.setProperty("--delay", (Math.random() * 600).toFixed(0) + "ms");
        frag.appendChild(bar);
      }
      el.appendChild(frag);
    });
  }

  /* ---------------------------------------------
     Player
     --------------------------------------------- */

  var audio = new Audio();
  audio.preload = "none";
  audio.setAttribute("playsinline", "");

  var streamStarted = false;
  var watchdog = null;
  var muted = false;
  var volume = CONFIG.defaultVolume != null ? CONFIG.defaultVolume : 0.8;
  var lastTrack = "";

  var playButtons = $$("[data-play]");
  var trackNodes = $$("[data-track]");
  var hintNode = $("[data-hint]");
  var errorNode = $("[data-error]");
  var errorTextNode = $("[data-error-text]");
  var statusNodes = $$("[data-status]");
  var volumeInput = $("[data-volume]");
  var volumeValue = $("[data-volume-value]");
  var muteButton = $("[data-mute]");

  function readStored(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function store(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* приватный режим — не страшно */
    }
  }

  function setStatus(state) {
    var labels = {
      live: "Live",
      idle: "Live",
      loading: "Подключение",
      error: "Нет сигнала"
    };
    statusNodes.forEach(function (node) {
      node.setAttribute("data-status", state);
      var text = $("[data-status-text]", node);
      if (text) text.textContent = labels[state] || "Live";
    });
  }

  function setPlaying(isPlaying) {
    body.classList.toggle("is-playing", isPlaying);
    playButtons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", isPlaying ? "true" : "false");
      btn.setAttribute("aria-label", isPlaying ? "Пауза" : "Слушать эфир");
    });

    $$("[data-play-label]").forEach(function (label) {
      label.textContent = isPlaying ? "Пауза" : "Слушать эфир";
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }

  function showError(kind) {
    clearTimeout(watchdog);
    if (!audio.paused) audio.pause();
    setPlaying(false);
    if (errorNode) errorNode.hidden = false;
    if (errorTextNode) {
      errorTextNode.textContent =
        kind === "mixed"
          ? "Браузер блокирует поток на HTTPS-странице. Откройте"
          : "Поток не отвечает. Попробуйте ещё раз или откройте";
    }
    setStatus("error");
  }

  function clearError() {
    if (errorNode) errorNode.hidden = true;
  }

  function isMixedContent(url) {
    return (
      window.location.protocol === "https:" && /^http:\/\//i.test(url || "")
    );
  }

  function streamSrc() {
    var url = CONFIG.streamUrl;
    if (!url) return "";
    if (isMixedContent(url)) {
      console.warn(
        "[SOTG] HTTPS-страница не может воспроизводить HTTP-поток. " +
          "Настройте HTTPS-прокси — см. README."
      );
      return "";
    }
    // Сбрасываем кэш, чтобы каждый запуск подключался к живому краю эфира.
    return url + (url.indexOf("?") === -1 ? "?_=" + Date.now() : "");
  }

  function playLive() {
    clearError();
    clearTimeout(watchdog);
    setStatus("loading");

    var src = streamSrc();
    if (!src) {
      showError(isMixedContent(CONFIG.streamUrl) ? "mixed" : "error");
      return;
    }

    audio.src = src;
    audio.load();
    streamStarted = true;

    var promise = audio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(function () {
        // автовоспроизведение запрещено — не показываем ошибку
        if (audio.error) {
          showError();
        } else {
          setStatus("idle");
        }
      });
    }

    watchdog = setTimeout(function () {
      if (audio.paused || audio.readyState < 2) showError();
    }, 15000);
  }

  function togglePlayback() {
    if (audio.paused) {
      playLive();
    } else {
      audio.pause();
    }
  }

  playButtons.forEach(function (btn) {
    btn.addEventListener("click", togglePlayback);
  });

  audio.addEventListener("playing", function () {
    clearTimeout(watchdog);
    clearError();
    setPlaying(true);
    setStatus("live");
  });

  audio.addEventListener("waiting", function () {
    if (!audio.paused) setPlaying(true);
  });

  audio.addEventListener("pause", function () {
    setPlaying(false);
  });

  audio.addEventListener("ended", function () {
    setPlaying(false);
  });

  audio.addEventListener("error", function () {
    if (streamStarted) showError();
  });

  /* ---------------------------------------------
     Track title + metadata
     --------------------------------------------- */

  function cleanTrackTitle(title) {
    var clean = (title || "").replace(/\s+/g, " ").trim();
    // Shoutcast часто отдаёт "Unknown - Название", если исполнитель не указан.
    clean = clean.replace(/^unknown\s*[-–—]\s*/i, "");
    return clean;
  }

  function setTrack(title) {
    var clean = cleanTrackTitle(title);
    if (!clean || clean === lastTrack) return;
    lastTrack = clean;
    markActiveMix();

    trackNodes.forEach(function (node) {
      node.textContent = clean;
      node.setAttribute("title", clean);
    });

    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: clean,
          artist: CONFIG.stationName || "S0uNd5 0f 7he Gr0unD",
          album: "Габба-радио · 24/7",
          artwork: [
            {
              src: new URL("assets/img/cover.png", window.location.href).href,
              sizes: "1920x1080",
              type: "image/png"
            }
          ]
        });
      } catch (err) {
        /* старый браузер */
      }
    }
  }

  var metadataTimer = null;
  var jsonpCounter = 0;

  function scheduleMetadata(delay) {
    clearTimeout(metadataTimer);
    metadataTimer = setTimeout(connectMetadata, delay);
  }

  // Shoutcast отдаёт статистику с поддержкой JSONP: обычный fetch упрётся
  // в CORS, а <script> с callback работает с любого домена.
  function pollShoutcast() {
    if (!CONFIG.metadataUrl) return;

    var callback = "__sotgMeta" + Date.now() + "_" + ++jsonpCounter;
    var script = doc.createElement("script");
    var timeout = null;
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      try {
        delete window[callback];
      } catch (err) {
        window[callback] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callback] = function (data) {
      finish();
      if (data && data.songtitle) {
        var before = lastTrack;
        setTrack(data.songtitle);
        if (lastTrack !== before) loadRecent();
        if (Number(data.streamstatus) === 1) setStatus("live");
      }
      scheduleMetadata(15000);
    };

    script.onerror = function () {
      finish();
      scheduleMetadata(30000);
    };

    script.async = true;
    script.src =
      CONFIG.metadataUrl +
      (CONFIG.metadataUrl.indexOf("?") === -1 ? "?" : "&") +
      "callback=" +
      encodeURIComponent(callback) +
      "&_=" +
      Date.now();

    timeout = setTimeout(function () {
      finish();
      scheduleMetadata(30000);
    }, 12000);

    (doc.head || doc.documentElement).appendChild(script);
  }

  function connectMetadata() {
    if (!CONFIG.metadataUrl) return;
    if (isMixedContent(CONFIG.metadataUrl)) return;

    if (CONFIG.metadataType === "shoutcast") {
      pollShoutcast();
      return;
    }

    if (!("EventSource" in window)) return;

    var source;
    try {
      source = new EventSource(CONFIG.metadataUrl);
    } catch (err) {
      return;
    }

    source.addEventListener("message", function (event) {
      try {
        var data = JSON.parse(event.data);
        if (data && data.streamTitle) {
          setTrack(data.streamTitle);
          setStatus("live");
        }
      } catch (err) {
        /* игнорируем битый пакет */
      }
    });

    source.addEventListener("error", function () {
      if (source.readyState !== 2) return; // браузер переподключится сам
      setTimeout(function () {
        if (source.readyState === 2) connectMetadata();
      }, 20000);
    });
  }

  /* ---------------------------------------------
     Recent tracks (/played) + mix tracklists
     --------------------------------------------- */

  var recentWrap = $("[data-recent-wrap]");
  var recentList = $("[data-recent]");
  var mixesRoot = $("[data-mixes]");
  var mixNodes = [];

  function formatTime(unix) {
    try {
      return new Date(unix * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (err) {
      return "";
    }
  }

  function loadRecent() {
    if (!CONFIG.playedUrl || !recentList || !window.fetch) return;
    if (isMixedContent(CONFIG.playedUrl)) return;

    var url =
      CONFIG.playedUrl +
      (CONFIG.playedUrl.indexOf("?") === -1 ? "?" : "&") +
      "_=" +
      Date.now();

    window
      .fetch(url, { cache: "no-store" })
      .then(function (res) {
        return res.ok ? res.json() : [];
      })
      .then(function (items) {
        if (!Array.isArray(items) || !items.length) return;
        recentList.textContent = "";

        items.slice(0, 10).forEach(function (item, index) {
          var title = cleanTrackTitle(item && item.title);
          if (!title) return;

          var li = doc.createElement("li");
          li.className = "recent__item" + (index === 0 ? " is-now" : "");

          var time = doc.createElement("span");
          time.className = "recent__time";
          time.textContent = index === 0 ? "сейчас" : formatTime(item.playedat);

          var name = doc.createElement("span");
          name.className = "recent__name";
          name.textContent = title;

          li.appendChild(time);
          li.appendChild(name);
          recentList.appendChild(li);
        });

        if (recentWrap && recentList.children.length) recentWrap.hidden = false;
      })
      .catch(function () {
        /* история — приятный бонус, ошибки не показываем */
      });
  }

  function buildMixes() {
    var mixes = window.SOTG_MIXES;
    if (!mixesRoot || !Array.isArray(mixes)) return;

    mixes.forEach(function (mix) {
      if (!mix || !mix.tracks || !mix.tracks.length) return;

      var details = doc.createElement("details");
      details.className = "mix";

      var summary = doc.createElement("summary");
      summary.className = "mix__summary";

      var label = doc.createElement("span");
      label.className = "mix__label";
      label.textContent = "Внутри микса · " + mix.title;

      var badge = doc.createElement("span");
      badge.className = "mix__badge";
      badge.textContent = "в эфире сейчас";

      var count = doc.createElement("span");
      count.className = "mix__count";
      count.textContent = mix.tracks.length + " треков";

      summary.appendChild(label);
      summary.appendChild(badge);
      summary.appendChild(count);
      details.appendChild(summary);

      var ol = doc.createElement("ol");
      ol.className = "tracks mix__tracks";
      mix.tracks.forEach(function (name) {
        var li = doc.createElement("li");
        li.className = "track";
        var span = doc.createElement("span");
        span.className = "track__name";
        span.textContent = name;
        li.appendChild(span);
        ol.appendChild(li);
      });
      details.appendChild(ol);

      mixesRoot.appendChild(details);
      mixNodes.push({ mix: mix, node: details });
    });
  }

  function markActiveMix() {
    var current = (lastTrack || "").toLowerCase();
    mixNodes.forEach(function (entry) {
      var active =
        !!entry.mix.match && current.indexOf(entry.mix.match.toLowerCase()) !== -1;
      entry.node.classList.toggle("is-live", active);
      if (active && !entry.node.hasAttribute("data-touched")) {
        entry.node.open = true;
      }
    });
  }

  buildMixes();
  mixNodes.forEach(function (entry) {
    entry.node.addEventListener("toggle", function () {
      entry.node.setAttribute("data-touched", "1");
    });
  });

  /* ---------------------------------------------
     Volume
     --------------------------------------------- */

  function paintVolume() {
    var percent = Math.round((muted ? 0 : volume) * 100);
    if (volumeValue) volumeValue.textContent = percent + "%";
    if (volumeInput) {
      volumeInput.value = String(muted ? 0 : volume);
      volumeInput.setAttribute("aria-valuetext", percent + "%");
    }
    if (muteButton) {
      muteButton.setAttribute("aria-pressed", muted ? "true" : "false");
      muteButton.setAttribute(
        "aria-label",
        muted ? "Включить звук" : "Выключить звук"
      );
    }
    body.classList.toggle("is-muted", muted);
    audio.muted = muted;
    audio.volume = volume;
    store("sotg-muted", muted ? "1" : "0");
    store("sotg-volume", String(volume));
  }

  var storedVolume = parseFloat(readStored("sotg-volume"));
  if (!isNaN(storedVolume)) {
    volume = Math.min(1, Math.max(0, storedVolume));
  }
  muted = readStored("sotg-muted") === "1";

  audio.volume = volume;
  audio.muted = muted;

  if (volumeInput) {
    volumeInput.addEventListener("input", function () {
      volume = Math.min(1, Math.max(0, parseFloat(volumeInput.value) || 0));
      muted = volume === 0;
      paintVolume();
    });
  }

  if (muteButton) {
    muteButton.addEventListener("click", function () {
      if (muted && volume === 0) volume = 0.8;
      muted = !muted;
      if (!muted && audio.muted) audio.muted = false;
      paintVolume();
    });
  }

  paintVolume();

  /* ---------------------------------------------
     Media Session controls
     --------------------------------------------- */

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", playLive);
      navigator.mediaSession.setActionHandler("pause", function () {
        audio.pause();
      });
      navigator.mediaSession.setActionHandler("stop", function () {
        audio.pause();
      });
    } catch (err) {
      /* не поддерживается */
    }
  }

  setTrack(CONFIG.defaultTrack || "S0uNd5 0f 7he Gr0unD — эфир 24/7");

  /* ---------------------------------------------
     Header + mini player
     --------------------------------------------- */

  var header = $("#site-header");
  var mini = $("#mini");
  var panel = $("[data-player]");

  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (mini && panel) {
    var updateMini = function () {
      var rect = panel.getBoundingClientRect();
      mini.classList.toggle("is-visible", rect.bottom < 0);
    };

    updateMini();
    window.addEventListener("scroll", updateMini, { passive: true });
    window.addEventListener("resize", updateMini);
  } else if (mini) {
    mini.classList.add("is-visible");
  }

  /* ---------------------------------------------
     Mobile navigation
     --------------------------------------------- */

  var nav = $("#nav");
  var navToggle = $("#nav-toggle");

  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    var text = $(".sr-only", navToggle);
    if (text) text.textContent = "Открыть меню";
  }

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      var text = $(".sr-only", navToggle);
      if (text) text.textContent = open ? "Закрыть меню" : "Открыть меню";
    });

    $$("a", nav).forEach(function (link) {
      link.addEventListener("click", closeNav);
    });

    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeNav();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) closeNav();
    });
  }

  /* ---------------------------------------------
     Playlist filter
     --------------------------------------------- */

  var filterInput = $("[data-filter]");
  var tracks = $$("[data-tracks] .track");
  var countNode = $("[data-count]");
  var emptyNode = $("[data-empty]");

  function filterTracks() {
    if (!filterInput) return;
    var query = filterInput.value.trim().toLowerCase();
    var visible = 0;

    tracks.forEach(function (row) {
      var match = !query || row.textContent.toLowerCase().indexOf(query) !== -1;
      row.hidden = !match;
      if (match) visible++;
    });

    if (countNode) countNode.textContent = String(visible);
    if (emptyNode) emptyNode.hidden = visible !== 0;
  }

  if (filterInput) {
    filterInput.addEventListener("input", filterTracks);
    filterInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        filterInput.value = "";
        filterTracks();
      }
    });
    filterTracks();
  }

  /* ---------------------------------------------
     Reveal on scroll + year
     --------------------------------------------- */

  var reveals = $$(".reveal");
  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reveals.length && "IntersectionObserver" in window && !reducedMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -40px 0px" }
    );

    reveals.forEach(function (el) {
      // уже видимые блоки не прячем, чтобы не было мигания
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        el.classList.add("is-in");
        return;
      }
      el.classList.add("is-armed");
      revealObserver.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  var yearNode = $("[data-year]");
  if (yearNode) yearNode.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------
     Init
     --------------------------------------------- */

  buildEq();
  setStatus("idle");

  $$("[data-stream-link]").forEach(function (link) {
    var href = CONFIG.fallbackPlayerUrl || CONFIG.streamUrl;
    if (href) link.href = href;
  });

  connectMetadata();
})();
