(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const distanceText = document.getElementById("distanceText");
  const timeText = document.getElementById("timeText");
  const bestText = document.getElementById("bestText");
  const overlay = document.getElementById("overlay");
  const resultKicker = document.getElementById("resultKicker");
  const resultTitle = document.getElementById("resultTitle");
  const resultMeta = document.getElementById("resultMeta");
  const startButton = document.getElementById("startButton");
  const leftButton = document.getElementById("leftButton");
  const jumpButton = document.getElementById("jumpButton");
  const rightButton = document.getElementById("rightButton");
  const submitArea = document.getElementById("submitArea");
  const nickInput = document.getElementById("nickInput");
  const contactInput = document.getElementById("contactInput");
  const submitScoreButton = document.getElementById("submitScoreButton");
  const submitStatus = document.getElementById("submitStatus");
  const leaderboardArea = document.getElementById("leaderboardArea");
  const leaderboardList = document.getElementById("leaderboardList");
  const myRankText = document.getElementById("myRankText");

  const W = canvas.width;
  const H = canvas.height;
  const horizonY = 190;
  const playerBaseY = 470;
  const goalDistance = 1650;
  const gameSeconds = 45;
  const ridgeCenterY = horizonY + 42;
  const ridgeSideY = horizonY + 78;
  const roadTopCenterY = horizonY + 56;
  const roadTopSideY = horizonY + 70;
  const homeRevealDistance = goalDistance * 0.62;
  const homeRevealEndDistance = goalDistance * 0.94;
  const homeObstacleStopDistance = goalDistance * 0.58;
  const itemStopDistance = goalDistance * 0.82;
  const finishLineVisibleDistance = 320;
  const celebrationWalkSeconds = 2.4;
  const celebrationTurnSeconds = 0.42;
  const celebrationWaveSeconds = 1.55;
  const sandwichInvincibleSeconds = 5;
  const goldenObstaclePauseSeconds = 3;
  const minCollisionSpeed = 118;
  const runFrameSeconds = 0.077;
  const puddleSplashFrameSeconds = 0.07;
  const puddleSplashFrameCount = 4;
  const goldenClearSeconds = 0.95;
  const goldenClearParticleCount = 124;
  const collisionPenalty = {
    puddle: { speed: 62, distance: 26 },
    cat: { speed: 86, distance: 42 },
  };

  const images = {
    kokkoRun: [
      loadImage("assets/kokko-run-1.png"),
      loadImage("assets/kokko-run-2.png"),
      loadImage("assets/kokko-run-3.png"),
      loadImage("assets/kokko-run-4.png"),
      loadImage("assets/kokko-run-5.png"),
      loadImage("assets/kokko-run-6.png"),
    ],
    kokkoWalkAway: loadImage("assets/kokko-walk-away-sheet.png"),
    kokkoFront: loadImage("assets/kokko-front-wave.png"),
    yellowCat: loadImage("assets/cat-yellow.png"),
    yellowCatHappy: loadImage("assets/cat-yellow-happy.png"),
    blackCat: loadImage("assets/cat-black.png"),
    blackCatBlock: loadImage("assets/cat-black-block.png"),
    home: loadImage("assets/home-cottage_origin.png"),
    sandwich: loadImage("assets/sandwitch-croissant.png"),
    goldenCroissant: loadImage("assets/golden-croissant.png"),
    puddleSplash: loadImage("assets/kokko-puddle-splash-sheet.png"),
    croissantFlowers: [
      loadImage("assets/croissant-flower-01.png"),
      loadImage("assets/croissant-flower-02.png"),
      loadImage("assets/croissant-flower-03.png"),
      loadImage("assets/croissant-flower-04.png"),
    ],
  };

  const homeSprite = {
    sx: 75,
    sy: 287,
    sw: 2392,
    sh: 1876,
  };

  const state = {
    mode: "ready",
    lastTime: 0,
    elapsed: 0,
    distance: 0,
    speed: 178,
    spawnTimer: 0.8,
    itemSpawnTimer: 2.8,
    invincibleTimer: 0,
    obstaclePauseTimer: 0,
    shake: 0,
    message: "",
    messageTimer: 0,
    finishSuccess: false,
    lane: 0,
    targetLane: 0,
    laneX: 0,
    jumpT: 0,
    jumpV: 0,
    playerPulse: 0,
    runFrame: 0,
    runFrameTimer: 0,
    celebrationTimer: 0,
    obstacles: [],
    items: [],
    flowers: [],
    clouds: [],
    dust: [],
    splashes: [],
    goldenClears: [],
  };

  let best = Number(localStorage.getItem("kokko-forward-best") || 0);
  bestText.textContent = `${Math.round(best)}m`;

  // 리더보드 연동 상태
  let lastResult = null; // 직전 플레이 결과 {finished, elapsedMs, distance}
  let lbUnsub = null; // Firestore 구독 해제 함수
  let mySubmittedNick = ""; // 내가 등록한 닉네임 (순위표에서 강조용)
  nickInput.value = localStorage.getItem("kokko-nick") || "";
  contactInput.value = localStorage.getItem("kokko-contact") || "";

  // 배경음악 — 게임 시작 시 재생, 반복
  const bgm = new Audio("assets/sound/bgm.mp3");
  bgm.loop = true;
  bgm.volume = 0.5;
  bgm.preload = "auto";

  function playBgm() {
    // startGame 은 클릭/터치/키 입력에서 호출되므로 브라우저 자동재생 정책을 통과한다.
    // (autostart 처럼 사용자 제스처가 아닌 경로에서는 조용히 무시)
    bgm.play().catch(() => {});
  }

  // 음소거 토글 (상태는 localStorage 에 저장)
  const muteButton = document.getElementById("muteButton");
  bgm.muted = localStorage.getItem("kokko-muted") === "1";
  updateMuteButton();

  muteButton.addEventListener("click", () => {
    bgm.muted = !bgm.muted;
    localStorage.setItem("kokko-muted", bgm.muted ? "1" : "0");
    updateMuteButton();
  });

  function updateMuteButton() {
    muteButton.textContent = bgm.muted ? "🔇" : "🔊";
    muteButton.classList.toggle("is-muted", bgm.muted);
    muteButton.setAttribute("aria-pressed", String(bgm.muted));
    muteButton.setAttribute("aria-label", bgm.muted ? "음소거 해제" : "음소거");
  }

  seedScenery();
  resizeCanvasForDisplay();
  draw(0);

  const params = new URLSearchParams(window.location.search);
  if (params.has("autostart")) {
    window.setTimeout(() => {
      startGame();
      if (params.has("showcase")) {
        seedShowcaseObstacles();
      }
    }, 250);
  }

  window.addEventListener("resize", resizeCanvasForDisplay);
  startButton.addEventListener("click", startGame);
  submitScoreButton.addEventListener("click", submitCurrentScore);
  leftButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    moveLane(-1);
  });
  rightButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    moveLane(1);
  });
  jumpButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state.mode === "running") {
      jump();
    } else {
      startGame();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state.mode !== "running") {
      startGame();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x < rect.width * 0.34) {
      moveLane(-1);
    } else if (x > rect.width * 0.66) {
      moveLane(1);
    } else {
      jump();
    }
  });

  window.addEventListener("keydown", (event) => {
    const code = event.code;
    if (code === "ArrowLeft" || code === "KeyA") {
      event.preventDefault();
      moveLane(-1);
    } else if (code === "ArrowRight" || code === "KeyD") {
      event.preventDefault();
      moveLane(1);
    } else if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
      event.preventDefault();
      if (state.mode === "running") {
        jump();
      } else {
        startGame();
      }
    }
  });

  requestAnimationFrame(loop);

  function loadImage(src) {
    const image = new Image();
    image.src = src;
    return image;
  }

  function resizeCanvasForDisplay() {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const targetRatio = W / H;
    const wrapRatio = rect.width / rect.height;

    if (wrapRatio > targetRatio) {
      canvas.style.width = `${Math.floor(rect.height * targetRatio)}px`;
      canvas.style.height = "100%";
      canvas.style.marginInline = "auto";
      canvas.style.marginBlock = "0";
    } else {
      canvas.style.width = "100%";
      canvas.style.height = `${Math.floor(rect.width / targetRatio)}px`;
      canvas.style.marginBlock = "auto";
      canvas.style.marginInline = "0";
    }
  }

  function startGame() {
    state.mode = "running";
    state.lastTime = performance.now();
    state.elapsed = 0;
    state.distance = 0;
    state.speed = 178;
    state.spawnTimer = 0.65;
    state.itemSpawnTimer = 2.8;
    state.invincibleTimer = 0;
    state.obstaclePauseTimer = 0;
    state.shake = 0;
    state.message = "";
    state.messageTimer = 0;
    state.finishSuccess = false;
    state.lane = 0;
    state.targetLane = 0;
    state.laneX = 0;
    state.jumpT = 0;
    state.jumpV = 0;
    state.playerPulse = 0;
    state.runFrame = 0;
    state.runFrameTimer = 0;
    state.celebrationTimer = 0;
    state.obstacles = [];
    state.items = [];
    state.dust = [];
    state.splashes = [];
    state.goldenClears = [];
    overlay.classList.add("is-hidden");
    hideLeaderboardUI();
    playBgm();
    requestAnimationFrame(loop);
  }

  function loop(time) {
    const dt = Math.min(0.033, Math.max(0, (time - state.lastTime) / 1000 || 0));
    state.lastTime = time;

    if (state.mode === "running") {
      update(dt);
    } else if (state.mode === "celebrating") {
      updateCelebration(dt);
    }

    draw(dt);
    if (state.mode === "running" || state.mode === "celebrating") {
      requestAnimationFrame(loop);
    }
  }

  function moveLane(dir) {
    if (state.mode !== "running") {
      startGame();
      return;
    }
    state.targetLane = clamp(state.targetLane + dir, -1, 1);
  }

  function jump() {
    if (state.jumpT <= 0.02) {
      state.jumpV = 1.42;
      makeDust(playerScreenX(), playerBaseY - 12, 8);
    }
  }

  function update(dt) {
    state.elapsed += dt;
    state.distance += (state.speed * dt) / 4;
    state.speed = Math.min(255, state.speed + dt * 3.5);
    state.spawnTimer -= dt;
    state.itemSpawnTimer -= dt;
    state.invincibleTimer = Math.max(0, state.invincibleTimer - dt);
    state.obstaclePauseTimer = Math.max(0, state.obstaclePauseTimer - dt);
    state.shake = Math.max(0, state.shake - dt * 18);
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    if (isGrounded()) {
      state.playerPulse += dt * 8;
      state.runFrameTimer += dt * (state.speed / 178);
      while (state.runFrameTimer >= runFrameSeconds) {
        state.runFrameTimer -= runFrameSeconds;
        state.runFrame = (state.runFrame + 1) % images.kokkoRun.length;
      }
    }

    state.lane += (state.targetLane - state.lane) * Math.min(1, dt * 10);
    state.laneX = laneOffset(state.lane, 1);

    if (state.jumpV > 0 || state.jumpT > 0) {
      state.jumpT += state.jumpV * dt;
      state.jumpV -= dt * 3.05;
      if (state.jumpT <= 0) {
        state.jumpT = 0;
        state.jumpV = 0;
        makeDust(playerScreenX(), playerBaseY - 8, 7);
      }
    }

    if (state.spawnTimer <= 0) {
      if (state.obstaclePauseTimer > 0) {
        state.spawnTimer = 0.12;
      } else if (state.distance < homeObstacleStopDistance) {
        spawnObstacle();
        const pressure = Math.min(0.34, state.distance / goalDistance * 0.22);
        state.spawnTimer = random(0.78, 1.22) - pressure;
      } else {
        state.spawnTimer = 0.35;
      }
    }

    if (state.itemSpawnTimer <= 0) {
      if (state.distance < itemStopDistance) {
        spawnItem();
      }
      state.itemSpawnTimer = random(5.2, 7.4);
    }

    for (const obstacle of state.obstacles) {
      obstacle.depth += dt * obstacle.speed;
      obstacle.wobble += dt;
      if (obstacle.hit) {
        obstacle.hitAge += dt;
      }
      if (!obstacle.hit && obstacle.depth >= 0.83 && obstacle.depth <= 1.08 && obstacle.lane === state.targetLane) {
        const clear = obstacle.type === "puddle" ? state.jumpT > 0.16 : state.jumpT > 0.47;
        if (!clear) {
          if (state.invincibleTimer > 0) {
            blockObstacle(obstacle);
          } else {
            hitObstacle(obstacle);
          }
        }
      }
    }
    const minObstacleDepth = state.distance >= homeRevealDistance ? 0.34 : -0.08;
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.depth < 1.22 && obstacle.depth >= minObstacleDepth);

    for (const item of state.items) {
      item.depth += dt * item.speed;
      item.wobble += dt;
      if (!item.collected && item.depth >= 0.82 && item.depth <= 1.1 && item.lane === state.targetLane) {
        collectItem(item);
      }
    }
    state.items = state.items.filter((item) => !item.collected && item.depth < 1.2);

    for (const cloud of state.clouds) {
      cloud.x -= dt * cloud.speed;
      if (cloud.x < -180) {
        cloud.x = W + random(60, 260);
        cloud.y = random(38, 138);
      }
    }

    for (const flower of state.flowers) {
      flower.depth += dt * 0.08 * flower.speed;
      if (flower.depth > 1.08) {
        flower.depth = random(0, 0.1);
        flower.lane = random(-1.8, 1.8);
        flower.side = Math.random() > 0.5 ? 1 : -1;
        resetFlowerLook(flower);
      }
    }

    for (const particle of state.dust) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 420 * dt;
    }
    state.dust = state.dust.filter((particle) => particle.life > 0);

    for (const splash of state.splashes) {
      splash.age += dt;
    }
    state.splashes = state.splashes.filter((splash) => splash.age < puddleSplashFrameSeconds * puddleSplashFrameCount);

    for (const clear of state.goldenClears) {
      clear.age += dt;
    }
    state.goldenClears = state.goldenClears.filter((clear) => clear.age < goldenClearSeconds);

    if (state.distance >= goalDistance) {
      beginCelebration();
      return;
    }

    if (state.elapsed >= gameSeconds) {
      finish(false);
    }
  }

  function updateCelebration(dt) {
    state.celebrationTimer += dt;
    state.runFrameTimer += dt;
    while (state.runFrameTimer >= 0.18) {
      state.runFrameTimer -= 0.18;
      state.runFrame = (state.runFrame + 1) % 4;
    }

    if (state.celebrationTimer >= celebrationWalkSeconds + celebrationTurnSeconds + celebrationWaveSeconds) {
      finish(true);
    }
  }

  function spawnObstacle() {
    const roll = Math.random();
    const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
    const type = roll < 0.42 ? "puddle" : roll < 0.72 ? "yellowCat" : "blackCat";
    state.obstacles.push({
      type,
      lane,
      depth: -0.04,
      speed: random(0.42, 0.5) + state.speed / 950,
      hit: false,
      hitAge: 0,
      wobble: random(0, 10),
    });
  }

  function spawnItem() {
    const type = Math.random() < 0.64 ? "sandwich" : "golden";
    state.items.push({
      type,
      lane: [-1, 0, 1][Math.floor(Math.random() * 3)],
      depth: -0.04,
      speed: random(0.42, 0.5) + state.speed / 1000,
      wobble: random(0, 10),
      collected: false,
    });
  }

  function seedShowcaseObstacles() {
    const yellowHit = params.has("hitshowcase");
    state.obstacles = [
      { type: "yellowCat", lane: -1, depth: yellowHit ? 0.88 : 0.45, speed: 0.46, hit: yellowHit, hitAge: 0, wobble: 0 },
      { type: "puddle", lane: 0, depth: 0.64, speed: 0.44, hit: false, hitAge: 0, wobble: 2 },
      { type: "blackCat", lane: 1, depth: 0.78, speed: 0.43, hit: false, hitAge: 0, wobble: 4 },
    ];
  }

  function hitObstacle(obstacle) {
    const penalty = obstacle.type === "puddle" ? collisionPenalty.puddle : collisionPenalty.cat;
    obstacle.hit = true;
    obstacle.hitAge = 0;
    state.shake = obstacle.type === "puddle" ? 5 : 8;
    state.speed = Math.max(minCollisionSpeed, state.speed - penalty.speed);
    state.distance = Math.max(0, state.distance - penalty.distance);
    state.message = obstacle.type === "puddle" ? "첨벙!" : "길막!";
    state.messageTimer = 0.7;
    makeDust(playerScreenX(), playerBaseY - 20, obstacle.type === "puddle" ? 15 : 10);
    if (obstacle.type === "puddle") {
      makePuddleSplash(obstacle);
    }
  }

  function blockObstacle(obstacle) {
    obstacle.hit = true;
    obstacle.hitAge = 0;
    state.shake = Math.max(state.shake, 3);
    state.message = "무적!";
    state.messageTimer = 0.45;
    makeDust(playerScreenX(), playerBaseY - 20, 8);
    if (obstacle.type === "puddle") {
      makePuddleSplash(obstacle);
    }
  }

  function collectItem(item) {
    item.collected = true;
    if (item.type === "sandwich") {
      state.invincibleTimer = sandwichInvincibleSeconds;
      state.message = "무적!";
      state.messageTimer = 0.9;
      makeDust(playerScreenX(), playerBaseY - 32, 18);
      return;
    }

    makeGoldenClearEffect(item, state.obstacles);
    state.obstacles = [];
    state.obstaclePauseTimer = goldenObstaclePauseSeconds;
    state.spawnTimer = Math.max(state.spawnTimer, goldenObstaclePauseSeconds);
    state.shake = Math.max(state.shake, 5);
    state.message = "싹!";
    state.messageTimer = 0.9;
    makeGoldenDust(playerScreenX(), playerBaseY - 36, 30);
  }

  function beginCelebration() {
    state.mode = "celebrating";
    state.distance = goalDistance;
    state.speed = 0;
    state.shake = 0;
    state.message = "";
    state.messageTimer = 0;
    state.invincibleTimer = 0;
    state.obstaclePauseTimer = 0;
    state.celebrationTimer = 0;
    state.runFrame = 0;
    state.runFrameTimer = 0;
    state.lane = 0;
    state.targetLane = 0;
    state.obstacles = [];
    state.items = [];
    state.dust = [];
    state.splashes = [];
    state.goldenClears = [];
  }

  function finish(success) {
    state.mode = "ended";
    state.finishSuccess = success;
    const score = Math.min(goalDistance, state.distance);
    if (score > best) {
      best = score;
      localStorage.setItem("kokko-forward-best", String(Math.round(best)));
    }
    updateHud();

    lastResult = {
      finished: success,
      elapsedMs: Math.round(state.elapsed * 1000),
      distance: Math.round(score),
    };

    resultKicker.textContent = success ? "SUCCESS" : "TIME UP";
    resultTitle.textContent = success ? "집에 도착!" : "조금 더!";
    resultMeta.textContent = success
      ? `${state.elapsed.toFixed(1)}초 만에 도착! 🎉`
      : `${Math.round(score)}m 이동`;
    startButton.textContent = "다시";
    showResultSubmitUI();
    overlay.classList.remove("is-hidden");
  }

  // --- 리더보드 ---

  function whenLB(callback) {
    if (window.KokkoLB) {
      callback(window.KokkoLB);
    } else {
      window.addEventListener("kokko-lb-ready", () => callback(window.KokkoLB), { once: true });
    }
  }

  function showResultSubmitUI() {
    submitStatus.textContent = "";
    submitStatus.classList.remove("is-error");
    submitScoreButton.disabled = false;
    submitScoreButton.textContent = "순위 등록";
    submitArea.classList.remove("is-hidden");
    leaderboardArea.classList.remove("is-hidden");
    startLeaderboardFeed();
  }

  function hideLeaderboardUI() {
    submitArea.classList.add("is-hidden");
    leaderboardArea.classList.add("is-hidden");
    if (lbUnsub) {
      lbUnsub();
      lbUnsub = null;
    }
  }

  function startLeaderboardFeed() {
    if (lbUnsub) {
      return;
    }
    whenLB((lb) => {
      if (!lbUnsub) {
        lbUnsub = lb.subscribeTop(renderLeaderboard);
      }
    });
  }

  function renderLeaderboard(rows) {
    leaderboardList.textContent = "";
    rows.slice(0, 7).forEach((row, i) => {
      const li = document.createElement("li");
      if (mySubmittedNick && row.nickname === mySubmittedNick) {
        li.classList.add("is-me");
      }

      const rankEl = document.createElement("span");
      rankEl.className = "lb-rank";
      rankEl.textContent = ["🥇", "🥈", "🥉"][i] || String(i + 1);

      const nameEl = document.createElement("span");
      nameEl.className = "lb-name";
      nameEl.textContent = row.nickname || "익명";

      const metricEl = document.createElement("span");
      metricEl.className = "lb-metric";
      metricEl.textContent = row.finished
        ? `${(row.elapsedMs / 1000).toFixed(1)}초 완주`
        : `${row.distance}m`;

      li.append(rankEl, nameEl, metricEl);
      leaderboardList.appendChild(li);
    });

    if (mySubmittedNick) {
      const idx = rows.findIndex((row) => row.nickname === mySubmittedNick);
      myRankText.textContent = idx >= 0 ? `· 내 순위 ${idx + 1}위` : "· 순위 집계 중";
    } else {
      myRankText.textContent = "";
    }
  }

  function submitCurrentScore() {
    if (!lastResult) {
      return;
    }
    const nickname = nickInput.value.trim();
    const contact = contactInput.value.trim();
    if (nickname.length < 1) {
      submitStatus.textContent = "닉네임을 입력해 주세요.";
      submitStatus.classList.add("is-error");
      nickInput.focus();
      return;
    }

    localStorage.setItem("kokko-nick", nickname);
    localStorage.setItem("kokko-contact", contact);
    submitScoreButton.disabled = true;
    submitScoreButton.textContent = "등록 중…";
    submitStatus.classList.remove("is-error");
    submitStatus.textContent = "";

    whenLB((lb) => {
      lb.submitScore({
        nickname,
        contact,
        finished: lastResult.finished,
        elapsedMs: lastResult.elapsedMs,
        distance: lastResult.distance,
      })
        .then(() => {
          mySubmittedNick = nickname;
          submitScoreButton.textContent = "등록 완료!";
          submitStatus.textContent = "순위표에 등록됐어요. 다시 도전해 더 높은 기록을 노려보세요!";
          startLeaderboardFeed();
        })
        .catch((err) => {
          console.error("[KokkoLB] 등록 실패:", err);
          submitScoreButton.disabled = false;
          submitScoreButton.textContent = "순위 등록";
          submitStatus.textContent = "등록 실패 — 잠시 후 다시 시도해 주세요.";
          submitStatus.classList.add("is-error");
        });
    });
  }

  function draw(dt) {
    const sx = state.shake ? random(-state.shake, state.shake) : 0;
    const sy = state.shake ? random(-state.shake * 0.6, state.shake * 0.6) : 0;
    ctx.save();
    ctx.translate(sx, sy);
    drawSky();
    drawHome();
    drawField();
    drawRoad();
    drawTrackDetails();
    drawDepthSortedObjects();
    drawGoldenClearEffects();
    if (state.mode === "celebrating" || (state.mode === "ended" && state.finishSuccess)) {
      drawCelebrationPlayer();
    } else {
      drawPlayer();
    }
    drawPuddleSplashes();
    drawDust();
    drawMessage();
    ctx.restore();
    updateHud();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#b9e7ff");
    sky.addColorStop(0.52, "#e8f7cb");
    sky.addColorStop(1, "#8ccf68");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255, 249, 201, 0.9)";
    ctx.beginPath();
    ctx.arc(814, 74, 42, 0, Math.PI * 2);
    ctx.fill();

    for (const cloud of state.clouds) {
      ctx.fillStyle = `rgba(255, 255, 255, ${cloud.alpha})`;
      cloudBlob(cloud.x, cloud.y, cloud.s);
    }

    drawHill(0, 286, "#71bf73", 0.22);
    drawHill(220, 302, "#61b768", 0.34);
    drawHill(520, 292, "#79c975", 0.28);
  }

  function drawField() {
    ctx.fillStyle = "#7fc866";
    ctx.beginPath();
    ctx.moveTo(0, ridgeSideY);
    ctx.quadraticCurveTo(W / 2, ridgeCenterY, W, ridgeSideY);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    for (const flower of state.flowers) {
      const p = perspectivePoint(flower.lane * 1.28 + flower.side * 1.3, flower.depth);
      const scale = 0.3 + flower.depth * 0.9;
      if (flower.kind === "croissant") {
        drawCroissantFlower(flower, p.x, p.y);
      } else {
        drawFlower(p.x, p.y, scale, flower.color);
      }
    }
  }

  function drawRoad() {
    ctx.fillStyle = "#d9b46d";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 78, roadTopSideY);
    ctx.quadraticCurveTo(W / 2, roadTopCenterY, W / 2 + 78, roadTopSideY);
    ctx.lineTo(W + 104, H + 40);
    ctx.lineTo(-104, H + 40);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(126, 91, 45, 0.22)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 25, roadTopCenterY + 3);
    ctx.lineTo(W / 2 - 185, H + 20);
    ctx.moveTo(W / 2 + 25, roadTopCenterY + 3);
    ctx.lineTo(W / 2 + 185, H + 20);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 253, 229, 0.4)";
    ctx.lineWidth = 3;
    const stripeSpacing = 0.18;
    const stripePhase = (state.distance / 70) % stripeSpacing;
    for (let d = stripePhase; d < 1.15; d += stripeSpacing) {
      const y = roadYForDepth(d);
      const w = roadHalfWidthForDepth(d);
      ctx.beginPath();
      ctx.moveTo(W / 2 - w, y);
      ctx.lineTo(W / 2 + w, y);
      ctx.stroke();
    }

    drawFinishLine();
  }

  function drawFinishLine() {
    const remaining = goalDistance - state.distance;
    if (remaining > finishLineVisibleDistance) {
      return;
    }

    const progress = clamp(1 - remaining / finishLineVisibleDistance, 0, 1);
    const depth = 0.06 + Math.pow(progress, 0.9) * 0.78;
    const farDepth = clamp(depth, 0, 0.9);
    const nearDepth = clamp(depth + 0.035 + depth * 0.018, 0, 0.94);
    const columns = 14;
    const rows = 2;

    ctx.save();
    ctx.globalAlpha = Math.min(1, progress * 3);
    for (let row = 0; row < rows; row += 1) {
      const rowTop = row / rows;
      const rowBottom = (row + 1) / rows;
      const topDepth = farDepth + (nearDepth - farDepth) * rowTop;
      const bottomDepth = farDepth + (nearDepth - farDepth) * rowBottom;
      const topY = roadYForDepth(topDepth);
      const bottomY = roadYForDepth(bottomDepth);
      const topHalf = roadHalfWidthForDepth(topDepth) * 0.96;
      const bottomHalf = roadHalfWidthForDepth(bottomDepth) * 0.96;

      for (let column = 0; column < columns; column += 1) {
        const leftRatio = column / columns;
        const rightRatio = (column + 1) / columns;
        const topLeft = W / 2 - topHalf + topHalf * 2 * leftRatio;
        const topRight = W / 2 - topHalf + topHalf * 2 * rightRatio;
        const bottomLeft = W / 2 - bottomHalf + bottomHalf * 2 * leftRatio;
        const bottomRight = W / 2 - bottomHalf + bottomHalf * 2 * rightRatio;

        ctx.fillStyle = (row + column) % 2 === 0 ? "rgba(255, 253, 235, 0.96)" : "rgba(126, 91, 45, 0.72)";
        ctx.beginPath();
        ctx.moveTo(topLeft, topY);
        ctx.lineTo(topRight, topY);
        ctx.lineTo(bottomRight, bottomY);
        ctx.lineTo(bottomLeft, bottomY);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.strokeStyle = "rgba(126, 91, 45, 0.34)";
    ctx.lineWidth = 2 + farDepth * 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - roadHalfWidthForDepth(farDepth) * 0.96, roadYForDepth(farDepth));
    ctx.lineTo(W / 2 + roadHalfWidthForDepth(farDepth) * 0.96, roadYForDepth(farDepth));
    ctx.lineTo(W / 2 + roadHalfWidthForDepth(nearDepth) * 0.96, roadYForDepth(nearDepth));
    ctx.lineTo(W / 2 - roadHalfWidthForDepth(nearDepth) * 0.96, roadYForDepth(nearDepth));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawHome() {
    const progress = clamp((state.distance - homeRevealDistance) / (homeRevealEndDistance - homeRevealDistance), 0, 1);
    if (progress <= 0) {
      return;
    }
    const eased = 1 - Math.pow(1 - progress, 3);
    const reveal = Math.pow(progress, 1.22);
    const width = 54 + eased * 184;
    const height = width * (homeSprite.sh / homeSprite.sw);
    const horizonCutY = ridgeCenterY - 5;
    const finalGroundY = roadTopCenterY + 4;
    const hiddenGroundY = horizonCutY + height + 8;
    const groundY = hiddenGroundY + (finalGroundY - hiddenGroundY) * eased;
    const revealY = horizonCutY + (groundY + 10 - horizonCutY) * reveal;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, revealY);
    ctx.clip();
    ctx.fillStyle = `rgba(52, 73, 43, ${0.04 + eased * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(W / 2, groundY + 8, width * 0.38, 10 + eased * 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (images.home.complete && images.home.naturalWidth) {
      ctx.drawImage(
        images.home,
        homeSprite.sx,
        homeSprite.sy,
        homeSprite.sw,
        homeSprite.sh,
        W / 2 - width / 2,
        groundY - height,
        width,
        height,
      );
    } else {
      drawHouse(W / 2, groundY - 72 * (width / 150), width / 150);
    }
    ctx.restore();
  }

  function drawTrackDetails() {
    ctx.fillStyle = "#5fa84e";
    for (let d = ((state.distance / 65) % 1) - 0.1; d < 1.12; d += 0.16) {
      const left = perspectivePoint(-1.95, d);
      const right = perspectivePoint(1.95, d + 0.04);
      grassClump(left.x, left.y, 0.42 + d * 0.7);
      grassClump(right.x, right.y, 0.42 + d * 0.7);
    }
  }

  function drawDepthSortedObjects() {
    const objects = [
      ...state.obstacles.map((obstacle) => ({ kind: "obstacle", value: obstacle })),
      ...state.items.map((item) => ({ kind: "item", value: item })),
    ].sort((a, b) => a.value.depth - b.value.depth);

    for (const object of objects) {
      if (object.kind === "item") {
        drawItem(object.value);
      } else if (object.value.type === "puddle") {
        drawPuddle(object.value);
      } else {
        drawCat(object.value);
      }
    }
  }

  function drawPuddle(obstacle) {
    const p = perspectivePoint(obstacle.lane, obstacle.depth);
    const scale = scaleForDepth(obstacle.depth);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale * 0.72);
    ctx.globalAlpha = obstacle.hit ? 0.55 : 0.9;
    ctx.fillStyle = "#48aeca";
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(229, 251, 255, 0.72)";
    ctx.beginPath();
    ctx.ellipse(-16, -5, 18, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCat(obstacle) {
    const p = perspectivePoint(obstacle.lane, obstacle.depth);
    const scale = scaleForDepth(obstacle.depth);
    const happyYellow = obstacle.type === "yellowCat" && obstacle.hit;
    const blockingBlack = obstacle.type === "blackCat" && obstacle.hit;
    const image = happyYellow
      ? images.yellowCatHappy
      : blockingBlack
        ? images.blackCatBlock
        : obstacle.type === "yellowCat"
          ? images.yellowCat
          : images.blackCat;
    const baseW = happyYellow ? 132 : blockingBlack ? 128 : obstacle.type === "yellowCat" ? 78 : 84;
    const baseH = happyYellow ? 80 : blockingBlack ? 170 : obstacle.type === "yellowCat" ? 104 : 118;
    const w = baseW * scale;
    const h = baseH * scale;
    const bob = Math.sin(obstacle.wobble * 5) * (happyYellow || blockingBlack ? 1.5 : 3) * scale;

    ctx.save();
    ctx.globalAlpha = obstacle.hit && !happyYellow && !blockingBlack ? 0.5 : 1;
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(happyYellow ? Math.sin(obstacle.wobble * 5.5) * 0.035 : Math.sin(obstacle.wobble * 2.2) * 0.03);
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, -w / 2, -h, w, h);
    } else {
      ctx.fillStyle = obstacle.type === "yellowCat" ? "#f6c85a" : "#222638";
      ctx.fillRect(-w / 2, -h, w, h);
    }
    ctx.restore();
  }

  function drawItem(item) {
    const p = perspectivePoint(item.lane, item.depth);
    const scale = scaleForDepth(item.depth);
    const image = item.type === "sandwich" ? images.sandwich : images.goldenCroissant;
    const baseW = item.type === "sandwich" ? 86 : 76;
    const baseH = item.type === "sandwich" ? 84 : 70;
    const w = baseW * scale;
    const h = baseH * scale;
    const bob = Math.sin(item.wobble * 5.4) * 5 * scale;
    const halo = 18 * scale + Math.sin(item.wobble * 6) * 2;

    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = item.type === "sandwich" ? "rgba(255, 255, 255, 0.32)" : "rgba(255, 236, 95, 0.42)";
    ctx.beginPath();
    ctx.arc(0, -h * 0.48, halo, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(Math.sin(item.wobble * 2.2) * 0.08);
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, -w / 2, -h, w, h);
    } else {
      ctx.fillStyle = item.type === "sandwich" ? "#f3a155" : "#ffd925";
      ctx.beginPath();
      ctx.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const x = playerScreenX();
    const jump = jumpHeight();
    const y = playerBaseY - jump * 92;
    const pulse = Math.sin(state.playerPulse) * 0.02;
    const lean = (state.targetLane - state.lane) * 0.12;
    const image = images.kokkoRun[state.runFrame] || images.kokkoRun[0];
    const w = 122 * (1 + pulse);
    const h = 185 * (1 - pulse * 0.4);

    ctx.fillStyle = `rgba(48, 60, 42, ${0.18 - jump * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(x, playerBaseY + 10, 54 * (1 - jump * 0.25), 12 * (1 - jump * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();

    if (state.invincibleTimer > 0) {
      const auraAlpha = 0.22 + Math.sin(state.elapsed * 14) * 0.06;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 236, 104, ${auraAlpha + 0.18})`;
      ctx.fillStyle = `rgba(255, 246, 168, ${auraAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(x, y - 68, 72 + Math.sin(state.elapsed * 9) * 3, 88, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean + Math.sin(state.playerPulse * 0.65) * 0.035);
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, -w / 2, -h + 20, w, h);
    } else {
      fallbackKokko(-w / 2, -h, w, h);
    }
    ctx.restore();
  }

  function drawCelebrationPlayer() {
    const walkProgress = clamp(state.celebrationTimer / celebrationWalkSeconds, 0, 1);
    const easedWalk = easeInOut(walkProgress);
    const depth = 1.02 + (0.58 - 1.02) * easedWalk;
    const p = perspectivePoint(0, depth);
    const scale = 1 - easedWalk * 0.28;
    const baselineY = p.y + 18 * scale;

    if (state.celebrationTimer < celebrationWalkSeconds) {
      drawKokkoWalkAway(p.x, baselineY, scale, state.runFrame);
      return;
    }

    const turnTimer = state.celebrationTimer - celebrationWalkSeconds;
    if (turnTimer < celebrationTurnSeconds) {
      const turnProgress = clamp(turnTimer / celebrationTurnSeconds, 0, 1);
      if (turnProgress < 0.5) {
        const squash = 1 - turnProgress * 1.7;
        drawKokkoWalkAway(p.x, baselineY, scale, state.runFrame, Math.max(0.15, squash));
      } else {
        const stretch = (turnProgress - 0.5) * 2;
        drawKokkoFront(p.x, baselineY, scale, 0, Math.max(0.15, stretch));
      }
      return;
    }

    const waveTimer = state.celebrationTimer - celebrationWalkSeconds - celebrationTurnSeconds;
    const wave = Math.sin(waveTimer * 11);
    drawKokkoFront(p.x, baselineY, scale, wave * 0.045, 1);
    drawWaveMarks(p.x + 43 * scale, baselineY - 130 * scale, scale, waveTimer);
  }

  function drawKokkoWalkAway(x, baselineY, scale, frame, scaleX = 1) {
    const image = images.kokkoWalkAway;
    const fallback = images.kokkoRun[frame % images.kokkoRun.length] || images.kokkoRun[0];
    const source = image.complete && image.naturalWidth ? image : fallback;
    const frameCount = source === image ? 4 : 1;
    const frameW = source.naturalWidth / frameCount;
    const frameH = source.naturalHeight;
    const sourceX = source === image ? Math.floor(frame % 4) * frameW : 0;
    const w = 124 * scale;
    const h = 190 * scale;

    ctx.save();
    ctx.translate(x, baselineY);
    ctx.scale(scaleX, 1);
    ctx.drawImage(source, sourceX, 0, frameW, frameH, -w / 2, -h, w, h);
    ctx.restore();
  }

  function drawKokkoFront(x, baselineY, scale, rotation = 0, scaleX = 1) {
    const image = images.kokkoFront;
    const w = 112 * scale;
    const h = 154 * scale;

    ctx.save();
    ctx.translate(x, baselineY);
    ctx.rotate(rotation);
    ctx.scale(scaleX, 1);
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, -w / 2, -h + 6 * scale, w, h);
    } else {
      fallbackKokko(-w / 2, -h, w, h);
    }
    ctx.restore();
  }

  function drawWaveMarks(x, y, scale, timer) {
    const alpha = 0.35 + Math.sin(timer * 12) * 0.12;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 253, 229, ${alpha})`;
    ctx.lineWidth = Math.max(1, 2.2 * scale);
    ctx.lineCap = "round";
    for (let i = 0; i < 2; i += 1) {
      const r = (12 + i * 9 + Math.sin(timer * 9 + i) * 1.5) * scale;
      ctx.beginPath();
      ctx.arc(x + i * 5 * scale, y - i * 7 * scale, r, -0.9, 0.65);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGoldenClearEffects() {
    if (!state.goldenClears.length) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const clear of state.goldenClears) {
      drawGoldenRoadRibbons(clear);
      drawGoldenObstacleBursts(clear);
      drawGoldenParticles(clear);
    }
    ctx.restore();
  }

  function drawGoldenRoadRibbons(clear) {
    const t = clamp(clear.age / goldenClearSeconds, 0, 1);
    const burst = easeOutCubic(clamp(clear.age / 0.34, 0, 1));
    const bloomFade = 1 - easeOutCubic(clamp((clear.age - 0.5) / 0.45, 0, 1));
    const bloomRadius = 42 + burst * 118;
    const bloom = ctx.createRadialGradient(clear.originX, clear.originY, 0, clear.originX, clear.originY, bloomRadius);
    bloom.addColorStop(0, `rgba(255, 255, 238, ${0.7 * bloomFade})`);
    bloom.addColorStop(0.28, `rgba(255, 232, 96, ${0.46 * bloomFade})`);
    bloom.addColorStop(1, "rgba(255, 210, 45, 0)");

    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(clear.originX, clear.originY, bloomRadius, 0, Math.PI * 2);
    ctx.fill();

    for (const trail of clear.trails) {
      const p = clamp((clear.age - trail.delay) / trail.life, 0, 1);
      if (p <= 0 || p >= 1) {
        continue;
      }

      const eased = easeOutCubic(p);
      const fade = Math.pow(1 - p, 0.72);
      const depth = trail.depth;
      const center = perspectivePoint(0, depth);
      const roadW = roadHalfWidthForDepth(depth);
      const scale = scaleForDepth(depth);
      const startX = center.x + trail.side * roadW * 0.04;
      const midX = center.x + trail.side * roadW * (0.16 + trail.reach * eased * 0.44);
      const endX = center.x + trail.side * roadW * (0.22 + trail.reach * eased);
      const y = center.y + trail.yOffset * scale - Math.sin(p * Math.PI) * trail.lift * scale;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = 18 * scale;
      ctx.shadowColor = "rgba(255, 224, 82, 0.82)";
      ctx.strokeStyle = `rgba(255, 218, 70, ${0.26 * fade * (1 - t * 0.18)})`;
      ctx.lineWidth = (4.5 + depth * 7.5) * trail.width * fade;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.quadraticCurveTo(midX, y - trail.arc * scale, endX, y + trail.tail * scale);
      ctx.stroke();

      ctx.shadowBlur = 6 * scale;
      ctx.strokeStyle = `rgba(255, 255, 236, ${0.58 * fade})`;
      ctx.lineWidth = Math.max(1.1, (1.5 + depth * 2.3) * trail.width * fade);
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.quadraticCurveTo(midX, y - trail.arc * scale, endX, y + trail.tail * scale);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGoldenObstacleBursts(clear) {
    for (const burst of clear.bursts) {
      const p = clamp((clear.age - burst.delay) / burst.life, 0, 1);
      if (p <= 0 || p >= 1) {
        continue;
      }

      const eased = easeOutCubic(p);
      const alpha = Math.pow(1 - p, 0.84);
      const point = perspectivePoint(burst.lane, burst.depth);
      const scale = scaleForDepth(burst.depth);
      const y = point.y - (28 + 8 * Math.sin(burst.phase)) * scale;

      ctx.save();
      ctx.strokeStyle = `rgba(255, 246, 166, ${0.68 * alpha})`;
      ctx.lineWidth = Math.max(1, 2.6 * scale * alpha);
      ctx.shadowBlur = 10 * scale;
      ctx.shadowColor = "rgba(255, 215, 72, 0.72)";
      ctx.beginPath();
      ctx.ellipse(point.x, y, (18 + 46 * eased) * scale, (8 + 18 * eased) * scale, burst.phase * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < 6; i += 1) {
        const angle = burst.phase + (Math.PI * 2 * i) / 6;
        const dist = (12 + 44 * eased) * scale;
        drawGoldenGlint(
          point.x + Math.cos(angle) * dist,
          y + Math.sin(angle) * dist * 0.58,
          (3.4 + i % 2) * scale * alpha,
          alpha * 0.78,
          angle,
        );
      }
    }
  }

  function drawGoldenParticles(clear) {
    for (const particle of clear.particles) {
      const p = clamp((clear.age - particle.delay) / particle.life, 0, 1);
      if (p <= 0 || p >= 1) {
        continue;
      }

      const eased = easeOutCubic(p);
      const center = perspectivePoint(0, particle.depth);
      const roadW = roadHalfWidthForDepth(particle.depth);
      const scale = scaleForDepth(particle.depth);
      const drift = particle.side * roadW * (particle.start + particle.distance * eased);
      const shimmer = Math.sin(clear.age * particle.twinkle + particle.phase) * particle.wobble * scale;
      const x = center.x + drift + shimmer;
      const y = center.y + particle.yOffset * scale - Math.sin(p * Math.PI) * particle.lift * scale;
      const alpha = Math.pow(1 - p, 0.9) * particle.alpha;
      const radius = particle.size * scale * (1 - p * 0.34);

      if (particle.glint) {
        drawGoldenGlint(x, y, radius * 2.4, alpha, particle.phase + p * Math.PI * 1.5);
        continue;
      }

      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.4);
      glow.addColorStop(0, `rgba(255, 255, 245, ${0.9 * alpha})`);
      glow.addColorStop(0.32, `rgba(255, 232, 93, ${0.58 * alpha})`);
      glow.addColorStop(1, "rgba(255, 196, 38, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.8, radius * 0.9), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGoldenGlint(x, y, radius, alpha, rotation = 0) {
    if (alpha <= 0) {
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.strokeStyle = `rgba(255, 255, 235, ${alpha})`;
    ctx.lineWidth = Math.max(1, radius * 0.16);
    ctx.lineCap = "round";
    ctx.shadowBlur = radius * 1.4;
    ctx.shadowColor = `rgba(255, 217, 74, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.moveTo(0, -radius * 0.74);
    ctx.lineTo(0, radius * 0.74);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 236, 112, ${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, radius * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function makeGoldenClearEffect(item, obstacles) {
    const itemPoint = perspectivePoint(item.lane, item.depth);
    const itemScale = scaleForDepth(item.depth);
    const clear = {
      age: 0,
      originX: itemPoint.x,
      originY: itemPoint.y - 42 * itemScale,
      particles: [],
      trails: [],
      bursts: obstacles.map((obstacle, index) => ({
        lane: obstacle.lane,
        depth: clamp(obstacle.depth, 0.08, 1.06),
        delay: 0.04 + index * 0.026 + random(0, 0.08),
        life: random(0.38, 0.56),
        phase: random(0, Math.PI * 2),
      })),
    };

    for (let i = 0; i < 8; i += 1) {
      const depth = 0.2 + Math.pow(i / 7, 1.12) * 0.86;
      for (const side of [-1, 1]) {
        clear.trails.push({
          side,
          depth,
          delay: random(0, 0.06) + (1 - depth) * 0.035,
          life: random(0.46, 0.66),
          reach: random(0.62, 0.9),
          lift: random(4, 18),
          arc: random(10, 34),
          tail: random(-8, 12),
          width: random(0.74, 1.24),
          yOffset: random(-8, 8),
        });
      }
    }

    for (let i = 0; i < goldenClearParticleCount; i += 1) {
      const depth = random(0.16, 1.05);
      clear.particles.push({
        side: i % 2 === 0 ? -1 : 1,
        depth,
        delay: random(0, 0.17) + (1 - depth) * 0.05,
        life: random(0.38, 0.82),
        start: random(0.02, 0.14),
        distance: random(0.42, 0.92),
        lift: random(8, 42),
        yOffset: random(-12, 14),
        wobble: random(1.5, 11),
        twinkle: random(7, 15),
        size: random(1.4, 4.7),
        alpha: random(0.54, 0.96),
        phase: random(0, Math.PI * 2),
        glint: Math.random() > 0.58,
      });
    }

    state.goldenClears.push(clear);
  }

  function drawPuddleSplashes() {
    const image = images.puddleSplash;
    if (!image.complete || !image.naturalWidth) {
      return;
    }

    const frameW = image.naturalWidth / puddleSplashFrameCount;
    const frameH = image.naturalHeight;
    for (const splash of state.splashes) {
      const frame = Math.min(puddleSplashFrameCount - 1, Math.floor(splash.age / puddleSplashFrameSeconds));
      const progress = splash.age / (puddleSplashFrameSeconds * puddleSplashFrameCount);
      const w = 212 * splash.scale;
      const h = w * (frameH / frameW);

      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, progress - 0.68) / 0.32;
      ctx.drawImage(
        image,
        frame * frameW,
        0,
        frameW,
        frameH,
        splash.x - w / 2,
        splash.y - h * 0.73,
        w,
        h,
      );
      ctx.restore();
    }
  }

  function makePuddleSplash(obstacle) {
    const jump = jumpHeight();
    const scale = scaleForDepth(Math.max(0.94, obstacle.depth)) * 0.9;
    state.splashes.push({
      x: playerScreenX(),
      y: playerBaseY - jump * 92 + 18,
      scale,
      age: 0,
    });
  }

  function drawDust() {
    for (const p of state.dust) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMessage() {
    if (state.messageTimer <= 0) {
      return;
    }
    const x = playerScreenX();
    const y = playerBaseY - 210 - (0.7 - state.messageTimer) * 24;
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.messageTimer * 2.2);
    ctx.fillStyle = "rgba(255, 253, 245, 0.93)";
    roundRect(ctx, x - 44, y - 22, 88, 38, 8);
    ctx.fill();
    ctx.fillStyle = "#e45738";
    ctx.font = "800 18px Malgun Gothic, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.message, x, y - 3);
    ctx.restore();
  }

  function perspectivePoint(lane, depth) {
    const d = clamp(depth, 0, 1.12);
    const y = roadTopCenterY + 8 + Math.pow(d, 1.58) * (playerBaseY - roadTopCenterY - 8);
    const x = W / 2 + laneOffset(lane, d);
    return { x, y };
  }

  function roadYForDepth(depth) {
    const d = clamp(depth, 0, 1.15);
    return roadTopCenterY + 8 + Math.pow(d, 1.7) * (H - roadTopCenterY + 10);
  }

  function roadHalfWidthForDepth(depth) {
    const d = clamp(depth, 0, 1.15);
    return 42 + d * 340;
  }

  function laneOffset(lane, depth) {
    return lane * (34 + depth * 150);
  }

  function scaleForDepth(depth) {
    const d = clamp(depth, 0, 1.08);
    return 0.28 + Math.pow(d, 1.28) * 1.05;
  }

  function playerScreenX() {
    return W / 2 + laneOffset(state.lane, 1);
  }

  function jumpHeight() {
    return Math.sin(clamp(state.jumpT, 0, 1) * Math.PI);
  }

  function isGrounded() {
    return state.jumpT <= 0 && state.jumpV <= 0;
  }

  function updateHud() {
    const remain = Math.max(0, gameSeconds - state.elapsed);
    distanceText.textContent = `${Math.round(Math.min(goalDistance, state.distance))}m`;
    timeText.textContent = remain.toFixed(1);
    bestText.textContent = `${Math.round(best)}m`;
  }

  function makeDust(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      state.dust.push({
        x: x + random(-14, 14),
        y: y + random(-5, 8),
        vx: random(-90, 90),
        vy: random(-170, -55),
        r: random(2.5, 5.5),
        life: random(0.28, 0.56),
        maxLife: 0.56,
        color: Math.random() > 0.35 ? "#c08c4f" : "#8dd4e8",
      });
    }
  }

  function makeGoldenDust(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const life = random(0.34, 0.72);
      state.dust.push({
        x: x + random(-18, 18),
        y: y + random(-8, 10),
        vx: random(-120, 120),
        vy: random(-210, -70),
        r: random(2, 5.2),
        life,
        maxLife: life,
        color: ["#fff7b8", "#ffe45f", "#ffffff", "#ffd24a"][i % 4],
      });
    }
  }

  function seedScenery() {
    state.clouds = [];
    for (let i = 0; i < 7; i += 1) {
      state.clouds.push({
        x: random(0, W),
        y: random(36, 160),
        s: random(0.55, 1.15),
        speed: random(8, 20),
        alpha: random(0.4, 0.75),
      });
    }

    state.flowers = [];
    for (let i = 0; i < 54; i += 1) {
      const flower = {
        lane: random(-1.8, 1.8),
        side: Math.random() > 0.5 ? 1 : -1,
        depth: random(0, 1),
        speed: random(0.7, 1.2),
        color: ["#fff6a9", "#f48ba8", "#ffcf4c", "#ffffff", "#ef6f58"][i % 5],
        kind: "normal",
        imageIndex: 0,
        flip: 1,
      };
      resetFlowerLook(flower, i);
      state.flowers.push(flower);
    }
  }

  function drawHill(offset, base, color, speed) {
    const shift = -((state.distance * speed) % 520);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-80, H);
    for (let x = -80; x <= W + 140; x += 130) {
      const y = base + Math.sin((x + shift + offset) * 0.012) * 24;
      ctx.quadraticCurveTo(x + 65, y - 30, x + 130, y);
    }
    ctx.lineTo(W + 140, H);
    ctx.closePath();
    ctx.fill();
  }

  function cloudBlob(x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y + 12 * s, 40 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 36 * s, y + 8 * s, 48 * s, 25 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 75 * s, y + 15 * s, 36 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFlower(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = "#397a3f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -7);
    ctx.stroke();
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i += 1) {
      const a = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 5, Math.sin(a) * 5 - 8, 4, 6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#d8913d";
    ctx.beginPath();
    ctx.arc(0, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCroissantFlower(flower, x, y) {
    const image = images.croissantFlowers[flower.imageIndex];
    const h = 22 + flower.depth * 42;
    const w = h * 0.92;
    const sway = Math.sin(state.distance * 0.025 + flower.imageIndex * 1.7 + flower.depth * 5) * flower.depth * 1.5;

    ctx.save();
    ctx.translate(x + sway, y + 5);
    ctx.scale(flower.flip, 1);
    if (image && image.complete && image.naturalWidth) {
      ctx.drawImage(image, -w / 2, -h, w, h);
    } else {
      drawFlower(0, 0, 0.9 + flower.depth * 0.5, "#f4a7ad");
    }
    ctx.restore();
  }

  function resetFlowerLook(flower, seed = Math.floor(Math.random() * 1000)) {
    flower.kind = Math.random() < 0.8 ? "croissant" : "normal";
    flower.imageIndex = seed % images.croissantFlowers.length;
    flower.flip = Math.random() > 0.5 ? 1 : -1;
    flower.color = ["#fff6a9", "#f48ba8", "#ffcf4c", "#ffffff", "#ef6f58"][seed % 5];
  }

  function grassClump(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.quadraticCurveTo(5, -6, 12, 12);
    ctx.quadraticCurveTo(20, -12, 27, 12);
    ctx.quadraticCurveTo(34, -4, 42, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHouse(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fff4df";
    ctx.strokeStyle = "#7e5a3b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-66, 72);
    ctx.lineTo(-66, 12);
    ctx.lineTo(0, -42);
    ctx.lineTo(68, 12);
    ctx.lineTo(68, 72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e15845";
    ctx.beginPath();
    ctx.moveTo(-78, 14);
    ctx.lineTo(0, -54);
    ctx.lineTo(80, 14);
    ctx.lineTo(68, 26);
    ctx.lineTo(0, -30);
    ctx.lineTo(-68, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7ac5d8";
    ctx.fillRect(-45, 28, 28, 26);
    ctx.fillRect(20, 28, 28, 26);
    ctx.fillStyle = "#8c6744";
    ctx.fillRect(-10, 30, 22, 42);
    ctx.fillStyle = "#f6cf67";
    ctx.beginPath();
    ctx.arc(7, 52, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function fallbackKokko(x, y, w, h) {
    ctx.fillStyle = "#fffaf1";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.5, w * 0.34, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#565a5e";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.26, y + h * 0.32, w * 0.13, h * 0.16, -0.4, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.74, y + h * 0.32, w * 0.13, h * 0.16, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function easeInOut(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function easeOutCubic(value) {
    const t = clamp(value, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }
})();
