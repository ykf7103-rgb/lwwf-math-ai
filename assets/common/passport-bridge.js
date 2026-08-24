(function () {
  "use strict";
  if (window.LWWFMathPassportBridge) return;
  const current = document.currentScript;
  const script = document.createElement("script");
  script.src = current && current.src
    ? current.src.replace("passport-bridge.js", "passport-runtime.js")
    : "assets/common/passport-runtime.js";
  script.async = false;
  script.referrerPolicy = "no-referrer";
  document.head.appendChild(script);
})();
