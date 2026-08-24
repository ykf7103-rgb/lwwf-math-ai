import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.argv[2] || process.env.PLAYWRIGHT_PORT || 18994);
const mimeTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
});

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl || "/", "http://127.0.0.1").pathname);
  const candidate = resolve(root, "." + pathname);
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  try {
    return statSync(candidate).isDirectory() ? resolve(candidate, "index.html") : candidate;
  } catch {
    return null;
  }
}

const server = createServer((request, response) => {
  if (!request.url || !["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405).end();
    return;
  }
  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(404).end();
    return;
  }
  let size;
  try {
    size = statSync(filePath).size;
  } catch {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": size,
    "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream"
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
  response.on("close", () => stream.destroy());
  stream.pipe(response);
});

server.on("clientError", (_error, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(port, "127.0.0.1");
