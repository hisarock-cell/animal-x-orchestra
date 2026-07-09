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

  function fmt(sec) {
    if (!isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  players.forEach(function (el) {
    const audio = new Audio(el.dataset.src);
    audio.preload = "none";
    const btn = el.querySelector(".play-btn");
    const progress = el.querySelector(".progress");
    const fill = el.querySelector(".progress-fill");
    const timeEl = el.querySelector(".time");

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
