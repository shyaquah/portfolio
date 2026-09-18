// ---- Text scramble effect ----
// Classic "decrypt" scramble: cycles random characters before settling
// on the target text. Used for the rotating role text and link hovers.
class TextScramble {
  constructor(el) {
    this.el = el;
    this.chars = "!<>-_\\/[]{}—=+*^?#";
    this.frame = 0;
    this.queue = [];
    this.frameRequest = null;
    this.resolve = null;
    this.update = this.update.bind(this);
  }

  setText(newText) {
    const oldText = this.el.textContent;
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise((resolve) => (this.resolve = resolve));
    this.queue = [];
    for (let i = 0; i < length; i++) {
      const from = oldText[i] || "";
      const to = newText[i] || "";
      const start = Math.floor(Math.random() * 20);
      const end = start + Math.floor(Math.random() * 20) + 10;
      this.queue.push({ from, to, start, end, char: null });
    }
    cancelAnimationFrame(this.frameRequest);
    this.frame = 0;
    this.update();
    return promise;
  }

  // Jump straight to the final text and resolve, without waiting out the
  // remaining frames. Used when the pointer leaves before the animation
  // would naturally finish, so a quick re-hover always starts clean.
  finish() {
    cancelAnimationFrame(this.frameRequest);
    if (this.queue.length) {
      this.el.textContent = this.queue.map((item) => item.to).join("");
    }
    if (this.resolve) this.resolve();
  }

  update() {
    let output = "";
    let complete = 0;
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (this.frame >= item.end) {
        complete++;
        output += item.to;
      } else if (this.frame >= item.start) {
        if (!item.char || Math.random() < 0.28) {
          item.char = this.randomChar();
        }
        output += `<span class="dud">${item.char}</span>`;
      } else {
        output += item.from;
      }
    }
    this.el.innerHTML = output;
    if (complete === this.queue.length) {
      this.resolve();
    } else {
      this.frameRequest = requestAnimationFrame(this.update);
      this.frame++;
    }
  }

  randomChar() {
    return this.chars[Math.floor(Math.random() * this.chars.length)];
  }
}

// ---- Hero <-> Experience: turn the first scroll gesture into a full,
// animated snap to the next section rather than a partial native scroll.
// Falls back gracefully to plain scroll-snap if JS or the events below
// don't fire (e.g. some assistive input methods).
function initSectionScroll() {
  const hero = document.querySelector(".hero");
  const experience = document.getElementById("experience");
  const scrollBtn = document.querySelector(".scroll-btn");
  const backBtn = document.querySelector(".back-btn");
  if (!hero || !experience) return;

  let current = 0; // 0 = hero, 1 = experience
  let isAnimating = false;
  let animationTimer = null;

  function lock() {
    isAnimating = true;
    clearTimeout(animationTimer);
    animationTimer = setTimeout(() => {
      isAnimating = false;
    }, 900);
  }

  function goToExperience() {
    if (isAnimating || current === 1) return;
    lock();
    current = 1;
    experience.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToHero() {
    if (isAnimating || current === 0) return;
    lock();
    current = 0;
    hero.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (scrollBtn) {
    scrollBtn.addEventListener("click", goToExperience);
  }
  if (backBtn) {
    backBtn.addEventListener("click", goToHero);
  }

  window.addEventListener(
    "wheel",
    (e) => {
      if (current === 0 && e.deltaY > 4) {
        e.preventDefault();
        goToExperience();
      } else if (current === 1 && e.deltaY < -4 && experience.scrollTop <= 2) {
        e.preventDefault();
        goToHero();
      }
    },
    { passive: false }
  );

  let touchStartY = null;
  window.addEventListener(
    "touchstart",
    (e) => {
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (touchStartY === null || isAnimating) return;
      const dy = touchStartY - e.touches[0].clientY;
      if (current === 0 && dy > 30) {
        goToExperience();
        touchStartY = null;
      } else if (current === 1 && dy < -30 && experience.scrollTop <= 2) {
        goToHero();
        touchStartY = null;
      }
    },
    { passive: true }
  );

  // Keep `current` correct if the page lands mid-scroll some other way
  // (deep link, keyboard scrolling, etc.) so the wheel/touch logic above
  // still makes the right call afterwards.
  if ("IntersectionObserver" in window) {
    const sync = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            current = entry.target === experience ? 1 : 0;
          }
        });
      },
      { threshold: 0.6 }
    );
    sync.observe(hero);
    sync.observe(experience);
  }
}

// ---- Timeline items: click to expand a bit more detail on that stint.
// Accordion behaviour — opening one closes any other that's open, so the
// expanded entry stays the focus (the CSS also dims the rest while one
// is open). Height is measured from the detail's own scrollHeight rather
// than a fixed value, since each blurb is a different length.
function initTimelineExpand() {
  const timelineEl = document.querySelector(".timeline");
  const items = Array.from(document.querySelectorAll(".timeline-item"));
  if (!items.length) return;

  function setExpanded(item, expand) {
    const head = item.querySelector(".timeline-item-head");
    const detail = item.querySelector(".timeline-detail");
    if (!head || !detail) return;
    item.classList.toggle("expanded", expand);
    head.setAttribute("aria-expanded", String(expand));
    detail.style.maxHeight = expand ? `${detail.scrollHeight}px` : "0px";
  }

  items.forEach((item) => {
    const head = item.querySelector(".timeline-item-head");
    if (!head) return;

    function toggle() {
      const willExpand = !item.classList.contains("expanded");
      items.forEach((other) => {
        if (other !== item && other.classList.contains("expanded")) {
          setExpanded(other, false);
        }
      });
      setExpanded(item, willExpand);
      if (timelineEl) {
        timelineEl.classList.toggle(
          "has-expanded",
          items.some((i) => i.classList.contains("expanded"))
        );
      }
    }

    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

// All DOM wiring lives inside start(), gated behind window.claude.hot.ready
// when that exists (the Claude Artifact preview), and called immediately
// otherwise (a plain browser — i.e. this file running for real on GitHub
// Pages). See the matching comment in the Artifact preview for why.
function start() {
  initSectionScroll();
  initTimelineExpand();

  // ---- Footer year: keep the copyright line current automatically ----
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const glow = document.querySelector(".glow");
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  window.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  window.addEventListener("pointermove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  window.addEventListener(
    "touchmove",
    (e) => {
      if (!e.touches.length) return;
      targetX = e.touches[0].clientX;
      targetY = e.touches[0].clientY;
    },
    { passive: true }
  );

  function animateGlow() {
    currentX += (targetX - currentX) * 0.18;
    currentY += (targetY - currentY) * 0.18;
    glow.style.setProperty("--x", `${currentX}px`);
    glow.style.setProperty("--y", `${currentY}px`);
    requestAnimationFrame(animateGlow);
  }
  requestAnimationFrame(animateGlow);

  // ---- Typewriter effect for the rotating role line ----
  // Each entry has a static "lead" ("I'm " / "I ") and a "text" portion
  // that's typed/deleted and stays underlined throughout (see #role-text
  // in the CSS) — only the highlighted phrase animates, the lead just
  // swaps instantly whenever a new phrase starts typing.
  // (Hover on the links below still uses the gibberish TextScramble.)
  const roles = [
    { lead: "I'm ", text: "product-minded." },
    { lead: "I'm ", text: "client-focused." },
    { lead: "I'm ", text: "a developer (sometimes)." },
  ];
  const roleLeadEl = document.getElementById("role-lead");
  const roleTextEl = document.getElementById("role-text");

  function typeLoop(leadEl, textEl, words, opts = {}) {
    const typeSpeed = opts.typeSpeed ?? 55;
    const deleteSpeed = opts.deleteSpeed ?? 30;
    const pauseFull = opts.pauseFull ?? 1800;
    const pauseEmpty = opts.pauseEmpty ?? 300;
    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;

    function tick() {
      const { lead, text } = words[wordIndex];
      if (!deleting) {
        if (charIndex === 0) leadEl.textContent = lead;
        charIndex++;
        textEl.textContent = text.slice(0, charIndex);
        if (charIndex === text.length) {
          deleting = true;
          setTimeout(tick, pauseFull);
          return;
        }
        setTimeout(tick, typeSpeed);
      } else {
        charIndex--;
        textEl.textContent = text.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
          setTimeout(tick, pauseEmpty);
          return;
        }
        setTimeout(tick, deleteSpeed);
      }
    }

    textEl.textContent = "";
    leadEl.textContent = "";
    charIndex = 0;
    setTimeout(tick, 600);
  }

  typeLoop(roleLeadEl, roleTextEl, roles);

  // ---- Scramble effect on link hover / tap (hero links + info panel links) ----
  document.querySelectorAll(".link").forEach((link) => {
    const text = link.dataset.text || link.textContent;
    const scramble = new TextScramble(link);
    let isAnimating = false;

    const play = () => {
      if (isAnimating) return;
      isAnimating = true;
      scramble.setText(text).then(() => {
        isAnimating = false;
      });
    };

    link.addEventListener("mouseenter", play);
    link.addEventListener("focus", play);

    link.addEventListener("mouseleave", () => {
      if (isAnimating) {
        scramble.finish();
        isAnimating = false;
      }
    });

    link.addEventListener(
      "touchstart",
      () => {
        play();
        link.classList.add("tapped");
        setTimeout(() => link.classList.remove("tapped"), 600);
      },
      { passive: true }
    );
  });

  // ---- Fade in the experience timeline as it scrolls into view ----
  const timelineItems = document.querySelectorAll(".timeline-item");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    timelineItems.forEach((item, i) => {
      item.style.transitionDelay = `${Math.min(i * 90, 450)}ms`;
      observer.observe(item);
    });
  } else {
    timelineItems.forEach((item) => item.classList.add("in-view"));
  }
}

if (window.claude?.hot?.ready) {
  window.claude.hot.ready(start);
} else {
  start();
}
