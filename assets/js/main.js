document.documentElement.classList.add("js");

// Меню: закрывается кнопкой, по ссылке, по Esc и по клику вне меню
const toggle = document.querySelector(".menu-toggle");
const menu = document.getElementById("menu");
if (toggle && menu) {
  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
  const setOpen = (open, { restoreFocus = false } = {}) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Закрыть" : "Меню";
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => {
        menu.classList.add("is-open");
        menu.querySelector("a")?.focus({ preventScroll: true });
      });
    } else {
      // Закрываем сразу, без анимации: выход должен быть мгновенным, а не догонять палец
      menu.classList.remove("is-open");
      menu.hidden = true;
      if (restoreFocus) toggle.focus();
    }
  };

  toggle.addEventListener("click", () => setOpen(!isOpen()));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) setOpen(false, { restoreFocus: true });
  });
  document.addEventListener("click", (e) => {
    if (isOpen() && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });
}

// Пометки от руки: включить или выключить, выбор запоминается
const notesButtons = document.querySelectorAll("[data-notes]");
const applyNotes = (on) => {
  document.documentElement.classList.toggle("no-notes", !on);
  notesButtons.forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.notes === "on") === on)));
};
applyNotes(!document.documentElement.classList.contains("no-notes"));
notesButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const on = button.dataset.notes === "on";
    applyNotes(on);
    try { localStorage.setItem("notes", on ? "on" : "off"); } catch (e) {}
  });
});

// Ближайший концерт: отмечаем в афише и подписываем «указатель» на первом экране
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const gigs = [...document.querySelectorAll(".gig")];
const next = gigs.find((gig) => new Date(gig.querySelector("time").dateTime) > new Date());
const playheadLabel = document.querySelector(".playhead__label");
if (next) {
  next.classList.add("is-next");
  document.querySelector(".playhead")?.setAttribute("href", `#${next.id}`);
  const select = document.getElementById("f-concert");
  if (select) select.value = next.querySelector("[data-concert]").dataset.concert;
  if (playheadLabel) {
    const date = new Date(next.querySelector("time").dateTime);
    const composer = next.querySelector(".gig__title").firstChild.textContent.trim();
    playheadLabel.textContent = `Ближайший: ${date.getDate()} ${MONTHS[date.getMonth()]}, ${composer}`;
  }
} else if (playheadLabel && gigs.length) {
  playheadLabel.textContent = "Осенний сезон закончился";
}

// «Записаться» в строке афиши сразу выбирает этот концерт в форме
const concertSelect = document.getElementById("f-concert");
document.querySelectorAll("[data-concert]").forEach((link) => {
  link.addEventListener("click", () => {
    if (!concertSelect) return;
    concertSelect.value = link.dataset.concert;
    concertSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
});

// Как проходит вечер: на широком экране «указатель» едет по стану вместе с прокруткой
// и проявляет фотографии, которые уже прошёл; на узком фото проявляются по мере появления
const evening = document.querySelector("[data-evening]");
if (evening) {
  const stage = evening.querySelector(".evening__stage");
  const head = evening.querySelector(".evening__head");
  const moments = [...evening.querySelectorAll(".moment")];
  const wide = matchMedia("(min-width: 56.25rem)");
  let frame = 0;

  const update = () => {
    frame = 0;
    const rect = stage.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = Math.min(1, Math.max(0, (vh * 0.8 - rect.top) / (vh * 0.4 + rect.height)));
    const x = progress * rect.width;
    head.style.transform = `translateX(${x}px)`;
    moments.forEach((m) => m.classList.toggle("is-lit", x >= m.offsetLeft + 24));
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("is-lit"); });
  }, { threshold: 0.6 });

  const setup = () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    observer.disconnect();
    if (wide.matches) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      update();
    } else {
      moments.forEach((m) => observer.observe(m));
    }
  };
  wide.addEventListener("change", setup);
  setup();
}

// Текущий год в подвале (в HTML тоже вписан год на случай, если скрипт не загрузится)
document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
