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

    document.querySelectorAll(".lang-opt").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.lang === state.lang);
    });
  }

  /* ---------- Mini-diagrama de arquitectura ---------- */

  // Color único para nodos — se diferencia capa con opacidad del trazo de arista
  const NODE_COLOR = "#111111";   // texto principal, máximo contraste
  const EDGE_COLOR = "#BBBBBB";   // gris medio, no compite con los nodos

  // Grilla: 4 columnas × 3 filas; viewBox con margen generoso para las etiquetas
  // Columna central fila media → coordenadas absolutas
  const ARCH_W = 480;
  const ARCH_H = 140;
  const COL_X = [55, 175, 305, 425];   // x centros por columna
  const ROW_Y = [36, 70, 104];          // y centros por fila

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
      const mx = (x1 + x2) / 2;
      root.append(svg("path", {
        class: "arch-edge",
        d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
        fill: "none",
        stroke: EDGE_COLOR,
        "stroke-width": "1.5",
      }));
    });

    // Nodos
    arch.nodes.forEach((n) => {
      const cx = COL_X[n.x];
      const cy = ROW_Y[n.y];
      const label = tr(n.label);

      const g = svg("g", { class: "arch-node" });

      // Círculo del nodo
      g.append(svg("circle", {
        cx,
        cy,
        r: 5,
        fill: NODE_COLOR,
        class: "arch-dot",
      }));

      // Posición de la etiqueta según fila:
      // fila 0 → encima del nodo; fila 1 → debajo; fila 2 → debajo
      const textY = n.y === 0 ? cy - 10 : cy + 16;

      const textEl = svg("text", {
        x: cx,
        y: textY,
        "text-anchor": "middle",
        class: "arch-label",
        fill: NODE_COLOR,
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
            p.challenge ? field("case.challenge", p.challenge) : null,
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

    // Mapa de ratios actuales por sección; se activa la que más área visible tenga
    const ratios = new Map([...links.keys()].map((id) => [id, 0]));

    const pick = () => {
      // Si estamos al fondo, activa el último
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActive(lastId);
        return;
      }
      // Elige la sección con mayor ratio de intersección
      let bestId = firstId;
      let bestRatio = -1;
      ratios.forEach((r, id) => {
        if (r > bestRatio) { bestRatio = r; bestId = id; }
      });
      setActive(bestId);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        ratios.set(entry.target.id, entry.intersectionRatio);
      });
      pick();
    }, {
      rootMargin: "-15% 0px -55% 0px",
      threshold: [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0],
    });

    links.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    if (firstId) setActive(firstId);

    // Al llegar al fondo, activa el último aunque el observer no lo reporte
    window.addEventListener("scroll", () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActive(lastId);
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
