"use strict";
const el = id => document.getElementById(id);
const digits = new Intl.NumberFormat("ne-NP-u-nu-deva");
const normalize = value => String(value).normalize("NFC").toLowerCase()
  .replace(/[०-९]/g, c => String(c.charCodeAt(0) - 2406))
  .replace(/[ीूशषव]/g, c => ({"ी":"ि","ू":"ु","श":"स","ष":"स","व":"ब"})[c])
  .replace(/[\u200b-\u200d]/g, "").replace(/[_.,-]/g, " ");
function displayLabel(label) {
  const parts = label.replace(/\.(txt|html)$/i, "").split("_");
  const nepali = parts.filter(part => /[\u0900-\u097f]/.test(part));
  return (nepali.length ? nepali : parts).join(" ");
}
function stored(key) {
  try {
    const value = JSON.parse(localStorage.getItem("rmo2:" + key));
    return Array.isArray(value) ? value.filter(v => typeof v === "string") : [];
  } catch { return []; }
}
function persist(key, values) {
  try { localStorage.setItem("rmo2:" + key, JSON.stringify(values)); }
  catch { /* Keep the choice available for this session. */ }
}
const saved = new Set(stored("saved"));
let recent = stored("recent");
let orders = [], view = "all", current = null, editing = false;
// Per-tab drafts can survive refresh without saving case text in browser history.
const drafts = new Map();
function draftKey(id) {return "rmo2:draft:" + id;}
function rememberDraft() {
  try {
    if (drafts.has(current.id)) sessionStorage.setItem(draftKey(current.id),currentText());
    else sessionStorage.removeItem(draftKey(current.id));
  } catch { /* The in-memory draft remains available. */ }
}
function element(tag, cls, text) {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
}
function showAll() {
  el("query").value = "";
  el("group").value = "";
  setView("all");
}
function setView(next) {
  view = next;
  for (const button of el("views").children) button.setAttribute("aria-pressed", button.dataset.view === view);
  render();
}
function render() {
  const terms = normalize(el("query").value).trim().split(/\s+/).filter(Boolean);
  const group = el("group").value;
  const shown = orders.filter(order => (!group || order.group === group)
    && (view !== "saved" || saved.has(order.id)) && (view !== "recent" || recent.includes(order.id))
    && terms.every(term => order.index.includes(term)));
  if (view === "recent") shown.sort((a,b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  el("count").textContent = digits.format(shown.length) + " आदेश";
  el("list").replaceChildren();
  for (const order of shown) {
    const card = element("article", "card", "");
    const open = element("button", "open", "");
    open.append(element("span","topic",order.subject),element("h2","",order.title),
      element("span","excerpt",order.plain.slice(0,220)));
    open.setAttribute("aria-label", order.title + " खोल्नुहोस्");
    open.onclick = () => read(order);
    const fav = element("button","star",saved.has(order.id) ? "★" : "☆");
    function updateStar() {
      const active = saved.has(order.id);
      fav.textContent = active ? "★" : "☆";
      fav.setAttribute("aria-pressed",active);
      fav.setAttribute("aria-label",order.title + " · मनपर्ने");
      fav.title = active ? "मनपर्नेबाट हटाउनुहोस्" : "मनपर्नेमा राख्नुहोस्";
    }
    fav.onclick = () => {
      if (saved.has(order.id)) saved.delete(order.id); else saved.add(order.id);
      persist("saved",[...saved]); updateStar();
      if (view === "saved") {render(); (el("list").querySelector(".star") || el("reset")).focus();}
    };
    updateStar(); card.append(open,fav); el("list").append(card);
  }
  el("empty").hidden = shown.length > 0;
  el("emptyTitle").textContent = "आदेश भेटिएन";
  el("emptyHint").textContent = terms.length || group ? "अर्को शब्द खोज्नुहोस् वा विषय बदल्नुहोस्।"
    : view === "saved" ? "फेरि प्रयोग गर्ने आदेशमा ☆ थिच्नुहोस्।" : "तपाईंले खोलेका आदेश यहाँ देखिन्छन्।";
}
function currentText() {return drafts.get(current.id) ?? current.plain;}
function paint() {
  const paper = el("paper");
  paper.replaceChildren();
  if (drafts.has(current.id)) paper.textContent = currentText();
  else {
    let offset = 0;
    for (const piece of current.pieces) {
      if (piece.sample) {
        const start = offset;
        const mark = element("mark","",piece.text);
        mark.title = "यो अंश सम्पादन गर्नुहोस्";
        mark.onclick = () => {setEditing(true); el("editor").setSelectionRange(start,start+piece.text.length);};
        paper.append(mark);
      } else paper.append(document.createTextNode(piece.text));
      offset += piece.text.length;
    }
  }
  el("restore").hidden = !drafts.has(current.id);
}
function setEditing(value) {
  editing = value;
  el("editBox").hidden = !value; el("paper").hidden = value;
  el("edit").textContent = value ? "पूर्वावलोकन" : "व्यहोरा सम्पादन";
  el("tip").textContent = value ? "सम्पादित पाठ यही ट्याबमा रहन्छ। राख्नका लागि प्रतिलिपि वा प्रिन्ट लिनुहोस्।"
    : drafts.has(current.id) ? "सम्पादित व्यहोरा" : "मुद्दाअनुसार मिलाउनुपर्ने अंश पहेँलो रङमा देखाइएको छ। अंश थिचेर सच्याउन सकिन्छ।";
  if (value) {el("editor").value = currentText(); el("editor").focus();}
  else paint();
}
function read(order) {
  current = order;
  if (!drafts.has(order.id)) {
    try {
      const text = sessionStorage.getItem(draftKey(order.id));
      if (text !== null) drafts.set(order.id,text);
    } catch {}
  }
  recent = [order.id,...recent.filter(id => id !== order.id)].slice(0,20); persist("recent",recent);
  el("subject").textContent = order.subject; el("title").textContent = order.title;
  el("notice").textContent = "";
  el("reader").showModal(); setEditing(false);
}
el("editor").oninput = () => {
  if (el("editor").value === current.plain) drafts.delete(current.id);
  else drafts.set(current.id,el("editor").value);
  rememberDraft();
  el("restore").hidden = !drafts.has(current.id); el("notice").textContent = "";
};
el("restore").onclick = () => {
  if (confirm("यो आदेशमा गरेका परिवर्तन हटाएर मूल पाठ फर्काउने हो?")) {
    drafts.delete(current.id); rememberDraft(); setEditing(false); el("notice").textContent = "मूल पाठ फर्काइयो।";
  }
};
el("edit").onclick = () => setEditing(!editing);
el("close").onclick = () => el("reader").close();
el("reader").onclose = () => {if (view === "recent") render();};
el("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(currentText());
    el("notice").textContent = "व्यहोरा प्रतिलिपि गरियो।";
  } catch {
    setEditing(true); el("editor").select();
    let copied = false;
    try {copied = document.execCommand("copy");} catch {}
    el("notice").textContent = copied ? "व्यहोरा प्रतिलिपि गरियो।" : "छानिएको पाठ प्रतिलिपि गर्न Ctrl/Cmd + C थिच्नुहोस्।";
  }
};
el("print").onclick = () => {el("printArea").textContent = currentText(); window.print();};
el("query").oninput = render; el("group").onchange = render;
el("views").onclick = event => {if (event.target.dataset.view) setView(event.target.dataset.view);};
el("reset").onclick = showAll;
document.addEventListener("keydown",event => {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !el("reader").open
    && !["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault(); el("query").focus();
  }
});
async function init() {
  try {
    const response = await fetch("adesh-catalog.json");
    if (!response.ok) throw Error();
    const data = await response.json();
    for (const category of data.categories) {
      const subject = displayLabel(category.label);
      el("group").add(new Option(subject, category.id));
      for (const entry of category.orders.filter(o => o.available && o.text.trim())) {
        const pieces = entry.text.split(/(<b><s>[\s\S]*?<\/s><\/b>)/gi).filter(Boolean)
          .map(part => ({sample:/^<b><s>/i.test(part),text:part.replace(/<\/?[bs]>/gi,"")}));
        const plain = pieces.map(piece => piece.text).join("");
        orders.push({id:entry.id,group:category.id,subject,title:displayLabel(entry.label),plain,pieces,
          index:normalize([category.label,entry.label,entry.keywords,plain].join(" "))});
      }
    }
    render();
  } catch {
    el("list").textContent = "आदेश सङ्ग्रह लोड हुन सकेन। साइट पुनः खोल्नुहोस्।";
    el("query").disabled = el("group").disabled = true;
  }
}
init();
