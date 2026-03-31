/* メンテログ v3
  変更点
  ・作業内容マスターを 3区分で保持
  ・マスターの表示順入替 上へ 下へ
  ・表示色 任意設定
  ・推奨頻度 日数 をマスターに保持し 次回推奨作業を算出
  ・アプリ名を端末内で変更可能
  ・既存 localStorage 互換を維持
*/

const BUILD_ID = "v15-2026-03-02";
console.info("[maintelog] build", BUILD_ID);

const STORAGE_KEY = "maintelog_rows_v2";      // 互換維持
const TASKS_KEY = "maintelog_tasks_v2";       // 互換維持
const APPNAME_KEY = "maintelog_appname_v3";
const APP_BUILD = "2026-02-27-v14";

const CATS_KEY = "maintelog_cats_v1";          // 新規 既存と衝突しない

const DEFAULT_CATS = ["掃除", "洗濯", "その他"];

function loadCats() {
  try {
    const raw = localStorage.getItem(CATS_KEY);
    if (!raw) return DEFAULT_CATS.slice();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) {
      // 文字列のみ、重複除去、空除去
      const out = [];
      const seen = new Set();
      arr.forEach(v => {
        const s = String(v ?? "").trim();
        if (!s) return;
        if (seen.has(s)) return;
        seen.add(s);
        out.push(s);
      });
      return out.length > 0 ? out : DEFAULT_CATS.slice();
    }
    return DEFAULT_CATS.slice();
  } catch (_) {
    return DEFAULT_CATS.slice();
  }
}

function saveCats(cats) {
  const out = [];
  const seen = new Set();
  (cats || []).forEach(v => {
    const s = String(v ?? "").trim();
    if (!s) return;
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  localStorage.setItem(CATS_KEY, JSON.stringify(out.length ? out : DEFAULT_CATS.slice()));
}

function getCats() {
  return loadCats();
}


function syncNewCatSelect() {
  const sel = document.getElementById("newCat");
  if (!sel) return;
  const cats = getCats();
  sel.innerHTML = "";
  const arr = (cats && cats.length) ? cats : ["その他"];
  arr.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  if (!sel.value && sel.options.length) {
    sel.value = sel.options[0].value;
  }
}


const defaultTaskNames = [
  "拭き掃除",
  "掃除機",
  "風呂",
  "トイレ",
  "洗濯",
  "庭"
];

const $ = (id) => document.getElementById(id);



function openModal(opts) {
  const ov = $("modalOverlay");
  const body = $("modalBody");
  const ttl = $("modalTitle");
  const okBtn = $("modalOk");
  const cancelBtn = $("modalCancel");

  ttl.textContent = opts.title || "";
  body.innerHTML = "";

  if (opts.bodyNodes) {
    opts.bodyNodes.forEach(n => body.appendChild(n));
  }

  okBtn.textContent = opts.okText || "OK";
  cancelBtn.textContent = opts.cancelText || "キャンセル";

  cancelBtn.style.display = opts.hideCancel ? "none" : "";
  document.body.style.overflow = "hidden";
  ov.classList.remove("hidden");

  const cleanup = () => {
    okBtn.onclick = null;
    cancelBtn.onclick = null;
    ov.classList.add("hidden");
    cancelBtn.style.display = "";
    document.body.style.overflow = "";
  };

  okBtn.onclick = () => { cleanup(); opts.onOk && opts.onOk(); };
  cancelBtn.onclick = () => { cleanup(); opts.onCancel && opts.onCancel(); };

  const first = body.querySelector("input,select,textarea,button");
  if (first) setTimeout(() => first.focus(), 50);
}

function showModal(title, fields, onOk, onCancel) {
  const nodes = [];
  const values = {};
  fields.forEach(f => {
    const wrap = document.createElement("div");
    const lab = document.createElement("label");
    lab.textContent = f.label;
    lab.style.display = "block";
    lab.style.marginBottom = "6px";
    wrap.appendChild(lab);

    let el;
    if (f.type === "select") {
      el = document.createElement("select");
      (f.options || []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (opt === f.value) o.selected = true;
        el.appendChild(o);
      });
    } else {
      el = document.createElement("input");
      el.type = f.type || "text";
      el.value = f.value ?? "";
      if (f.placeholder) el.placeholder = f.placeholder;
      if (f.inputmode) el.inputMode = f.inputmode;
    }
    el.id = f.id;
    wrap.appendChild(el);
    nodes.push(wrap);
    values[f.id] = el;
  });

  openModal({
    title,
    bodyNodes: nodes,
    onOk: () => {
      const out = {};
      fields.forEach(f => out[f.id] = values[f.id].value);
      onOk && onOk(out);
    },
    onCancel: () => { onCancel && onCancel(); }
  });
}

function showConfirm(title, message, onYes, onNo) {
  const p = document.createElement("div");
  p.textContent = message;
  p.style.fontSize = "16px";
  p.style.lineHeight = "1.4";
  openModal({
    title,
    bodyNodes:[p],
    okText:"OK",
    cancelText:"キャンセル",
    onOk: () => { onYes && onYes(); },
    onCancel: () => { onNo && onNo(); }
  });
}

function showAlert(title, message, onClose) {
  const p = document.createElement("div");
  p.textContent = message;
  p.style.fontSize = "16px";
  p.style.lineHeight = "1.4";
  openModal({
    title,
    bodyNodes:[p],
    okText:"閉じる",
    hideCancel:true,
    onOk: () => { onClose && onClose(); },
    onCancel: () => { onClose && onClose(); }
  });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatJP(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y}/${m}/${d}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* v5 UI patches
  ・履歴を 区分ごとの3レーンへ分割し レーン単位で横スクロール
  ・作業内容の縦積み禁止 折り返し禁止
  ・作業内容マスターと区分マスターを折りたたみ
  ・画面下部の固定 入力/履歴 ボタンを非表示
*/

function ensureDynamicStylesV5() {
  if (document.getElementById("dynamicStyles_v5")) return;
  const css = `
    .pill{
      display:inline-flex;
      align-items:center;
      white-space:nowrap;
      word-break:keep-all;
      overflow-wrap:normal;
      padding:5px 10px;
      border-radius:999px;
      line-height:1.1;
    }

    /* lane layout */
    .laneBlock{ margin: 10px 0 18px; }
    .laneTitle{
      display:block;
      font-size:12px;
      opacity:0.72;
      margin:0 0 8px 6px;
      white-space:nowrap;
    }
    .laneScroll{
      position:relative;
      display:flex;
      flex-wrap:nowrap;
      gap:12px;
      overflow-x:auto;
      -webkit-overflow-scrolling:touch;
      padding:6px 6px;
      scrollbar-width:thin;
      scroll-snap-type:x proximity;
    }
    .laneScroll::after{
      content:"";
      position:sticky;
      right:0;
      width:22px;
      height:100%;
      margin-left:auto;
      pointer-events:none;
      background:linear-gradient(to left, rgba(11,11,11,0.85), rgba(11,11,11,0));
    }

    .histCard{
      flex: 0 0 auto;
      min-width: 220px;
      max-width: 86vw;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(255,255,255,0.03);
      border-radius: 18px;
      padding: 12px;
      scroll-snap-align:start;
    }
    .histMeta{
      display:flex;
      gap:10px;
      align-items:baseline;
      justify-content:space-between;
      margin-bottom:10px;
      white-space:nowrap;
    }
    .histMeta .date{ font-size:16px; }
    .histMeta .nights{ opacity:0.8; font-size:14px; }
    .histPills{
      display:flex;
      flex-wrap:nowrap;
      gap:8px;
      white-space:nowrap;
      overflow:hidden;
    }
    .histActions{
      display:flex;
      justify-content:flex-end;
      margin-top:10px;
    }

    /* collapsibles */
    .miniPanel{
      border:1px solid rgba(255,255,255,0.12);
      border-radius:18px;
      padding:12px;
      margin:10px 0;
      background:rgba(255,255,255,0.03);
    }
    .catPanel{
      border:none;
      background:transparent;
      padding:0;
    }
    .catPanel .miniToggle{ margin:0; }
    .catPanel #catList_v5{ margin-top:8px; }
    .miniToggle{
      width:100%;
      text-align:left;
      margin:10px 0;
    }
    .miniRow{
      display:flex;
      gap:10px;
      align-items:center;
      flex-wrap:wrap;
    }
    .miniRow input[type=text]{ flex:1 1 180px; }

    /* hide bottom fixed nav if an old layout still exists */
    #bottomNav, #bottomBar, #bottomButtons, .bottomNav, .bottomBar, .bottomButtons, .bottom-tabs, .bottomTabs, .fixedBottom, .stickyBottom{
      display:none !important;
    }
  `;
  const st = document.createElement("style");
  st.id = "dynamicStyles_v5";
  st.textContent = css;
  document.head.appendChild(st);
}

function showDeleteConfirmV5(message, onYes, onNo) {
  const p = document.createElement("div");
  p.textContent = message;
  p.style.fontSize = "16px";
  p.style.lineHeight = "1.4";
  openModal({
    title: "確認",
    bodyNodes: [p],
    okText: "削除OK",
    cancelText: "キャンセル",
    onOk: () => { onYes && onYes(); },
    onCancel: () => { onNo && onNo(); }
  });
}

function setupMasterCollapsiblesV5() {
  // 作業内容マスター折りたたみ
  const master = document.getElementById("master");
  if (master && !document.getElementById("masterWrap_v5")) {
    const wrap = document.createElement("div");
    wrap.id = "masterWrap_v5";
    wrap.style.display = "none";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "masterToggleBtn_v5";
    btn.className = "miniToggle";
    btn.textContent = "作業内容マスター 表示";

    master.parentNode.insertBefore(btn, master);
    master.parentNode.insertBefore(wrap, master);
    wrap.appendChild(master);

    btn.addEventListener("click", () => {
      const open = wrap.style.display !== "none";
      wrap.style.display = open ? "none" : "";
      btn.textContent = open ? "作業内容マスター 表示" : "作業内容マスター 非表示";
    });
  }

  // 区分マスター
  const inputView = document.getElementById("viewInput") || document.body;
  if (!document.getElementById("catMasterPanel_v5")) {
    const panel = document.createElement("div");
    panel.id = "catMasterPanel_v5";
    panel.className = "miniPanel catPanel";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "miniToggle";
    toggle.textContent = "区分マスター 表示";

    const body = document.createElement("div");
    body.style.display = "none";

    const row = document.createElement("div");
    row.className = "miniRow";

    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = "区分名を追加";
    inp.id = "catName_v5";

    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "追加";

    row.appendChild(inp);
    row.appendChild(add);

    const list = document.createElement("div");
    list.id = "catList_v5";
    list.style.marginTop = "10px";

    const rerenderAll = () => {
      renderTaskChips();
      renderMaster();
      renderReco();
      renderHistory();
    };

    const render = () => {
      const cats = getCats();
      list.innerHTML = "";
      cats.forEach((c, idx) => {
        const r = document.createElement("div");
        r.className = "miniRow";
        r.style.margin = "6px 0";

        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = c;

        const up = document.createElement("button");
        up.type = "button";
        up.className = "small";
        up.textContent = "上へ";
        up.disabled = idx === 0;

        const down = document.createElement("button");
        down.type = "button";
        down.className = "small";
        down.textContent = "下へ";
        down.disabled = idx === cats.length - 1;

        const del = document.createElement("button");
        del.type = "button";
        del.className = "small danger";
        del.textContent = "削除";
        // 削除は 最低1件残る範囲で許可
        up.addEventListener("click", () => {
          const arr = getCats();
          if (idx <= 0 || idx >= arr.length) return;
          const tmp = arr[idx - 1];
          arr[idx - 1] = arr[idx];
          arr[idx] = tmp;
          saveCats(arr);
          render();
          rerenderAll();
        });

        down.addEventListener("click", () => {
          const arr = getCats();
          if (idx < 0 || idx >= arr.length - 1) return;
          const tmp = arr[idx + 1];
          arr[idx + 1] = arr[idx];
          arr[idx] = tmp;
          saveCats(arr);
          render();
          rerenderAll();
        });

        del.addEventListener("click", () => {
          const name = c;
          const catsNow = getCats();
          if (catsNow.length <= 1) {
            showAlert("確認", "区分は最低1つ必要");
            return;
          }
          showDeleteConfirmV5("区分を削除", () => {
            const next = catsNow.filter(x => x !== name);
            saveCats(next);

            // 既存タスクの区分を退避
            const ts = loadTasks();
            const fallback = next[0] ? String(next[0]) : "その他";
            ts.forEach(t => {
              if (String(t.cat ?? "") === name) t.cat = fallback;
            });
            saveTasks(ts);

            render();
            rerenderAll();
          }, () => {});
        });


        r.appendChild(pill);
        r.appendChild(up);
        r.appendChild(down);
        r.appendChild(del);
        list.appendChild(r);
      });
    };

    add.addEventListener("click", () => {
      const name = String(inp.value ?? "").trim();
      if (!name) return;
      const cats = getCats();
      if (cats.includes(name)) {
        showAlert("確認", "同名が既に存在");
        return;
      }
      cats.push(name);
      saveCats(cats);
      inp.value = "";
      render();
      rerenderAll();
    });

    toggle.addEventListener("click", () => {
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "";
      toggle.textContent = open ? "区分マスター 表示" : "区分マスター 非表示";
    });

    body.appendChild(row);
    body.appendChild(list);
    panel.appendChild(toggle);
    panel.appendChild(body);

    // 作業内容マスターの下に入れる
    const masterWrap = document.getElementById("masterWrap_v5");
    const masterToggleBtn = document.getElementById("masterToggleBtn_v5");
    if (masterWrap && masterWrap.parentNode) {
      masterWrap.parentNode.insertBefore(panel, masterWrap.nextSibling);
    } else if (master && master.parentNode) {
      master.parentNode.insertBefore(panel, master.nextSibling);
    } else {
      inputView.appendChild(panel);
    }

    render();
  }
}


function clampColor(hex, fallback) {
  if (typeof hex !== "string") return fallback;
  const v = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback;
}

function normalizeIntOrNull(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0) return null;
  return i;
}

function daysBetween(isoA, isoB) {
  // isoA <= isoB を想定
  const a = new Date(`${isoA}T00:00:00`);
  const b = new Date(`${isoB}T00:00:00`);
  const ms = b.getTime() - a.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86400000);
}

/* rows 互換
  既存: { id, date, nights, tasks:[string], other }
*/
function loadRows() {
  const rows = loadJSON(STORAGE_KEY, []);
  if (!Array.isArray(rows)) return [];
  return rows;
}

function saveRows(rows) {
  saveJSON(STORAGE_KEY, rows);
}

/* tasks master 互換
  v2: [ "トイレ", "風呂", ... ]
  v3: [ { name, cat, freqDays, bg, text }, ... ]
*/
function migrateTasks(raw) {
  if (!raw) return null;

  if (Array.isArray(raw) && raw.every(x => typeof x === "string")) {
    // 区分推測は禁止なので 一律 その他 を既定値として移行
    return raw
      .map(s => String(s).trim())
      .filter(s => s.length > 0)
      .map(s => ({
        name: s,
        cat: "その他",
        freqDays: null,
        bg: "#0f0f0f",
        text: "#f0f0f0"
      }));
  }

  if (Array.isArray(raw) && raw.every(x => x && typeof x === "object" && typeof x.name === "string")) {
    return raw.map(x => ({
      name: String(x.name).trim(),
      cat: getCats().includes(x.cat) ? x.cat : "その他",
      freqDays: normalizeIntOrNull(x.freqDays),
      bg: clampColor(x.bg, "#0f0f0f"),
      text: clampColor(x.text, "#f0f0f0")
    })).filter(x => x.name.length > 0);
  }

  return null;
}

function ensureDefaultTasks() {
  const raw = loadJSON(TASKS_KEY, null);
  const migrated = migrateTasks(raw);

  if (migrated && migrated.length > 0) {
    // unique by name keep first
    const seen = new Set();
    const uniq = [];
    migrated.forEach(t => {
      if (seen.has(t.name)) return;
      seen.add(t.name);
      uniq.push(t);
    });
    saveJSON(TASKS_KEY, uniq);
    return uniq;
  }

  const base = defaultTaskNames.map(s => ({
    name: s,
    cat: "その他",
    freqDays: null,
    bg: "#0f0f0f",
    text: "#f0f0f0"
  }));
  saveJSON(TASKS_KEY, base);
  return base;
}

function loadTasks() {
  const raw = loadJSON(TASKS_KEY, null);
  const migrated = migrateTasks(raw);
  if (migrated && migrated.length > 0) return migrated;
  return ensureDefaultTasks();
}

function saveTasks(tasks) {
  const cleaned = (tasks || [])
    .filter(x => x && typeof x === "object")
    .map(x => ({
      name: String(x.name ?? "").trim(),
      cat: getCats().includes(x.cat) ? x.cat : "その他",
      freqDays: normalizeIntOrNull(x.freqDays),
      bg: clampColor(x.bg, "#0f0f0f"),
      text: clampColor(x.text, "#f0f0f0")
    }))
    .filter(x => x.name.length > 0);

  // unique by name keep first
  const seen = new Set();
  const uniq = [];
  cleaned.forEach(t => {
    if (seen.has(t.name)) return;
    seen.add(t.name);
    uniq.push(t);
  });

  saveJSON(TASKS_KEY, uniq);
  return uniq;
}

/* app name */
function loadAppName() {
  const v = localStorage.getItem(APPNAME_KEY);
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : "メンテログ";
}
function saveAppName(v) {
  const s = String(v ?? "").trim();
  if (s.length === 0) {
    localStorage.removeItem(APPNAME_KEY);
    return "メンテログ";
  }
  localStorage.setItem(APPNAME_KEY, s);
  return s;
}
function applyAppName() {
  const name = loadAppName();
  $("appTitle").textContent = name;
  document.title = name;
  $("appName").value = name;
}

function renderStatus() {
  const rows = loadRows();
  $("status").textContent = `記録 ${rows.length}件`;
}

/* tasks selection */
function tasksByCat(tasks) {
  const map = { "掃除": [], "洗濯": [], "その他": [] };
  tasks.forEach(t => {
    const cat = getCats().includes(t.cat) ? t.cat : "その他";
    map[cat].push(t);
  });
  return map;
}

function renderTaskChips() {
  const tasks = loadTasks();
  const byCat = tasksByCat(tasks);
  const area = $("tasksArea");
  area.innerHTML = "";

  getCats().forEach(cat => {
    const items = byCat[cat] || [];
    const title = document.createElement("div");
    title.className = "groupTitle";
    title.textContent = cat;
    area.appendChild(title);

    const wrap = document.createElement("div");
    wrap.className = "chips";

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "未設定";
      wrap.appendChild(empty);
    } else {
      items.forEach(t => {
        const label = document.createElement("label");
        label.className = "chip";
        label.setAttribute("data-color", "1");
        label.style.background = t.bg || "#0f0f0f";
        label.style.color = t.text || "#f0f0f0";
        label.style.borderColor = "rgba(255,255,255,0.18)";
        label.innerHTML = `
          <input type="checkbox" value="${escapeHtml(t.name)}" />
          <span>${escapeHtml(t.name)}</span>
        `;
        wrap.appendChild(label);
      });
    }

    area.appendChild(wrap);
  });
}

function getSelectedTasks() {
  const area = $("tasksArea");
  const checks = Array.from(area.querySelectorAll("input[type=checkbox]"));
  return checks.filter(c => c.checked).map(c => c.value);
}

function clearInput() {
  $("date").value = todayISO();
  $("nights").value = "";
  $("other").value = "";
  const area = $("tasksArea");
  Array.from(area.querySelectorAll("input[type=checkbox]")).forEach(c => c.checked = false);
}

/* rows add delete */
function addRow(row) {
  const rows = loadRows();
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  rows.push({ id, ...row });
  saveRows(rows);
  return id;
}

function deleteRow(id) {
  const rows = loadRows();
  const next = rows.filter(r => r.id !== id);
  saveRows(next);
}

function rowSummaryParts(r) {
  const tasks = Array.isArray(r.tasks) ? r.tasks : [];
  const other = String(r.other ?? "").trim();
  const parts = [];
  tasks.forEach(t => parts.push(t));
  if (other.length > 0) parts.push(other);
  return parts;
}

function taskStyleByName(name) {
  const tasks = loadTasks();
  const hit = tasks.find(t => t.name === name);
  if (!hit) return null;
  return { bg: hit.bg || "#0f0f0f", text: hit.text || "#f0f0f0" };
}

let sortMode = "desc";

function renderHistory() {
  const rows = loadRows().slice();
  rows.sort((a, b) => {
    const ad = String(a.date ?? "");
    const bd = String(b.date ?? "");
    if (sortMode === "asc") return ad.localeCompare(bd);
    return bd.localeCompare(ad);
  });

  const body = $("historyBody");
  body.innerHTML = "";

  if (rows.length === 0) {
    body.innerHTML = `<div class="muted">記録なし</div>`;
    return;
  }

  const cats = getCats();
  const tasks = loadTasks();

  const fallbackCat = () => {
    if (cats.includes("その他")) return "その他";
    return cats[0] ? String(cats[0]) : "その他";
  };

  function taskCatByName(name) {
    const hit = tasks.find(t => t.name === name);
    const c = hit ? String(hit.cat ?? "").trim() : "";
    return cats.includes(c) ? c : fallbackCat();
  }

  const blocks = rows.map(r => {
    const taskNames = Array.isArray(r.tasks) ? r.tasks.slice() : [];
    const byCat = {};
    cats.forEach(c => byCat[c] = []);

    taskNames.forEach(nm => {
      const c = taskCatByName(nm);
      if (!byCat[c]) byCat[c] = [];
      byCat[c].push(nm);
    });

    const other = String(r.other ?? "").trim();
    if (other.length > 0) {
            const oc = fallbackCat();
      if (!byCat[oc]) byCat[oc] = [];
      byCat[oc].push(other);
    }

    const dateTxt = r.date ? formatJP(r.date) : "日付不明";
    const daysTxt = (r.nights === 0 || r.nights) ? String(r.nights) : "";
    const daysPart = daysTxt !== "" ? `${escapeHtml(daysTxt)}日` : "";

    const catRows = cats.map(cat => {
      const items = byCat[cat] || [];
      if (!items.length) return "";
      const pills = items.map(name => {
        const style = taskStyleByName(name);
        if (style) {
          return `<span class="pill" style="background:${escapeHtml(style.bg)};color:${escapeHtml(style.text)}">${escapeHtml(name)}</span>`;
        }
        return `<span class="pill">${escapeHtml(name)}</span>`;
      }).join("");
      return `
        <div class="histCatRow">
          <div class="histCatLabel">${escapeHtml(cat)}</div>
          <div class="histCatPills">${pills}</div>
        </div>
      `;
    }).filter(Boolean).join("");

    return `
      <div class="histEntry">
        <div class="histHeader">
          <div class="histHeadLeft">
            <div class="histDate">${escapeHtml(dateTxt)}</div>
            <div class="histDays">${daysPart}</div>
          </div>
          <button type="button" class="histDelBtn" data-del="${escapeHtml(r.id)}">削除</button>
        </div>
        <div class="histScroll"><div class="histInner">${catRows}</div></div>
      </div>
    `;
  }).join("");

  body.innerHTML = `<div class="histList">${blocks}</div>`;

  Array.from(body.querySelectorAll("button[data-del]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      if (!id) return;
      showDeleteConfirmV5("この行を削除", () => {
        deleteRow(id);
        renderStatus();
        renderHistory();
        renderReco();
      }, () => {});
    });
  });
}

/* master UI */
function renderMaster() {
  syncNewCatSelect();
  const tasks = loadTasks();
  const box = $("master");
  box.innerHTML = "";

  if (tasks.length === 0) {
    box.innerHTML = `<div class="muted">未設定</div>`;
    return;
  }

  tasks.forEach((t, idx) => {
    const div = document.createElement("div");
    div.className = "masterItem";

    const freqTxt = (t.freqDays && t.freqDays > 0) ? `${t.freqDays}日` : "未設定";

    div.innerHTML = `
      <div class="masterName">${escapeHtml(t.name)}</div>
      <span class="tag">${escapeHtml(t.cat)}</span>
      <span class="tag">頻度 ${escapeHtml(freqTxt)}</span>
      <div class="colorPick">
        <input data-bg="${idx}" type="color" value="${escapeHtml(clampColor(t.bg, "#0f0f0f"))}" />
        <input data-text="${idx}" type="color" value="${escapeHtml(clampColor(t.text, "#f0f0f0"))}" />
      </div>

      <button class="small" data-up="${idx}" type="button">上へ</button>
      <button class="small" data-down="${idx}" type="button">下へ</button>
      <button class="small" data-edit="${idx}" type="button">編集</button>
      <button class="small danger" data-del-task="${idx}" type="button">削除</button>
    `;
    box.appendChild(div);
  });

  // delete
  Array.from(box.querySelectorAll("button[data-del-task]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-del-task"));
      if (!Number.isFinite(i)) return;
      const tasks2 = loadTasks();
      const target = tasks2[i];
      if (!target) return;
      showDeleteConfirmV5("選択肢を削除", () => { tasks2.splice(i,1); saveTasks(tasks2); renderTaskChips(); renderMaster(); renderReco(); }, () => {}); return;
    });
  });

  // move
  Array.from(box.querySelectorAll("button[data-up]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-up"));
      if (!Number.isFinite(i) || i <= 0) return;
      const tasks2 = loadTasks();
      const tmp = tasks2[i - 1];
      tasks2[i - 1] = tasks2[i];
      tasks2[i] = tmp;
      saveTasks(tasks2);
      renderTaskChips();
      renderMaster();
    });
  });
  Array.from(box.querySelectorAll("button[data-down]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-down"));
      const tasks2 = loadTasks();
      if (!Number.isFinite(i) || i >= tasks2.length - 1) return;
      const tmp = tasks2[i + 1];
      tasks2[i + 1] = tasks2[i];
      tasks2[i] = tmp;
      saveTasks(tasks2);
      renderTaskChips();
      renderMaster();
    });
  });

  // edit
  Array.from(box.querySelectorAll("button[data-edit]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-edit"));
      if (!Number.isFinite(i)) return;
      const tasks2 = loadTasks();
      const t = tasks2[i];
      if (!t) return;

      showModal("項目を編集", [
        {id:"name", label:"項目名", type:"text", value:t.name},
        {id:"cat", label:"区分", type:"select", value:t.cat, options:getCats()},
        {id:"freq", label:"推奨頻度 日数 空欄で未設定", type:"number", value:(t.freqDays && t.freqDays>0)?String(t.freqDays):"", inputmode:"numeric"}
      ], (out) => {
        const nm = String(out.name ?? "").trim();
        if (nm.length === 0) return;
        const catsNow = getCats();
        const ct = catsNow.includes(String(out.cat).trim()) ? String(out.cat).trim() : "その他";
        const fd = normalizeIntOrNull(String(out.freq ?? "").trim());
        const freqDays = (fd && fd > 0) ? fd : null;

        const exists = tasks2.find((x, idx) => idx !== i && x.name === nm);
        if (exists) {
          showAlert("確認", "同名が既に存在");
          return;
        }

        tasks2[i] = { ...t, name: nm, cat: ct, freqDays };
        saveTasks(tasks2);
        renderTaskChips();
        renderMaster();
        renderReco();
      }, () => {});
    });
  });

  // color change
  Array.from(box.querySelectorAll("input[data-bg]")).forEach(inp => {
    inp.addEventListener("input", () => {
      const i = Number(inp.getAttribute("data-bg"));
      const tasks2 = loadTasks();
      if (!tasks2[i]) return;
      tasks2[i].bg = clampColor(inp.value, "#0f0f0f");
      saveTasks(tasks2);
      renderTaskChips();
      renderHistory();
      renderReco();
    });
  });
  Array.from(box.querySelectorAll("input[data-text]")).forEach(inp => {
    inp.addEventListener("input", () => {
      const i = Number(inp.getAttribute("data-text"));
      const tasks2 = loadTasks();
      if (!tasks2[i]) return;
      tasks2[i].text = clampColor(inp.value, "#f0f0f0");
      saveTasks(tasks2);
      renderTaskChips();
      renderHistory();
      renderReco();
    });
  });
}

function addTaskFromInputs() {
  const name = String($("newTask").value ?? "").trim();
  if (name.length === 0) return;

  const cat = String($("newCat") ? $("newCat").value : "" ?? "").trim();
  const catsNow = getCats();
  const ct = catsNow.includes(cat) ? cat : (catsNow[0] || "その他");

  const freqRaw = $("newFreq").value;
  const fd = normalizeIntOrNull(freqRaw);
  const freqDays = (fd && fd > 0) ? fd : null;

  const bg = clampColor($("newBg").value, "#0f0f0f");
  const text = clampColor($("newText").value, "#f0f0f0");

  const tasks = loadTasks();
  const exists = tasks.find(t => t.name === name);
  if (exists) {
    showAlert("確認", "同名が既に存在");
    return;
  }

  tasks.push({ name, cat: ct, freqDays, bg, text });
  saveTasks(tasks);

  $("newTask").value = "";
  $("newFreq").value = "";
  $("newBg").value = "#0f0f0f";
  $("newText").value = "#f0f0f0";

  renderTaskChips();
  renderMaster();
  renderReco();
}

/* recommendation */
function lastDoneMap(rows) {
  const map = new Map(); // name -> iso date max
  rows.forEach(r => {
    const iso = String(r.date ?? "");
    if (!iso) return;
    const tasks = Array.isArray(r.tasks) ? r.tasks : [];
    tasks.forEach(name => {
      const prev = map.get(name);
      if (!prev || prev.localeCompare(iso) < 0) map.set(name, iso);
    });
  });
  return map;
}

function renderReco() {
  const tasks = loadTasks();
  const rows = loadRows();
  const map = lastDoneMap(rows);
  const today = todayISO();

  const targets = tasks
    .filter(t => t.freqDays && t.freqDays > 0)
    .map(t => {
      const last = map.get(t.name) || null;
      let elapsed = null;
      if (last) elapsed = daysBetween(last, today);
      const due = (elapsed === null) ? true : (elapsed >= t.freqDays);
      const over = (elapsed === null) ? (t.freqDays) : (elapsed - t.freqDays);
      return { ...t, last, elapsed, due, over };
    });

  const box = $("reco");
  if (targets.length === 0) {
    box.textContent = "推奨頻度が設定された項目のみ表示";
    return;
  }

  // sort: due first, then larger over
  targets.sort((a, b) => {
    const ad = a.due ? 1 : 0;
    const bd = b.due ? 1 : 0;
    if (ad !== bd) return bd - ad;
    const ao = Number(a.over ?? 0);
    const bo = Number(b.over ?? 0);
    return bo - ao;
  });

  const wrap = document.createElement("div");
  targets.forEach(t => {
    const item = document.createElement("div");
    item.className = "recoItem";

    const left = document.createElement("div");
    left.className = "recoName";
    left.textContent = t.name;
    left.style.color = t.text || "#f0f0f0";

    const meta = document.createElement("div");
    meta.className = "recoMeta";

    const lastTxt = t.last ? formatJP(t.last) : "未実施";
    const elapsedTxt = (t.elapsed === null) ? "不明" : `${t.elapsed}日経過`;
    const freqTxt = `${t.freqDays}日`;
    const dueTxt = t.due ? "要実施" : "猶予";

    meta.innerHTML = `
      <div>${escapeHtml(dueTxt)}</div>
      <div>${escapeHtml(lastTxt)}</div>
      <div>${escapeHtml(elapsedTxt)} 閾値 ${escapeHtml(freqTxt)}</div>
    `;

    item.style.background = "transparent";
    item.appendChild(left);
    item.appendChild(meta);
    wrap.appendChild(item);
  });

  box.innerHTML = "";
  box.appendChild(wrap);
}

/* export import */
function exportJSON() {
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    appName: loadAppName(),
    tasks: loadTasks(),
    rows: loadRows()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maintelog_backup_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload || typeof payload !== "object") throw new Error("bad");

      // appName optional
      if (typeof payload.appName === "string") saveAppName(payload.appName);

      // tasks
      if (Array.isArray(payload.tasks)) {
        const migrated = migrateTasks(payload.tasks);
        if (migrated) saveTasks(migrated);
      }

      // rows
      if (Array.isArray(payload.rows)) {
        saveRows(payload.rows);
      }

      boot();
      showAlert("確認", "復元完了");
    } catch {
      showAlert("確認", "読み込み失敗");
    }
  };
  reader.readAsText(file);
}

/* view */
function setView(which) {
  const inputBtn = $("tabInput");
  const histBtn = $("tabHistory");
  const viewInput = $("viewInput");
  const viewHistory = $("viewHistory");

  const isInput = which === "input";
  if (viewInput) viewInput.style.display = isInput ? "" : "none";
  if (viewHistory) viewHistory.style.display = isInput ? "none" : "";

  if (inputBtn) inputBtn.classList.toggle("active", isInput);
  if (histBtn) histBtn.classList.toggle("active", !isInput);

  if (!isInput) {
    renderReco();
    renderHistory();
  }
}

function boot() {
  ensureDynamicStylesV5();
  ensureDefaultTasks();

  $("date").value = todayISO();

  applyAppName();
  renderStatus();
  renderTaskChips();
  renderMaster();
  renderReco();
  renderHistory();
  setView("input");
  setupMasterCollapsiblesV5();
}

/* events */
function bindIf(id, type, handler) {
  const el = $(id);
  if (el) el.addEventListener(type, handler);
}

bindIf("tabInput", "click", () => setView("input"));
bindIf("tabHistory", "click", () => setView("history"));
bindIf("footInput", "click", () => setView("input"));
bindIf("footHistory", "click", () => setView("history"));
bindIf("goInput", "click", () => setView("input"));

bindIf("save", "click", () => {
  const date = $("date").value || "";
  const nights = normalizeIntOrNull($("nights").value);
  const tasks = getSelectedTasks();
  const other = $("other").value || "";

  if (!date) {
    showAlert("確認", "日付は必須");
    return;
  }
  if (tasks.length === 0 && String(other).trim().length === 0 && (nights === null)) {
    return;
  }

  addRow({ date, nights, tasks, other });
  clearInput();
  renderStatus();
});

bindIf("clear", "click", () => clearInput());

bindIf("wipe", "click", () => {
  showConfirm("確認","全データ削除", () => {
    saveRows([]);
    saveTasks(ensureDefaultTasks());
    localStorage.removeItem(APPNAME_KEY);
    boot();
  }, () => {});
});

bindIf("addTask", "click", () => addTaskFromInputs());
bindIf("newTask", "keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTaskFromInputs();
  }
});

bindIf("sortDesc", "click", () => { sortMode = "desc"; renderHistory(); });
bindIf("sortAsc", "click", () => { sortMode = "asc"; renderHistory(); });

bindIf("export", "click", () => exportJSON());
bindIf("import", "change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  importJSON(file);
  e.target.value = "";
});

bindIf("saveAppName", "click", () => {
  saveAppName($("appName").value);
  applyAppName();
  showAlert("確認", "保存完了");
});
bindIf("resetAppName", "click", () => {
  localStorage.removeItem(APPNAME_KEY);
  applyAppName();
});

boot();