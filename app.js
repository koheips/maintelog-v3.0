/* メンテログ app.js  v17-20260401
   動的CSS注入を完全廃止 → 全スタイルはindex.htmlに集約
   主な変更:
   ・localStorage 超過を try-catch で保護
   ・JSON インポートのスキーマ検証強化
   ・crypto.randomUUID() で ID 生成
   ・tasksByCat のハードコード区分を除去
   ・.recoItem スタイル定義（index.html側）
   ・履歴の「編集」ボタン追加
   ・カラーピッカーにリアルタイムプレビュー追加（枠線はCSS側）
   ・作業内容マスターをドラッグ＆ドロップ並び替えに変更
*/

const BUILD_ID  = "v17-20260401";
console.info("[maintelog] build", BUILD_ID);

const STORAGE_KEY = "maintelog_rows_v2";
const TASKS_KEY   = "maintelog_tasks_v2";
const APPNAME_KEY = "maintelog_appname_v3";
const CATS_KEY    = "maintelog_cats_v1";
const DEFAULT_CATS = ["掃除","洗濯","その他"];

/* ── ストレージ安全ラッパー ── */
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    showAlert("ストレージエラー",
      "端末の空き容量が不足しています。JSONエクスポートでバックアップ後、不要データを削除してください。");
    return false;
  }
}

/* ── 区分マスター ── */
function loadCats() {
  try {
    const raw = localStorage.getItem(CATS_KEY);
    if (!raw) return DEFAULT_CATS.slice();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return DEFAULT_CATS.slice();
    const out = [], seen = new Set();
    arr.forEach(v => { const s = String(v ?? "").trim(); if (s && !seen.has(s)) { seen.add(s); out.push(s); } });
    return out.length ? out : DEFAULT_CATS.slice();
  } catch (_) { return DEFAULT_CATS.slice(); }
}
function saveCats(cats) {
  const out = [], seen = new Set();
  (cats || []).forEach(v => { const s = String(v ?? "").trim(); if (s && !seen.has(s)) { seen.add(s); out.push(s); } });
  safeSet(CATS_KEY, JSON.stringify(out.length ? out : DEFAULT_CATS.slice()));
}
function getCats() { return loadCats(); }

function syncNewCatSelect() {
  const sel = document.getElementById("newCat");
  if (!sel) return;
  const cats = getCats();
  sel.innerHTML = "";
  (cats.length ? cats : ["その他"]).forEach(c => {
    const o = document.createElement("option");
    o.value = o.textContent = c;
    sel.appendChild(o);
  });
  if (!sel.value && sel.options.length) sel.value = sel.options[0].value;
}

/* ── デフォルト作業名 ── */
const defaultTaskNames = ["拭き掃除","掃除機","風呂","トイレ","洗濯","庭"];
const $ = id => document.getElementById(id);

/* ── モーダル ── */
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
  const first = body.querySelector("input,select,textarea,button");
  if (first) setTimeout(() => first.focus(), 50);
}

function showModal(title, fields, onOk, onCancel) {
  const nodes = {}, els = {};
  const nodeArr = fields.map(f => {
    const wrap = document.createElement("div");
    wrap.style.marginBottom = "10px";
    const lab = document.createElement("label");
    lab.textContent = f.label; lab.style.cssText = "display:block;margin-bottom:4px;font-size:13px;opacity:0.75;";
    wrap.appendChild(lab);
    let el;
    if (f.type === "select") {
      el = document.createElement("select");
      (f.options || []).forEach(opt => {
        const o = document.createElement("option"); o.value = o.textContent = opt;
        if (opt === f.value) o.selected = true; el.appendChild(o);
      });
    } else {
      el = document.createElement("input");
      el.type = f.type || "text"; el.value = f.value ?? "";
      if (f.placeholder) el.placeholder = f.placeholder;
      if (f.inputmode)   el.inputMode   = f.inputmode;
    }
    el.id = f.id; wrap.appendChild(el); els[f.id] = el; return wrap;
  });
  openModal({ title, bodyNodes: nodeArr,
    onOk: () => { const out = {}; fields.forEach(f => out[f.id] = els[f.id].value); onOk && onOk(out); },
    onCancel: () => onCancel && onCancel()
  });
}

function showConfirm(title, message, onYes, onNo) {
  const p = document.createElement("div");
  p.textContent = message; p.style.cssText = "font-size:16px;line-height:1.4;";
  openModal({ title, bodyNodes:[p], okText:"OK", cancelText:"キャンセル",
    onOk: () => onYes && onYes(), onCancel: () => onNo && onNo() });
}
function showAlert(title, message, onClose) {
  const p = document.createElement("div");
  p.textContent = message; p.style.cssText = "font-size:16px;line-height:1.4;";
  openModal({ title, bodyNodes:[p], okText:"閉じる", hideCancel:true,
    onOk: () => onClose && onClose(), onCancel: () => onClose && onClose() });
}
function showDeleteConfirm(message, onYes, onNo) {
  const p = document.createElement("div");
  p.textContent = message; p.style.cssText = "font-size:16px;line-height:1.4;";
  openModal({ title:"確認", bodyNodes:[p], okText:"削除OK", cancelText:"キャンセル",
    onOk: () => onYes && onYes(), onCancel: () => onNo && onNo() });
}

/* ── ユーティリティ ── */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function loadJSON(key, fb) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; } }
function saveJSON(key, val) { safeSet(key, JSON.stringify(val)); }
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
  const i = Math.trunc(n); return i < 0 ? null : i;
}
function daysBetween(a, b) {
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Number.isFinite(ms) ? Math.floor(ms/86400000) : null;
}
function genId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/* ── rows ── */
function loadRows() { const r = loadJSON(STORAGE_KEY,[]); return Array.isArray(r) ? r : []; }
function saveRows(rows) { saveJSON(STORAGE_KEY, rows); }

/* ── tasks ── */
function migrateTasks(raw) {
  if (!raw) return null;
  if (Array.isArray(raw) && raw.every(x => typeof x === "string")) {
    return raw.map(s => String(s).trim()).filter(s => s)
      .map(s => ({ name:s, cat:"その他", freqDays:null, bg:"#0f0f0f", text:"#f0f0f0" }));
  }
  if (Array.isArray(raw) && raw.every(x => x && typeof x === "object" && typeof x.name === "string")) {
    return raw.map(x => ({
      name: String(x.name).trim(),
      cat:  getCats().includes(x.cat) ? x.cat : "その他",
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
  const base = defaultTaskNames.map(s => ({ name:s, cat:"その他", freqDays:null, bg:"#0f0f0f", text:"#f0f0f0" }));
  saveJSON(TASKS_KEY, base); return base;
}
function loadTasks() {
  const m = migrateTasks(loadJSON(TASKS_KEY, null));
  return (m && m.length) ? m : ensureDefaultTasks();
}
function saveTasks(tasks) {
  const seen = new Set(), uniq = [];
  (tasks || []).filter(x => x && typeof x === "object")
    .map(x => ({ name:String(x.name??"").trim(), cat:getCats().includes(x.cat)?x.cat:"その他",
      freqDays:normalizeIntOrNull(x.freqDays), bg:clampColor(x.bg,"#0f0f0f"), text:clampColor(x.text,"#f0f0f0") }))
    .filter(x => x.name.length)
    .forEach(t => { if (!seen.has(t.name)) { seen.add(t.name); uniq.push(t); } });
  saveJSON(TASKS_KEY, uniq); return uniq;
}

/* ── アプリ名 ── */
function loadAppName() { const s = String(localStorage.getItem(APPNAME_KEY)??"").trim(); return s||"メンテログ"; }
function saveAppName(v) { const s = String(v??"").trim(); if (!s) { localStorage.removeItem(APPNAME_KEY); return "メンテログ"; } localStorage.setItem(APPNAME_KEY,s); return s; }
function applyAppName() { const n = loadAppName(); $("appTitle").textContent = n; document.title = n; $("appName").value = n; }
function renderStatus() { $("status").textContent = `記録 ${loadRows().length}件`; }

/* ── tasksByCat（動的・ハードコードなし） ── */
function tasksByCat(tasks) {
  const cats = getCats(), map = {};
  cats.forEach(c => map[c] = []);
  tasks.forEach(t => {
    const c = cats.includes(t.cat) ? t.cat : (cats[0]||"その他");
    if (!map[c]) map[c] = []; map[c].push(t);
  });
  return map;
}

/* ── 入力チェックボックス ── */
function renderTaskChips() {
  const tasks = loadTasks(), byCat = tasksByCat(tasks), area = $("tasksArea");
  area.innerHTML = "";
  getCats().forEach(cat => {
    const items = byCat[cat]||[];
    const title = document.createElement("div"); title.className = "groupTitle"; title.textContent = cat;
    area.appendChild(title);
    const wrap = document.createElement("div"); wrap.className = "chips";
    if (!items.length) {
      const em = document.createElement("div"); em.className = "muted"; em.textContent = "未設定"; wrap.appendChild(em);
    } else {
      items.forEach(t => {
        const lbl = document.createElement("label"); lbl.className = "chip";
        lbl.style.background = t.bg||"#0f0f0f"; lbl.style.color = t.text||"#f0f0f0";
        lbl.style.borderColor = "rgba(255,255,255,0.18)";
        lbl.innerHTML = `<input type="checkbox" value="${escapeHtml(t.name)}"><span>${escapeHtml(t.name)}</span>`;
        wrap.appendChild(lbl);
      });
    }
    area.appendChild(wrap);
  });
}
function getSelectedTasks() {
  return Array.from($("tasksArea").querySelectorAll("input[type=checkbox]")).filter(c=>c.checked).map(c=>c.value);
}
function clearInput() {
  $("date").value = todayISO(); $("nights").value = ""; $("other").value = "";
  Array.from($("tasksArea").querySelectorAll("input[type=checkbox]")).forEach(c=>c.checked=false);
}

/* ── rows CRUD ── */
function addRow(row) { const rows = loadRows(); rows.push({ id:genId(), ...row }); saveRows(rows); }
function deleteRow(id) { saveRows(loadRows().filter(r=>r.id!==id)); }
function updateRow(id, patch) {
  const rows = loadRows(), idx = rows.findIndex(r=>r.id===id);
  if (idx===-1) return; rows[idx] = {...rows[idx],...patch}; saveRows(rows);
}
function taskStyleByName(name) {
  const hit = loadTasks().find(t=>t.name===name);
  return hit ? { bg:hit.bg||"#0f0f0f", text:hit.text||"#f0f0f0" } : null;
}

/* ── 履歴 編集モーダル ── */
function openHistEditModal(rowId) {
  const row = loadRows().find(r=>r.id===rowId);
  if (!row) return;
  const tasks = loadTasks(), cats = getCats();
  const selSet = new Set(Array.isArray(row.tasks) ? row.tasks : []);
  const wrap = document.createElement("div");

  // 日付
  const dw = document.createElement("div"); dw.style.marginBottom = "10px";
  dw.innerHTML = `<label style="display:block;font-size:13px;opacity:0.75;margin-bottom:4px;">日付</label>`;
  const dInp = document.createElement("input"); dInp.type="date"; dInp.value=row.date||""; dw.appendChild(dInp);
  wrap.appendChild(dw);

  // 泊数
  const nw = document.createElement("div"); nw.style.marginBottom = "10px";
  nw.innerHTML = `<label style="display:block;font-size:13px;opacity:0.75;margin-bottom:4px;">泊数</label>`;
  const nInp = document.createElement("input"); nInp.type="number"; nInp.inputMode="numeric"; nInp.min="0";
  nInp.value = (row.nights!=null) ? String(row.nights) : ""; nw.appendChild(nInp);
  wrap.appendChild(nw);

  // 作業チェックボックス
  const tl = document.createElement("div"); tl.style.cssText="font-size:13px;opacity:0.75;margin-bottom:6px;";
  tl.textContent="作業内容"; wrap.appendChild(tl);
  const byCat = tasksByCat(tasks);
  cats.forEach(cat => {
    const items = byCat[cat]||[];
    if (!items.length) return;
    const cl = document.createElement("div"); cl.style.cssText="font-size:12px;opacity:0.6;margin:8px 0 4px;";
    cl.textContent=cat; wrap.appendChild(cl);
    const chips = document.createElement("div"); chips.className="chips";
    items.forEach(t => {
      const lbl = document.createElement("label"); lbl.className="chip";
      lbl.style.background=t.bg||"#0f0f0f"; lbl.style.color=t.text||"#f0f0f0";
      lbl.style.borderColor="rgba(255,255,255,0.18)";
      const cb = document.createElement("input"); cb.type="checkbox"; cb.value=t.name; cb.checked=selSet.has(t.name);
      lbl.appendChild(cb); const sp=document.createElement("span"); sp.textContent=t.name; lbl.appendChild(sp);
      chips.appendChild(lbl);
    });
    wrap.appendChild(chips);
  });

  // メモ
  const ow = document.createElement("div"); ow.style.marginTop="10px";
  ow.innerHTML=`<label style="display:block;font-size:13px;opacity:0.75;margin-bottom:4px;">その他メモ</label>`;
  const oTA = document.createElement("textarea"); oTA.value=row.other||""; oTA.style.minHeight="80px";
  ow.appendChild(oTA); wrap.appendChild(ow);

  openModal({ title:"記録を編集", bodyNodes:[wrap], okText:"保存",
    onOk: () => {
      if (!dInp.value) { showAlert("確認","日付は必須"); return; }
      const newTasks = Array.from(wrap.querySelectorAll("input[type=checkbox]")).filter(c=>c.checked).map(c=>c.value);
      updateRow(rowId, { date:dInp.value, nights:normalizeIntOrNull(nInp.value), tasks:newTasks, other:oTA.value });
      renderStatus(); renderHistory(); renderReco();
    }
  });
}

/* ── 履歴描画 ── */
let sortMode = "desc";

function renderHistory() {
  const rows = loadRows().slice().sort((a,b)=>{
    const ad=String(a.date??""), bd=String(b.date??"");
    return sortMode==="asc" ? ad.localeCompare(bd) : bd.localeCompare(ad);
  });
  const body = $("historyBody");
  body.innerHTML = "";
  if (!rows.length) { body.innerHTML=`<div class="muted">記録なし</div>`; return; }

  const cats = getCats(), tasks = loadTasks();
  const fallbackCat = () => cats.includes("その他") ? "その他" : (cats[0]||"その他");
  const taskCatByName = name => {
    const hit = tasks.find(t=>t.name===name);
    const c = hit ? String(hit.cat??"").trim() : "";
    return cats.includes(c) ? c : fallbackCat();
  };

  const blocks = rows.map(r => {
    const taskNames = Array.isArray(r.tasks) ? r.tasks.slice() : [];
    const byCat = {}; cats.forEach(c=>byCat[c]=[]);
    taskNames.forEach(nm=>{ const c=taskCatByName(nm); if(!byCat[c]) byCat[c]=[]; byCat[c].push(nm); });
    const other = String(r.other??"").trim();
    if (other) { const oc=fallbackCat(); if(!byCat[oc]) byCat[oc]=[]; byCat[oc].push(other); }

    const dateTxt = r.date ? formatJP(r.date) : "日付不明";
    const daysPart = (r.nights===0||r.nights) ? `${escapeHtml(String(r.nights))}日` : "";
    const catRows = cats.map(cat => {
      const items = byCat[cat]||[]; if(!items.length) return "";
      const pills = items.map(name => {
        const st = taskStyleByName(name);
        return st ? `<span class="pill" style="background:${escapeHtml(st.bg)};color:${escapeHtml(st.text)}">${escapeHtml(name)}</span>`
                  : `<span class="pill">${escapeHtml(name)}</span>`;
      }).join("");
      return `<div class="histCatRow"><div class="histCatLabel">${escapeHtml(cat)}</div><div class="histCatPills">${pills}</div></div>`;
    }).filter(Boolean).join("");

    return `<div class="histEntry">
      <div class="histHeader">
        <div class="histHeadLeft">
          <div class="histDate">${escapeHtml(dateTxt)}</div>
          <div class="histDays">${daysPart}</div>
        </div>
        <div class="histBtnWrap">
          <button type="button" class="histEditBtn" data-edit="${escapeHtml(r.id)}">編集</button>
          <button type="button" class="histDelBtn"  data-del="${escapeHtml(r.id)}">削除</button>
        </div>
      </div>
      <div class="histScroll"><div class="histInner">${catRows}</div></div>
    </div>`;
  }).join("");

  body.innerHTML = `<div class="histList">${blocks}</div>`;

  body.querySelectorAll("button[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openHistEditModal(btn.getAttribute("data-edit"))));
  body.querySelectorAll("button[data-del]").forEach(btn =>
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del"); if(!id) return;
      showDeleteConfirm("この記録を削除しますか？", () => { deleteRow(id); renderStatus(); renderHistory(); renderReco(); }, ()=>{});
    }));
}

/* ── 作業内容マスター（ドラッグ＆ドロップ並び替え） ── */
function renderMaster() {
  syncNewCatSelect();
  const tasks = loadTasks(), box = $("master");
  box.innerHTML = "";
  if (!tasks.length) { box.innerHTML=`<div class="muted">未設定</div>`; return; }

  let dragSrcIdx = null;

  tasks.forEach((t, idx) => {
    const div = document.createElement("div");
    div.className = "masterItem"; div.draggable = true; div.dataset.idx = idx;

    /* ドラッグハンドル */
    const handle = document.createElement("span");
    handle.className = "drag-handle"; handle.textContent = "⠿"; handle.title = "ドラッグして並び替え";

    /* 名前 */
    const nameWrap = document.createElement("div");
    nameWrap.style.cssText = "display:flex;align-items:center;gap:6px;";
    const nameEl = document.createElement("div"); nameEl.className = "masterName"; nameEl.textContent = t.name;
    nameWrap.appendChild(handle); nameWrap.appendChild(nameEl);

    /* タグ */
    const catTag = document.createElement("span"); catTag.className="tag"; catTag.textContent=t.cat;
    const freqTag = document.createElement("span"); freqTag.className="tag";
    freqTag.textContent = `頻度 ${(t.freqDays&&t.freqDays>0)?t.freqDays+"日":"未設定"}`;

    /* カラーピッカー＋プレビュー */
    const cpWrap = document.createElement("div"); cpWrap.className="colorPick";

    const bgLab = document.createElement("span"); bgLab.className="color-label"; bgLab.textContent="背景";
    const bgInp = document.createElement("input"); bgInp.type="color"; bgInp.value=clampColor(t.bg,"#0f0f0f"); bgInp.title="背景色";

    const txLab = document.createElement("span"); txLab.className="color-label"; txLab.textContent="文字";
    const txInp = document.createElement("input"); txInp.type="color"; txInp.value=clampColor(t.text,"#f0f0f0"); txInp.title="文字色";

    const preview = document.createElement("span"); preview.className="colorPreview";
    preview.textContent = t.name;
    preview.style.background = t.bg||"#0f0f0f";
    preview.style.color      = t.text||"#f0f0f0";

    cpWrap.appendChild(bgLab); cpWrap.appendChild(bgInp);
    cpWrap.appendChild(txLab); cpWrap.appendChild(txInp);
    cpWrap.appendChild(preview);

    /* 操作ボタン */
    const editBtn = document.createElement("button"); editBtn.type="button"; editBtn.className="small"; editBtn.textContent="編集";
    const delBtn  = document.createElement("button"); delBtn.type="button";  delBtn.className="small danger"; delBtn.textContent="削除";

    div.appendChild(nameWrap); div.appendChild(catTag); div.appendChild(freqTag);
    div.appendChild(cpWrap); div.appendChild(editBtn); div.appendChild(delBtn);
    box.appendChild(div);

    /* ── ドラッグイベント（PC） ── */
    div.addEventListener("dragstart", e => {
      dragSrcIdx = idx; div.classList.add("dragging"); e.dataTransfer.effectAllowed="move";
    });
    div.addEventListener("dragend", () => {
      div.classList.remove("dragging");
      box.querySelectorAll(".masterItem").forEach(el=>el.classList.remove("drag-over"));
    });
    div.addEventListener("dragover", e => {
      e.preventDefault(); e.dataTransfer.dropEffect="move";
      box.querySelectorAll(".masterItem").forEach(el=>el.classList.remove("drag-over"));
      div.classList.add("drag-over");
    });
    div.addEventListener("drop", e => {
      e.preventDefault();
      if (dragSrcIdx===null || dragSrcIdx===idx) return;
      const ts = loadTasks(); const [moved]=ts.splice(dragSrcIdx,1); ts.splice(idx,0,moved);
      saveTasks(ts); renderTaskChips(); renderMaster();
    });

    /* ── タッチ並び替え（iPhone） ── */
    let touchDragging = false;
    handle.addEventListener("touchstart", e => {
      touchDragging = true; div.classList.add("dragging"); e.stopPropagation();
    }, {passive:true});
    handle.addEventListener("touchmove", e => {
      if (!touchDragging) return; e.preventDefault();
      const y = e.touches[0].clientY;
      box.querySelectorAll(".masterItem").forEach(el => el.classList.remove("drag-over"));
      const target = Array.from(box.querySelectorAll(".masterItem")).find(el => {
        const r = el.getBoundingClientRect(); return y>=r.top && y<=r.bottom;
      });
      if (target && target!==div) target.classList.add("drag-over");
    }, {passive:false});
    handle.addEventListener("touchend", e => {
      if (!touchDragging) return; touchDragging=false; div.classList.remove("dragging");
      const y = e.changedTouches[0].clientY;
      box.querySelectorAll(".masterItem").forEach(el=>el.classList.remove("drag-over"));
      const items = Array.from(box.querySelectorAll(".masterItem"));
      const targetEl = items.find(el=>{ const r=el.getBoundingClientRect(); return y>=r.top&&y<=r.bottom; });
      if (!targetEl||targetEl===div) return;
      const toIdx = Number(targetEl.dataset.idx); if(isNaN(toIdx)||toIdx===idx) return;
      const ts = loadTasks(); const [moved]=ts.splice(idx,1); ts.splice(toIdx,0,moved);
      saveTasks(ts); renderTaskChips(); renderMaster();
    });

    /* ── カラーリアルタイムプレビュー ── */
    bgInp.addEventListener("input", () => {
      const ts=loadTasks(); if(!ts[idx]) return;
      ts[idx].bg = clampColor(bgInp.value,"#0f0f0f");
      saveTasks(ts); preview.style.background=ts[idx].bg;
      renderTaskChips(); renderHistory(); renderReco();
    });
    txInp.addEventListener("input", () => {
      const ts=loadTasks(); if(!ts[idx]) return;
      ts[idx].text = clampColor(txInp.value,"#f0f0f0");
      saveTasks(ts); preview.style.color=ts[idx].text;
      renderTaskChips(); renderHistory(); renderReco();
    });

    /* ── 編集 ── */
    editBtn.addEventListener("click", () => {
      const ts=loadTasks(), tgt=ts[idx]; if(!tgt) return;
      showModal("項目を編集",[
        {id:"name",label:"項目名",type:"text",value:tgt.name},
        {id:"cat",label:"区分",type:"select",value:tgt.cat,options:getCats()},
        {id:"freq",label:"推奨頻度 日数（空欄=未設定）",type:"number",value:(tgt.freqDays&&tgt.freqDays>0)?String(tgt.freqDays):"",inputmode:"numeric"}
      ], out => {
        const nm=String(out.name??"").trim(); if(!nm) return;
        const ct=getCats().includes(String(out.cat).trim())?String(out.cat).trim():"その他";
        const fd=normalizeIntOrNull(String(out.freq??"").trim());
        if (ts.find((x,i)=>i!==idx&&x.name===nm)) { showAlert("確認","同名が既に存在"); return; }
        ts[idx]={...tgt,name:nm,cat:ct,freqDays:(fd&&fd>0)?fd:null};
        saveTasks(ts); renderTaskChips(); renderMaster(); renderReco();
      },()=>{});
    });

    /* ── 削除 ── */
    delBtn.addEventListener("click", () => {
      const ts=loadTasks(), tgt=ts[idx]; if(!tgt) return;
      showDeleteConfirm(`「${tgt.name}」を削除しますか？`, ()=>{
        ts.splice(idx,1); saveTasks(ts); renderTaskChips(); renderMaster(); renderReco();
      },()=>{});
    });
  });
}

/* ── 作業追加フォーム ── */
function addTaskFromInputs() {
  const name = String($("newTask").value??"").trim(); if(!name) return;
  const cats = getCats(), cat = String($("newCat")?$("newCat").value:"").trim();
  const ct   = cats.includes(cat)?cat:(cats[0]||"その他");
  const fd   = normalizeIntOrNull($("newFreq").value);
  const bg   = clampColor($("newBg").value,"#0f0f0f");
  const text = clampColor($("newText").value,"#f0f0f0");
  const tasks = loadTasks();
  if (tasks.find(t=>t.name===name)) { showAlert("確認","同名が既に存在"); return; }
  tasks.push({name,cat:ct,freqDays:(fd&&fd>0)?fd:null,bg,text});
  saveTasks(tasks);
  $("newTask").value=""; $("newFreq").value=""; $("newBg").value="#0f0f0f"; $("newText").value="#f0f0f0";
  renderTaskChips(); renderMaster(); renderReco();
}

/* ── 推奨作業 ── */
function lastDoneMap(rows) {
  const map = new Map();
  rows.forEach(r => {
    const iso = String(r.date??""); if(!iso) return;
    (Array.isArray(r.tasks)?r.tasks:[]).forEach(name => {
      const prev=map.get(name); if(!prev||prev.localeCompare(iso)<0) map.set(name,iso);
    });
  });
  return map;
}
function renderReco() {
  const tasks=loadTasks(), rows=loadRows(), map=lastDoneMap(rows), today=todayISO(), box=$("reco");
  const targets = tasks.filter(t=>t.freqDays&&t.freqDays>0).map(t => {
    const last=map.get(t.name)||null, elapsed=last?daysBetween(last,today):null;
    const due=elapsed===null?true:elapsed>=t.freqDays;
    const over=elapsed===null?t.freqDays:elapsed-t.freqDays;
    return {...t,last,elapsed,due,over};
  });
  if (!targets.length) { box.textContent="推奨頻度が設定された項目のみ表示"; return; }
  targets.sort((a,b)=>{ const d=(b.due?1:0)-(a.due?1:0); return d!==0?d:Number(b.over??0)-Number(a.over??0); });
  box.innerHTML = "";
  const wrap = document.createElement("div");
  targets.forEach(t => {
    const item = document.createElement("div"); item.className="recoItem";
    const left = document.createElement("div"); left.className="recoName";
    left.textContent=t.name; left.style.background=t.bg||"rgba(255,255,255,0.06)"; left.style.color=t.text||"#f0f0f0";
    const meta = document.createElement("div"); meta.className="recoMeta";
    const dueTxt = t.due?`<span class="due-label">要実施</span>`:"猶予";
    meta.innerHTML=`<div>${dueTxt}</div><div>${escapeHtml(t.last?formatJP(t.last):"未実施")}</div>`
      +`<div>${escapeHtml(t.elapsed===null?"不明":`${t.elapsed}日経過`)} 閾値${escapeHtml(String(t.freqDays))}日</div>`;
    item.appendChild(left); item.appendChild(meta); wrap.appendChild(item);
  });
  box.appendChild(wrap);
}

/* ── 区分マスター折りたたみ ── */
function setupMasterCollapsibles() {
  const master = $("master");
  if (master && !$("masterWrap_v5")) {
    const wrap = document.createElement("div"); wrap.id="masterWrap_v5"; wrap.style.display="none";
    const btn = document.createElement("button"); btn.type="button"; btn.id="masterToggleBtn_v5";
    btn.className="miniToggle"; btn.textContent="作業内容マスター 表示";
    master.parentNode.insertBefore(btn, master); master.parentNode.insertBefore(wrap, master); wrap.appendChild(master);
    btn.addEventListener("click",()=>{
      const open=wrap.style.display!=="none"; wrap.style.display=open?"none":"";
      btn.textContent=open?"作業内容マスター 表示":"作業内容マスター 非表示";
    });
  }
  if (!$("catMasterPanel_v5")) {
    const panel=document.createElement("div"); panel.id="catMasterPanel_v5"; panel.className="miniPanel catPanel";
    const toggle=document.createElement("button"); toggle.type="button"; toggle.className="miniToggle"; toggle.textContent="区分マスター 表示";
    const body=document.createElement("div"); body.style.display="none";
    const row=document.createElement("div"); row.className="miniRow";
    const inp=document.createElement("input"); inp.type="text"; inp.placeholder="区分名を追加"; inp.id="catName_v5";
    const add=document.createElement("button"); add.type="button"; add.textContent="追加";
    row.appendChild(inp); row.appendChild(add);
    const list=document.createElement("div"); list.style.marginTop="10px";
    const rerenderAll=()=>{ renderTaskChips();renderMaster();renderReco();renderHistory(); };
    let catDragSrcIdx = null;
    const renderCats=()=>{
      const cats=getCats(); list.innerHTML="";
      cats.forEach((c,idx)=>{
        const r=document.createElement("div");
        r.className="masterItem"; r.draggable=true; r.dataset.idx=idx;
        r.style.padding="8px 4px";

        /* ドラッグハンドル */
        const handle=document.createElement("span");
        handle.className="drag-handle"; handle.textContent="⠿"; handle.title="ドラッグして並び替え";

        /* 区分名 pill */
        const pill=document.createElement("span"); pill.className="pill"; pill.textContent=c;

        /* 削除ボタン */
        const dl=document.createElement("button"); dl.type="button"; dl.className="small danger"; dl.textContent="削除";
        dl.addEventListener("click",()=>{
          const cn=getCats(); if(cn.length<=1){showAlert("確認","区分は最低1つ必要");return;}
          showDeleteConfirm("区分「"+c+"」を削除しますか？",()=>{
            const next=cn.filter(x=>x!==c); saveCats(next);
            const ts=loadTasks(),fb=next[0]||"その他";
            ts.forEach(t=>{ if(String(t.cat??"")===c) t.cat=fb; }); saveTasks(ts);
            renderCats(); rerenderAll();
          },()=>{});
        });

        r.appendChild(handle); r.appendChild(pill); r.appendChild(dl);
        list.appendChild(r);

        /* ── ドラッグイベント（PC） ── */
        r.addEventListener("dragstart",e=>{
          catDragSrcIdx=idx; r.classList.add("dragging"); e.dataTransfer.effectAllowed="move";
        });
        r.addEventListener("dragend",()=>{
          r.classList.remove("dragging");
          list.querySelectorAll(".masterItem").forEach(el=>el.classList.remove("drag-over"));
        });
        r.addEventListener("dragover",e=>{
          e.preventDefault(); e.dataTransfer.dropEffect="move";
          list.querySelectorAll(".masterItem").forEach(el=>el.classList.remove("drag-over"));
          r.classList.add("drag-over");
        });
        r.addEventListener("drop",e=>{
          e.preventDefault();
          if(catDragSrcIdx===null||catDragSrcIdx===idx) return;
          const a=getCats(); const [moved]=a.splice(catDragSrcIdx,1); a.splice(idx,0,moved);
          saveCats(a); renderCats(); rerenderAll();
        });

        /* ── タッチ並び替え（iPhone） ── */
        let touchDragging=false;
        handle.addEventListener("touchstart",e=>{ touchDragging=true; r.classList.add("dragging"); e.stopPropagation(); },{passive:true});
        handle.addEventListener("touchmove",e=>{
          if(!touchDragging) return; e.preventDefault();
          const y=e.touches[0].clientY;
          list.querySelectorAll(".masterItem").forEach(el=>el.classList.remove("drag-over"));
          const target=Array.from(list.querySelectorAll(".masterItem")).find(el=>{
            const rc=el.getBoundingClientRect(); return y>=rc.top&&y<=rc.bottom;
          });
          if(target&&target!==r) target.classList.add("drag-over");
        },{passive:false});
        handle.addEventListener("touchend",e=>{
          if(!touchDragging) return; touchDragging=false; r.classList.remove("dragging");
          const y=e.changedTouches[0].clientY;
          list.querySelectorAll(".masterItem").forEach(el=>el.classList.remove("drag-over"));
          const items=Array.from(list.querySelectorAll(".masterItem"));
          const targetEl=items.find(el=>{ const rc=el.getBoundingClientRect(); return y>=rc.top&&y<=rc.bottom; });
          if(!targetEl||targetEl===r) return;
          const toIdx=Number(targetEl.dataset.idx); if(isNaN(toIdx)||toIdx===idx) return;
          const a=getCats(); const [moved]=a.splice(idx,1); a.splice(toIdx,0,moved);
          saveCats(a); renderCats(); rerenderAll();
        });
      });
    };
    add.addEventListener("click",()=>{
      const name=String(inp.value??"").trim(); if(!name)return;
      const cats=getCats(); if(cats.includes(name)){showAlert("確認","同名が既に存在");return;}
      cats.push(name); saveCats(cats); inp.value=""; renderCats(); rerenderAll();
    });
    toggle.addEventListener("click",()=>{
      const open=body.style.display!=="none"; body.style.display=open?"none":"";
      toggle.textContent=open?"区分マスター 表示":"区分マスター 非表示";
    });
    body.appendChild(row); body.appendChild(list);
    panel.appendChild(toggle); panel.appendChild(body);
    const mw=$("masterWrap_v5");
    if(mw&&mw.parentNode) mw.parentNode.insertBefore(panel,mw.nextSibling);
    else if(master&&master.parentNode) master.parentNode.insertBefore(panel,master.nextSibling);
    renderCats();
  }
}

/* ── エクスポート / インポート ── */
function exportJSON() {
  const payload={ version:4, exportedAt:new Date().toISOString(),
    appName:loadAppName(), tasks:loadTasks(), rows:loadRows() };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=`maintelog_backup_${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function importJSON(file) {
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const p=JSON.parse(reader.result);
      if(!p||typeof p!=="object") throw new Error("不正なファイル形式");
      if(typeof p.version!=="number"||p.version<1||p.version>99) throw new Error("バージョン情報が不正");
      if(!Array.isArray(p.rows))  throw new Error("rowsが配列ではありません");
      if(!Array.isArray(p.tasks)) throw new Error("tasksが配列ではありません");
      p.rows.forEach((r,i)=>{ if(typeof r!=="object"||r===null) throw new Error(`row[${i}]が不正`);
        if(typeof r.date!=="string") throw new Error(`row[${i}].dateが不正`); });
      if(typeof p.appName==="string") saveAppName(p.appName);
      const m=migrateTasks(p.tasks); if(m) saveTasks(m);
      saveRows(p.rows.map(r=>({id:r.id||genId(),...r})));
      boot(); showAlert("確認","復元完了");
    } catch(e) { showAlert("読み込み失敗",e.message); }
  };
  reader.readAsText(file);
}

/* ── ビュー切替 ── */
function setView(which) {
  const isInput=which==="input";
  const vi=$("viewInput"), vh=$("viewHistory");
  if(vi) vi.style.display=isInput?"":"none";
  if(vh) vh.style.display=isInput?"none":"";
  $("tabInput") .classList.toggle("active", isInput);
  $("tabHistory").classList.toggle("active",!isInput);
  if(!isInput){renderReco();renderHistory();}
}

/* ── 起動 ── */
function boot() {
  ensureDefaultTasks();
  $("date").value=todayISO();
  applyAppName(); renderStatus();
  renderTaskChips(); renderMaster(); renderReco(); renderHistory();
  setView("input"); setupMasterCollapsibles();
}

/* ── イベントバインド ── */
function bindIf(id,type,fn){ const el=$(id); if(el) el.addEventListener(type,fn); }
bindIf("tabInput",  "click",()=>setView("input"));
bindIf("tabHistory","click",()=>setView("history"));
bindIf("save","click",()=>{
  const date=$("date").value||"", nights=normalizeIntOrNull($("nights").value);
  const tasks=getSelectedTasks(), other=$("other").value||"";
  if(!date){showAlert("確認","日付は必須");return;}
  if(!tasks.length&&!String(other).trim()&&nights===null) return;
  addRow({date,nights,tasks,other}); clearInput(); renderStatus();
});
bindIf("clear","click",()=>clearInput());
bindIf("wipe","click",()=>{
  showConfirm("確認","全データを削除します",()=>{
    saveRows([]); saveTasks(ensureDefaultTasks()); localStorage.removeItem(APPNAME_KEY); boot();
  },()=>{});
});
bindIf("addTask","click",()=>addTaskFromInputs());
bindIf("newTask","keydown",e=>{ if(e.key==="Enter"){e.preventDefault();addTaskFromInputs();} });
bindIf("sortDesc","click",()=>{ sortMode="desc"; renderHistory(); $("sortDesc").classList.add("active"); $("sortAsc").classList.remove("active"); });
bindIf("sortAsc", "click",()=>{ sortMode="asc";  renderHistory(); $("sortAsc").classList.add("active"); $("sortDesc").classList.remove("active"); });
bindIf("export","click",()=>exportJSON());
bindIf("import","change",e=>{ const f=e.target.files&&e.target.files[0]; if(!f)return; importJSON(f); e.target.value=""; });
bindIf("saveAppName", "click",()=>{ saveAppName($("appName").value); applyAppName(); showAlert("確認","保存完了"); });
bindIf("resetAppName","click",()=>{ localStorage.removeItem(APPNAME_KEY); applyAppName(); });

boot();
