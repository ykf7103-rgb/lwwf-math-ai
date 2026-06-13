(function () {
  const challenges = [
    {
      id: "unit-cube",
      title: "任務一：一個 1 cm³ 方塊",
      prompt: "把長、闊、高都調成 1 cm，理解 1 cm³ 是一個小正方體所佔的空間。",
      mode: "exact",
      start: { length: 3, width: 2, height: 2, removed: 0 },
      target: { length: 1, width: 1, height: 1, removed: 0 },
      targetVolume: 1,
      strategy: "unit-cube"
    },
    {
      id: "rectangular-prism",
      title: "任務二：建立長方體",
      prompt: "建立 4 × 3 × 2 的長方體。先數一層，再乘以層數。",
      mode: "exact",
      start: { length: 3, width: 2, height: 1, removed: 0 },
      target: { length: 4, width: 3, height: 2, removed: 0 },
      targetVolume: 24,
      strategy: "base-area-times-height"
    },
    {
      id: "same-volume",
      title: "任務三：不同形狀，同一體積",
      prompt: "建立任何一個體積等於 12 cm³ 的立體，觀察形狀不同也可以體積相同。",
      mode: "volume",
      start: { length: 2, width: 2, height: 2, removed: 0 },
      targetVolume: 12,
      strategy: "conservation-of-volume"
    },
    {
      id: "missing-blocks",
      title: "任務四：補回缺口",
      prompt: "建立 4 × 3 × 2，再移走 4 個方塊。用完整長方體減去缺口。",
      mode: "exact",
      start: { length: 4, width: 3, height: 2, removed: 0 },
      target: { length: 4, width: 3, height: 2, removed: 4 },
      targetVolume: 20,
      strategy: "missing-block-subtraction"
    },
    {
      id: "one-litre",
      title: "任務五：1000 cm³ 的量感",
      prompt: "建立 10 × 10 × 10，理解 1000 cm³ 等於 1 L。",
      mode: "exact",
      start: { length: 5, width: 5, height: 4, removed: 0 },
      target: { length: 10, width: 10, height: 10, removed: 0 },
      targetVolume: 1000,
      strategy: "unit-conversion"
    }
  ];

  const storageKey = "lwwf_math_volume_architect_v1";
  const state = {
    route: "volume-builder",
    mode: "challenge",
    viewMode: "solid",
    length: 3,
    width: 2,
    height: 2,
    removed: 0,
    challengeIndex: 0,
    attempts: 0,
    correct: 0,
    completedIds: [],
    saveStatus: "idle",
    apiStatus: "not-connected",
    passportSiteId: "lwwf-math-ai",
    lastPassportSync: "",
    lastFeedback: "先調整方塊模型，再檢查是否完成任務。",
    lastError: "",
    canvasNonBlank: false
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function currentChallenge() {
    return challenges[state.challengeIndex % challenges.length];
  }

  function totalBlocks() {
    return state.length * state.width * state.height;
  }

  function currentVolume() {
    return Math.max(0, totalBlocks() - state.removed);
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
    const client = window.LWWFPassport;
    if (!client || typeof client.getState !== "function") return { ready: false };
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
    if (state.apiStatus === "pending") {
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
      localStorage.setItem(storageKey, JSON.stringify({
        completedIds: state.completedIds,
        correct: state.correct,
        attempts: state.attempts,
        updatedAt: new Date().toISOString()
      }));
      state.saveStatus = "saved-local";
    } catch (error) {
      state.saveStatus = "failed";
      state.lastError = error instanceof Error ? error.message : "Local progress could not be saved.";
    }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(storageKey);
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
    const client = window.LWWFPassport;
    const snapshot = passportSnapshot();
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
        taskId: `volume-architect-${challenge.id}`,
        taskTitle: `體積建築師：${challenge.title.replace(/^任務[一二三四五]：/, "")}`,
        completed: true,
        score: 100,
        coins: 6,
        metadata: {
          toolId: "lwwf-math-volume-architect",
          topic: "volume",
          challengeId: challenge.id,
          strategy: challenge.strategy,
          dimensions: {
            length: state.length,
            width: state.width,
            height: state.height
          },
          baseArea: state.length * state.width,
          removedBlocks: state.removed,
          volume: currentVolume(),
          unit: "cm3",
          completedCount: summary.completedCount,
          totalChallenges: summary.totalChallenges,
          attempts: summary.attempts,
          correct: summary.correct,
          accuracy: summary.accuracy,
          visualModel: "isometric-blocks"
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
    if (challenge.mode === "volume") return currentVolume() === challenge.targetVolume;
    const target = challenge.target || {};
    return state.length === target.length
      && state.width === target.width
      && state.height === target.height
      && state.removed === target.removed
      && currentVolume() === challenge.targetVolume;
  }

  function setFeedback(message, tone) {
    const feedback = $("[data-testid='feedback']");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove("success", "retry");
    if (tone) feedback.classList.add(tone);
    state.lastFeedback = message;
  }

  function feedbackForRetry(challenge) {
    if (challenge.id === "unit-cube") return "仍未完成。1 cm³ 必須是長 1 cm、闊 1 cm、高 1 cm 的一個小方塊。";
    if (challenge.id === "rectangular-prism") return "仍未完成。先令底層有 4 × 3 = 12 個方塊，再有 2 層。";
    if (challenge.id === "same-volume") return `現在體積是 ${currentVolume()} cm³。請調整長、闊、高，令總體積等於 12 cm³。`;
    if (challenge.id === "missing-blocks") return `現在體積是 ${currentVolume()} cm³。完整 4 × 3 × 2 = 24，移走 4 個後才是 20 cm³。`;
    return "仍未完成。10 × 10 × 10 = 1000 cm³，這就是 1 L 的體積量感。";
  }

  function checkAnswer() {
    const challenge = currentChallenge();
    const ok = isCorrect(challenge);
    state.attempts += 1;
    if (ok) {
      if (!state.completedIds.includes(challenge.id)) state.completedIds.push(challenge.id);
      state.correct += 1;
      saveProgress();
      setFeedback(`完成。${state.length} × ${state.width} × ${state.height} − ${state.removed} = ${currentVolume()} cm³。`, "success");
      void recordPassportProgress(challenge, progress());
    } else {
      setFeedback(feedbackForRetry(challenge), "retry");
    }
    renderStatus();
    renderMissions();
    updateDebug();
  }

  function applyChallengeStart(challenge) {
    const start = challenge.start || { length: 3, width: 2, height: 2, removed: 0 };
    state.length = start.length;
    state.width = start.width;
    state.height = start.height;
    state.removed = Math.min(start.removed, Math.max(0, start.length * start.width * start.height - 1));
  }

  function nextChallenge() {
    state.challengeIndex = (state.challengeIndex + 1) % challenges.length;
    const challenge = currentChallenge();
    applyChallengeStart(challenge);
    state.viewMode = challenge.id === "missing-blocks" ? "missing" : "solid";
    state.lastFeedback = challenge.prompt;
    render();
  }

  function resetTool() {
    state.length = 3;
    state.width = 2;
    state.height = 2;
    state.removed = 0;
    state.challengeIndex = 0;
    state.attempts = 0;
    state.correct = 0;
    state.completedIds = [];
    state.viewMode = "solid";
    state.lastFeedback = "已重設。請重新建立體積模型。";
    state.saveStatus = "reset-local";
    state.apiStatus = "not-connected";
    state.lastError = "";
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    render();
  }

  function setRangeValues() {
    const total = totalBlocks();
    const removedRange = $("[data-testid='removed-range']");
    removedRange.max = String(Math.max(0, total - 1));
    state.removed = Math.max(0, Math.min(state.removed, Number(removedRange.max)));

    $("[data-testid='length-range']").value = String(state.length);
    $("[data-testid='width-range']").value = String(state.width);
    $("[data-testid='height-range']").value = String(state.height);
    removedRange.value = String(state.removed);

    $("[data-testid='length-value']").textContent = `${state.length} cm`;
    $("[data-testid='width-value']").textContent = `${state.width} cm`;
    $("[data-testid='height-value']").textContent = `${state.height} cm`;
    $("[data-testid='removed-value']").textContent = `${state.removed} 個`;
  }

  function renderChallenge() {
    const challenge = currentChallenge();
    $("[data-testid='challenge-title']").textContent = challenge.title;
    $("[data-testid='challenge-prompt']").textContent = challenge.prompt;
    $("[data-testid='target-volume']").textContent = `${challenge.targetVolume.toLocaleString()} cm³`;
  }

  function renderCalculations() {
    const baseArea = state.length * state.width;
    const volume = currentVolume();
    $("[data-testid='base-area']").textContent = `${state.length} × ${state.width} = ${baseArea}`;
    $("[data-testid='height-readout']").textContent = `${state.height} 層`;
    $("[data-testid='removed-readout']").textContent = `${state.removed}`;
    $("[data-testid='volume-readout']").textContent = `${volume.toLocaleString()} cm³`;
  }

  function renderMissions() {
    const list = $("[data-testid='mission-list']");
    list.innerHTML = challenges.map((challenge, index) => {
      const done = state.completedIds.includes(challenge.id);
      const current = index === state.challengeIndex;
      return `
        <div class="mission-item ${done ? "done" : ""} ${current ? "current" : ""}">
          <span class="mission-index">${done ? "✓" : index + 1}</span>
          <div>
            <strong>${challenge.title.replace(/^任務[一二三四五]：/, "")}</strong>
            <span>${challenge.prompt}</span>
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

  function renderViewButtons() {
    $$(".mode-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === state.viewMode);
    });
  }

  function getVisibleBlocks() {
    const blocks = [];
    let removedLeft = state.removed;
    for (let z = 0; z < state.height; z += 1) {
      for (let y = state.width - 1; y >= 0; y -= 1) {
        for (let x = state.length - 1; x >= 0; x -= 1) {
          const removeThis = removedLeft > 0;
          if (removeThis) {
            removedLeft -= 1;
            continue;
          }
          blocks.push({ x, y, z });
        }
      }
    }
    return blocks.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
  }

  function drawFace(ctx, points, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawBlock(ctx, originX, originY, block, size, colors) {
    const tw = size;
    const th = size * 0.5;
    const ch = size * 0.58;
    const x = originX + (block.x - block.y) * (tw / 2);
    const y = originY + (block.x + block.y) * (th / 2) - block.z * ch;
    const top = [[x, y - ch], [x + tw / 2, y - ch + th / 2], [x, y - ch + th], [x - tw / 2, y - ch + th / 2]];
    const left = [[x - tw / 2, y - ch + th / 2], [x, y - ch + th], [x, y + th], [x - tw / 2, y + th / 2]];
    const right = [[x + tw / 2, y - ch + th / 2], [x, y - ch + th], [x, y + th], [x + tw / 2, y + th / 2]];
    drawFace(ctx, left, colors.left, colors.stroke);
    drawFace(ctx, right, colors.right, colors.stroke);
    drawFace(ctx, top, colors.top, colors.stroke);
  }

  function drawCanvas() {
    const canvas = $("[data-testid='volume-canvas']");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f4fbf8";
    ctx.fillRect(0, 0, width, height);

    const maxSpan = Math.max(state.length + state.width, state.height * 1.4, 4);
    const size = Math.max(16, Math.min(44, Math.floor((width * 0.82) / maxSpan)));
    const originX = width / 2;
    const originY = height * 0.62 + (state.height * size * 0.18);
    const colors = {
      top: state.viewMode === "layers" ? "#ffd36f" : "#69c4bd",
      left: state.viewMode === "missing" ? "#7c6ec5" : "#2d7f77",
      right: state.viewMode === "layers" ? "#2f76b7" : "#1e5f95",
      stroke: "rgba(19, 35, 31, .34)"
    };

    ctx.save();
    ctx.fillStyle = "rgba(37, 102, 168, .08)";
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.82, Math.min(360, width * 0.34), 44, 0, 0, Math.PI * 2);
    ctx.fill();
    getVisibleBlocks().forEach((block) => drawBlock(ctx, originX, originY, block, size, colors));
    if (state.removed > 0 && state.viewMode === "missing") {
      ctx.fillStyle = "rgba(201, 95, 72, .9)";
      ctx.font = "900 22px Microsoft JhengHei, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`已移走 ${state.removed} 個`, width / 2, 42);
    }
    ctx.restore();

    state.canvasNonBlank = canvasHasInk(canvas);
  }

  function canvasHasInk(canvas) {
    try {
      const ctx = canvas.getContext("2d");
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 0; index < pixels.length; index += 64) {
        if (pixels[index] < 230 || pixels[index + 1] < 230 || pixels[index + 2] < 230) return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function updateDebug() {
    const challenge = currentChallenge();
    const summary = progress();
    const debugState = {
      schemaVersion: "lwwf-tool-debug/v1",
      siteId: "lwwf-math-volume-architect",
      route: state.route,
      mode: state.mode,
      viewMode: state.viewMode,
      passportSiteId: state.passportSiteId,
      selectedActivityId: challenge.id,
      itemCount: challenges.length,
      dimensions: {
        length: state.length,
        width: state.width,
        height: state.height
      },
      removedBlocks: state.removed,
      baseArea: state.length * state.width,
      volume: currentVolume(),
      targetVolume: challenge.targetVolume,
      completedCount: summary.completedCount,
      score: summary.correct,
      attempts: summary.attempts,
      accuracy: summary.accuracy,
      loadedAssets: {
        crest: "../assets/common/images/LWWFPNG.png",
        background: "../assets/common/images/school_bg.jpg",
        isometricCanvas: state.canvasNonBlank
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
      viewMode: debugState.viewMode,
      passportSiteId: debugState.passportSiteId,
      selectedActivityId: debugState.selectedActivityId,
      dimensions: debugState.dimensions,
      removedBlocks: debugState.removedBlocks,
      baseArea: debugState.baseArea,
      volume: debugState.volume,
      targetVolume: debugState.targetVolume,
      completedCount: debugState.completedCount,
      score: debugState.score,
      attempts: debugState.attempts,
      accuracy: debugState.accuracy,
      canvasNonBlank: debugState.loadedAssets.isometricCanvas,
      saveStatus: debugState.saveStatus,
      apiStatus: debugState.apiStatus,
      lastPassportSync: debugState.lastPassportSync,
      lastError: debugState.lastError
    });
  }

  function render() {
    setRangeValues();
    renderChallenge();
    renderCalculations();
    renderStatus();
    renderMissions();
    renderViewButtons();
    setFeedback(state.lastFeedback, "");
    drawCanvas();
    updateDebug();
  }

  function bindEvents() {
    const rangeMap = {
      "length-range": "length",
      "width-range": "width",
      "height-range": "height",
      "removed-range": "removed"
    };
    Object.entries(rangeMap).forEach(([testId, key]) => {
      $(`[data-testid='${testId}']`).addEventListener("input", (event) => {
        state[key] = Number(event.target.value);
        state.saveStatus = "dirty";
        render();
      });
    });

    $$(".mode-btn").forEach((button) => {
      button.addEventListener("click", () => {
        state.viewMode = button.dataset.view || "solid";
        render();
      });
    });

    $("[data-testid='check-answer']").addEventListener("click", checkAnswer);
    $("[data-testid='next-challenge']").addEventListener("click", nextChallenge);
    $("[data-testid='reset-tool']").addEventListener("click", resetTool);
    window.addEventListener("lwwf-passport-updated", () => {
      updatePassportStatusLabel();
      updateDebug();
    });
    window.addEventListener("resize", () => {
      drawCanvas();
      updateDebug();
    });
  }

  function boot() {
    loadProgress();
    bindEvents();
    render();
  }

  boot();
})();
