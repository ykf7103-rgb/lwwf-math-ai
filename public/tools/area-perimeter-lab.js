(function () {
  const challenges = [
    {
      id: "border-garden",
      title: "任務一：圍欄要看周界",
      prompt: "花圃長 4 cm、闊 3 cm。要用繩圍邊，應計算周界。",
      start: { length: 3, width: 3, measure: "area" },
      target: { length: 4, width: 3 },
      requiredMeasure: "perimeter",
      targetArea: 12,
      targetPerimeter: 14,
      mode: "exact",
      strategy: "border-not-fill"
    },
    {
      id: "tile-floor",
      title: "任務二：鋪地磚要看面積",
      prompt: "地台長 5 cm、闊 4 cm。要鋪滿方格，應計算面積。",
      start: { length: 4, width: 4, measure: "perimeter" },
      target: { length: 5, width: 4 },
      requiredMeasure: "area",
      targetArea: 20,
      targetPerimeter: 18,
      mode: "exact",
      strategy: "fill-not-border"
    },
    {
      id: "same-area-different-perimeter",
      title: "任務三：同一面積，不同周界",
      prompt: "建立一個面積 18 cm² 的長方形，但不要用 3 × 6 的起始形狀。",
      start: { length: 3, width: 6, measure: "area" },
      requiredMeasure: "area",
      targetArea: 18,
      targetPerimeter: null,
      mode: "area-not-start",
      strategy: "same-area-different-shape"
    },
    {
      id: "max-area-fixed-perimeter",
      title: "任務四：固定周界找最大面積",
      prompt: "周界固定為 20 cm。調成 5 × 5，觀察為何面積最大。",
      start: { length: 1, width: 9, measure: "perimeter" },
      target: { length: 5, width: 5 },
      requiredMeasure: "area",
      targetArea: 25,
      targetPerimeter: 20,
      mode: "exact",
      strategy: "max-area-with-fixed-perimeter"
    },
    {
      id: "word-problem-diagnosis",
      title: "任務五：文字題先判斷量度",
      prompt: "長 6 cm、闊 4 cm 的告示板要加邊框。邊框長度是周界，不是面積。",
      start: { length: 6, width: 4, measure: "area" },
      target: { length: 6, width: 4 },
      requiredMeasure: "perimeter",
      targetArea: 24,
      targetPerimeter: 20,
      mode: "exact",
      strategy: "word-clue-diagnosis"
    }
  ];

  const storageKey = "lwwf_math_area_perimeter_lab_v1";
  const state = {
    route: "area-perimeter-lab",
    mode: "challenge",
    length: 3,
    width: 3,
    selectedMeasure: "area",
    challengeIndex: 0,
    attempts: 0,
    correct: 0,
    completedIds: [],
    saveStatus: "idle",
    apiStatus: "not-connected",
    passportSiteId: "lwwf-math-ai",
    lastPassportSync: "",
    lastFeedback: "先看題目是「鋪滿」還是「圍邊」，再調整長方形。",
    lastError: ""
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function passportBridge() {
    return window.LWWFMathPassportBridge || null;
  }

  function toolStorage() {
    return passportBridge()?.storage;
  }

  function currentChallenge() {
    return challenges[state.challengeIndex % challenges.length];
  }

  function area() {
    return state.length * state.width;
  }

  function perimeter() {
    return 2 * (state.length + state.width);
  }

  function sameDimensions(a, b) {
    if (!a || !b) return false;
    return (a.length === b.length && a.width === b.width)
      || (a.length === b.width && a.width === b.length);
  }

  function progress() {
    const accuracy = state.attempts ? Math.round((state.correct / state.attempts) * 100) : 0;
    return {
      correct: state.correct,
      attempts: state.attempts,
      accuracy,
      completedCount: state.completedIds.length,
      totalChallenges: challenges.length
    };
  }

  function passportSnapshot() {
    const client = passportBridge();
    if (!client || typeof client.getState !== "function") return { ready: false, readOnly: true };
    try {
      return client.getState() || { ready: false };
    } catch {
      return { ready: false };
    }
  }

  function updatePassportStatusLabel() {
    const pill = $("[data-testid='passport-pill']");
    if (!pill) return;
    const snapshot = passportSnapshot();
    if (snapshot.synthetic === true || snapshot.mode === "teacher-preview") {
      pill.textContent = "教師巡堂沙盒";
    } else if (state.apiStatus === "pending") {
      pill.textContent = "護照記錄中";
    } else if (state.apiStatus === "saved-passport") {
      pill.textContent = "護照已記錄";
    } else if (state.apiStatus === "failed") {
      pill.textContent = "護照暫未同步";
    } else if (snapshot.ready) {
      pill.textContent = "護照已連線";
    } else {
      pill.textContent = "護照未連線";
    }
  }

  function saveProgress() {
    try {
      toolStorage()?.setItem(storageKey, JSON.stringify({
        completedIds: state.completedIds,
        correct: state.correct,
        attempts: state.attempts,
        updatedAt: new Date().toISOString()
      }));
      state.saveStatus = passportBridge()?.isTeacherPreview() ? "saved-sandbox" : "saved-local";
    } catch (error) {
      state.saveStatus = "failed";
      state.lastError = error instanceof Error ? error.message : "Local progress could not be saved.";
    }
  }

  function loadProgress() {
    try {
      const raw = toolStorage()?.getItem(storageKey);
      if (!raw) return;
      const payload = JSON.parse(raw);
      state.completedIds = Array.isArray(payload.completedIds)
        ? payload.completedIds.filter((id) => challenges.some((item) => item.id === id))
        : [];
      state.correct = Number(payload.correct || 0);
      state.attempts = Number(payload.attempts || 0);
      state.saveStatus = "loaded-local";
    } catch {
      state.saveStatus = "fresh";
    }
  }

  async function recordPassportProgress(challenge, summary) {
    const client = passportBridge();
    const snapshot = passportSnapshot();
    if (snapshot.synthetic === true || snapshot.mode === "teacher-preview") {
      state.apiStatus = "sandbox";
      updatePassportStatusLabel();
      updateDebug();
      return;
    }
    if (!client || typeof client.recordProgress !== "function" || !snapshot.ready) {
      state.apiStatus = "not-connected";
      updatePassportStatusLabel();
      updateDebug();
      return;
    }

    state.apiStatus = "pending";
    updatePassportStatusLabel();
    updateDebug();

    try {
      await client.recordProgress({
        taskId: `area-perimeter-${challenge.id}`,
        taskTitle: `面積周界診斷室：${challenge.title.replace(/^任務[一二三四五]：/, "")}`,
        completed: true,
        score: 100,
        coins: 5,
        metadata: {
          toolId: "lwwf-math-area-perimeter-lab",
          topic: "area-perimeter",
          challengeId: challenge.id,
          strategy: challenge.strategy,
          dimensions: {
            length: state.length,
            width: state.width
          },
          selectedMeasure: state.selectedMeasure,
          area: area(),
          perimeter: perimeter(),
          targetArea: challenge.targetArea,
          targetPerimeter: challenge.targetPerimeter,
          completedCount: summary.completedCount,
          totalChallenges: summary.totalChallenges,
          attempts: summary.attempts,
          correct: summary.correct,
          accuracy: summary.accuracy,
          visualModel: "grid-border-tiles"
        }
      });
      state.apiStatus = "saved-passport";
      state.lastPassportSync = new Date().toISOString();
    } catch (error) {
      state.apiStatus = "failed";
      state.lastError = error instanceof Error ? error.message.slice(0, 120) : "Passport progress could not be saved.";
    }

    updatePassportStatusLabel();
    updateDebug();
  }

  function isCorrect(challenge = currentChallenge()) {
    if (state.selectedMeasure !== challenge.requiredMeasure) return false;
    if (challenge.mode === "area-not-start") {
      return area() === challenge.targetArea && !sameDimensions({ length: state.length, width: state.width }, challenge.start);
    }
    return sameDimensions({ length: state.length, width: state.width }, challenge.target)
      && area() === challenge.targetArea
      && (challenge.targetPerimeter === null || perimeter() === challenge.targetPerimeter);
  }

  function feedbackForRetry(challenge = currentChallenge()) {
    if (state.selectedMeasure !== challenge.requiredMeasure) {
      if (challenge.requiredMeasure === "perimeter") {
        return "題目要計算圍邊長度。請選「周界」，再用 2 × (長 + 闊)。";
      }
      return "題目要計算鋪滿的大小。請選「面積」，再用長 × 闊。";
    }
    if (challenge.mode === "area-not-start" && area() === challenge.targetArea) {
      return "面積正確，但要換另一個形狀，才能看見同一面積可以有不同周界。";
    }
    if (challenge.requiredMeasure === "perimeter") {
      return `目前周界是 ${perimeter()} cm。請檢查長和闊是否符合題目，再想像要圍住四條邊。`;
    }
    return `目前面積是 ${area()} cm²。請檢查是否真的把整個長方形鋪滿。`;
  }

  function setFeedback(message, tone) {
    const feedback = $("[data-testid='feedback']");
    feedback.textContent = message;
    feedback.classList.remove("success", "retry");
    if (tone) feedback.classList.add(tone);
    state.lastFeedback = message;
  }

  function checkAnswer() {
    const challenge = currentChallenge();
    const ok = isCorrect(challenge);
    state.attempts += 1;
    if (ok) {
      if (!state.completedIds.includes(challenge.id)) state.completedIds.push(challenge.id);
      state.correct += 1;
      saveProgress();
      void recordPassportProgress(challenge, progress());
      const measureText = state.selectedMeasure === "area" ? `面積 ${area()} cm²` : `周界 ${perimeter()} cm`;
      setFeedback(`完成。你先判斷量度，再用 ${state.length} × ${state.width} 的模型驗證：${measureText}。`, "success");
    } else {
      setFeedback(feedbackForRetry(challenge), "retry");
    }
    renderStatus();
    renderMissionList();
    updateDebug();
  }

  function applyChallengeStart(challenge) {
    const start = challenge.start || { length: 3, width: 3, measure: "area" };
    state.length = start.length;
    state.width = start.width;
    state.selectedMeasure = start.measure || "area";
  }

  function nextChallenge() {
    state.challengeIndex = (state.challengeIndex + 1) % challenges.length;
    const challenge = currentChallenge();
    applyChallengeStart(challenge);
    state.lastFeedback = challenge.prompt;
    render();
  }

  function resetTool() {
    state.length = 3;
    state.width = 3;
    state.selectedMeasure = "area";
    state.challengeIndex = 0;
    state.attempts = 0;
    state.correct = 0;
    state.completedIds = [];
    state.saveStatus = "reset-local";
    state.apiStatus = "not-connected";
    state.lastFeedback = "已重設。請重新分辨面積和周界。";
    state.lastError = "";
    try {
      toolStorage()?.removeItem(storageKey);
    } catch {}
    render();
  }

  function setDimension(key, value) {
    state[key] = Math.max(1, Math.min(10, Number(value) || 1));
    render();
  }

  function setMeasure(measure) {
    state.selectedMeasure = measure === "perimeter" ? "perimeter" : "area";
    render();
  }

  function targetText(challenge = currentChallenge()) {
    if (challenge.targetArea && challenge.targetPerimeter) {
      const required = challenge.requiredMeasure === "area"
        ? `面積 ${challenge.targetArea} cm²`
        : `周界 ${challenge.targetPerimeter} cm`;
      return required;
    }
    if (challenge.targetArea) return `面積 ${challenge.targetArea} cm²`;
    return `周界 ${challenge.targetPerimeter} cm`;
  }

  function renderGrid() {
    const board = $("[data-testid='grid-board']");
    board.style.setProperty("--cols", String(state.length));
    board.classList.toggle("measure-area", state.selectedMeasure === "area");
    board.classList.toggle("measure-perimeter", state.selectedMeasure === "perimeter");
    const cells = [];
    for (let row = 0; row < state.width; row += 1) {
      for (let col = 0; col < state.length; col += 1) {
        const edge = row === 0 || row === state.width - 1 || col === 0 || col === state.length - 1;
        cells.push(`<span class="cell ${edge ? "edge" : ""}" aria-hidden="true"></span>`);
      }
    }
    board.innerHTML = cells.join("");
  }

  function renderMissionList() {
    const list = $("[data-testid='mission-list']");
    list.innerHTML = challenges.map((challenge, index) => {
      const done = state.completedIds.includes(challenge.id);
      return `
        <div class="mission-item ${done ? "done" : ""}">
          <span>${done ? "✓" : index + 1}</span>
          <div>
            <strong>${challenge.title.replace(/^任務[一二三四五]：/, "")}</strong>
            <p>${challenge.requiredMeasure === "area" ? "面積判斷" : "周界判斷"} · ${challenge.strategy}</p>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderStatus() {
    const summary = progress();
    $("[data-testid='score-pill']").textContent = `完成 ${summary.completedCount}/${summary.totalChallenges}`;
    $("[data-testid='accuracy-pill']").textContent = `準確率 ${summary.accuracy}%`;
    updatePassportStatusLabel();
  }

  function renderMeasures() {
    $$("[data-measure]").forEach((button) => {
      button.classList.toggle("active", button.dataset.measure === state.selectedMeasure);
    });
    $("[data-testid='selected-measure-readout']").textContent = state.selectedMeasure === "area" ? "面積" : "周界";
  }

  function renderReadouts() {
    const challenge = currentChallenge();
    $("[data-testid='challenge-title']").textContent = challenge.title;
    $("[data-testid='challenge-prompt']").textContent = challenge.prompt;
    $("[data-testid='target-readout']").textContent = targetText(challenge);
    $("[data-testid='dimension-readout']").textContent = `${state.length} × ${state.width}`;
    $("[data-testid='area-readout']").textContent = `${area()} cm²`;
    $("[data-testid='perimeter-readout']").textContent = `${perimeter()} cm`;
    $("[data-testid='length-range']").value = String(state.length);
    $("[data-testid='width-range']").value = String(state.width);
    $("[data-testid='length-value']").textContent = `${state.length} cm`;
    $("[data-testid='width-value']").textContent = `${state.width} cm`;
  }

  function updateDebug() {
    const challenge = currentChallenge();
    const summary = progress();
    const debugState = {
      schemaVersion: "lwwf-tool-debug/v1",
      siteId: "lwwf-math-area-perimeter-lab",
      route: state.route,
      mode: state.mode,
      passportSiteId: state.passportSiteId,
      selectedActivityId: challenge.id,
      itemCount: challenges.length,
      dimensions: {
        length: state.length,
        width: state.width
      },
      selectedMeasure: state.selectedMeasure,
      requiredMeasure: challenge.requiredMeasure,
      area: area(),
      perimeter: perimeter(),
      targetArea: challenge.targetArea,
      targetPerimeter: challenge.targetPerimeter,
      completedCount: summary.completedCount,
      score: summary.correct,
      attempts: summary.attempts,
      accuracy: summary.accuracy,
      loadedAssets: {
        crest: "../assets/common/images/LWWFPNG.png",
        background: "../assets/common/images/school_bg.jpg",
        cssGridModel: true
      },
      saveStatus: state.saveStatus,
      exportStatus: "not-required",
      apiStatus: state.apiStatus,
      lastPassportSync: state.lastPassportSync,
      lastFeedback: state.lastFeedback,
      lastError: state.lastError,
      privacy: {
        containsToken: false,
        containsPassword: false,
        containsProviderPayload: false,
        studentIdentityRedacted: true
      }
    };
    window.__TOOL_DEBUG__ = debugState;
    document.documentElement.dataset.toolDebug = JSON.stringify({
      siteId: debugState.siteId,
      route: debugState.route,
      mode: debugState.mode,
      passportSiteId: debugState.passportSiteId,
      selectedActivityId: debugState.selectedActivityId,
      dimensions: debugState.dimensions,
      selectedMeasure: debugState.selectedMeasure,
      requiredMeasure: debugState.requiredMeasure,
      area: debugState.area,
      perimeter: debugState.perimeter,
      targetArea: debugState.targetArea,
      targetPerimeter: debugState.targetPerimeter,
      completedCount: debugState.completedCount,
      score: debugState.score,
      attempts: debugState.attempts,
      accuracy: debugState.accuracy,
      saveStatus: debugState.saveStatus,
      apiStatus: debugState.apiStatus,
      lastPassportSync: debugState.lastPassportSync,
      lastError: debugState.lastError
    });
  }

  function render() {
    renderReadouts();
    renderMeasures();
    renderGrid();
    renderMissionList();
    renderStatus();
    setFeedback(state.lastFeedback, "");
    updateDebug();
  }

  function bindEvents() {
    $("[data-testid='length-range']").addEventListener("input", (event) => setDimension("length", event.target.value));
    $("[data-testid='width-range']").addEventListener("input", (event) => setDimension("width", event.target.value));
    $$("[data-measure]").forEach((button) => {
      button.addEventListener("click", () => setMeasure(button.dataset.measure));
    });
    $("[data-testid='check-answer']").addEventListener("click", checkAnswer);
    $("[data-testid='next-challenge']").addEventListener("click", nextChallenge);
    $("[data-testid='reset-tool']").addEventListener("click", resetTool);
    window.addEventListener("lwwf-passport-updated", () => {
      updatePassportStatusLabel();
      updateDebug();
    });
    window.addEventListener("lwwf-math-passport-ready", () => {
      loadProgress();
      render();
    });
  }

  function boot() {
    loadProgress();
    bindEvents();
    render();
  }

  boot();
})();
