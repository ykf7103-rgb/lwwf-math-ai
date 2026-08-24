import { readFileSync } from "node:fs";
import vm from "node:vm";

const scriptPattern = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
let checked = 0;

const pages = [
  "index.html",
  "tools/ai-comic.html",
  ...Array.from({ length: 10 }, (_value, index) => `assets/ch${index + 12}/ai-help.html`)
];

for (const page of pages) {
  const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
  scriptPattern.lastIndex = 0;
  let match;
  while ((match = scriptPattern.exec(html))) {
    const attributes = match[1] || "";
    const type = attributes.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (type && !["text/javascript", "application/javascript", "module"].includes(type)) continue;
    new vm.Script(match[2], { filename: `${page}:inline-${checked + 1}` });
    checked += 1;
  }
}

if (!checked) throw new Error("沒有可檢查的 inline script");
console.log(`inline scripts: ${checked} passed across ${pages.length} pages`);
