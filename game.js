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

  const W = canvas.width;
  const H = canvas.height;
  const horizonY = 190;
  const playerBaseY = 470;
  const goalDistance = 1650;
  const gameSeconds = 45;

  const images = {
    kokkoRun: [
      loadImage("assets/kokko-run-1.png"),
      loadImage("assets/kokko-run-2.png"),
      loadImage("assets/kokko-run-3.png"),
      loadImage("assets/kokko-run-2.png"),
    ],
    yellowCat: loadImage("assets/cat-yellow.png"),
    blackCat: loadImage("assets/cat-black.png"),
  };

  const state = {
    mode: "ready",
    lastTime: 0,
    elapsed: 0,
    distance: 0,
    speed: 178,
    spawnTimer: 0.8,
    shake: 0,
    message: "",
    messageTimer: 0,
    lane: 0,
    targetLane: 0,
    laneX: 0,
    jumpT: 0,
    jumpV: 0,
    playerPulse: 0,
    runFrame: 0,
    runFrameTimer: 0,
    obstacles: [],
    flowers: [],
    clouds: [],
    dust: [],
  };

  let best = Number(localStorage.getItem("kokko-forward-best") || 0);
  bestText.textContent = `${Math.round(best)}m`;

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
    state.shake = 0;
    state.message = "";
    state.messageTimer = 0;
    state.lane = 0;
    state.targetLane = 0;
    state.laneX = 0;
    state.jumpT = 0;
    state.jumpV = 0;
    state.playerPulse = 0;
    state.runFrame = 0;
    state.runFrameTimer = 0;
    state.obstacles = [];
    state.dust = [];
    overlay.classList.add("is-hidden");
    requestAnimationFrame(loop);
  }

  function loop(time) {
    const dt = Math.min(0.033, Math.max(0, (time - state.lastTime) / 1000 || 0));
    state.lastTime = time;

    if (state.mode === "running") {
      update(dt);
    }

    draw(dt);
    if (state.mode === "running") {
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
    state.shake = Math.max(0, state.shake - dt * 18);
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    if (isGrounded()) {
      state.playerPulse += dt * 8;
      state.runFrameTimer += dt * (state.speed / 178);
      while (state.runFrameTimer >= 0.115) {
        state.runFrameTimer -= 0.115;
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
      spawnObstacle();
      const pressure = Math.min(0.34, state.distance / goalDistance * 0.22);
      state.spawnTimer = random(0.78, 1.22) - pressure;
    }

    for (const obstacle of state.obstacles) {
      obstacle.depth += dt * obstacle.speed;
      obstacle.wobble += dt;
      if (!obstacle.hit && obstacle.depth >= 0.83 && obstacle.depth <= 1.08 && obstacle.lane === state.targetLane) {
        const clear = obstacle.type === "puddle" ? state.jumpT > 0.16 : state.jumpT > 0.47;
        if (!clear) {
          hitObstacle(obstacle);
        }
      }
    }
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.depth < 1.22);

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
      }
    }

    for (const particle of state.dust) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 420 * dt;
    }
    state.dust = state.dust.filter((particle) => particle.life > 0);

    if (state.distance >= goalDistance) {
      finish(true);
      return;
    }

    if (state.elapsed >= gameSeconds) {
      finish(false);
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
      wobble: random(0, 10),
    });
  }

  function seedShowcaseObstacles() {
    state.obstacles = [
      { type: "yellowCat", lane: -1, depth: 0.45, speed: 0.46, hit: false, wobble: 0 },
      { type: "puddle", lane: 0, depth: 0.64, speed: 0.44, hit: false, wobble: 2 },
      { type: "blackCat", lane: 1, depth: 0.78, speed: 0.43, hit: false, wobble: 4 },
    ];
  }

  function hitObstacle(obstacle) {
    obstacle.hit = true;
    state.shake = obstacle.type === "puddle" ? 5 : 8;
    state.speed = Math.max(150, state.speed - (obstacle.type === "puddle" ? 36 : 48));
    state.distance = Math.max(0, state.distance - (obstacle.type === "puddle" ? 10 : 18));
    state.message = obstacle.type === "puddle" ? "첨벙!" : "길막!";
    state.messageTimer = 0.7;
    makeDust(playerScreenX(), playerBaseY - 20, obstacle.type === "puddle" ? 15 : 10);
  }

  function finish(success) {
    state.mode = "ended";
    const score = Math.min(goalDistance, state.distance);
    if (score > best) {
      best = score;
      localStorage.setItem("kokko-forward-best", String(Math.round(best)));
    }
    updateHud();

    resultKicker.textContent = success ? "SUCCESS" : "TIME UP";
    resultTitle.textContent = success ? "집에 도착!" : "조금 더!";
    resultMeta.textContent = `${Math.round(score)}m 이동`;
    startButton.textContent = "다시";
    overlay.classList.remove("is-hidden");
  }

  function draw(dt) {
    const sx = state.shake ? random(-state.shake, state.shake) : 0;
    const sy = state.shake ? random(-state.shake * 0.6, state.shake * 0.6) : 0;
    ctx.save();
    ctx.translate(sx, sy);
    drawSky();
    drawField();
    drawRoad();
    drawHome();
    drawTrackDetails();
    drawDepthSortedObjects();
    drawPlayer();
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
    ctx.fillRect(0, 250, W, H - 250);

    for (const flower of state.flowers) {
      const p = perspectivePoint(flower.lane * 1.28 + flower.side * 1.3, flower.depth);
      const scale = 0.3 + flower.depth * 0.9;
      drawFlower(p.x, p.y, scale, flower.color);
    }
  }

  function drawRoad() {
    ctx.fillStyle = "#d9b46d";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 78, horizonY + 16);
    ctx.lineTo(W / 2 + 78, horizonY + 16);
    ctx.lineTo(W + 104, H + 40);
    ctx.lineTo(-104, H + 40);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(126, 91, 45, 0.22)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 25, horizonY + 18);
    ctx.lineTo(W / 2 - 185, H + 20);
    ctx.moveTo(W / 2 + 25, horizonY + 18);
    ctx.lineTo(W / 2 + 185, H + 20);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 253, 229, 0.4)";
    ctx.lineWidth = 3;
    for (let d = ((state.distance / 70) % 1) - 0.15; d < 1.15; d += 0.18) {
      const y = horizonY + 22 + Math.pow(d, 1.7) * (H - horizonY + 20);
      const w = 42 + d * 340;
      ctx.beginPath();
      ctx.moveTo(W / 2 - w, y);
      ctx.lineTo(W / 2 + w, y);
      ctx.stroke();
    }
  }

  function drawHome() {
    const progress = state.distance / goalDistance;
    if (progress < 0.7) {
      return;
    }
    const d = (progress - 0.7) / 0.3;
    const scale = 0.35 + d * 0.55;
    const y = horizonY + 38 + d * 18;
    drawHouse(W / 2, y, scale);
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
    const objects = [...state.obstacles].sort((a, b) => a.depth - b.depth);
    for (const obstacle of objects) {
      if (obstacle.type === "puddle") {
        drawPuddle(obstacle);
      } else {
        drawCat(obstacle);
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
    const image = obstacle.type === "yellowCat" ? images.yellowCat : images.blackCat;
    const baseW = obstacle.type === "yellowCat" ? 78 : 84;
    const baseH = obstacle.type === "yellowCat" ? 104 : 118;
    const w = baseW * scale;
    const h = baseH * scale;
    const bob = Math.sin(obstacle.wobble * 5) * 3 * scale;

    ctx.save();
    ctx.globalAlpha = obstacle.hit ? 0.5 : 1;
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(Math.sin(obstacle.wobble * 2.2) * 0.03);
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, -w / 2, -h, w, h);
    } else {
      ctx.fillStyle = obstacle.type === "yellowCat" ? "#f6c85a" : "#222638";
      ctx.fillRect(-w / 2, -h, w, h);
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
    const y = horizonY + 24 + Math.pow(d, 1.58) * (playerBaseY - horizonY);
    const x = W / 2 + laneOffset(lane, d);
    return { x, y };
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
      state.flowers.push({
        lane: random(-1.8, 1.8),
        side: Math.random() > 0.5 ? 1 : -1,
        depth: random(0, 1),
        speed: random(0.7, 1.2),
        color: ["#fff6a9", "#f48ba8", "#ffcf4c", "#ffffff", "#ef6f58"][i % 5],
      });
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

  function random(min, max) {
    return min + Math.random() * (max - min);
  }
})();
