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
    // Окно открывается с фокусом на заголовке, а не на «Закрыть»: на телефоне у кнопки не появляется рамка,
    // а экранный диктор сразу читает название концерта
    const title = body.querySelector(".programme__title");
    if (title) { title.tabIndex = -1; title.autofocus = true; }
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
  const staff = evening.querySelector(".staff--evening");
  const moments = [...evening.querySelectorAll(".moment")];
  const wide = matchMedia("(min-width: 56.25rem)");
  let frame = 0;

  const update = () => {
    frame = 0;
    const rect = stage.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = Math.min(1, Math.max(0, (vh * 0.8 - rect.top) / (vh * 0.4 + rect.height)));
    const x = progress * rect.width;
    // Линия встаёт ровно на пиксели экрана (при масштабе 125 % и 150 % тоже): не размывается и не съезжает с вершин
    const dpr = window.devicePixelRatio || 1;
    const snapped = Math.round((rect.left + x) * dpr) / dpr - rect.left;
    head.style.transform = `translateX(${snapped}px)`;
    // Граница цвета проходит по середине линии, а сама линия лежит поверх, поэтому края не видно
    const middle = snapped + Math.max(1, Math.round(dpr)) / dpr / 2;
    moments.forEach((m) => {
      const reveal = Math.min(m.offsetWidth, Math.max(0, middle - m.offsetLeft));
      m.style.setProperty("--reveal", `${reveal}px`);
      m.classList.toggle("is-lit", x >= m.offsetLeft + 24);
    });
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

  // Указатель и стан подгоняются под снимки на любом экране:
  // нижний конец выходит из-под самой низкой подписи на столько же, на сколько верхний — над самым высоким фото,
  // а пять линеек стана разложены с равным шагом так, что каждая фотография лежит хотя бы на одной из них
  const LINES = 5;
  const reset = () => {
    head.style.removeProperty("bottom");
    stage.style.removeProperty("margin-bottom");
    ["top", "height", "--gap"].forEach((prop) => staff?.style.removeProperty(prop));
  };
  // Линия и треугольники рисуются картинками, посчитанными прямо в пикселях экрана (при 100, 125, 150 % — свои):
  // линия — целое число пикселей, треугольник той же «чётности», так что вершина приходится ровно на середину линии
  const svg = (w, h, body, extra = "") =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' ${extra}>${body}</svg>`)}")`;
  const fitPixels = () => {
    const dpr = window.devicePixelRatio || 1;
    const hair = Math.max(1, Math.round(dpr));
    let tip = Math.round(9 * dpr);
    if ((tip - hair) % 2) tip += 1;
    const tipH = Math.round(7 * dpr);
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#121212";
    const set = (name, value) => head.style.setProperty(name, value);
    set("--tip-w", `${tip / dpr}px`);
    set("--tip-h", `${tipH / dpr}px`);
    set("--tip-left", `${-(tip - hair) / 2 / dpr}px`);
    set("--tip-line-w", `${tip / dpr}px`);
    set("--tip-top", svg(tip, tipH, `<path d='M0 0H${tip}L${tip / 2} ${tipH}Z' fill='${ink}'/>`));
    set("--tip-bottom", svg(tip, tipH, `<path d='M${tip / 2} 0L${tip} ${tipH}H0Z' fill='${ink}'/>`));
    set("--tip-line", svg(tip, 1, `<rect x='${(tip - hair) / 2}' width='${hair}' height='1' fill='${ink}'/>`, "preserveAspectRatio='none'"));
  };
  const placeHead = () => {
    reset();
    if (!wide.matches) return;
    fitPixels();
    const box = stage.getBoundingClientRect();
    const photos = moments.map((m) => m.querySelector("img").getBoundingClientRect());
    const texts = moments.map((m) => m.querySelector("p").getBoundingClientRect());
    const highest = Math.min(...photos.map((r) => r.top));
    const lowestPhoto = Math.max(...photos.map((r) => r.bottom));
    const lowestText = Math.max(lowestPhoto, ...texts.map((r) => r.bottom));
    const overhang = highest - head.getBoundingClientRect().top;
    const bottom = Math.round(box.bottom - (lowestText + overhang));
    head.style.bottom = `${bottom}px`;
    if (bottom < 0) stage.style.marginBottom = `${-bottom}px`;
    if (staff) {
      const inset = Math.min(...photos.map((r) => r.height)) * 0.25;
      const gap = Math.round((lowestPhoto - highest - inset * 2) / (LINES - 1));
      staff.style.top = `${Math.round(highest + inset - box.top)}px`;
      staff.style.setProperty("--gap", `${gap}px`);
      staff.style.height = `${gap * (LINES - 1) + 1}px`;
    }
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
      reset();
      moments.forEach((m) => { m.style.removeProperty("--reveal"); observer.observe(m); });
    }
  };
  wide.addEventListener("change", setup);
  setup();
  // Подписи под фото сдвигают снимки, пока грузятся шрифты: пересчитываем, когда шрифты готовы
  document.fonts?.ready.then(placeHead);
}

// Текущий год в подвале (в HTML тоже вписан год на случай, если скрипт не загрузится)
document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
