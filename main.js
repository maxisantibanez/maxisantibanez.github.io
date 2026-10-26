(() => {
  "use strict";

  const LANGS = ["es", "en"];
  const STORAGE_KEY = "lang";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const state = { lang: "es", i18n: null, projects: null };

  /* ---------- Utilidades ---------- */

  function readStoredLang() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return LANGS.includes(value) ? value : null;
    } catch {
      return null;
    }
  }

  function storeLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* almacenamiento bloqueado: el idioma no se recuerda, nada más */
    }
  }

  // Campo traducible: { es, en } o texto plano
  function tr(value) {
    if (value && typeof value === "object") return value[state.lang] ?? value.es ?? "";
    return value ?? "";
  }

  function t(key) {
    const dict = state.i18n[state.lang];
    if (key in dict) return dict[key];
    console.warn(`Falta la clave i18n "${key}" en "${state.lang}"`);
    return state.i18n.es[key] ?? key;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value == null) continue;
      if (name === "text") node.textContent = value;
      else node.setAttribute(name, value);
    }
    for (const child of [].concat(children)) {
      if (child) node.append(child);
    }
    return node;
  }

  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    return node;
  }

  const isPlaceholder = (url) => !url || /^\[.*\]$/.test(url.trim());

  /* ---------- Textos ---------- */

  function applyI18n() {
    document.documentElement.lang = state.lang;
    document.title = t("meta.title");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));

    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });

    // data-i18n-attr="aria-label:clave;title:otra"
    document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
      node.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (attr && key) node.setAttribute(attr, t(key));
      });
    });
  }

  /* ---------- Mini-diagrama de arquitectura ---------- */

  // Colores por capa de arquitectura
  const LAYER_COLORS = {
    frontend: "#2F5BFF",  // azul acento
    api:      "#111111",  // texto principal
    db:       "#7A5200",  // naranja oscuro legible
    ext:      "#555555",  // muted
  };

  // Grilla: columnas 0-3 → 60-420, filas 0-2 → 28-88
  const ARCH_W = 480;
  const ARCH_H = 120;
  const COL_X = [60, 180, 300, 420];   // x centros de cada columna
  const ROW_Y = [28, 64, 100];          // y centros de cada fila

  function archDiagram(arch) {
    const nodeMap = new Map(arch.nodes.map((n) => [n.id, n]));

    const root = svg("svg", {
      class: "arch-svg",
      viewBox: `0 0 ${ARCH_W} ${ARCH_H}`,
      role: "img",
      "aria-label": t("case.diagram"),
    });

    // Aristas (primero, debajo de los nodos)
    arch.edges.forEach(({ from, to }) => {
      const a = nodeMap.get(from);
      const b = nodeMap.get(to);
      if (!a || !b) return;
      const x1 = COL_X[a.x], y1 = ROW_Y[a.y];
      const x2 = COL_X[b.x], y2 = ROW_Y[b.y];
      // Bézier suave horizontal
      const mx = (x1 + x2) / 2;
      root.append(svg("path", {
        class: "arch-edge",
        d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
        fill: "none",
      }));
    });

    // Nodos
    arch.nodes.forEach((n) => {
      const cx = COL_X[n.x];
      const cy = ROW_Y[n.y];
      const label = tr(n.label);
      const color = LAYER_COLORS[n.layer] ?? "#555555";

      const g = svg("g", { class: "arch-node" });

      // Círculo del nodo
      g.append(svg("circle", {
        cx,
        cy,
        r: 6,
        fill: color,
        class: "arch-dot",
      }));

      // Etiqueta: arriba si fila 0, abajo si fila 2, a la derecha si fila central (o por posición relativa)
      const isTop = n.y === 0;
      const isBottom = n.y === 2;
      const textY = isTop ? cy - 11 : isBottom ? cy + 18 : cy + 18;
      const textAnchor = "middle";

      const textEl = svg("text", {
        x: cx,
        y: textY,
        "text-anchor": textAnchor,
        class: "arch-label",
        fill: color,
      });
      textEl.textContent = label;
      g.append(textEl);

      root.append(g);
    });

    return root;
  }

  // Fallback: diagrama lineal legacy (para proyectos sin arch)
  function flowArrow() {
    const root = svg("svg", { class: "flow-arrow", viewBox: "0 0 20 10", width: 20, height: 10, "aria-hidden": "true", focusable: "false" });
    root.append(svg("line", { x1: 0, y1: 5, x2: 14, y2: 5 }));
    root.append(svg("path", { d: "M20 5 l-6 -4 v8 z" }));
    return root;
  }

  function diagram(steps) {
    return el("ol", { class: "flow", "aria-label": t("case.diagram") }, steps.map((step, i) =>
      el("li", { class: "flow-step" }, [
        el("span", { class: "flow-box", text: tr(step) }),
        i < steps.length - 1 ? flowArrow() : null,
      ])
    ));
  }

  /* ---------- Proyectos ---------- */

  function stackList(items) {
    return el("ul", { class: "stack", "aria-label": t("case.stack") }, items.map((s) => el("li", { text: s })));
  }

  // Casos de empresa: Trabajo con empresas y Práctica profesional
  function renderCases(listId, projects) {
    const list = document.getElementById(listId);
    list.replaceChildren(...projects.map((p) => {
      const field = (labelKey, value) => el("div", {}, [
        el("dt", { text: t(labelKey) }),
        el("dd", { text: tr(value) }),
      ]);
      const titleId = `case-${p.id}`;

      return el("li", {}, el("article", { class: "case", "aria-labelledby": titleId }, [
        el("p", { class: "item-year", text: tr(p.year) }),
        el("div", { class: "item-body" }, [
          el("h3", { class: "item-title", id: titleId, text: tr(p.title) }),
          el("p", { class: "item-context", text: tr(p.context) }),
          el("dl", { class: "case-fields" }, [
            field("case.problem", p.problem),
            field("case.role", p.role),
            field("case.impact", p.impact),
          ]),
          p.diagram?.length ? diagram(p.diagram) : null,
          p.arch ? archDiagram(p.arch) : null,
          p.stack?.length ? stackList(p.stack) : null,
        ]),
      ]));
    }));
  }

  function renderOpenSource(projects) {
    const list = document.getElementById("oss-list");
    list.replaceChildren(...projects.map((p) => {
      const title = isPlaceholder(p.repo)
        ? el("span", {}, [
          document.createTextNode(`${p.title} `),
          el("span", { class: "pending", text: `(${t("oss.pending")})` }),
        ])
        : el("a", {
          class: "oss-link",
          href: p.repo,
          target: "_blank",
          rel: "noopener",
          "aria-label": `${p.title}. ${t("oss.repo")}`,
        }, [
          el("span", { text: p.title }),
          el("span", { class: "arrow", "aria-hidden": "true", text: "↗" }),
        ]);

      return el("li", {}, el("article", { class: "oss-item" }, [
        el("p", { class: "item-year", text: tr(p.year) }),
        el("div", { class: "item-body" }, [
          el("h3", { class: "item-title" }, title),
          el("p", { class: "oss-desc", text: tr(p.description) }),
          p.stack?.length ? stackList(p.stack) : null,
        ]),
      ]));
    }));
  }

  // Otros trabajos: una línea por ítem (año · cargo · lugar)
  function renderJobs(jobs) {
    const list = document.getElementById("jobs-list");
    list.replaceChildren(...jobs.map((job) =>
      el("li", { class: "job" }, [
        el("span", { class: "job-year", text: tr(job.year) }),
        el("span", { class: "job-title", text: tr(job.title) }),
        el("span", { class: "job-place", text: tr(job.place) }),
      ])
    ));
  }

  const visible = (items) => (items ?? []).filter((item) => !item.hidden);

  // Oculta secciones sin ítems visibles (y su link) y renumera las que quedan
  function updateSections() {
    document.querySelectorAll("main .section").forEach((section) => {
      const list = section.querySelector(".list");
      const empty = list ? list.children.length === 0 : false;
      section.hidden = empty;
      const link = document.querySelector(`.nav a[href="#${section.id}"]`);
      if (link) link.parentElement.hidden = empty;
    });

    const shown = [...document.querySelectorAll("main .section:not([hidden])")];
    shown.forEach((section, i) => {
      section.classList.toggle("is-first", i === 0);
      const num = section.querySelector(".section-num");
      if (num) num.textContent = `(${String(i + 1).padStart(2, "0")})`;
    });
  }

  function render() {
    applyI18n();
    renderCases("work-list", visible(state.projects.work));
    renderOpenSource(visible(state.projects.openSource));
    renderCases("internship-list", visible(state.projects.internship));
    renderJobs(visible(state.projects.otherJobs));
    updateSections();
  }

  /* ---------- Idioma ---------- */

  function setupToggle() {
    document.getElementById("lang-toggle").addEventListener("click", () => {
      state.lang = state.lang === "es" ? "en" : "es";
      storeLang(state.lang);
      render();
    });
  }

  /* ---------- Visor del CV ---------- */

  // Abre el PDF en un diálogo dentro de la página. Si el navegador no muestra PDFs
  // embebidos (la mayoría de los móviles), el link sigue su curso y abre una pestaña.
  function setupCvViewer() {
    const link = document.getElementById("cv-open");
    const dialog = document.getElementById("cv-dialog");
    const frame = document.getElementById("cv-frame");
    if (!dialog?.showModal || !navigator.pdfViewerEnabled) return;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (!frame.getAttribute("src")) frame.src = link.getAttribute("href");
      dialog.showModal();
    });
    document.getElementById("cv-close").addEventListener("click", () => dialog.close());
    // clic en el fondo oscuro cierra
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  /* ---------- Navegación activa ---------- */

  function setupActiveNav() {
    if (!("IntersectionObserver" in window)) return;
    const links = new Map(
      [...document.querySelectorAll(".nav li:not([hidden]) a")].map((a) => [a.getAttribute("href").slice(1), a])
    );
    const setActive = (activeId) => {
      links.forEach((a, id) => {
        const active = id === activeId;
        a.classList.toggle("is-active", active);
        if (active) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
    };
    const firstId = [...links.keys()][0];
    const lastId = [...links.keys()].at(-1);
    const atTop = () => window.scrollY < 80;
    const atBottom = () =>
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

    const observer = new IntersectionObserver((entries) => {
      if (atTop()) {
        if (firstId) setActive(firstId);
        return;
      }
      if (atBottom()) {
        if (lastId) setActive(lastId);
        return;
      }
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: "-20% 0px -60% 0px" });

    links.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    if (firstId) setActive(firstId);

    window.addEventListener("scroll", () => {
      if (atTop()) {
        if (firstId) setActive(firstId);
      } else if (atBottom()) {
        if (lastId) setActive(lastId);
      }
    }, { passive: true });
  }

  /* ---------- Detalle 3: hora de Santiago ---------- */

  function setupClock() {
    const clock = document.getElementById("clock");
    const format = new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => { clock.textContent = format.format(new Date()); };
    tick();
    // sincroniza con el cambio de minuto
    setTimeout(() => { tick(); setInterval(tick, 60_000); }, 60_000 - (Date.now() % 60_000));
  }

  function setupYear() {
    document.getElementById("year").textContent = String(new Date().getFullYear());
  }

  /* ---------- Inicio ---------- */

  async function loadJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  async function init() {
    setupYear();
    setupClock();
    try {
      [state.i18n, state.projects] = await Promise.all([
        loadJSON("data/i18n.json"),
        loadJSON("data/projects.json"),
      ]);
    } catch (error) {
      console.warn("No se pudo cargar el contenido:", error);
      document.getElementById("load-error").hidden = false;
      return;
    }
    state.lang = readStoredLang() ?? "es";
    render();
    setupToggle();
    setupCvViewer();
    setupActiveNav(); // después de render: ya se sabe qué secciones están visibles
  }

  init();
})();
