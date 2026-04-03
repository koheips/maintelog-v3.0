/* メンテログ app.js v18c-dev-20260402
   主な変更点
   ・3タブ構成（入力／履歴／設定）
   ・推奨作業：要対応のみ入力タブ最上部に表示
   ・トリガー種別：経過日数 / 累計滞在日数（個別設定）
   ・「泊数」→「滞在日数」
   ・履歴：縦タイムライン、行タップで編集・削除展開
   ・全体UIフラット化
*/

const BUILD_ID = "v18c-dev-20260402";
console.info("[maintelog] build", BUILD_ID);

/* ── カラーパレット（グリッド用） ── */
const COLOR_PALETTE = [
  // ダーク系背景
  "#0f0f0f","#1c1c1e","#2c2c2e","#1a1a2e","#0d1b2a","#1a2a1a",
  // 有彩色背景
  "#1a3a6a","#0a3a2a","#3a1a0a","#2a0a3a","#3a0a1a","#1a2a3a",
  "#0f2744","#0f3320","#3d1a00","#280040","#400020","#003040",
  // テキスト（明るい系）
  "#ffffff","#f2f2f7","#e5e5ea","#d1d1d6","#aeaeb2","#8e8e93",
  // アクセント
  "#2f7cf6","#30d158","#ffd60a","#ff9f0a","#ff453a","#bf5af2",
  "#64d2ff","#5e5ce6","#ff6b6b","#ffa500","#00c896","#ff2d55",
];



const STORAGE_KEY = "maintelog_rows_v2";
const TASKS_KEY   = "maintelog_tasks_v2";
const APPNAME_KEY = "maintelog_appname_v3";
const CATS_KEY    = "maintelog_cats_v1";
const DEFAULT_CATS = ["掃除","洗濯","その他"];

/* ── ストレージ ── */
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (_) {
    showAlert("ストレージエラー", "端末の空き容量が不足しています。JSONエクスポートでバックアップ後、不要データを削除してください。");
    return false;
  }
}
function loadJSON(key, fb) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; } }
function saveJSON(key, val) { safeSet(key, JSON.stringify(val)); }

/* ── 区分 ── */
function loadCats() {
  try {
    const raw = localStorage.getItem(CATS_KEY);
    if (!raw) return DEFAULT_CATS.slice();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return DEFAULT_CATS.slice();
    const out = [], seen = new Set();
    arr.forEach(v => { const s = String(v ?? "").trim(); if (s && !seen.has(s)) { seen.add(s); out.push(s); } });
    return out.length ? out : DEFAULT_CATS.slice();
  } catch { return DEFAULT_CATS.slice(); }
}
function saveCats(cats) {
  const out = [], seen = new Set();
  (cats || []).forEach(v => { const s = String(v ?? "").trim(); if (s && !seen.has(s)) { seen.add(s); out.push(s); } });
  safeSet(CATS_KEY, JSON.stringify(out.length ? out : DEFAULT_CATS.slice()));
}
function getCats() { return loadCats(); }

function syncNewCatSelect() {
  const sel = document.getElementById("newCat"); if (!sel) return;
  const cats = getCats(); sel.innerHTML = "";
  (cats.length ? cats : ["その他"]).forEach(c => {
    const o = document.createElement("option"); o.value = o.textContent = c; sel.appendChild(o);
  });
  if (!sel.value && sel.options.length) sel.value = sel.options[0].value;
}

const defaultTaskNames = ["拭き掃除","掃除機","風呂","トイレ","洗濯","庭"];
const $ = id => document.getElementById(id);

/* ── モーダル（下から出るシート型） ── */
function openModal(opts) {
  const ov = $("modalOverlay"), body = $("modalBody"), ttl = $("modalTitle");
  const okBtn = $("modalOk"), canBtn = $("modalCancel");
  ttl.textContent = opts.title || "";
  body.innerHTML = "";
  if (opts.bodyNodes) opts.bodyNodes.forEach(n => body.appendChild(n));
  okBtn.textContent  = opts.okText     || "OK";
  canBtn.textContent = opts.cancelText || "キャンセル";
  canBtn.style.display = opts.hideCancel ? "none" : "";
  document.body.style.overflow = "hidden";
  ov.classList.remove("hidden");
  const cleanup = () => {
    okBtn.onclick = canBtn.onclick = null;
    ov.classList.add("hidden");
    canBtn.style.display = "";
    document.body.style.overflow = "";
  };
  okBtn.onclick  = () => { cleanup(); opts.onOk    && opts.onOk();    };
  canBtn.onclick = () => { cleanup(); opts.onCancel && opts.onCancel(); };
  // 背景タップで閉じる
  ov.onclick = e => { if (e.target === ov) { cleanup(); opts.onCancel && opts.onCancel(); } };
  const first = body.querySelector("input,select,textarea");
  if (first) setTimeout(() => first.focus(), 50);
}

function showAlert(title, message, onClose) {
  const p = document.createElement("div"); p.textContent = message;
  p.style.cssText = "font-size:15px;line-height:1.6;color:var(--text2);";
  openModal({ title, bodyNodes:[p], okText:"閉じる", hideCancel:true,
    onOk: () => onClose && onClose(), onCancel: () => onClose && onClose() });
}
function showConfirm(title, message, onYes, onNo) {
  const p = document.createElement("div"); p.textContent = message;
  p.style.cssText = "font-size:15px;line-height:1.6;color:var(--text2);";
  openModal({ title, bodyNodes:[p], okText:"OK", cancelText:"キャンセル",
    onOk: () => onYes && onYes(), onCancel: () => onNo && onNo() });
}
function showDeleteConfirm(message, onYes, onNo) {
  const p = document.createElement("div"); p.textContent = message;
  p.style.cssText = "font-size:15px;line-height:1.6;color:var(--text2);";
  openModal({ title:"削除の確認", bodyNodes:[p], okText:"削除", cancelText:"キャンセル",
    onOk: () => onYes && onYes(), onCancel: () => onNo && onNo() });
}

/* ── ユーティリティ ── */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatJP(iso) { if (!iso) return ""; const [y,m,d] = iso.split("-"); return `${y}/${m}/${d}`; }
function escapeHtml(s) {
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function clampColor(hex, fb) {
  return (typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex.trim())) ? hex.trim() : fb;
}
function normalizeIntOrNull(raw) {
  if (raw === "" || raw == null) return null;
  const n = Number(raw); if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n); return i <= 0 ? null : i;
}
function daysBetween(a, b) {
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null;
}

/* ── カラーグリッドUI ── */
function createColorGrid(currentColor, onChange, opts) {
  // opts: { hiddenInputId }
  const wrap = document.createElement("div");

  const grid = document.createElement("div");
  grid.className = "color-grid";

  const swatches = [];
  const updateSelected = (hex) => {
    swatches.forEach(sw => sw.classList.toggle("selected", sw.dataset.color === hex));
  };

  COLOR_PALETTE.forEach(hex => {
    const sw = document.createElement("div");
    sw.className = "color-swatch";
    sw.dataset.color = hex;
    sw.style.background = hex;
    if (hex === currentColor) sw.classList.add("selected");
    sw.addEventListener("click", () => {
      updateSelected(hex);
      onChange(hex);
    });
    swatches.push(sw);
    grid.appendChild(sw);
  });

  // カスタム色ボタン（ネイティブピッカー呼び出し）
  const customBtn = document.createElement("label");
  customBtn.className = "color-swatch-custom";
  customBtn.title = "カスタム色";
  customBtn.textContent = "+";
  const hiddenInp = document.createElement("input");
  hiddenInp.type = "color";
  hiddenInp.value = currentColor || "#ffffff";
  if (opts && opts.hiddenInputId) hiddenInp.id = opts.hiddenInputId;
  hiddenInp.addEventListener("input", () => {
    const hex = hiddenInp.value;
    updateSelected(hex);
    onChange(hex);
  });
  customBtn.appendChild(hiddenInp);
  grid.appendChild(customBtn);

  wrap.appendChild(grid);
  return { el: wrap, update: updateSelected };
}

function genId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/* ── tasks ── */
function migrateTasks(raw) {
  if (!raw) return null;
  if (Array.isArray(raw) && raw.every(x => typeof x === "string")) {
    return raw.map(s => String(s).trim()).filter(s => s)
      .map(s => ({ name:s, cat:"その他", triggerType:"days", freqDays:null, bg:"#0f0f0f", text:"#f0f0f0" }));
  }
  if (Array.isArray(raw) && raw.every(x => x && typeof x === "object" && typeof x.name === "string")) {
    return raw.map(x => ({
      name: String(x.name).trim(),
      cat:  getCats().includes(x.cat) ? x.cat : "その他",
      triggerType: (x.triggerType === "nights") ? "nights" : "days",
      freqDays: normalizeIntOrNull(x.freqDays),
      bg:   clampColor(x.bg,   "#0f0f0f"),
      text: clampColor(x.text, "#f0f0f0")
    })).filter(x => x.name.length > 0);
  }
  return null;
}
function ensureDefaultTasks() {
  const m = migrateTasks(loadJSON(TASKS_KEY, null));
  if (m && m.length) {
    const seen = new Set(), uniq = [];
    m.forEach(t => { if (!seen.has(t.name)) { seen.add(t.name); uniq.push(t); } });
    saveJSON(TASKS_KEY, uniq); return uniq;
  }
  const base = defaultTaskNames.map(s => ({ name:s, cat:"その他", triggerType:"days", freqDays:null, bg:"#0f0f0f", text:"#f0f0f0" }));
  saveJSON(TASKS_KEY, base); return base;
}
function loadTasks() {
  const m = migrateTasks(loadJSON(TASKS_KEY, null));
  return (m && m.length) ? m : ensureDefaultTasks();
}
function saveTasks(tasks) {
  const seen = new Set(), uniq = [];
  (tasks || []).filter(x => x && typeof x === "object")
    .map(x => ({
      name: String(x.name ?? "").trim(),
      cat:  getCats().includes(x.cat) ? x.cat : "その他",
      triggerType: (x.triggerType === "nights") ? "nights" : "days",
      freqDays: normalizeIntOrNull(x.freqDays),
      bg:   clampColor(x.bg,   "#0f0f0f"),
      text: clampColor(x.text, "#f0f0f0")
    }))
    .filter(x => x.name.length)
    .forEach(t => { if (!seen.has(t.name)) { seen.add(t.name); uniq.push(t); } });
  saveJSON(TASKS_KEY, uniq); return uniq;
}

/* ── rows ── */
function loadRows() { const r = loadJSON(STORAGE_KEY, []); return Array.isArray(r) ? r : []; }
function saveRows(rows) { saveJSON(STORAGE_KEY, rows); }
function addRow(row)    { const rows = loadRows(); rows.push({ id:genId(), ...row }); saveRows(rows); }
function deleteRow(id)  { saveRows(loadRows().filter(r => r.id !== id)); }
function updateRow(id, patch) {
  const rows = loadRows(), idx = rows.findIndex(r => r.id === id);
  if (idx === -1) return; rows[idx] = { ...rows[idx], ...patch }; saveRows(rows);
}

/* ── アプリ名 ── */
function loadAppName() { const s = String(localStorage.getItem(APPNAME_KEY) ?? "").trim(); return s || "メンテログ"; }
function saveAppName(v) {
  const s = String(v ?? "").trim();
  if (!s) { localStorage.removeItem(APPNAME_KEY); return "メンテログ"; }
  localStorage.setItem(APPNAME_KEY, s); return s;
}
function applyAppName() {
  const n = loadAppName();
  $("appTitle").textContent = n; document.title = n; $("appName").value = n;
}
function renderStatus() { $("status").textContent = `記録 ${loadRows().length}件`; }

/* ── 区分別タスク（動的） ── */
function tasksByCat(tasks) {
  const cats = getCats(), map = {};
  cats.forEach(c => map[c] = []);
  tasks.forEach(t => {
    const c = cats.includes(t.cat) ? t.cat : (cats[0] || "その他");
    if (!map[c]) map[c] = []; map[c].push(t);
  });
  return map;
}

/* ── 区分ごとの色（pill表示用） ── */
function catColor(cat) {
  const cats = getCats(), idx = cats.indexOf(cat);
  const palettes = [
    { bg:"rgba(47,124,246,.15)", color:"#6aabff" },
    { bg:"rgba(48,209,88,.12)",  color:"#30d158" },
    { bg:"rgba(255,159,10,.12)", color:"#ffd60a" },
    { bg:"rgba(191,90,242,.12)", color:"#bf5af2" },
    { bg:"rgba(255,69,58,.12)",  color:"#ff6b6b" },
  ];
  return palettes[idx % palettes.length] || palettes[0];
}

/* ── 入力チェックボックス ── */
function renderTaskChips() {
  const tasks = loadTasks(), byCat = tasksByCat(tasks), area = $("tasksArea");
  area.innerHTML = "";
  getCats().forEach(cat => {
    const items = byCat[cat] || [];
    if (!items.length) return;
    const label = document.createElement("div"); label.className = "task-group-label"; label.textContent = cat;
    area.appendChild(label);
    const chips = document.createElement("div"); chips.className = "task-chips";
    items.forEach(t => {
      const lbl = document.createElement("label"); lbl.className = "task-chip";
      lbl.style.borderColor = t.bg !== "#0f0f0f" ? t.bg : "";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = t.name;
      cb.addEventListener("change", () => lbl.classList.toggle("checked", cb.checked));
      const sp = document.createElement("span"); sp.textContent = t.name;
      // カスタム色が設定されている場合はチェック時に適用
      if (t.bg !== "#0f0f0f" || t.text !== "#f0f0f0") {
        cb.addEventListener("change", () => {
          if (cb.checked) { lbl.style.background = t.bg; lbl.style.color = t.text; lbl.style.borderColor = t.bg; }
          else { lbl.style.background = ""; lbl.style.color = ""; lbl.style.borderColor = t.bg !== "#0f0f0f" ? t.bg : ""; }
        });
      }
      lbl.appendChild(cb); lbl.appendChild(sp); chips.appendChild(lbl);
    });
    area.appendChild(chips);
  });
}
function getSelectedTasks() {
  return Array.from($("tasksArea").querySelectorAll("input[type=checkbox]")).filter(c => c.checked).map(c => c.value);
}
function clearInput() {
  $("date").value = todayISO(); $("nights").value = ""; $("other").value = "";
  Array.from($("tasksArea").querySelectorAll("input[type=checkbox]")).forEach(c => {
    c.checked = false; c.dispatchEvent(new Event("change"));
  });
}

/* ── 推奨作業ロジック ── */
function lastDoneMap(rows) {
  const map = new Map();
  rows.forEach(r => {
    const iso = String(r.date ?? ""); if (!iso) return;
    (Array.isArray(r.tasks) ? r.tasks : []).forEach(name => {
      const prev = map.get(name); if (!prev || prev.localeCompare(iso) < 0) map.set(name, iso);
    });
  });
  return map;
}

// 前回実施以降の累計滞在日数を計算
function nightsSinceLastDone(taskName, rows) {
  const sorted = rows.slice().sort((a,b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  let lastDoneIdx = -1;
  sorted.forEach((r, i) => {
    if ((Array.isArray(r.tasks) ? r.tasks : []).includes(taskName)) lastDoneIdx = i;
  });
  if (lastDoneIdx === -1) {
    // 一度も実施していない → 全記録の滞在日数合計
    return sorted.reduce((sum, r) => sum + (Number(r.nights) || 0), 0);
  }
  // 前回実施以降（次のレコードから）の累計
  return sorted.slice(lastDoneIdx + 1).reduce((sum, r) => sum + (Number(r.nights) || 0), 0);
}

function renderReco() {
  const tasks = loadTasks(), rows = loadRows(), map = lastDoneMap(rows), today = todayISO();
  const banner = $("recoBanner"), list = $("recoList");
  if (!banner || !list) return;

  const targets = tasks
    .filter(t => t.freqDays && t.freqDays > 0)
    .map(t => {
      if (t.triggerType === "nights") {
        const cumNights = nightsSinceLastDone(t.name, rows);
        const due  = cumNights >= t.freqDays;
        const over = cumNights - t.freqDays;
        return { ...t, cumNights, due, over, isNightsTrigger: true };
      } else {
        const last    = map.get(t.name) || null;
        const elapsed = last ? daysBetween(last, today) : null;
        const due     = elapsed === null ? true : elapsed >= t.freqDays;
        const over    = elapsed === null ? t.freqDays : elapsed - t.freqDays;
        // 閾値70%以上で「もうすぐ」表示
        const nearDue = !due && elapsed !== null && elapsed >= Math.floor(t.freqDays * 0.7);
        const nextDate = last ? (() => {
          const d = new Date(`${last}T00:00:00`); d.setDate(d.getDate() + t.freqDays);
          return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
        })() : null;
        return { ...t, last, elapsed, due, over, nearDue, nextDate, isNightsTrigger: false };
      }
    })
    .filter(t => {
      if (t.isNightsTrigger) return t.due || t.cumNights >= Math.floor(t.freqDays * 0.7);
      return t.due || t.nearDue;
    });

  targets.sort((a, b) => {
    const ad = (a.due ? 1 : 0), bd = (b.due ? 1 : 0);
    if (ad !== bd) return bd - ad;
    return Number(b.over ?? 0) - Number(a.over ?? 0);
  });

  if (!targets.length) { banner.style.display = "none"; return; }

  list.innerHTML = "";
  targets.forEach(t => {
    const row = document.createElement("div"); row.className = "reco-row";

    const name = document.createElement("span"); name.className = "reco-row-name"; name.textContent = t.name;

    const right = document.createElement("div"); right.className = "reco-row-right";
    const dateEl = document.createElement("span"); dateEl.className = "reco-row-date";
    const badge  = document.createElement("span"); badge.className = "reco-badge";

    // 年を下2桁で短縮
    const fmtShort = iso => {
      if (!iso) return "";
      const [y,m,d] = iso.split("-");
      return `${String(y).slice(2)}/${m}/${d}`;
    };
    // lastSpan / nextSpan を常にスコープ内で宣言（スコープバグ修正）
    const lastSpan = document.createElement("span");
    lastSpan.className = "reco-row-date reco-date-sub";
    let nextSpan = null;

    if (t.isNightsTrigger) {
      // 累計滞在日数トリガー
      if (t.due) {
        badge.textContent = `+${t.cumNights - t.freqDays}日超過`;
        badge.classList.add("reco-badge-red");
      } else {
        badge.textContent = `あと${t.freqDays - t.cumNights}日`;
        badge.classList.add("reco-badge-amber");
      }
      lastSpan.textContent = `累計 ${t.cumNights}日 / ${t.freqDays}日`;
    } else {
      // 経過日数トリガー
      if (t.due) {
        badge.textContent = `+${t.over}日超過`;
        badge.classList.add("reco-badge-red");
      } else {
        badge.textContent = `あと${t.freqDays - (t.elapsed||0)}日`;
        badge.classList.add("reco-badge-amber");
      }
      lastSpan.textContent = t.last ? `前回 ${fmtShort(t.last)}` : "前回 未実施";
      if (t.nextDate) {
        nextSpan = document.createElement("span");
        nextSpan.className = "reco-row-date reco-date-sub";
        nextSpan.textContent = `次回 ${fmtShort(t.nextDate)}`;
      }
    }
    dateEl.style.display = "none";

    right.appendChild(badge);
    right.appendChild(lastSpan);
    if (nextSpan) right.appendChild(nextSpan);
    row.appendChild(name); row.appendChild(right);
    list.appendChild(row);
  });

  banner.style.display = "";
}

/* ── 履歴タスクのスタイル ── */
function taskStyleByName(name) {
  const hit = loadTasks().find(t => t.name === name);
  return hit ? { bg: hit.bg || "#0f0f0f", text: hit.text || "#f0f0f0", cat: hit.cat || "その他" } : null;
}

/* ── 履歴 編集モーダル ── */
function openHistEditModal(rowId) {
  const row = loadRows().find(r => r.id === rowId); if (!row) return;
  const tasks = loadTasks(), cats = getCats();
  const selSet = new Set(Array.isArray(row.tasks) ? row.tasks : []);
  const wrap = document.createElement("div");

  // 日付
  const dw = document.createElement("div"); dw.className = "modal-field";
  dw.innerHTML = `<label>日付</label>`;
  const dInp = document.createElement("input"); dInp.type = "date"; dInp.value = row.date || "";
  dw.appendChild(dInp); wrap.appendChild(dw);

  // 滞在日数
  const nw = document.createElement("div"); nw.className = "modal-field";
  nw.innerHTML = `<label>滞在日数</label>`;
  const nInp = document.createElement("input"); nInp.type = "number"; nInp.inputMode = "numeric"; nInp.min = "0";
  nInp.value = (row.nights != null) ? String(row.nights) : ""; nw.appendChild(nInp); wrap.appendChild(nw);

  // 作業チェックボックス
  const tl = document.createElement("div"); tl.className = "modal-field";
  tl.innerHTML = `<label>作業内容</label>`;
  const byCat = tasksByCat(tasks);
  cats.forEach(cat => {
    const items = byCat[cat] || []; if (!items.length) return;
    const cl = document.createElement("div");
    cl.style.cssText = "font-size:12px;color:var(--text3);margin:8px 0 4px;";
    cl.textContent = cat; tl.appendChild(cl);
    const chips = document.createElement("div"); chips.className = "task-chips"; chips.style.padding = "0";
    items.forEach(t => {
      const lbl = document.createElement("label"); lbl.className = "task-chip";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = t.name; cb.checked = selSet.has(t.name);
      cb.addEventListener("change", () => lbl.classList.toggle("checked", cb.checked));
      if (cb.checked) lbl.classList.add("checked");
      if (t.bg !== "#0f0f0f" || t.text !== "#f0f0f0") {
        cb.addEventListener("change", () => {
          if (cb.checked) { lbl.style.background = t.bg; lbl.style.color = t.text; }
          else { lbl.style.background = ""; lbl.style.color = ""; }
        });
        if (cb.checked) { lbl.style.background = t.bg; lbl.style.color = t.text; }
      }
      const sp = document.createElement("span"); sp.textContent = t.name;
      lbl.appendChild(cb); lbl.appendChild(sp); chips.appendChild(lbl);
    });
    tl.appendChild(chips);
  });
  wrap.appendChild(tl);

  // メモ
  const ow = document.createElement("div"); ow.className = "modal-field";
  ow.innerHTML = `<label>メモ</label>`;
  const oTA = document.createElement("textarea"); oTA.value = row.other || ""; ow.appendChild(oTA); wrap.appendChild(ow);

  openModal({ title:"記録を編集", bodyNodes:[wrap], okText:"保存",
    onOk: () => {
      if (!dInp.value) { showAlert("確認","日付は必須"); return; }
      const newTasks = Array.from(wrap.querySelectorAll("input[type=checkbox]")).filter(c => c.checked).map(c => c.value);
      updateRow(rowId, { date:dInp.value, nights:normalizeIntOrNull(nInp.value), tasks:newTasks, other:oTA.value });
      renderStatus(); renderHistory(); renderReco();
    }
  });
}

/* ── 履歴描画（縦タイムライン） ── */
let sortMode = "desc";

function renderHistory() {
  const rows = loadRows().slice().sort((a, b) => {
    const ad = String(a.date ?? ""), bd = String(b.date ?? "");
    return sortMode === "asc" ? ad.localeCompare(bd) : bd.localeCompare(ad);
  });
  const body = $("historyBody"); body.innerHTML = "";
  if (!rows.length) { body.innerHTML = `<div class="muted" style="padding:20px 0;">記録なし</div>`; return; }

  rows.forEach(r => {
    const entry = document.createElement("div"); entry.className = "hist-entry";

    // 左：日付・滞在日数
    const left = document.createElement("div"); left.className = "hist-left";
    const dateEl = document.createElement("div"); dateEl.className = "hist-date";
    dateEl.textContent = r.date ? formatJP(r.date).slice(5) : "不明"; // MM/DD
    const yearEl = document.createElement("div");
    yearEl.style.cssText = "font-size:10px;color:var(--text3);margin-bottom:2px;";
    yearEl.textContent = r.date ? r.date.slice(0,4) : "";
    const nightsEl = document.createElement("div"); nightsEl.className = "hist-nights";
    nightsEl.textContent = (r.nights != null && r.nights !== "") ? `${r.nights}日` : "";
    left.appendChild(yearEl); left.appendChild(dateEl); left.appendChild(nightsEl);

    // 右：pills + 展開アクション
    const right = document.createElement("div"); right.className = "hist-right";
    const pills = document.createElement("div"); pills.className = "hist-pills";
    const taskNames = Array.isArray(r.tasks) ? r.tasks : [];
    taskNames.forEach(name => {
      const st = taskStyleByName(name);
      const pill = document.createElement("span"); pill.className = "hist-pill";
      if (st && (st.bg !== "#0f0f0f" || st.text !== "#f0f0f0")) {
        pill.style.background = st.bg; pill.style.color = st.text;
      } else {
        const cc = catColor(st ? st.cat : "その他");
        pill.style.background = cc.bg; pill.style.color = cc.color;
      }
      pill.textContent = name; pills.appendChild(pill);
    });
    const other = String(r.other ?? "").trim();
    if (other) {
      const pill = document.createElement("span"); pill.className = "hist-pill";
      pill.style.cssText = "background:var(--panel2);color:var(--text3);";
      pill.textContent = other.length > 20 ? other.slice(0,20) + "…" : other;
      pills.appendChild(pill);
    }

    // 編集・削除（タップで展開）
    const actions = document.createElement("div"); actions.className = "hist-actions";
    const editBtn = document.createElement("button"); editBtn.className = "hist-action-btn edit"; editBtn.textContent = "編集";
    const delBtn  = document.createElement("button"); delBtn.className  = "hist-action-btn del";  delBtn.textContent = "削除";
    editBtn.addEventListener("click", e => { e.stopPropagation(); openHistEditModal(r.id); });
    delBtn.addEventListener("click", e => {
      e.stopPropagation();
      showDeleteConfirm("この記録を削除しますか？", () => { deleteRow(r.id); renderStatus(); renderHistory(); renderReco(); }, () => {});
    });
    actions.appendChild(editBtn); actions.appendChild(delBtn);

    right.appendChild(pills); right.appendChild(actions);
    entry.appendChild(left); entry.appendChild(right);

    // 行タップで展開
    entry.addEventListener("click", () => {
      const isExp = entry.classList.contains("expanded");
      document.querySelectorAll(".hist-entry.expanded").forEach(el => el.classList.remove("expanded"));
      if (!isExp) entry.classList.add("expanded");
    });

    body.appendChild(entry);
  });
}

/* ── 作業内容マスター（ドラッグ並び替え） ── */
function renderMaster() {
  syncNewCatSelect();
  const tasks = loadTasks(), box = $("master"); box.innerHTML = "";
  if (!tasks.length) { box.innerHTML = `<div style="padding:12px 16px;color:var(--text3);font-size:14px;">未設定</div>`; return; }

  let dragSrcIdx = null;

  tasks.forEach((t, idx) => {
    const div = document.createElement("div");
    div.className = "master-item"; div.draggable = true; div.dataset.idx = idx;

    const handle = document.createElement("span"); handle.className = "drag-handle"; handle.textContent = "⠿";

    const info = document.createElement("div"); info.className = "master-info";

    // ⑦ 作業名をpill形式で表示（設定色を反映）
    const nameEl = document.createElement("div"); nameEl.className = "master-name";
    nameEl.style.cssText = `display:inline-block;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:500;background:${t.bg||"#1c1c1e"};color:${t.text||"#f2f2f7"};border:1px solid ${t.bg&&t.bg!=="0f0f0f"?t.bg:"rgba(255,255,255,.15)"};`;
    nameEl.textContent = t.name;

    // ⑥ 区分を色付きbadgeで表示
    const metaEl = document.createElement("div"); metaEl.className = "master-meta";
    metaEl.style.marginTop = "5px";
    const catBadge = document.createElement("span");
    catBadge.style.cssText = "font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.1);color:#e5e5ea;font-weight:500;";
    catBadge.textContent = t.cat;

    metaEl.appendChild(catBadge);
    if (t.freqDays && t.freqDays > 0) {
      const freqSpan = document.createElement("span");
      freqSpan.style.cssText = "font-size:11px;color:#aeaeb2;margin-left:6px;";
      const triggerLabel = t.triggerType === "nights" ? "累計滞在" : "経過";
      freqSpan.textContent = `${triggerLabel} ${t.freqDays}日`;
      metaEl.appendChild(freqSpan);
    }
    info.appendChild(nameEl); info.appendChild(metaEl);

    // ⑤ 黒丸廃止（カラープレビュー不要 → pill に統合済み）

    const editBtn = document.createElement("button"); editBtn.className = "master-btn"; editBtn.textContent = "編集";
    const delBtn  = document.createElement("button"); delBtn.className  = "master-btn danger"; delBtn.textContent = "削除";

    div.appendChild(handle); div.appendChild(info); div.appendChild(editBtn); div.appendChild(delBtn);
    box.appendChild(div);

    /* ドラッグ（PC） */
    div.addEventListener("dragstart", e => { dragSrcIdx = idx; div.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
    div.addEventListener("dragend",   () => { div.classList.remove("dragging"); box.querySelectorAll(".master-item").forEach(el => el.classList.remove("drag-over")); });
    div.addEventListener("dragover",  e => { e.preventDefault(); box.querySelectorAll(".master-item").forEach(el => el.classList.remove("drag-over")); div.classList.add("drag-over"); });
    div.addEventListener("drop",      e => {
      e.preventDefault(); if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const ts = loadTasks(); const [m] = ts.splice(dragSrcIdx, 1); ts.splice(idx, 0, m);
      saveTasks(ts); renderTaskChips(); renderMaster();
    });

    /* タッチ（iPhone） */
    let tDrag = false;
    handle.addEventListener("touchstart", e => { tDrag = true; div.classList.add("dragging"); e.stopPropagation(); }, { passive:true });
    handle.addEventListener("touchmove", e => {
      if (!tDrag) return; e.preventDefault();
      const y = e.touches[0].clientY;
      box.querySelectorAll(".master-item").forEach(el => el.classList.remove("drag-over"));
      const target = Array.from(box.querySelectorAll(".master-item")).find(el => { const rc = el.getBoundingClientRect(); return y >= rc.top && y <= rc.bottom; });
      if (target && target !== div) target.classList.add("drag-over");
    }, { passive:false });
    handle.addEventListener("touchend", e => {
      if (!tDrag) return; tDrag = false; div.classList.remove("dragging");
      const y = e.changedTouches[0].clientY;
      box.querySelectorAll(".master-item").forEach(el => el.classList.remove("drag-over"));
      const items = Array.from(box.querySelectorAll(".master-item"));
      const tgt = items.find(el => { const rc = el.getBoundingClientRect(); return y >= rc.top && y <= rc.bottom; });
      if (!tgt || tgt === div) return;
      const toIdx = Number(tgt.dataset.idx); if (isNaN(toIdx) || toIdx === idx) return;
      const ts = loadTasks(); const [m] = ts.splice(idx, 1); ts.splice(toIdx, 0, m);
      saveTasks(ts); renderTaskChips(); renderMaster();
    });

    /* 編集モーダル */
    editBtn.addEventListener("click", () => {
      const ts = loadTasks(), tgt = ts[idx]; if (!tgt) return;
      const wrap = document.createElement("div");
      const fields = [
        { id:"ename", label:"項目名",      type:"text",   value:tgt.name },
        { id:"ecat",  label:"区分",        type:"select", value:tgt.cat, options:getCats() },
        { id:"etrig", label:"トリガー種別", type:"select", value:tgt.triggerType,
          options:[["days","経過日数"],["nights","累計滞在日数"]] },
        { id:"efreq", label:"閾値（日）空欄=未設定", type:"number", value:tgt.freqDays ? String(tgt.freqDays) : "" }
      ];
      fields.forEach(f => {
        const fw = document.createElement("div"); fw.className = "modal-field";
        const lb = document.createElement("label"); lb.textContent = f.label; fw.appendChild(lb);
        let el;
        if (f.type === "select") {
          el = document.createElement("select");
          (f.options || []).forEach(opt => {
            const o = document.createElement("option");
            if (Array.isArray(opt)) { o.value = opt[0]; o.textContent = opt[1]; }
            else { o.value = o.textContent = opt; }
            if (o.value === f.value) o.selected = true;
            el.appendChild(o);
          });
        } else {
          el = document.createElement("input"); el.type = f.type; el.value = f.value ?? "";
          if (f.type === "number") { el.inputMode = "numeric"; el.min = "1"; }
        }
        el.id = f.id; fw.appendChild(el); wrap.appendChild(fw);
      });
      // 色設定（カラーグリッド）
      let currentBg   = clampColor(tgt.bg,   "#0f0f0f");
      let currentText = clampColor(tgt.text,  "#f0f0f0");

      const cw = document.createElement("div"); cw.className = "modal-field";
      const clabel = document.createElement("label"); clabel.textContent = "色設定"; cw.appendChild(clabel);

      // プレビューpill
      const prev = document.createElement("div");
      prev.className = "color-preview-pill";
      prev.style.background = currentBg; prev.style.color = currentText;
      prev.textContent = tgt.name;
      prev.style.marginBottom = "10px";
      cw.appendChild(prev);

      // 背景色グリッド
      const bgLbl = document.createElement("div"); bgLbl.style.cssText="font-size:11px;color:#8e8e93;margin-bottom:6px;"; bgLbl.textContent="背景色";
      cw.appendChild(bgLbl);
      const bgGrid = createColorGrid(currentBg, hex => {
        currentBg = hex; bgInp.value = hex; prev.style.background = hex;
      }, { hiddenInputId: "editBgHidden" });
      // hidden inputへの参照を作成
      const bgInp = document.createElement("input"); bgInp.type="hidden"; bgInp.id="editBgHidden"; bgInp.value=currentBg;
      cw.appendChild(bgGrid.el); cw.appendChild(bgInp);

      // 文字色グリッド
      const txLbl = document.createElement("div"); txLbl.style.cssText="font-size:11px;color:#8e8e93;margin:10px 0 6px;"; txLbl.textContent="文字色";
      cw.appendChild(txLbl);
      const txGrid = createColorGrid(currentText, hex => {
        currentText = hex; txInp.value = hex; prev.style.color = hex;
      }, { hiddenInputId: "editTxHidden" });
      const txInp = document.createElement("input"); txInp.type="hidden"; txInp.id="editTxHidden"; txInp.value=currentText;
      cw.appendChild(txGrid.el); cw.appendChild(txInp);
      wrap.appendChild(cw);

      openModal({ title:"項目を編集", bodyNodes:[wrap], okText:"保存",
        onOk: () => {
          const nm = String($("ename").value ?? "").trim(); if (!nm) return;
          const ct = getCats().includes(String($("ecat").value).trim()) ? String($("ecat").value).trim() : "その他";
          const tr = $("etrig").value === "nights" ? "nights" : "days";
          const fd = normalizeIntOrNull(String($("efreq").value ?? "").trim());
          if (ts.find((x,i) => i !== idx && x.name === nm)) { showAlert("確認","同名が既に存在"); return; }
          ts[idx] = { ...tgt, name:nm, cat:ct, triggerType:tr, freqDays:fd,
            bg:clampColor(currentBg,"#0f0f0f"), text:clampColor(currentText,"#f0f0f0") };
          saveTasks(ts); renderTaskChips(); renderMaster(); renderReco();
        }
      });
    });

    /* 削除 */
    delBtn.addEventListener("click", () => {
      const ts = loadTasks(), tgt = ts[idx]; if (!tgt) return;
      showDeleteConfirm(`「${tgt.name}」を削除しますか？`, () => {
        ts.splice(idx,1); saveTasks(ts); renderTaskChips(); renderMaster(); renderReco();
      }, () => {});
    });
  });
}

/* ── 作業追加 ── */
function addTaskFromInputs() {
  const name = String($("newTask").value ?? "").trim(); if (!name) return;
  const cats = getCats(), cat = String($("newCat") ? $("newCat").value : "").trim();
  const ct   = cats.includes(cat) ? cat : (cats[0] || "その他");
  const tr   = $("newTrigger") && $("newTrigger").value === "nights" ? "nights" : "days";
  const fd   = normalizeIntOrNull($("newFreq").value);
  const bg   = clampColor($("newBg").value,   "#0f0f0f");
  const text = clampColor($("newText").value, "#f0f0f0");
  const tasks = loadTasks();
  if (tasks.find(t => t.name === name)) { showAlert("確認","同名が既に存在"); return; }
  tasks.push({ name, cat:ct, triggerType:tr, freqDays:fd, bg, text });
  saveTasks(tasks);
  $("newTask").value = ""; $("newFreq").value = "";
  if ($("newTrigger")) $("newTrigger").value = "days";
  // カラーグリッドリセット
  if (window._bgGridReset) window._bgGridReset();
  if (window._txGridReset) window._txGridReset();
  renderTaskChips(); renderMaster(); renderReco();
}

/* ── 区分マスター ── */
function setupCatMaster() {
  const list = $("catList_v5"); if (!list) return;
  let catDragSrcIdx = null;

  const rerenderAll = () => { renderTaskChips(); renderMaster(); renderReco(); renderHistory(); };

  const renderCats = () => {
    const cats = getCats(); list.innerHTML = "";
    cats.forEach((c, idx) => {
      const r = document.createElement("div"); r.className = "master-item"; r.draggable = true; r.dataset.idx = idx;
      const handle = document.createElement("span"); handle.className = "drag-handle"; handle.textContent = "⠿";
      const nameEl = document.createElement("div"); nameEl.className = "master-info";
      nameEl.innerHTML = `<div class="master-name" style="color:#f2f2f7;font-size:15px;">${escapeHtml(c)}</div>`;
      const dl = document.createElement("button"); dl.className = "master-btn danger"; dl.textContent = "削除";
      dl.addEventListener("click", () => {
        const cn = getCats(); if (cn.length <= 1) { showAlert("確認","区分は最低1つ必要"); return; }
        showDeleteConfirm(`区分「${c}」を削除しますか？`, () => {
          const next = cn.filter(x => x !== c); saveCats(next);
          const ts = loadTasks(), fb = next[0] || "その他";
          ts.forEach(t => { if (String(t.cat ?? "") === c) t.cat = fb; }); saveTasks(ts);
          renderCats(); rerenderAll();
        }, () => {});
      });
      r.appendChild(handle); r.appendChild(nameEl); r.appendChild(dl); list.appendChild(r);

      /* ドラッグ（PC） */
      r.addEventListener("dragstart", e => { catDragSrcIdx = idx; r.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
      r.addEventListener("dragend",   () => { r.classList.remove("dragging"); list.querySelectorAll(".master-item").forEach(el => el.classList.remove("drag-over")); });
      r.addEventListener("dragover",  e => { e.preventDefault(); list.querySelectorAll(".master-item").forEach(el => el.classList.remove("drag-over")); r.classList.add("drag-over"); });
      r.addEventListener("drop",      e => {
        e.preventDefault(); if (catDragSrcIdx === null || catDragSrcIdx === idx) return;
        const a = getCats(); const [m] = a.splice(catDragSrcIdx, 1); a.splice(idx, 0, m);
        saveCats(a); renderCats(); rerenderAll();
      });

      /* タッチ（iPhone） */
      let tDrag = false;
      handle.addEventListener("touchstart", e => { tDrag = true; r.classList.add("dragging"); e.stopPropagation(); }, { passive:true });
      handle.addEventListener("touchmove", e => {
        if (!tDrag) return; e.preventDefault();
        const y = e.touches[0].clientY;
        list.querySelectorAll(".master-item").forEach(el => el.classList.remove("drag-over"));
        const target = Array.from(list.querySelectorAll(".master-item")).find(el => { const rc = el.getBoundingClientRect(); return y >= rc.top && y <= rc.bottom; });
        if (target && target !== r) target.classList.add("drag-over");
      }, { passive:false });
      handle.addEventListener("touchend", e => {
        if (!tDrag) return; tDrag = false; r.classList.remove("dragging");
        const y = e.changedTouches[0].clientY;
        list.querySelectorAll(".master-item").forEach(el => el.classList.remove("drag-over"));
        const items = Array.from(list.querySelectorAll(".master-item"));
        const tgt = items.find(el => { const rc = el.getBoundingClientRect(); return y >= rc.top && y <= rc.bottom; });
        if (!tgt || tgt === r) return;
        const toIdx = Number(tgt.dataset.idx); if (isNaN(toIdx) || toIdx === idx) return;
        const a = getCats(); const [m] = a.splice(idx, 1); a.splice(toIdx, 0, m);
        saveCats(a); renderCats(); rerenderAll();
      });
    });
  };

  const addBtn = $("catAddBtn"); if (addBtn) {
    addBtn.addEventListener("click", () => {
      const inp = $("catName_v5"); if (!inp) return;
      const name = String(inp.value ?? "").trim(); if (!name) return;
      const cats = getCats(); if (cats.includes(name)) { showAlert("確認","同名が既に存在"); return; }
      cats.push(name); saveCats(cats); inp.value = ""; renderCats(); rerenderAll();
    });
  }
  renderCats();
}

/* ── 折りたたみ ── */
function setupCollapse(btnId, bodyId) {
  const btn = $(btnId), body = $(bodyId); if (!btn || !body) return;
  btn.addEventListener("click", () => {
    const open = body.classList.toggle("open");
    btn.classList.toggle("open", open);
  });
}


/* ── 作業追加フォームのカラーグリッド初期化 ── */
function setupNewTaskColorGrids() {
  const bgArea = document.getElementById("newBgGridArea");
  const txArea = document.getElementById("newTextGridArea");
  if (!bgArea || !txArea) return;

  let bgVal = "#0f0f0f", txVal = "#f0f0f0";

  // hidden input を用意（addTaskFromInputs で参照）
  let bgHidden = document.getElementById("newBg");
  let txHidden = document.getElementById("newText");
  if (!bgHidden) { bgHidden = document.createElement("input"); bgHidden.type="hidden"; bgHidden.id="newBg"; bgHidden.value=bgVal; document.body.appendChild(bgHidden); }
  if (!txHidden) { txHidden = document.createElement("input"); txHidden.type="hidden"; txHidden.id="newText"; txHidden.value=txVal; document.body.appendChild(txHidden); }

  const bgGrid = createColorGrid(bgVal, hex => { bgVal = hex; bgHidden.value = hex; });
  bgArea.innerHTML = ""; bgArea.appendChild(bgGrid.el);

  const txGrid = createColorGrid(txVal, hex => { txVal = hex; txHidden.value = hex; });
  txArea.innerHTML = ""; txArea.appendChild(txGrid.el);

  // addTask 後にリセット
  const origAdd = window._origAddTask;
  if (!origAdd) {
    window._bgGridRef = bgGrid; window._txGridRef = txGrid;
    window._bgGridReset = () => { bgHidden.value="#0f0f0f"; bgGrid.update("#0f0f0f"); };
    window._txGridReset = () => { txHidden.value="#f0f0f0"; txGrid.update("#f0f0f0"); };
  }
}

/* ── エクスポート / インポート ── */
function exportJSON() {
  const payload = { version:5, exportedAt:new Date().toISOString(),
    appName:loadAppName(), tasks:loadTasks(), rows:loadRows() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `maintelog_backup_${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const p = JSON.parse(reader.result);
      if (!p || typeof p !== "object") throw new Error("不正なファイル形式");
      // version がない旧データも受け入れる（v3以前互換）
      if (p.version !== undefined && (typeof p.version !== "number" || p.version < 1 || p.version > 99)) throw new Error("バージョン情報が不正");
      if (!Array.isArray(p.rows))  throw new Error("rowsが不正");
      if (!Array.isArray(p.tasks)) throw new Error("tasksが不正");
      p.rows.forEach((r,i) => { if (typeof r !== "object" || r === null) throw new Error(`row[${i}]が不正`); });
      if (typeof p.appName === "string") saveAppName(p.appName);
      const m = migrateTasks(p.tasks); if (m) saveTasks(m);
      saveRows(p.rows.map(r => ({ id:r.id || genId(), ...r })));
      boot(); showAlert("確認","復元完了");
    } catch(e) { showAlert("読み込み失敗", e.message); }
  };
  reader.readAsText(file);
}


/* ── メモカラーグリッド初期化 ── */
function setupMemoColorGrid() {
  const area = document.getElementById("memoColorGrid");
  if (!area) return;
  const grid = createColorGrid(loadMemoColor(), hex => {
    saveMemoColor(hex);
    renderHistory();
  });
  area.innerHTML = "";
  area.appendChild(grid.el);
}

/* ── タブ切替 ── */
function setView(which) {
  ["Input","History","Setting"].forEach(v => {
    const sec = $(`view${v}`), btn = $(`tab${v}`);
    const active = which === v;
    if (sec) { sec.classList.toggle("active", active); }
    if (btn) btn.classList.toggle("active", active);
  });
  if (which === "History") { renderHistory(); }
}

/* ── 起動 ── */
function boot() {
  ensureDefaultTasks();
  $("date").value = todayISO();
  applyAppName(); renderStatus();
  renderTaskChips(); renderMaster(); renderReco(); renderHistory();
  // メモ文字色ピッカー初期値
  const mcp = $("memoColorPicker");
  if (mcp) mcp.value = loadMemoColor();
  setView("Input");
}

/* ── イベントバインド ── */
function bindIf(id, type, fn) { const el = $(id); if (el) el.addEventListener(type, fn); }

bindIf("tabInput",   "click", () => setView("Input"));
bindIf("tabHistory", "click", () => setView("History"));
bindIf("tabSetting", "click", () => setView("Setting"));

bindIf("save", "click", () => {
  const date = $("date").value || "", nights = normalizeIntOrNull($("nights").value);
  const tasks = getSelectedTasks(), other = $("other").value || "";
  if (!date) { showAlert("確認","日付は必須"); return; }
  if (!tasks.length && !String(other).trim() && nights === null) return;
  addRow({ date, nights, tasks, other }); clearInput(); renderStatus(); renderReco();
});
bindIf("clear", "click", () => clearInput());
bindIf("wipe",  "click", () => {
  showConfirm("確認","全データを削除します", () => {
    saveRows([]); saveTasks(ensureDefaultTasks()); localStorage.removeItem(APPNAME_KEY); boot();
  }, () => {});
});
bindIf("addTask", "click", () => addTaskFromInputs());
bindIf("newTask", "keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTaskFromInputs(); } });
bindIf("sortDesc", "click", () => { sortMode = "desc"; renderHistory(); $("sortDesc").classList.add("active");    $("sortAsc").classList.remove("active"); });
bindIf("sortAsc",  "click", () => { sortMode = "asc";  renderHistory(); $("sortAsc").classList.add("active");     $("sortDesc").classList.remove("active"); });
bindIf("export", "click", () => exportJSON());
bindIf("import", "change", e => { const f = e.target.files && e.target.files[0]; if (!f) return; importJSON(f); e.target.value = ""; });
bindIf("saveAppName",  "click", () => { saveAppName($("appName").value); applyAppName(); showAlert("確認","保存完了"); });
bindIf("resetAppName", "click", () => { localStorage.removeItem(APPNAME_KEY); applyAppName(); });
// memoColorPicker bind は setupMemoColorGrid に移行

setupCollapse("masterToggle", "masterBody");
setupCollapse("catToggle",    "catBody");
setupCollapse("memoColorToggle", "memoColorBody");
setupCatMaster();
setupMemoColorGrid();
setupNewTaskColorGrids();
boot();
