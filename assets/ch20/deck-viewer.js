const cfg = window.DECK_CONFIG;
let page = 1;
let reachedEnd = false;

function pad(n) {
  return String(n).padStart(2, "0");
}

function render() {
  const img = document.getElementById("slideImg");
  img.src = `pages/${cfg.prefix}_p${pad(page)}.jpg`;
  img.alt = `${cfg.title} 第 ${page} 頁`;
  document.getElementById("pageNow").textContent = page;
  document.getElementById("pageTotal").textContent = cfg.total;
  document.getElementById("prevBtn").disabled = page <= 1;
  document.getElementById("nextBtn").disabled = page >= cfg.total;
  if (page >= cfg.total && !reachedEnd) {
    reachedEnd = true;
    markDeckDone();
    showDoneBanner();
  }
}

function prevPage() {
  if (page > 1) {
    page -= 1;
    render();
  }
}

function nextPage() {
  if (page < cfg.total) {
    page += 1;
    render();
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") prevPage();
  if (event.key === "ArrowRight" || event.key === " ") nextPage();
});

window.addEventListener("DOMContentLoaded", render);

function markDeckDone() {
  try {
    const u = JSON.parse(localStorage.getItem("lwwf_auth_user") || "null");
    const key = (u && u.class && u.number)
      ? `progress_ch20_${u.class}_${u.number}`
      : `progress_ch20`;
    const p = JSON.parse(localStorage.getItem(key) || "{}");
    const stepKey = cfg.prefix;
    const prev = p[stepKey] || {};
    p[stepKey] = Object.assign({}, prev, { done: true, ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(p));
  } catch (e) {}
}

function showDoneBanner() {
  if (document.getElementById("deckDoneBanner")) return;
  const banner = document.createElement("div");
  banner.id = "deckDoneBanner";
  banner.textContent = `✅ 已完成 ${cfg.title}！+金幣已加入`;
  banner.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4CAF50,#2E7D32);color:white;padding:10px 18px;border-radius:24px;font-weight:800;box-shadow:0 4px 12px rgba(46,125,50,0.4);z-index:9999;font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;font-size:0.92rem;";
  document.body.appendChild(banner);
  setTimeout(() => { banner.style.transition = "opacity 0.6s"; banner.style.opacity = "0"; }, 3000);
  setTimeout(() => banner.remove(), 4000);
}
