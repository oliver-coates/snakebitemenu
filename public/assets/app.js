/* SnakeBite menu – renders data/menu.json in the chosen language.
   You shouldn't need to edit this file to change the menu: see README.md. */
(function () {
  "use strict";

  var DATA = "data/";
  var state = { settings: null, menu: null, en: null, lang: null, langCode: "en", menuId: null };
  var els = {
    main: document.getElementById("menu"),
    tabs: document.getElementById("menu-tabs"),
    cats: document.getElementById("cat-nav"),
    footer: document.getElementById("footer"),
    select: document.getElementById("lang-select")
  };
  var langCache = {};

  /* ---------- helpers ---------- */
  function getJSON(path) {
    return fetch(DATA + path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " → HTTP " + r.status);
      return r.json();
    });
  }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }
  function store(key, value) {
    try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); }
    catch (e) { return null; }
  }
  function money(n) { return Number(n).toFixed(2); }
  function asList(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

  /* translation lookups: chosen language → English → raw value */
  function ui(key) {
    var L = state.lang && state.lang.ui;
    return (L && L[key] != null && L[key] !== "") ? L[key] : (state.en.ui[key] || "");
  }
  function dict(section, key) {
    var L = state.lang && state.lang[section];
    if (L && L[key]) return L[key];
    var E = state.en[section];
    return (E && E[key]) || key;
  }
  function trMenu(menu, field) {
    var t = state.lang && state.lang.menus && state.lang.menus[menu.id];
    return (t && t[field] != null && t[field] !== "") ? t[field] : menu[field];
  }
  function trCat(cat, field) {
    var t = state.lang && state.lang.categories && state.lang.categories[cat.id];
    return (t && t[field]) ? t[field] : cat[field];
  }
  function trItem(item, field) {
    var t = state.lang && state.lang.items && state.lang.items[item.id];
    return (t && t[field]) ? t[field] : item[field];
  }
  function trLabel(item, label) {
    var t = state.lang && state.lang.items && state.lang.items[item.id];
    if (t && t.labels && t.labels[label]) return t.labels[label];
    var g = state.lang && state.lang.labels;
    return (g && g[label]) || label;
  }

  /* ---------- which menu opens by default ---------- */
  function minutesNow(tz) {
    var q = new URLSearchParams(location.search).get("time");   // e.g. ?time=10:45 for testing
    if (q && /^\d{1,2}:\d{2}$/.test(q)) return toMinutes(q);
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      var h = 0, m = 0;
      parts.forEach(function (p) { if (p.type === "hour") h = +p.value; if (p.type === "minute") m = +p.value; });
      return (h % 24) * 60 + m;
    } catch (e) {
      var d = new Date(); return d.getHours() * 60 + d.getMinutes();
    }
  }
  function toMinutes(s) { var p = s.split(":"); return (+p[0]) * 60 + (+p[1]); }
  function scheduledMenu() {
    var s = state.settings, t = minutesNow(s.timezone);
    for (var i = 0; i < s.schedule.length; i++) {
      var r = s.schedule[i], a = toMinutes(r.from), b = toMinutes(r.to);
      var inside = a <= b ? (t >= a && t < b) : (t >= a || t < b);
      if (inside) return r.menu;
    }
    return s.fallbackMenu || state.menu.menus[0].id;
  }
  function menuExists(id) { return state.menu.menus.some(function (m) { return m.id === id; }); }

  /* ---------- language ---------- */
  function pickLanguage() {
    var codes = state.settings.languages.map(function (l) { return l.code; });
    var fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl && codes.indexOf(fromUrl) > -1) return fromUrl;
    var saved = store("snakebite-lang");
    if (saved && codes.indexOf(saved) > -1) return saved;
    var prefs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < prefs.length; i++) {
      var p = (prefs[i] || "").toLowerCase();
      for (var j = 0; j < codes.length; j++) {
        var c = codes[j].toLowerCase();
        if (p === c || p.indexOf(c + "-") === 0) return codes[j];
      }
    }
    return state.settings.defaultLanguage || "en";
  }
  function loadLanguage(code) {
    if (code === "en") return Promise.resolve(state.en);
    if (langCache[code]) return Promise.resolve(langCache[code]);
    return getJSON("lang/" + code + ".json").then(function (d) { langCache[code] = d; return d; });
  }
  function setLanguage(code, persist) {
    return loadLanguage(code).then(function (data) {
      state.lang = data; state.langCode = code;
      document.documentElement.lang = code;
      els.select.value = code;
      if (persist) {
        store("snakebite-lang", code);
        var url = new URL(location.href);
        if (code === (state.settings.defaultLanguage || "en")) url.searchParams.delete("lang"); else url.searchParams.set("lang", code);
        history.replaceState(null, "", url);
      }
      render();
    }).catch(function (err) {
      console.error(err);
      if (code !== "en") setLanguage("en", false);
    });
  }

  /* ---------- rendering ---------- */
  function renderTabs() {
    els.tabs.innerHTML = "";
    els.tabs.setAttribute("aria-label", ui("menus"));
    state.menu.menus.forEach(function (m) {
      var selected = m.id === state.menuId;
      var b = el("button", {
        class: "tab", type: "button", role: "tab", id: "tab-" + m.id,
        "aria-selected": selected ? "true" : "false", "aria-controls": "menu",
        tabindex: selected ? "0" : "-1", text: trMenu(m, "name")
      });
      b.addEventListener("click", function () { selectMenu(m.id, true); });
      els.tabs.appendChild(b);
    });
  }
  els.tabs.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var ids = state.menu.menus.map(function (m) { return m.id; });
    var i = ids.indexOf(state.menuId) + (e.key === "ArrowRight" ? 1 : -1);
    i = (i + ids.length) % ids.length;
    selectMenu(ids[i], true);
    document.getElementById("tab-" + ids[i]).focus();
  });

  function categoriesFor(menuId) {
    return state.menu.categories.filter(function (c) { return c.menu === menuId; })
      .map(function (c) {
        var items = state.menu.items.filter(function (it) {
          return it.category === c.id && asList(it.menu).indexOf(menuId) > -1 && it.available !== false;
        });
        return { cat: c, items: items };
      })
      .filter(function (g) { return g.items.length; });
  }

  var chevron = '<svg aria-hidden="true" viewBox="0 0 12 12" width="10" height="10"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

  function renderItem(item) {
    var name = trItem(item, "name");
    var translated = state.langCode !== "en" && name !== item.name;
    var tags = asList(item.dietary);
    var hasSingle = item.price != null && !(item.prices && item.prices.length);

    var tagEl = tags.length ? el("span", {
      class: "tags",
      title: tags.map(function (t) { return dict("dietary", t); }).join(", "),
      text: tags.join(" · ")
    }) : null;

    var head = el("div", { class: "item-head" },
      el("h3", { class: "item-name" }, name, tagEl),
      hasSingle ? el("span", { class: "price", text: money(item.price) }) : null
    );

    var li = el("li", { class: "item", id: "item-" + item.id }, head);
    if (translated) li.appendChild(el("p", { class: "item-en", lang: "en", text: item.name }));

    var desc = trItem(item, "description");
    if (desc) li.appendChild(el("p", { class: "desc", text: desc }));

    if (item.prices && item.prices.length) {
      var ul = el("ul", { class: "price-list" });
      item.prices.forEach(function (p) {
        var lbl = trLabel(item, p.label);
        ul.appendChild(el("li", null,
          el("span", { class: "label" }, lbl, (state.langCode !== "en" && lbl !== p.label) ? el("small", { lang: "en", text: p.label }) : null),
          el("span", { class: "price", text: money(p.price) })
        ));
      });
      li.appendChild(ul);
    }

    if (item.extras && item.extras.length) {
      li.appendChild(el("p", { class: "extras", text: item.extras.map(function (x) {
        return trLabel(item, x.label) + " +" + money(x.price);
      }).join(" · ") }));
    }

    var allergens = asList(item.allergens);
    if (allergens.length) {
      li.appendChild(el("p", { class: "allergens" },
        el("strong", { text: ui("contains") + ": " }),
        allergens.map(function (a) { return dict("allergens", a); }).join(", ")
      ));
    }

    if (item.photo) {
      var panelId = "photo-" + item.id;
      var btn = el("button", { class: "photo-toggle", type: "button", "aria-expanded": "false", "aria-controls": panelId });
      btn.innerHTML = '<span></span>' + chevron;
      btn.firstChild.textContent = ui("showPhoto");
      var inner = el("div");
      var panel = el("div", { class: "photo", id: panelId, "aria-hidden": "true" }, inner);
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") !== "true";
        if (open && !inner.firstChild) {
          inner.appendChild(el("img", { src: item.photo, alt: name, loading: "lazy", decoding: "async" }));
        }
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        panel.setAttribute("aria-hidden", open ? "false" : "true");
        panel.classList.toggle("is-open", open);
        btn.firstChild.textContent = open ? ui("hidePhoto") : ui("showPhoto");
      });
      li.appendChild(btn);
      li.appendChild(panel);
    }
    return li;
  }

  var observer = null;
  function render() {
    if (!state.menu) return;
    var menu = state.menu.menus.filter(function (m) { return m.id === state.menuId; })[0];
    var groups = categoriesFor(menu.id);
    document.title = "SnakeBite – " + trMenu(menu, "name");
    renderTabs();

    // category chips
    els.cats.innerHTML = "";
    els.cats.setAttribute("aria-label", ui("jumpTo"));
    els.cats.hidden = groups.length < 2;
    groups.forEach(function (g) {
      els.cats.appendChild(el("a", { class: "chip", href: "#cat-" + g.cat.id, "data-cat": g.cat.id, text: trCat(g.cat, "name") }));
    });

    // menu body
    var frag = document.createDocumentFragment();
    var hours = trMenu(menu, "hours"), intro = trMenu(menu, "intro"), hint = ui("englishHint");
    if (hours || intro || (hint && state.langCode !== "en")) {
      frag.appendChild(el("section", { class: "menu-intro" },
        hours ? el("p", { class: "hours", text: hours }) : null,
        intro ? el("p", { class: "intro", text: intro }) : null,
        (hint && state.langCode !== "en") ? el("p", { class: "translation-hint", text: hint }) : null
      ));
    }
    groups.forEach(function (g) {
      var note = trCat(g.cat, "note");
      var sec = el("section", { class: "category", id: "cat-" + g.cat.id, "aria-labelledby": "h-" + g.cat.id },
        el("h2", { class: "category-title", id: "h-" + g.cat.id, text: trCat(g.cat, "name") }),
        note ? el("p", { class: "category-note", text: note }) : null
      );
      var ul = el("ul", { class: "items" });
      g.items.forEach(function (it) { ul.appendChild(renderItem(it)); });
      sec.appendChild(ul);
      frag.appendChild(sec);
    });
    els.main.innerHTML = "";
    els.main.setAttribute("aria-labelledby", "tab-" + menu.id);
    els.main.appendChild(frag);

    renderFooter(menu);
    watchSections();
    updateStickyHeight();
  }

  function renderFooter(menu) {
    els.footer.innerHTML = "";
    var notes = asList(trMenu(menu, "notes"));
    if (notes.length) {
      els.footer.appendChild(el.apply(null, ["div", { class: "notes" }].concat(notes.map(function (n) { return el("p", { text: n }); }))));
    }
    var used = {};
    state.menu.items.forEach(function (it) {
      if (asList(it.menu).indexOf(menu.id) > -1) asList(it.dietary).forEach(function (d) { used[d] = 1; });
    });
    var codes = Object.keys(state.en.dietary).filter(function (k) { return used[k]; });
    if (codes.length) {
      var dl = el("dl", { class: "key" });
      codes.forEach(function (c) { dl.appendChild(el("dt", { text: c })); dl.appendChild(el("dd", { text: dict("dietary", c) })); });
      els.footer.appendChild(el("h2", { text: ui("dietaryKey") }));
      els.footer.appendChild(dl);
    }
    els.footer.appendChild(el("p", { class: "currency", text: ui("currency") }));
  }

  function watchSections() {
    if (observer) observer.disconnect();
    if (!("IntersectionObserver" in window)) return;
    var chips = els.cats.querySelectorAll(".chip");
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id.replace("cat-", "");
        chips.forEach(function (c) {
          var on = c.getAttribute("data-cat") === id;
          c.classList.toggle("is-active", on);
          if (on && c.scrollIntoView) {
            var box = els.cats;
            box.scrollTo({ left: c.offsetLeft - box.clientWidth / 2 + c.clientWidth / 2, behavior: "smooth" });
          }
        });
      });
    }, { rootMargin: "-" + (stickyHeight() + 10) + "px 0px -65% 0px" });
    els.main.querySelectorAll(".category").forEach(function (s) { observer.observe(s); });
  }
  els.cats.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".chip");
    if (!a) return;
    e.preventDefault();
    var target = document.getElementById("cat-" + a.getAttribute("data-cat"));
    if (target) {
      var y = target.getBoundingClientRect().top + window.scrollY - stickyHeight() - 4;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  });
  function stickyHeight() { var s = document.querySelector(".sticky"); return s ? s.offsetHeight : 0; }
  function updateStickyHeight() { document.documentElement.style.setProperty("--sticky-h", (stickyHeight() + 8) + "px"); }
  window.addEventListener("resize", updateStickyHeight);

  function selectMenu(id, fromUser) {
    if (!menuExists(id)) return;
    state.menuId = id;
    if (fromUser) {
      var url = new URL(location.href);
      url.hash = id;
      history.replaceState(null, "", url);
      var top = document.querySelector(".sticky").offsetTop;
      if (window.scrollY > top) window.scrollTo(0, top);
    }
    render();
  }

  /* ---------- start ---------- */
  Promise.all([getJSON("settings.json"), getJSON("menu.json"), getJSON("lang/en.json")])
    .then(function (r) {
      state.settings = r[0]; state.menu = r[1]; state.en = r[2];
      state.settings.languages.forEach(function (l) {
        els.select.appendChild(el("option", { value: l.code, text: l.name }));
      });
      els.select.addEventListener("change", function () { setLanguage(els.select.value, true); });

      var hash = decodeURIComponent(location.hash.replace("#", ""));
      state.menuId = menuExists(hash) ? hash : scheduledMenu();
      if (!menuExists(state.menuId)) state.menuId = state.menu.menus[0].id;
      return setLanguage(pickLanguage(), false);
    })
    .catch(function (err) {
      console.error(err);
      var msg = (state.en && state.en.ui.loadError) || "Sorry, the menu couldn't be loaded. Please ask our staff for a printed menu.";
      els.main.innerHTML = "";
      els.main.appendChild(el("p", { class: "message", text: msg }));
      if (location.protocol === "file:") {
        els.main.appendChild(el("p", { class: "message", text: "(Opened as a file – preview it with a local web server instead. See README.md.)" }));
      }
    });
})();
