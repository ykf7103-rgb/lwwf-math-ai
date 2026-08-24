(function () {
  const challenges = [
    { id: "same-denominator", targetNumerator: 3, targetDenominator: 4, prompt: "切出 3/4，先感受同分母份數。" },
    { id: "equivalent-half", targetNumerator: 1, targetDenominator: 2, prompt: "用不同分母切出 1/2，找出等值分數。" },
    { id: "three-sixths", targetNumerator: 3, targetDenominator: 6, prompt: "觀察 3/6 和 1/2 是否一樣大。" },
    { id: "compare-eighths", targetNumerator: 5, targetDenominator: 8, prompt: "切出 5/8，解釋為何超過一半。" }
  ];

  const denominatorOptions = [2, 3, 4, 5, 6, 8, 10, 12];
  const storageKey = "lwwf_math_fraction_kitchen_v1";
  const state = {
    route: "fraction-kitchen",
    mode: "challenge",
    numerator: 1,
    denominator: 4,
    challengeIndex: 0,
    attempts: 0,
    correct: 0,
    completedIds: [],
    lastFeedback: "選擇分母和分子，然後檢查是否等於目標分數。",
    saveStatus: "idle",
    apiStatus: "not-connected",
    passportSiteId: "lwwf-math-ai",
    lastPassportSync: "",
    lastError: ""
  };

  const $ = (selector) => document.querySelector(selector);

  function passportBridge() {
    return window.LWWFMathPassportBridge || null;
  }

  function toolStorage() {
    return passportBridge()?.storage;
  }
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const temp = y;
      y = x % y;
      x = temp;
    }
    return x || 1;
  }

  function equivalent(aNum, aDen, bNum, bDen) {
    return aNum * bDen === bNum * aDen;
  }

  function simplify(num, den) {
    const factor = gcd(num, den);
    return `${num / factor}/${den / factor}`;
  }

  function currentChallenge() {
    return challenges[state.challengeIndex % challenges.length];
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

  function saveProgress() {
    try {
      const payload = {
        completedIds: state.completedIds,
        correct: state.correct,
        attempts: state.attempts,
        updatedAt: new Date().toISOString()
      };
      toolStorage()?.setItem(storageKey, JSON.stringify(payload));
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
      state.completedIds = Array.isArray(payload.completedIds) ? payload.completedIds.filter((id) => challenges.some((item) => item.id === id)) : [];
      state.correct = Number(payload.correct || 0);
      state.attempts = Number(payload.attempts || 0);
      state.saveStatus = "loaded-local";
    } catch {
      state.saveStatus = "fresh";
    }
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
        taskId: `fraction-kitchen-${challenge.id}`,
        taskTitle: `分數料理台：${challenge.targetNumerator}/${challenge.targetDenominator}`,
        completed: true,
        score: 100,
        coins: 5,
        metadata: {
          toolId: "lwwf-math-fraction-kitchen",
          topic: "fractions",
          challengeId: challenge.id,
          targetFraction: `${challenge.targetNumerator}/${challenge.targetDenominator}`,
          studentFraction: `${state.numerator}/${state.denominator}`,
          simplifiedFraction: simplify(state.numerator, state.denominator),
          completedCount: summary.completedCount,
          totalChallenges: summary.totalChallenges,
          attempts: summary.attempts,
          correct: summary.correct,
          accuracy: summary.accuracy,
          strategy: "equivalent-fraction",
          visualModel: "circle-plate"
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

  function setNumerator(value) {
    state.numerator = Math.max(0, Math.min(Number(value) || 0, state.denominator));
    render();
  }

  function setDenominator(value) {
    state.denominator = Number(value) || 4;
    if (state.numerator > state.denominator) state.numerator = state.denominator;
    if (state.numerator === 0) state.numerator = 1;
    render();
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
    const ok = equivalent(state.numerator, state.denominator, challenge.targetNumerator, challenge.targetDenominator);
    state.attempts += 1;
    if (ok) {
      if (!state.completedIds.includes(challenge.id)) state.completedIds.push(challenge.id);
      state.correct += 1;
      saveProgress();
      void recordPassportProgress(challenge, progress());
      setFeedback(`完成。${state.numerator}/${state.denominator} 和 ${challenge.targetNumerator}/${challenge.targetDenominator} 一樣大，最簡分數是 ${simplify(state.numerator, state.denominator)}。`, "success");
    } else {
      const left = state.numerator * challenge.targetDenominator;
      const right = challenge.targetNumerator * state.denominator;
      setFeedback(`仍未相等。可以比較交叉乘積：${state.numerator} × ${challenge.targetDenominator} = ${left}，${challenge.targetNumerator} × ${state.denominator} = ${right}。`, "retry");
    }
    renderStatus();
    updateDebug();
  }

  function nextChallenge() {
    state.challengeIndex = (state.challengeIndex + 1) % challenges.length;
    const challenge = currentChallenge();
    state.denominator = challenge.targetDenominator;
    state.numerator = Math.max(1, Math.min(challenge.targetNumerator - 1, state.denominator));
    state.lastFeedback = challenge.prompt;
    render();
  }

  function resetTool() {
    state.numerator = 1;
    state.denominator = 4;
    state.challengeIndex = 0;
    state.attempts = 0;
    state.correct = 0;
    state.completedIds = [];
    state.lastFeedback = "已重設。請重新切出目標分數。";
    state.saveStatus = "reset-local";
    try {
      toolStorage()?.removeItem(storageKey);
    } catch {}
    render();
  }

  function renderDenominators() {
    const row = $("[data-testid='denominator-row']");
    row.innerHTML = denominatorOptions.map((den) => (
      `<button class="den-btn ${den === state.denominator ? "active" : ""}" type="button" data-den="${den}" data-testid="den-${den}">${den} 份</button>`
    )).join("");
    row.querySelectorAll("[data-den]").forEach((button) => {
      button.addEventListener("click", () => setDenominator(button.dataset.den));
    });
  }

  function renderSlices() {
    const grid = $("[data-testid='slice-grid']");
    grid.innerHTML = Array.from({ length: state.denominator }, (_, index) => {
      const slice = index + 1;
      return `<button class="slice-btn ${slice <= state.numerator ? "active" : ""}" type="button" data-slice="${slice}">${slice}</button>`;
    }).join("");
    grid.querySelectorAll("[data-slice]").forEach((button) => {
      button.addEventListener("click", () => setNumerator(button.dataset.slice));
    });
  }

  function renderMissions() {
    const list = $("[data-testid='mission-list']");
    list.innerHTML = challenges.map((challenge, index) => {
      const done = state.completedIds.includes(challenge.id);
      return `
        <div class="mission-item ${done ? "done" : ""}">
          <span class="mission-index">${done ? "✓" : index + 1}</span>
          <div>
            <strong>${challenge.targetNumerator}/${challenge.targetDenominator}</strong>
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

  function renderPlates() {
    const challenge = currentChallenge();
    const fillAngle = state.denominator ? (state.numerator / state.denominator) * 360 : 0;
    const targetAngle = (challenge.targetNumerator / challenge.targetDenominator) * 360;
    $("[data-testid='student-plate']").style.setProperty("--fill-angle", `${fillAngle}deg`);
    $("[data-testid='target-plate']").style.setProperty("--target-angle", `${targetAngle}deg`);
    $("[data-testid='student-fraction']").innerHTML = `${state.numerator}/${state.denominator} <small>你的分數</small>`;
    $("[data-testid='target-fraction']").innerHTML = `${challenge.targetNumerator}/${challenge.targetDenominator} <small>目標</small>`;
    $("[data-testid='target-value']").textContent = `${challenge.targetNumerator}/${challenge.targetDenominator}`;
    $("[data-testid='numerator-readout']").textContent = `${state.numerator} 份`;
  }

  function updateDebug() {
    const challenge = currentChallenge();
    const summary = progress();
    const debugState = {
      schemaVersion: "lwwf-tool-debug/v1",
      siteId: "lwwf-math-fraction-kitchen",
      route: state.route,
      mode: state.mode,
      passportSiteId: state.passportSiteId,
      numerator: state.numerator,
      denominator: state.denominator,
      selectedActivityId: challenge.id,
      targetFraction: `${challenge.targetNumerator}/${challenge.targetDenominator}`,
      itemCount: challenges.length,
      completedCount: summary.completedCount,
      score: summary.correct,
      attempts: summary.attempts,
      accuracy: summary.accuracy,
      loadedAssets: {
        crest: "../assets/common/images/LWWFPNG.png",
        background: "../assets/common/images/school_bg.jpg",
        cssFractionPlate: true
      },
      saveStatus: state.saveStatus,
      exportStatus: "not-required",
      apiStatus: state.apiStatus,
      lastPassportSync: state.lastPassportSync,
      lastFeedback: state.lastFeedback,
      lastError: state.lastError
    };
    window.__TOOL_DEBUG__ = debugState;
    document.documentElement.dataset.toolDebug = JSON.stringify({
      siteId: debugState.siteId,
      route: debugState.route,
      mode: debugState.mode,
      passportSiteId: debugState.passportSiteId,
      selectedActivityId: debugState.selectedActivityId,
      numerator: debugState.numerator,
      denominator: debugState.denominator,
      targetFraction: debugState.targetFraction,
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
    renderDenominators();
    renderSlices();
    renderMissions();
    renderStatus();
    renderPlates();
    setFeedback(state.lastFeedback, "");
    updateDebug();
  }

  function boot() {
    loadProgress();
    $("[data-testid='num-down']").addEventListener("click", () => setNumerator(state.numerator - 1));
    $("[data-testid='num-up']").addEventListener("click", () => setNumerator(state.numerator + 1));
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
    render();
  }

  boot();
})();
