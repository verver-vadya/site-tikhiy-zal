document.documentElement.classList.add("js");

// Safari на iPhone показывает нажатие (:active) только если на странице слушают касания
document.addEventListener("touchstart", () => {}, { passive: true });

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
    const composer = next.querySelector(".gig__open").firstChild.textContent.trim();
    playheadLabel.textContent = `Ближайший: ${date.getDate()} ${MONTHS[date.getMonth()]}, ${composer}`;
  }
} else if (playheadLabel && gigs.length) {
  playheadLabel.textContent = "Осенний сезон закончился";
}

// Фамилия в афише раскладывается на буквы, чтобы при наведении каждая отъезжала своим transform.
// Экранный диктор читает фамилию целиком из скрытой копии, а буквы от него спрятаны
document.querySelectorAll(".gig__open").forEach((button) => {
  const text = button.firstChild;
  if (!text || text.nodeType !== Node.TEXT_NODE) return;
  const name = text.textContent.trim();
  const letters = document.createElement("span");
  letters.className = "gig__name";
  letters.setAttribute("aria-hidden", "true");
  [...name].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "gig__ch";
    span.style.setProperty("--i", i);
    span.textContent = ch;
    letters.append(span);
  });
  const spoken = document.createElement("span");
  spoken.className = "visually-hidden";
  spoken.textContent = name;
  text.replaceWith(spoken, letters);
  button.querySelector("sup")?.style.setProperty("--n", name.length);
});

// «Записаться» в строке афиши и в программке сразу выбирает этот концерт в форме
const concertSelect = document.getElementById("f-concert");
const chooseConcert = (value) => {
  if (!concertSelect) return;
  concertSelect.value = value;
  concertSelect.dispatchEvent(new Event("change", { bubbles: true }));
};
document.querySelectorAll(".gig__cta[data-concert]").forEach((link) => {
  link.addEventListener("click", () => chooseConcert(link.dataset.concert));
});

// Программка концерта: окно с описанием, программой и музыкантами
const programme = document.querySelector(".programme");
if (programme && typeof programme.showModal === "function") {
  const body = programme.querySelector("[data-programme-body]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let closing = false;

  // Картинки программок заранее скачиваем и раскодируем, пока страница простаивает:
  // иначе раскодирование большой картинки съедает первые кадры выезда
  const decoded = new Map();
  const warm = () => {
    document.querySelectorAll("template[id^='programme-']").forEach((template) => {
      template.content.querySelectorAll("img").forEach((img) => {
        if (decoded.has(img.src)) return;
        const pic = new Image();
        pic.src = img.src;
        decoded.set(img.src, pic.decode().catch(() => {}));
      });
    });
  };
  if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1500);

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  let opening = 0;

  const open = async (id) => {
    const template = document.getElementById(`programme-${id}`);
    if (!template || programme.open) return;
    const ticket = ++opening;
    warm();
    body.replaceChildren(template.content.cloneNode(true));
    body.scrollTop = 0;
    programme.classList.remove("is-closing");
    // Ждём картинку, но не дольше 120 мс: окно должно откликнуться сразу
    const pictures = [...body.querySelectorAll("img")].map((img) => decoded.get(img.src) || img.decode().catch(() => {}));
    await Promise.race([Promise.all(pictures), new Promise((resolve) => setTimeout(resolve, 120))]);
    if (ticket !== opening) return;
    programme.showModal();
    document.documentElement.classList.add("has-dialog");
    // Самый тяжёлый кадр (окно встаёт поверх страницы) проходит без движения.
    // Выезд начинается через два кадра, когда браузер уже свободен, поэтому ни один кадр анимации не теряется
    await nextFrame();
    await nextFrame();
    if (ticket === opening && programme.open) programme.classList.add("is-open");
  };

  // Закрытие тоже анимированное, но короче открытия; потом окно действительно закрывается
  const close = (after) => {
    if (!programme.open || closing) return;
    closing = true;
    programme.classList.add("is-closing");
    programme.classList.remove("is-open");
    const finish = () => {
      closing = false;
      programme.classList.remove("is-closing");
      programme.close();
      document.documentElement.classList.remove("has-dialog");
      if (after) after();
    };
    setTimeout(finish, reduceMotion.matches ? 220 : 320);
  };

  document.querySelectorAll(".gig__open").forEach((button) => {
    button.addEventListener("click", () => open(button.dataset.programme));
  });
  programme.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return close();
    // Клик по затемнению: сам dialog растянут на весь экран, лист внутри него
    if (!e.target.closest(".programme__sheet")) return close();
    const cta = e.target.closest(".programme__cta");
    if (cta) {
      e.preventDefault();
      chooseConcert(cta.dataset.concert);
      close(() => {
        document.getElementById("zapis")?.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
        history.replaceState(null, "", "#zapis");
      });
    }
  });
  // Esc: не даём окну закрыться рывком, а закрываем с анимацией
  programme.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  programme.addEventListener("close", () => {
    programme.classList.remove("is-open", "is-closing");
    document.documentElement.classList.remove("has-dialog");
  });
}

// Как проходит вечер: на широком экране «указатель» едет по стану вместе с прокруткой
// и проявляет фотографии, которые уже прошёл; на узком фото проявляются по мере появления
const evening = document.querySelector("[data-evening]");
if (evening) {
  const stage = evening.querySelector(".evening__stage");
  const head = evening.querySelector(".evening__head");
  const tips = evening.querySelector(".evening__tips");
  const pointer = [head, tips].filter(Boolean);
  const moments = [...evening.querySelectorAll(".moment")];
  const wide = matchMedia("(min-width: 56.25rem)");
  let frame = 0;

  const update = () => {
    frame = 0;
    const rect = stage.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = Math.min(1, Math.max(0, (vh * 0.8 - rect.top) / (vh * 0.4 + rect.height)));
    const x = progress * rect.width;
    // Сдвиг округляется до пикселя экрана: линия толщиной в пиксель остаётся чёткой и не съезжает с вершин треугольников
    const dpr = window.devicePixelRatio || 1;
    pointer.forEach((el) => { el.style.transform = `translateX(${Math.round(x * dpr) / dpr}px)`; });
    moments.forEach((m) => {
      // Цвет появляется ровно за линией: граница серого слоя едет вместе с указателем
      const reveal = Math.min(m.offsetWidth, Math.max(0, x - m.offsetLeft));
      m.style.setProperty("--reveal", `${reveal}px`);
      m.classList.toggle("is-crossing", reveal > 0 && reveal < m.offsetWidth);
      m.classList.toggle("is-lit", x >= m.offsetLeft + 24);
    });
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

  // Нижний конец указателя выходит за самое низкое фото на столько же, на сколько верхний —
  // за самое высокое: полоса выглядит симметричной на любом экране
  const placeHead = () => {
    pointer.forEach((el) => el.style.removeProperty("bottom"));
    if (!wide.matches) return;
    const box = stage.getBoundingClientRect();
    const line = head.getBoundingClientRect();
    const photos = moments.map((m) => m.querySelector("img").getBoundingClientRect());
    const highest = Math.min(...photos.map((r) => r.top));
    const lowest = Math.max(...photos.map((r) => r.bottom));
    const overhang = highest - line.top;
    pointer.forEach((el) => { el.style.bottom = `${Math.max(0, box.bottom - (lowest + overhang))}px`; });
  };
  const onResize = () => { placeHead(); onScroll(); };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("is-lit"); });
  }, { threshold: 0.6 });

  const setup = () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    observer.disconnect();
    if (wide.matches) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize, { passive: true });
      placeHead();
      update();
    } else {
      pointer.forEach((el) => el.style.removeProperty("bottom"));
      moments.forEach((m) => { m.style.removeProperty("--reveal"); m.classList.remove("is-crossing"); observer.observe(m); });
    }
  };
  wide.addEventListener("change", setup);
  setup();
  // Подписи под фото сдвигают снимки, пока грузятся шрифты: пересчитываем, когда шрифты готовы
  document.fonts?.ready.then(placeHead);
}

// Текущий год в подвале (в HTML тоже вписан год на случай, если скрипт не загрузится)
document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
