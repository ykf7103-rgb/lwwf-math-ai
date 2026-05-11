const cfg = window.DECK_CONFIG;
let page = 1;

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
