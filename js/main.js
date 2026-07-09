/* Animal X Orchestra — shared scripts */

/* ---------- Theme (light / dark) ---------- */
(function () {
  const saved = localStorage.getItem("axo-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);

  document.addEventListener("DOMContentLoaded", function () {
    const toggle = document.querySelector(".theme-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("axo-theme", next);
    });
  });
})();

document.addEventListener("DOMContentLoaded", function () {
  /* ---------- Mobile nav ---------- */
  const navToggle = document.querySelector(".mobile-nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
  }

  /* ---------- Audio players ---------- */
  const players = document.querySelectorAll(".player[data-src]");
  let current = null; // { audio, btn, fill, timeEl }
  let audioCtx = null; // 共有AudioContext（初回の再生操作で生成）

  function fmt(sec) {
    if (!isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  /* --- スペクトラム（オーディオビジュアライザー） --- */
  const BAR_COUNT = 32;

  function accentColor() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
  }

  function setupSpectrum(canvas, audio) {
    const ctx2d = canvas.getContext("2d");
    let analyser = null;
    let data = null;
    let rafId = null;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    }

    function drawBars(levels) {
      resize();
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      ctx2d.fillStyle = accentColor();
      const gap = w / BAR_COUNT / 4;
      const barW = w / BAR_COUNT - gap;
      for (let i = 0; i < BAR_COUNT; i++) {
        const bh = Math.max(h * 0.03, levels[i] * h * 0.92);
        const x = i * (barW + gap) + gap / 2;
        ctx2d.beginPath();
        if (ctx2d.roundRect) {
          ctx2d.roundRect(x, h - bh, barW, bh, barW / 2);
        } else {
          ctx2d.rect(x, h - bh, barW, bh);
        }
        ctx2d.fill();
      }
    }

    function idle() {
      // 停止中はうっすら低いバーを表示
      const levels = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        levels.push(0.04 + 0.03 * Math.sin(i * 0.9));
      }
      ctx2d.globalAlpha = 0.45;
      drawBars(levels);
      ctx2d.globalAlpha = 1;
    }

    function tick() {
      if (audio.paused) {
        idle();
        rafId = null;
        return;
      }
      analyser.getByteFrequencyData(data);
      const levels = [];
      // 低音域〜中音域を中心にバーへマッピング
      const usable = Math.floor(data.length * 0.7);
      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.floor((i / BAR_COUNT) * usable);
        levels.push(data[idx] / 255);
      }
      drawBars(levels);
      rafId = requestAnimationFrame(tick);
    }

    // テーマ切替時、停止中でもバーの色を描き直す
    new MutationObserver(function () {
      if (audio.paused) idle();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return {
      start: function () {
        if (!analyser) {
          if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          }
          const source = audioCtx.createMediaElementSource(audio);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          data = new Uint8Array(analyser.frequencyBinCount);
          source.connect(analyser);
          analyser.connect(audioCtx.destination);
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
        if (!rafId) rafId = requestAnimationFrame(tick);
      },
      idle: idle,
    };
  }

  players.forEach(function (el) {
    const audio = new Audio(el.dataset.src);
    audio.preload = "none";
    audio.crossOrigin = "anonymous";
    const btn = el.querySelector(".play-btn");
    const progress = el.querySelector(".progress");
    const fill = el.querySelector(".progress-fill");
    const timeEl = el.querySelector(".time");

    // 同じカード内にキャンバスがあればビジュアライザーを有効化
    const card = el.closest(".track-card") || el.parentElement;
    const canvas = card ? card.querySelector("canvas.spectrum") : null;
    const spectrum = canvas ? setupSpectrum(canvas, audio) : null;
    if (spectrum) spectrum.idle();

    function stopCurrent() {
      if (current && current.audio !== audio) {
        current.audio.pause();
        current.btn.classList.remove("playing");
      }
    }

    btn.addEventListener("click", function () {
      if (audio.paused) {
        stopCurrent();
        audio.play();
        btn.classList.add("playing");
        current = { audio: audio, btn: btn };
        if (spectrum) spectrum.start();
      } else {
        audio.pause();
        btn.classList.remove("playing");
      }
    });

    audio.addEventListener("timeupdate", function () {
      if (audio.duration) {
        fill.style.width = (audio.currentTime / audio.duration) * 100 + "%";
        timeEl.textContent = fmt(audio.duration - audio.currentTime);
      }
    });

    audio.addEventListener("loadedmetadata", function () {
      timeEl.textContent = fmt(audio.duration);
    });

    audio.addEventListener("ended", function () {
      btn.classList.remove("playing");
      fill.style.width = "0%";
      timeEl.textContent = fmt(audio.duration);
    });

    progress.addEventListener("click", function (e) {
      if (!audio.duration) return;
      const rect = progress.getBoundingClientRect();
      audio.currentTime =
        ((e.clientX - rect.left) / rect.width) * audio.duration;
    });
  });

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- Request form (Formspree) ---------- */
  const form = document.querySelector(".request-form form");
  if (form) {
    const status = form.querySelector(".form-status");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (form.action.includes("YOUR_FORM_ID")) {
        status.className = "form-status err";
        status.textContent =
          "フォームは現在準備中です。恐れ入りますが、しばらくお待ちください。";
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const res = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          status.className = "form-status ok";
          status.textContent =
            "リクエストを送信しました。ご連絡ありがとうございます！";
          form.reset();
        } else {
          throw new Error("send failed");
        }
      } catch (err) {
        status.className = "form-status err";
        status.textContent =
          "送信に失敗しました。時間をおいて再度お試しください。";
      } finally {
        btn.disabled = false;
      }
    });
  }
});
