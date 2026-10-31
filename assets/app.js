(() => {
  const state = { notes: [], search: "", domain: "", tag: "", view: "all" };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const icons = { engineering: "⚙️", personal: "🌿", product: "🧩", language: "🗣️", certificate: "🏅", "work-process": "🧭", uncategorized: "📄" };

  function markdownToHtml(text) {
    const escaped = escapeHtml(text).replace(/`(.+?)`/g, "<code>$1</code>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const lines = escaped.split("\n");
    let html = "";
    let listOpen = false;
    let tableOpen = false;
    const closeList = () => { if (listOpen) { html += "</ul>"; listOpen = false; } };
    const closeTable = () => { if (tableOpen) { html += "</tbody></table>"; tableOpen = false; } };
    for (const line of lines) {
      const cells = line.startsWith("|") && line.endsWith("|") ? line.slice(1, -1).split("|").map((cell) => cell.trim()) : null;
      const isSeparator = cells && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
      if (cells && !isSeparator) {
        closeList();
        if (!tableOpen) { html += `<table><thead><tr>${cells.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>`; tableOpen = true; }
        else { html += `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`; }
      } else if (isSeparator) { closeList(); }
      else if (/^### /.test(line)) { closeList(); closeTable(); html += `<h4>${line.slice(4)}</h4>`; }
      else if (/^## /.test(line)) { closeList(); closeTable(); html += `<h3>${line.slice(3)}</h3>`; }
      else if (/^# /.test(line)) { closeList(); closeTable(); html += `<h2>${line.slice(2)}</h2>`; }
      else if (/^[-*] /.test(line)) { closeTable(); if (!listOpen) { html += "<ul>"; listOpen = true; } html += `<li>${line.slice(2)}</li>`; }
      else if (!line.trim()) { closeList(); closeTable(); }
      else { closeList(); closeTable(); html += `<p>${line}</p>`; }
    }
    closeList();
    closeTable();
    return html;
  }

  function isDue(note) {
    return note.review_after && note.review_after <= new Date().toISOString().slice(0, 10);
  }

  function match(note) {
    const needle = state.search.trim().toLocaleLowerCase();
    const haystack = `${note.title} ${note.tags.join(" ")} ${note.body}`.toLocaleLowerCase();
    return (!needle || haystack.includes(needle)) &&
      (!state.domain || note.domain === state.domain) &&
      (!state.tag || note.tags.includes(state.tag)) &&
      (state.view !== "review" || isDue(note));
  }

  function render() {
    const target = byId("notes");
    const visible = state.notes.filter(match);
    byId("result-count").textContent = state.view === "review"
      ? `待複習 ${visible.length} 張筆記`
      : `顯示 ${visible.length}／${state.notes.length} 張筆記`;
    target.replaceChildren();
    for (const note of visible) {
      const fragment = byId("note-template").content.cloneNode(true);
      fragment.querySelector(".note-icon").textContent = icons[note.domain] || icons.uncategorized;
      fragment.querySelector(".note-meta").textContent = `${note.domain} · ${note.scope}`;
      fragment.querySelector(".note-title").textContent = note.title;
      fragment.querySelector(".preview").textContent = note.preview;
      const properties = [
        `<span class="property">可信度：${escapeHtml(note.confidence)}</span>`,
        ...note.tags.map((tag) => `<span class="property is-tag">#${escapeHtml(tag)}</span>`),
      ];
      fragment.querySelector(".note-properties").innerHTML = properties.join("");
      fragment.querySelector(".note-body").innerHTML = markdownToHtml(note.body);
      fragment.querySelector(".review").textContent = note.review_after
        ? `下次複習：${note.review_after}　·　來源範圍：${note.scope}`
        : `來源範圍：${note.scope}`;
      target.append(fragment);
    }
    if (!visible.length) target.innerHTML = "<p class=\"empty\">目前沒有相符的筆記。試試清除搜尋條件，或回到「所有筆記」。</p>";
  }

  function options(select, values) {
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value; option.textContent = value; select.append(option);
    }
  }

  function renderSidebarDomains(domains) {
    const target = byId("sidebar-domains");
    target.replaceChildren();
    for (const domain of domains) {
      const button = document.createElement("button");
      button.className = "domain-link";
      button.type = "button";
      button.textContent = `${icons[domain] || "📄"} ${domain}`;
      button.addEventListener("click", () => {
        state.domain = state.domain === domain ? "" : domain;
        byId("domain").value = state.domain;
        render();
      });
      target.append(button);
    }
  }

  fetch("notes-index.json").then((response) => response.json()).then((data) => {
    state.notes = data.notes || [];
    options(byId("domain"), data.domains || []);
    options(byId("tag"), data.tags || []);
    renderSidebarDomains(data.domains || []);
    byId("search").addEventListener("input", (event) => { state.search = event.target.value; render(); });
    byId("domain").addEventListener("change", (event) => { state.domain = event.target.value; render(); });
    byId("tag").addEventListener("change", (event) => { state.tag = event.target.value; render(); });
    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
      render();
    }));
    byId("random-note").addEventListener("click", () => {
      const available = state.notes.filter((note) => state.view === "review" ? isDue(note) : true);
      if (!available.length) return;
      const note = available[Math.floor(Math.random() * available.length)];
      state.search = note.title; byId("search").value = note.title; state.view = "all"; render();
      const details = document.querySelector(".note-card details");
      details?.setAttribute("open", ""); document.querySelector("#notes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    byId("sidebar-toggle").addEventListener("click", () => byId("sidebar").classList.toggle("is-open"));
    render();
  }).catch(() => { byId("notes").textContent = "無法載入筆記索引。請在 repo 根目錄執行 python3 scripts/build_site.py。"; });
})();
