const scriptLoads = new Map();
const styleLoads = new Map();
let katexConfigured = false;

function loadScript(src) {
  if (scriptLoads.has(src)) return scriptLoads.get(src);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });

  scriptLoads.set(src, promise);
  return promise;
}

function loadStyle(href) {
  if (styleLoads.has(href)) return styleLoads.get(href);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) {
      if (existing.sheet) resolve();
      else {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      }
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", reject, { once: true });
    document.head.appendChild(link);
  });

  styleLoads.set(href, promise);
  return promise;
}

export async function ensureMarkdown(markdownText) {
  if (typeof window.marked === "undefined") {
    await loadScript("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
  }

  if (!markdownText.includes("$")) return;

  await Promise.all([
    loadStyle("https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css"),
    typeof window.katex === "undefined"
      ? loadScript("https://cdn.jsdelivr.net/npm/katex/dist/katex.min.js")
      : Promise.resolve(),
  ]);

  if (typeof window.markedKatex === "undefined") {
    await loadScript("https://cdn.jsdelivr.net/npm/marked-katex-extension/lib/index.umd.js");
  }

  if (!katexConfigured) {
    window.marked.use(
      window.markedKatex({ throwOnError: false, nonStandard: true }),
    );
    katexConfigured = true;
  }
}

export async function ensureCodeHighlighting() {
  await Promise.all([
    loadStyle(
      "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css",
    ),
    loadStyle(
      "https://fonts.googleapis.com/css2?family=Google+Sans+Code:wght@400..700&display=swap",
    ),
    typeof window.hljs === "undefined"
      ? loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js",
        )
      : Promise.resolve(),
  ]);
}

export async function ensurePdfJs() {
  if (typeof window.pdfjsLib === "undefined") {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    );
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}
