// Compatibility loader for the central Learning Passport feedback widget.
// This file intentionally owns no credentials, roster data or remote endpoint.
(function () {
  "use strict";
  if (window.LWWFLegacyFeedback) return;

  function start() {
    const bridge = window.LWWFMathPassportBridge;
    if (!bridge) return Promise.resolve({ ready: false });
    return bridge.init({ feedbackWidget: true });
  }

  if (!window.LWWFMathPassportBridge) {
    const current = document.currentScript;
    const script = document.createElement("script");
    script.src = current && current.src
      ? current.src.replace("feedback.js", "passport-runtime.js")
      : "assets/common/passport-runtime.js";
    script.async = false;
    script.referrerPolicy = "no-referrer";
    script.onload = function () { start().catch(function () {}); };
    document.head.appendChild(script);
  } else {
    start().catch(function () {});
  }

  window.LWWFLegacyFeedback = Object.freeze({
    open: function () {
      return start().then(function () {
        const host = document.querySelector("[data-lwwf-feedback-host]");
        if (host) host.click();
      });
    }
  });
})();
