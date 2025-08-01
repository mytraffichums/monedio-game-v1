const API_KEY = "2GzxJfKu10qeIJcl0FsTY5AbhgXQj2ZgaXJhm6jHbK";
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

// Performance Stats Class
class PerformanceStats {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.frameStartTime = performance.now();
    this.frameTimes = [];
    this.maxSamples = 60; // Keep last 60 frame times
    this.lastFpsUpdate = 0;
    this.fps = 0;
    this.avgFrameTime = 0;
    this.minFrameTime = Infinity;
    this.maxFrameTime = 0;
    this.inputLatency = 0;
    this.lastInputTime = 0;

    // DOM elements
    this.fpsDisplay = document.getElementById("fpsDisplay");
    this.frameTimeDisplay = document.getElementById("frameTimeDisplay");
    this.avgFrameDisplay = document.getElementById("avgFrameDisplay");
    this.minMaxDisplay = document.getElementById("minMaxDisplay");
    this.latencyDisplay = document.getElementById("latencyDisplay");
  }

  startFrame() {
    this.frameStartTime = performance.now();
  }

  endFrame() {
    const now = performance.now();
    const frameTime = now - this.frameStartTime;

    // Add frame time to our sample array
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    // Update min/max
    this.minFrameTime = Math.min(this.minFrameTime, frameTime);
    this.maxFrameTime = Math.max(this.maxFrameTime, frameTime);

    this.frameCount++;

    // Update FPS and stats every 250ms
    if (now - this.lastFpsUpdate > 250) {
      this.updateStats(now);
      this.lastFpsUpdate = now;
    }
  }

  updateStats(now) {
    // Calculate FPS
    const timeDelta = now - this.lastTime;
    if (timeDelta > 0) {
      this.fps = Math.round((this.frameCount * 1000) / timeDelta);
    }

    // Calculate average frame time
    if (this.frameTimes.length > 0) {
      this.avgFrameTime =
        this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    }

    // Reset counters
    this.frameCount = 0;
    this.lastTime = now;

    // Update UI
    this.updateDisplay();
  }

  updateDisplay() {
    this.fpsDisplay.textContent = this.fps;
    this.frameTimeDisplay.textContent =
      this.frameTimes.length > 0
        ? this.frameTimes[this.frameTimes.length - 1].toFixed(1)
        : "--";
    this.avgFrameDisplay.textContent = this.avgFrameTime.toFixed(1);
    this.minMaxDisplay.textContent = `${
      this.minFrameTime === Infinity ? "--" : this.minFrameTime.toFixed(1)
    }/${this.maxFrameTime.toFixed(1)}`;
    this.latencyDisplay.textContent = this.inputLatency.toFixed(1);

    // Color code FPS based on performance
    if (this.fps >= 55) {
      this.fpsDisplay.style.color = "#4CAF50"; // Green
    } else if (this.fps >= 30) {
      this.fpsDisplay.style.color = "#FF9800"; // Orange
    } else {
      this.fpsDisplay.style.color = "#F44336"; // Red
    }
  }

  recordInputLatency() {
    this.lastInputTime = performance.now();
  }

  measureInputLatency() {
    if (this.lastInputTime > 0) {
      this.inputLatency = performance.now() - this.lastInputTime;
      this.lastInputTime = 0;
    }
  }

  reset() {
    this.minFrameTime = Infinity;
    this.maxFrameTime = 0;
    this.frameTimes = [];
  }
}

// Game Model - handles all game logic and state
class MopeGameModel extends Multisynq.Model {
  init() {
    // Game state
    this.players = new Map();
    this.food = new Map();
    this.islands = new Map();
    this.nextFoodId = 0;
    this.nextIslandId = 0;

    // Round state
    this.currentRound = 1;
    this.roundDuration = 1 * 60 * 1000; // 4 minutes in milliseconds
    this.roundStartTime = this.now();
    this.roundEndTime = this.roundStartTime + this.roundDuration;
    this.isRoundActive = true;
    this.roundScores = new Map();
    this.showingScores = false;
    this.scoreDisplayDuration = 10 * 1000; // Show scores for 10 seconds
    this.sessionTopScore = null; // Track session-wide top scorer

    // Blockchain submission state
    this.blockchainSubmissionStatus = null; // null, 'pending', 'success', 'error'
    this.blockchainSubmissionData = null;
    this.shouldFetchBlockchainScores = false;
    this.shouldPublishRoundUpdate = false;

    // Global throttling
    this.lastGlobalGameStateUpdate = 0;

    // Chat state
    this.messages = [];
    this.maxMessages = 100; // Keep last 100 messages

    // Leaderboard state - track fruit consumption per player
    this.playerFruitCounts = new Map(); // playerId -> fruit count

    // Subscribe to player events
    this.subscribe(this.sessionId, "playerJoin", this.handlePlayerJoin);
    this.subscribe(this.sessionId, "playerMove", this.handlePlayerMove);
    this.subscribe(this.sessionId, "playerLeave", this.handlePlayerLeave);
    this.subscribe(this.sessionId, "foodEaten", this.handleFoodEaten);
    this.subscribe(this.sessionId, "orbSelection", this.handleOrbSelection);

    // Subscribe to chat events
    this.subscribe(this.sessionId, "sendMessage", this.handleMessage);
    this.subscribe(this.sessionId, "view-join", this.handleUserJoin);
    this.subscribe(this.sessionId, "view-exit", this.handleUserLeave);

    // Spawn initial food and islands
    this.spawnFood(50);
    this.spawnIslands(4); // Add 4 islands to start

    // Start food spawning loop
    this.future(1000).spawnFoodLoop();

    // Start server-side movement update loop
    this.future(50).updateServerMovement();

    // Start round timer loop
    this.future(1000).roundTimerLoop();

    // Periodic broadcast removed - game states sent on events only

    // Initialize empty leaderboard
    this.publishLeaderboard();

    console.log("Game model initialized");
  }

  handlePlayerJoin(data) {
    const playerId = data.playerId;
    this.players.set(playerId, {
      id: playerId,
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      targetX: Math.random() * WORLD_WIDTH,
      targetY: Math.random() * WORLD_HEIGHT,
      size: 30,
      color: this.getRandomColor(),
      selectedSkin: data.selectedSkin || "orb1", // Default orb skin
    });

    // Initialize fruit count for new player
    this.playerFruitCounts.set(playerId, 0);

    console.log("Player joined:", playerId);
    this.publishGameStateThrottled();
    this.publishLeaderboard();
  }

  handlePlayerMove(data) {
    const player = this.players.get(data.playerId);
    if (player) {
      // Use client's predicted position if reasonable, otherwise interpolate
      if (data.x && data.y) {
        const dx = data.x - player.x;
        const dy = data.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If client position is reasonable, use it
        if (distance < 100) {
          player.x = data.x;
          player.y = data.y;
        }
      }

      // Store target for server-side movement
      player.targetX = data.targetX;
      player.targetY = data.targetY;

      // Keep player in bounds
      player.x = Math.max(
        player.size,
        Math.min(WORLD_WIDTH - player.size, player.x)
      );
      player.y = Math.max(
        player.size,
        Math.min(WORLD_HEIGHT - player.size, player.y)
      );

      // Check food collisions
      this.checkFoodCollisions(player);
    }

    // Use global throttled update
    this.publishGameStateThrottled();
  }

  handlePlayerLeave(data) {
    this.players.delete(data.playerId);
    // Keep fruit count for rejoining players, so don't delete from playerFruitCounts
    this.publishGameStateThrottled();
    this.publishLeaderboard();
  }

  handleOrbSelection(data) {
    const player = this.players.get(data.playerId);
    if (player) {
      player.selectedSkin = data.selectedSkin;
      console.log("Player", data.playerId, "selected orb:", data.selectedSkin);
      this.publishGameStateThrottled();
    }
  }

  // Chat handlers
  handleMessage(data) {
    const { userId, text } = data;

    // Validate message
    if (!text || text.trim().length === 0) return;
    if (text.length > 200) return; // Length limit

    // Create player nickname from player ID (last 4 characters)
    const nickname = userId.slice(-4);

    const message = {
      id: this.generateMessageId(),
      userId,
      nickname,
      text: text.trim(),
      timestamp: this.now(),
    };

    // Add to message history
    this.messages.push(message);

    // Trim old messages if needed
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    // Broadcast to all users
    this.publish(this.sessionId, "newMessage", message);
  }

  handleUserJoin(viewId) {
    // Send recent messages to new user
    const recentMessages = this.messages.slice(-20); // Last 20 messages
    this.publish(viewId, "messageHistory", recentMessages);

    // Announce user joined
    const nickname = viewId.slice(-4);
    this.publish(this.sessionId, "userJoined", {
      userId: viewId,
      nickname: nickname,
    });
  }

  handleUserLeave(viewId) {
    // Announce user left
    const nickname = viewId.slice(-4);
    this.publish(this.sessionId, "userLeft", {
      userId: viewId,
      nickname: nickname,
    });
  }

  generateMessageId() {
    return `msg_${this.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  publishLeaderboard() {
    // Get top 3 players by fruit count
    const leaderboardData = [];

    for (let [playerId, fruitCount] of this.playerFruitCounts.entries()) {
      // Only include players who are currently in the game
      if (this.players.has(playerId)) {
        leaderboardData.push({
          playerId: playerId,
          fruitCount: fruitCount,
        });
      }
    }

    // Sort by fruit count (descending)
    leaderboardData.sort((a, b) => b.fruitCount - a.fruitCount);

    // Take top 3
    const topPlayers = leaderboardData.slice(0, 3);

    // Publish to all players
    this.publish(this.sessionId, "leaderboardUpdate", topPlayers);
  }

  handleFoodEaten(data) {
    const foodId = data.foodId;
    const playerId = data.playerId;
    const player = this.players.get(playerId);

    // Verify the food still exists and player is close enough and big enough
    if (player && this.food.has(foodId)) {
      const food = this.food.get(foodId);
      const dx = player.x - food.x;
      const dy = player.y - food.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Double-check collision on server side - distance AND size requirement
      if (distance < player.size + food.size && player.size >= food.size) {
        this.food.delete(foodId);
        player.size += 1;

        // Increment fruit count for leaderboard
        const currentCount = this.playerFruitCounts.get(playerId) || 0;
        this.playerFruitCounts.set(playerId, currentCount + 1);

        // Spawn new food to replace eaten one
        this.spawnFood(1);
        console.log(
          "Food eaten by player:",
          playerId,
          "Food ID:",
          foodId,
          "Player size:",
          player.size,
          "Food size:",
          food.size
        );

        // Send immediate update for food consumption
        this.publishGameStateThrottled();
        this.publishLeaderboard();
      } else if (distance < player.size + food.size) {
        console.log(
          "Player too small to eat food:",
          playerId,
          "Player size:",
          player.size,
          "Food size:",
          food.size
        );
      }
    }
  }

  checkFoodCollisions(player) {
    for (let [foodId, food] of this.food.entries()) {
      const dx = player.x - food.x;
      const dy = player.y - food.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if player is close enough AND big enough to eat the logo
      if (distance < player.size + food.size && player.size >= food.size) {
        // Player eats food
        this.food.delete(foodId);
        player.size += 1;

        // Increment fruit count for leaderboard
        const currentCount = this.playerFruitCounts.get(player.id) || 0;
        this.playerFruitCounts.set(player.id, currentCount + 1);

        // Spawn new food to replace eaten one
        this.spawnFood(1);

        // Update leaderboard
        this.publishLeaderboard();
        break;
      }
    }
  }

  spawnFood(count) {
    for (let i = 0; i < count; i++) {
      const foodId = this.nextFoodId++;
      this.food.set(foodId, {
        id: foodId,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        size: 12 + Math.random() * 40, // Varied sizes between 12-52 (doubled)
        logoType: this.getRandomLogoType(),
        angle: Math.random() * Math.PI * 2, // Random starting angle
        rotationSpeed: 0.01 + Math.random() * 0.03, // Random rotation speed
        rotationDirection: Math.random() > 0.5 ? 1 : -1, // Random direction
      });
    }
  }

  spawnIslands(count) {
    for (let i = 0; i < count; i++) {
      const islandId = this.nextIslandId++;
      this.islands.set(islandId, {
        id: islandId,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        size: 50 + Math.random() * 60, // Bigger sizes between 50-110
        islandType: this.getRandomIslandType(), // Random island SVG
      });
    }
  }

  spawnFoodLoop() {
    // Maintain food count
    if (this.food.size < 40) {
      this.spawnFood(5);
      this.publishGameStateThrottled();
    }

    // Schedule next spawn
    this.future(2000).spawnFoodLoop();
  }

  updateServerMovement() {
    // Update all players' positions on server-side
    for (let [playerId, player] of this.players.entries()) {
      if (player.targetX !== undefined && player.targetY !== undefined) {
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 2) {
          const moveSpeed = Math.max(1, 5 - player.size * 0.1);
          player.x += (dx / distance) * moveSpeed * 0.5; // Slower server movement
          player.y += (dy / distance) * moveSpeed * 0.5;

          // Keep player in bounds
          player.x = Math.max(
            player.size,
            Math.min(WORLD_WIDTH - player.size, player.x)
          );
          player.y = Math.max(
            player.size,
            Math.min(WORLD_HEIGHT - player.size, player.y)
          );

          // Check island collisions on server side
          this.checkServerIslandCollisions(player);
        }
      }
    }

    // Update food rotation angles
    for (let [foodId, food] of this.food.entries()) {
      if (
        food.angle !== undefined &&
        food.rotationSpeed &&
        food.rotationDirection
      ) {
        food.angle += food.rotationSpeed * food.rotationDirection;
      }
    }

    // Schedule next update
    this.future(50).updateServerMovement(); // 20Hz server updates
  }

  roundTimerLoop() {
    const now = this.now();

    if (this.isRoundActive) {
      // Check if round should end
      if (now >= this.roundEndTime) {
        this.endRound();
      }
    } else if (this.showingScores) {
      // Check if score display should end and start new round
      if (now >= this.scoreEndTime) {
        this.startNewRound();
      }
    }

    // Check for blockchain submission status updates
    this.checkBlockchainSubmissionStatus();

    // Check if we need to fetch blockchain scores
    if (this.shouldFetchBlockchainScores) {
      this.shouldFetchBlockchainScores = false;
      this.fetchBlockchainScores();
    }

    // Check if we need to publish round update after blockchain score fetch
    if (this.shouldPublishRoundUpdate) {
      this.shouldPublishRoundUpdate = false;
      this.publishRoundUpdate();
    }

    // Continue the timer loop
    this.future(1000).roundTimerLoop();
  }

  endRound() {
    console.log("Round", this.currentRound, "ended");
    this.isRoundActive = false;
    this.showingScores = true;
    this.scoreEndTime = this.now() + this.scoreDisplayDuration;

    // Calculate and store final scores
    this.roundScores.clear();
    for (let [playerId, player] of this.players.entries()) {
      this.roundScores.set(playerId, {
        playerId: playerId,
        score: Math.floor(player.size),
        color: player.color,
      });
    }

    // Submit scores to blockchain backend
    this.submitScoresToBlockchain();

    // Broadcast round end with scores
    this.publishRoundUpdate();
  }

  submitScoresToBlockchain() {
    // Only submit if there are scores to submit
    if (this.roundScores.size === 0) {
      console.log("No scores to submit");
      return;
    }

    const scoreData = {
      sessionId: this.sessionId,
      roundNumber: this.currentRound,
      scores: Array.from(this.roundScores.values()).map((score) => ({
        playerId: score.playerId,
        score: score.score,
      })),
    };

    console.log("Submitting scores to blockchain:", scoreData);

    // Set status to pending and immediately broadcast
    this.blockchainSubmissionStatus = "pending";
    this.publish(this.sessionId, "blockchainSubmission", {
      success: null, // null indicates in progress
      message: "Submitting scores to blockchain...",
    });

    // Submit to backend
    const backendUrl = "starlit-cobbler-aa77d6.netlify.app";

    fetch(`${backendUrl}/api/submit-scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(scoreData),
    })
      .then((response) => {
        console.log("Blockchain submission response status:", response.status);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then((result) => {
        console.log("Scores successfully submitted to blockchain:", result);

        if (result.success) {
          // Store success data for the model to publish later
          console.log("Setting blockchain status to success...");
          this.blockchainSubmissionStatus = "success";
          this.blockchainSubmissionData = {
            transactionHash: result.transactionHash,
            blockNumber: result.blockNumber,
          };
        } else {
          console.log("Backend returned success=false:", result);
          this.blockchainSubmissionStatus = "error";
          this.blockchainSubmissionData = {
            error: result.error,
          };
        }
      })
      .catch((error) => {
        console.error("Error submitting scores to blockchain:", error);
        this.blockchainSubmissionStatus = "error";
        this.blockchainSubmissionData = {
          error: error.message,
        };
      });
  }

  fetchBlockchainScores() {
    const backendUrl = "starlit-cobbler-aa77d6.netlify.app";
    const url = `${backendUrl}/api/get-scores?sessionId=${encodeURIComponent(
      this.sessionId
    )}&roundNumber=${this.currentRound}`;

    console.log("Fetching blockchain scores:", url);

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          console.error("Error fetching blockchain scores:", data.error);
          // Keep local scores if blockchain fetch fails
          return;
        }

        console.log("Received blockchain scores:", data);

        // Replace local scores with blockchain scores
        this.roundScores.clear();

        data.roundScores.forEach((score) => {
          // Try to match with existing local player to preserve color, or use default
          const existingPlayer = Array.from(this.players.values()).find(
            (p) => p.id === score.playerId
          );
          const playerColor = existingPlayer
            ? existingPlayer.color
            : this.getRandomColor();

          this.roundScores.set(score.playerId, {
            playerId: score.playerId,
            score: score.score,
            color: playerColor,
            timestamp: score.timestamp,
          });
        });

        // Store session top score for display
        this.sessionTopScore = data.sessionTopScore;

        console.log(
          "Updated scores from blockchain. Session top score:",
          this.sessionTopScore
        );

        // Flag to publish round update on next poll
        this.shouldPublishRoundUpdate = true;
      })
      .catch((error) => {
        console.error("Error fetching blockchain scores:", error);
        // Keep local scores if blockchain fetch fails
      });
  }

  startNewRound() {
    console.log("Starting round", this.currentRound + 1);
    this.currentRound++;
    this.roundStartTime = this.now();
    this.roundEndTime = this.roundStartTime + this.roundDuration;
    this.isRoundActive = true;
    this.showingScores = false;
    this.roundScores.clear();

    // Reset fruit counts for new round
    this.playerFruitCounts.clear();
    for (let playerId of this.players.keys()) {
      this.playerFruitCounts.set(playerId, 0);
    }

    // Reset all players to starting size and random positions
    for (let [playerId, player] of this.players.entries()) {
      player.size = 30;
      player.x = Math.random() * WORLD_WIDTH;
      player.y = Math.random() * WORLD_HEIGHT;
      player.targetX = player.x;
      player.targetY = player.y;
    }

    // Clear and respawn food
    this.food.clear();
    this.nextFoodId = 0;
    this.spawnFood(50);

    // Broadcast new round start
    this.publishRoundUpdate();
    this.publishLeaderboard();
  }

  publishRoundUpdate() {
    const roundState = this.getRoundState();
    this.publish(this.sessionId, "roundUpdate", roundState);
    // Also send game state update
    this.publishGameStateThrottled();
  }

  getRoundState() {
    const now = this.now();
    const timeRemaining = this.isRoundActive
      ? Math.max(0, this.roundEndTime - now)
      : 0;

    return {
      currentRound: this.currentRound,
      timeRemaining: timeRemaining,
      isRoundActive: this.isRoundActive,
      showingScores: this.showingScores,
      scores: Array.from(this.roundScores.values()).sort(
        (a, b) => b.score - a.score
      ),
      sessionTopScore: this.sessionTopScore,
    };
  }

  checkServerIslandCollisions(player) {
    // Server-side island collision detection
    for (let [islandId, island] of this.islands.entries()) {
      const dx = player.x - island.x;
      const dy = player.y - island.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = player.size + island.size;

      if (distance < minDistance) {
        // Push player out of island
        const overlap = minDistance - distance;
        const nx = distance > 0 ? dx / distance : 1;
        const ny = distance > 0 ? dy / distance : 0;

        player.x += nx * overlap;
        player.y += ny * overlap;

        // Keep player in bounds after collision adjustment
        player.x = Math.max(
          player.size,
          Math.min(WORLD_WIDTH - player.size, player.x)
        );
        player.y = Math.max(
          player.size,
          Math.min(WORLD_HEIGHT - player.size, player.y)
        );
      }
    }
  }

  publishGameStateThrottled() {
    const now = this.now();
    if (now - this.lastGlobalGameStateUpdate > 200) {
      // Max 5 updates per second globally
      this.lastGlobalGameStateUpdate = now;
      this.publish(this.sessionId, "gameStateUpdate", this.getGameState());
    }
  }

  getGameState() {
    return {
      players: Array.from(this.players.values()),
      food: Array.from(this.food.values()),
      islands: Array.from(this.islands.values()),
      round: this.getRoundState(),
    };
  }

  getRandomColor() {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FCEA2B",
      "#FF9FF3",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getRandomLogoType() {
    const protocols = [
      "apriori",
      "monad",
      "monda",
      "multisynq",
      "rarebet",
      "uniswap",
    ];
    return protocols[Math.floor(Math.random() * protocols.length)];
  }

  getRandomIslandType() {
    const islands = ["island1", "island2", "island3", "island4", "island5"];
    return islands[Math.floor(Math.random() * islands.length)];
  }

  checkBlockchainSubmissionStatus() {
    if (this.blockchainSubmissionStatus === "pending") {
      // Still waiting, keep the pending status
      return;
    } else if (
      this.blockchainSubmissionStatus === "success" &&
      this.blockchainSubmissionData
    ) {
      // Publish success status
      this.publish(this.sessionId, "blockchainSubmission", {
        success: true,
        message: "Scores saved to blockchain!",
        transactionHash: this.blockchainSubmissionData.transactionHash,
        blockNumber: this.blockchainSubmissionData.blockNumber,
      });

      // Clear the status after publishing
      this.blockchainSubmissionStatus = null;
      this.blockchainSubmissionData = null;

      // Flag to fetch blockchain scores on next poll
      this.shouldFetchBlockchainScores = true;
    } else if (
      this.blockchainSubmissionStatus === "error" &&
      this.blockchainSubmissionData
    ) {
      // Publish error status
      this.publish(this.sessionId, "blockchainSubmission", {
        success: false,
        message: "Failed to submit scores",
        error: this.blockchainSubmissionData.error,
      });

      // Clear the status after publishing
      this.blockchainSubmissionStatus = null;
      this.blockchainSubmissionData = null;
    }
  }
}

// Game View - handles rendering and input
class MopeGameView extends Multisynq.View {
  constructor(model) {
    super(model);

    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.playerId =
      this.sessionId + "_" + Math.random().toString(36).substr(2, 9);

    // Set canvas size
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Load protocol logos
    this.protocolLogos = {};
    this.protocolTypes = [
      "apriori",
      "monad",
      "monda",
      "multisynq",
      "rarebet",
      "uniswap",
    ];
    this.loadLogos();

    // Load island SVGs
    this.islandLogos = {};
    this.islandCanvases = {}; // Pre-rendered canvas cache
    this.islandTypes = ["island1", "island2", "island3", "island4", "island5"];
    this.loadIslandLogos();

    // Load orb SVGs
    this.orbLogos = {};
    this.orbCanvases = {}; // Pre-rendered canvas cache for orbs
    this.orbTypes = ["orb1", "orb2", "orb3", "orb4"];
    this.loadOrbLogos();

    // Game state
    this.gameState = { players: [], food: [], islands: [] };
    this.roundState = {
      currentRound: 1,
      timeRemaining: 4 * 60 * 1000,
      isRoundActive: true,
      showingScores: false,
      scores: [],
    };
    this.camera = { x: 0, y: 0 };
    this.mousePos = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };

    // Cursor movement tracking for drift behavior
    this.lastMousePos = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    this.lastMouseMoveTime = Date.now();
    this.cursorStillThreshold = 100; // ms - time before entering drift mode
    this.isDrifting = false;

    // Local food state for client-side prediction
    this.localFoodState = new Map(); // Track which food items are locally "eaten"
    this.predictedEatenFood = new Set(); // Food IDs that we predict are eaten

    // Initialize performance stats
    this.perfStats = new PerformanceStats();

    // Countdown timer tracking
    this.countdownTimer = null;
    this.isCountdownRunning = false;

    // Client-side prediction state
    this.localPlayer = {
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      size: 30,
      color: "#FF6B6B",
      selectedSkin: "orb1", // Default orb skin
      targetX: 0,
      targetY: 0,
      vx: 0, // velocity x
      vy: 0, // velocity y
    };

    // Orb selection state
    this.orbSelectionVisible = false;
    this.orbCountdownTimer = null;

    // Network sync timing
    this.lastNetworkSync = 0;
    this.networkSyncInterval = 100; // Send position every 100ms (10Hz)

    // Subscribe to game updates
    this.subscribe(this.sessionId, "gameStateUpdate", (state) =>
      this.updateGameState(state)
    );

    // Subscribe to round updates
    this.subscribe(this.sessionId, "roundUpdate", (roundState) =>
      this.updateRoundState(roundState)
    );

    // Subscribe to blockchain submission updates
    this.subscribe(this.sessionId, "blockchainSubmission", (status) =>
      this.updateBlockchainStatus(status)
    );

    // Subscribe to chat events
    this.subscribe(this.sessionId, "newMessage", (message) =>
      this.displayMessage(message)
    );
    this.subscribe(this.sessionId, "messageHistory", (messages) =>
      this.loadMessageHistory(messages)
    );
    this.subscribe(this.sessionId, "userJoined", (data) =>
      this.announceUserJoined(data)
    );
    this.subscribe(this.sessionId, "userLeft", (data) =>
      this.announceUserLeft(data)
    );

    // Subscribe to leaderboard updates
    this.subscribe(this.sessionId, "leaderboardUpdate", (topPlayers) =>
      this.updateLeaderboard(topPlayers)
    );

    // Setup input
    this.setupInput();

    // Setup chat
    this.setupChat();

    // Setup leaderboard
    this.setupLeaderboard();

    // Start render loop - using requestAnimationFrame for smooth 60fps
    this.startRenderLoop();

    // Start network sync loop - separate from rendering
    this.startNetworkLoop();

    // Join the game
    this.publish(this.sessionId, "playerJoin", {
      playerId: this.playerId,
      selectedSkin: this.localPlayer.selectedSkin,
    });

    // Ensure proper sizing on initialization
    this.handleResize();

    // Show orb selection for the first round after a brief delay
    setTimeout(() => {
      this.showFirstRoundOrbSelection();
    }, 1000); // Give time for assets to load

    console.log("Game view initialized, player ID:", this.playerId);
  }

  loadLogos() {
    this.protocolTypes.forEach((protocol) => {
      const img = new Image();
      img.onload = () => {
        console.log(
          `Loaded ${protocol} logo (${
            Object.keys(this.protocolLogos).filter(
              (k) =>
                this.protocolLogos[k].complete &&
                this.protocolLogos[k].naturalWidth > 0
            ).length
          }/${this.protocolTypes.length})`
        );
      };
      img.onerror = () => {
        console.log(`Failed to load ${protocol} logo`);
        // Mark as failed so we don't try to draw it
        this.protocolLogos[protocol] = null;
      };
      img.src = `assets/logos/defi/${protocol}.svg`;
      this.protocolLogos[protocol] = img;
    });
  }

  loadIslandLogos() {
    this.islandTypes.forEach((islandType) => {
      const img = new Image();
      img.onload = () => {
        // Pre-render SVG to canvas for better performance
        this.preRenderIslandCanvas(islandType, img);
        console.log(
          `Loaded ${islandType} island (${
            Object.keys(this.islandLogos).filter(
              (k) =>
                this.islandLogos[k].complete &&
                this.islandLogos[k].naturalWidth > 0
            ).length
          }/${this.islandTypes.length})`
        );
      };
      img.onerror = () => {
        console.log(`Failed to load ${islandType} island`);
        // Mark as failed so we don't try to draw it
        this.islandLogos[islandType] = null;
        this.islandCanvases[islandType] = null;
      };
      img.src = `assets/islands/${islandType}.svg`;
      this.islandLogos[islandType] = img;
    });
  }

  preRenderIslandCanvas(islandType, img) {
    // Create off-screen canvas for this island type
    const maxSize = 220; // Max island size (110 radius * 2)
    const canvas = document.createElement("canvas");
    canvas.width = maxSize;
    canvas.height = maxSize;
    const ctx = canvas.getContext("2d");

    // Draw SVG to canvas at maximum size
    ctx.drawImage(img, 0, 0, maxSize, maxSize);

    // Cache the pre-rendered canvas
    this.islandCanvases[islandType] = canvas;
    console.log(`Pre-rendered ${islandType} to canvas for performance`);
  }

  loadOrbLogos() {
    this.orbTypes.forEach((orbType) => {
      const img = new Image();
      img.onload = () => {
        // Pre-render SVG to canvas for better performance
        this.preRenderOrbCanvas(orbType, img);
        console.log(
          `Loaded ${orbType} orb (${
            Object.keys(this.orbLogos).filter(
              (k) =>
                this.orbLogos[k].complete && this.orbLogos[k].naturalWidth > 0
            ).length
          }/${this.orbTypes.length})`
        );
      };
      img.onerror = () => {
        console.log(`Failed to load ${orbType} orb`);
        // Mark as failed so we don't try to draw it
        this.orbLogos[orbType] = null;
        this.orbCanvases[orbType] = null;
      };
      img.src = `assets/orbs/${orbType}.svg`;
      this.orbLogos[orbType] = img;
    });
  }

  preRenderOrbCanvas(orbType, img) {
    // Create off-screen canvas for this orb type
    const maxSize = 200; // Max player size * 2 for safety
    const canvas = document.createElement("canvas");
    canvas.width = maxSize;
    canvas.height = maxSize;
    const ctx = canvas.getContext("2d");

    // Draw SVG to canvas at maximum size
    ctx.drawImage(img, 0, 0, maxSize, maxSize);

    // Cache the pre-rendered canvas
    this.orbCanvases[orbType] = canvas;
    console.log(`Pre-rendered ${orbType} orb to canvas for performance`);
  }

  handleResize() {
    // Update canvas dimensions
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Recalculate camera position to keep player centered (adjusted for zoom)
    const zoomScale = 1.12;
    const effectiveWidth = window.innerWidth / zoomScale;
    const effectiveHeight = window.innerHeight / zoomScale;

    this.camera.x = this.localPlayer.x - effectiveWidth / 2;
    this.camera.y = this.localPlayer.y - effectiveHeight / 2;
    this.camera.x = Math.max(
      0,
      Math.min(WORLD_WIDTH - effectiveWidth, this.camera.x)
    );
    this.camera.y = Math.max(
      0,
      Math.min(WORLD_HEIGHT - effectiveHeight, this.camera.y)
    );

    console.log("Game resized to:", window.innerWidth, "x", window.innerHeight);
  }

  setupInput() {
    // Pointer lock state
    this.isPointerLocked = false;

    // Click to request pointer lock
    this.canvas.addEventListener("click", () => {
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    // Also allow clicking the instruction button directly for better responsiveness
    const cursorInstruction = document.getElementById("cursorInstruction");
    cursorInstruction.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    // Handle pointer lock changes
    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      console.log(
        "Pointer lock:",
        this.isPointerLocked ? "enabled" : "disabled"
      );

      // Update instruction visibility
      const instruction = document.getElementById("cursorInstruction");
      if (this.isPointerLocked) {
        instruction.classList.add("hidden");
      } else {
        instruction.classList.remove("hidden");
      }
    });

    // Handle pointer lock errors
    document.addEventListener("pointerlockerror", () => {
      console.error("Pointer lock failed");
    });

    // Mouse movement - handle both locked and unlocked modes
    this.canvas.addEventListener("mousemove", (e) => {
      // Record input time for latency measurement
      this.perfStats.recordInputLatency();

      let newMouseX, newMouseY;

      if (this.isPointerLocked) {
        // In pointer lock mode, use relative movement
        newMouseX = this.mousePos.x + e.movementX;
        newMouseY = this.mousePos.y + e.movementY;

        // Keep mouse position within canvas bounds
        newMouseX = Math.max(0, Math.min(this.canvas.width, newMouseX));
        newMouseY = Math.max(0, Math.min(this.canvas.height, newMouseY));
      } else {
        // Normal mode - use absolute coordinates
        const rect = this.canvas.getBoundingClientRect();
        newMouseX = e.clientX - rect.left;
        newMouseY = e.clientY - rect.top;
      }

      // Check if cursor actually moved
      if (newMouseX !== this.mousePos.x || newMouseY !== this.mousePos.y) {
        this.lastMousePos.x = this.mousePos.x;
        this.lastMousePos.y = this.mousePos.y;
        this.mousePos.x = newMouseX;
        this.mousePos.y = newMouseY;
        this.lastMouseMoveTime = Date.now();
        this.isDrifting = false; // Exit drift mode when cursor moves
      }

      // Update local target immediately for responsiveness (adjusted for zoom)
      const zoomScale = 1.12;
      this.localPlayer.targetX = this.mousePos.x / zoomScale + this.camera.x;
      this.localPlayer.targetY = this.mousePos.y / zoomScale + this.camera.y;
    });

    // Handle escape key to exit pointer lock
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isPointerLocked) {
        document.exitPointerLock();
      }
    });

    // Handle window resize
    let resizeTimeout;
    window.addEventListener("resize", () => {
      // Debounce resize events to prevent excessive updates
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 100); // Wait 100ms after last resize event
    });
  }

  startRenderLoop() {
    const renderFrame = () => {
      this.updateLocalPlayer(); // Update local player position
      this.render(); // Render everything
      requestAnimationFrame(renderFrame);
    };
    renderFrame();
  }

  startNetworkLoop() {
    setInterval(() => {
      this.sendNetworkUpdate();
    }, this.networkSyncInterval);
  }

  updateLocalPlayer() {
    // Check if cursor has been still long enough to enter drift mode
    const now = Date.now();
    const cursorStillTime = now - this.lastMouseMoveTime;
    const shouldDrift = cursorStillTime > this.cursorStillThreshold;

    // Update drift state
    if (shouldDrift && !this.isDrifting) {
      this.isDrifting = true;
      console.log("Entering drift mode");
    } else if (!shouldDrift && this.isDrifting) {
      this.isDrifting = false;
      console.log("Exiting drift mode");
    }

    // Movement parameters
    const maxSpeed = Math.max(3, 8 - this.localPlayer.size * 0.1);
    const acceleration = 0.3; // How quickly we accelerate toward target
    const normalFriction = 0.92; // Normal friction when near cursor
    const driftFriction = 0.995; // Much less friction when drifting (loses only 0.5% per frame)
    const minDriftSpeed = 0.8; // Minimum speed when drifting

    if (this.isDrifting) {
      // Drift mode - maintain momentum, apply minimal friction
      this.localPlayer.vx *= driftFriction;
      this.localPlayer.vy *= driftFriction;

      // Maintain minimum drift speed
      const currentSpeed = Math.sqrt(
        this.localPlayer.vx * this.localPlayer.vx +
          this.localPlayer.vy * this.localPlayer.vy
      );
      if (currentSpeed > 0 && currentSpeed < minDriftSpeed) {
        const scale = minDriftSpeed / currentSpeed;
        this.localPlayer.vx *= scale;
        this.localPlayer.vy *= scale;
      }
    } else {
      // Normal mode - move toward cursor
      const dx = this.localPlayer.targetX - this.localPlayer.x;
      const dy = this.localPlayer.targetY - this.localPlayer.y;
      const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

      if (distanceToTarget > 2) {
        // Accelerate toward target
        const targetVx = (dx / distanceToTarget) * maxSpeed;
        const targetVy = (dy / distanceToTarget) * maxSpeed;

        // Apply acceleration toward target direction
        this.localPlayer.vx += (targetVx - this.localPlayer.vx) * acceleration;
        this.localPlayer.vy += (targetVy - this.localPlayer.vy) * acceleration;
      } else {
        // Apply normal friction when close to target
        this.localPlayer.vx *= normalFriction;
        this.localPlayer.vy *= normalFriction;
      }
    }

    // Update position based on velocity
    this.localPlayer.x += this.localPlayer.vx;
    this.localPlayer.y += this.localPlayer.vy;

    // Keep player in bounds
    this.localPlayer.x = Math.max(
      this.localPlayer.size,
      Math.min(WORLD_WIDTH - this.localPlayer.size, this.localPlayer.x)
    );
    this.localPlayer.y = Math.max(
      this.localPlayer.size,
      Math.min(WORLD_HEIGHT - this.localPlayer.size, this.localPlayer.y)
    );

    // Apply velocity damping when hitting boundaries
    if (
      this.localPlayer.x <= this.localPlayer.size ||
      this.localPlayer.x >= WORLD_WIDTH - this.localPlayer.size
    ) {
      this.localPlayer.vx *= -0.3; // Bounce with reduced velocity
    }
    if (
      this.localPlayer.y <= this.localPlayer.size ||
      this.localPlayer.y >= WORLD_HEIGHT - this.localPlayer.size
    ) {
      this.localPlayer.vy *= -0.3; // Bounce with reduced velocity
    }

    // Client-side food collision detection for immediate feedback
    this.checkLocalFoodCollisions();

    // Check island collisions and handle bouncing
    this.checkIslandCollisions();

    // Update camera to follow local player (adjusted for zoom)
    const zoomScale = 1.12;
    const effectiveWidth = window.innerWidth / zoomScale;
    const effectiveHeight = window.innerHeight / zoomScale;

    this.camera.x = this.localPlayer.x - effectiveWidth / 2;
    this.camera.y = this.localPlayer.y - effectiveHeight / 2;
    this.camera.x = Math.max(
      0,
      Math.min(WORLD_WIDTH - effectiveWidth, this.camera.x)
    );
    this.camera.y = Math.max(
      0,
      Math.min(WORLD_HEIGHT - effectiveHeight, this.camera.y)
    );
  }

  checkLocalFoodCollisions() {
    // Check collisions with food items that aren't already predicted as eaten
    this.gameState.food.forEach((food) => {
      if (!this.predictedEatenFood.has(food.id)) {
        const dx = this.localPlayer.x - food.x;
        const dy = this.localPlayer.y - food.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if player is close enough AND big enough to eat the logo
        if (
          distance < this.localPlayer.size + food.size &&
          this.localPlayer.size >= food.size
        ) {
          // Predict food is eaten - hide it immediately
          this.predictedEatenFood.add(food.id);

          // Predict size increase
          this.localPlayer.size += 1;

          // Call fake viem contract
          if (window.eatFood) {
            window.eatFood();
          }

          // Send food eaten event to server
          this.publish(this.sessionId, "foodEaten", {
            playerId: this.playerId,
            foodId: food.id,
            playerX: this.localPlayer.x,
            playerY: this.localPlayer.y,
          });

          console.log("Food eaten locally:", food.id);
        }
      }
    });
  }

  checkIslandCollisions() {
    // Check collisions with islands and apply bounce physics
    this.gameState.islands.forEach((island) => {
      const dx = this.localPlayer.x - island.x;
      const dy = this.localPlayer.y - island.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = this.localPlayer.size + island.size;

      if (distance < minDistance) {
        // Collision detected - calculate bounce
        const overlap = minDistance - distance;

        // Normalize the collision vector
        const nx = distance > 0 ? dx / distance : 1;
        const ny = distance > 0 ? dy / distance : 0;

        // Move player out of collision
        this.localPlayer.x += nx * overlap;
        this.localPlayer.y += ny * overlap;

        // Apply bounce to velocity
        const bounceStrength = 0.8;
        const velocityAlongNormal =
          this.localPlayer.vx * nx + this.localPlayer.vy * ny;

        // Only bounce if moving toward the island
        if (velocityAlongNormal < 0) {
          this.localPlayer.vx -=
            velocityAlongNormal * nx * (1 + bounceStrength);
          this.localPlayer.vy -=
            velocityAlongNormal * ny * (1 + bounceStrength);
        }

        // Add some friction to the bounce
        this.localPlayer.vx *= 0.7;
        this.localPlayer.vy *= 0.7;
      }
    });
  }

  sendNetworkUpdate() {
    // Only send network updates periodically, not on every frame
    const now = Date.now();
    if (now - this.lastNetworkSync >= this.networkSyncInterval) {
      this.lastNetworkSync = now;

      // Send current position and target to server
      this.publish(this.sessionId, "playerMove", {
        playerId: this.playerId,
        x: this.localPlayer.x,
        y: this.localPlayer.y,
        targetX: this.localPlayer.targetX,
        targetY: this.localPlayer.targetY,
      });
    }
  }

  updateGameState(state) {
    // Reconcile food predictions with server state
    const serverFoodIds = new Set(state.food.map((f) => f.id));

    // Check our predictions against server reality
    for (let predictedFoodId of this.predictedEatenFood) {
      if (serverFoodIds.has(predictedFoodId)) {
        // Server still has this food - our prediction was wrong, remove from predicted set
        this.predictedEatenFood.delete(predictedFoodId);
        console.log(
          "Food prediction corrected - food still exists:",
          predictedFoodId
        );
      }
      // If server doesn't have the food, our prediction was correct - keep it in the set
    }

    // Update other players with server data
    this.gameState = state;

    // Update round state if included
    if (state.round) {
      this.updateRoundState(state.round);
    }

    // Find our player in server data and reconcile if needed
    const serverPlayer = state.players.find((p) => p.id === this.playerId);
    if (serverPlayer) {
      // Simple reconciliation - if too far from server, adjust
      const dx = serverPlayer.x - this.localPlayer.x;
      const dy = serverPlayer.y - this.localPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 50) {
        // If too far from server position, snap back
        this.localPlayer.x = serverPlayer.x;
        this.localPlayer.y = serverPlayer.y;
      }

      // Always sync size from server (authoritative for food consumption)
      this.localPlayer.size = serverPlayer.size;
      this.localPlayer.color = serverPlayer.color;

      // Update UI
      document.getElementById("sizeDisplay").textContent = Math.floor(
        serverPlayer.size
      );
    }

    document.getElementById("playersCount").textContent = state.players.length;
  }

  updateRoundState(roundState) {
    const previousRound = this.roundState.currentRound;
    this.roundState = roundState;

    // Check if a new round started
    if (roundState.currentRound > previousRound && roundState.isRoundActive) {
      // New round started - reset local player state
      this.localPlayer.size = 30;
      this.localPlayer.x = Math.random() * WORLD_WIDTH;
      this.localPlayer.y = Math.random() * WORLD_HEIGHT;
      this.localPlayer.targetX = this.localPlayer.x;
      this.localPlayer.targetY = this.localPlayer.y;
      this.localPlayer.vx = 0;
      this.localPlayer.vy = 0;

      // Reset predicted food state
      this.predictedEatenFood.clear();

      console.log("Client reset for new round:", roundState.currentRound);
    }

    // Update round UI
    document.getElementById("roundDisplay").textContent =
      roundState.currentRound;

    // Update timer display
    const minutes = Math.floor(roundState.timeRemaining / 60000);
    const seconds = Math.floor((roundState.timeRemaining % 60000) / 1000);
    document.getElementById("timeDisplay").textContent = `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;

    // Show/hide score overlay
    const scoreOverlay = document.getElementById("scoreOverlay");
    if (roundState.showingScores) {
      this.showScoreBoard(roundState.scores);
      scoreOverlay.style.display = "flex";
    } else {
      scoreOverlay.style.display = "none";
      // Reset countdown when hiding scores (new round started)
      this.isCountdownRunning = false;
      if (this.countdownTimer) {
        clearTimeout(this.countdownTimer);
        this.countdownTimer = null;
      }
    }
  }

  showScoreBoard(scores) {
    const scoreList = document.getElementById("scoreList");
    scoreList.innerHTML = "";

    scores.forEach((score, index) => {
      const scoreItem = document.createElement("div");
      scoreItem.className = "score-item";

      const rank = index + 1;
      const medal =
        rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;

      scoreItem.innerHTML = `
              <div class="player-info">
                ${medal}
                <div class="player-color" style="background-color: ${
                  score.color
                }"></div>
                <span>${score.playerId.slice(-4)}</span>
              </div>
              <div class="score-value">${score.score}</div>
            `;

      scoreList.appendChild(scoreItem);
    });

    // Display session top score if available
    this.displaySessionTopScore();

    // Start countdown timer for next round (only if not already running)
    if (!this.isCountdownRunning) {
      this.startCountdownTimer();
    }
  }

  displaySessionTopScore() {
    const sessionTopScoreDiv = document.getElementById("sessionTopScore");
    const topPlayerName = document.getElementById("topPlayerName");
    const topPlayerDetails = document.getElementById("topPlayerDetails");

    // Check if we have session top score data from the round state
    const sessionTopScore = this.roundState.sessionTopScore;

    if (sessionTopScore) {
      sessionTopScoreDiv.style.display = "block";
      topPlayerName.textContent = sessionTopScore.playerId.slice(-4);
      topPlayerDetails.textContent = `Total: ${sessionTopScore.totalScore} points across ${sessionTopScore.roundCount} rounds`;
    } else {
      sessionTopScoreDiv.style.display = "none";
    }
  }

  startCountdownTimer() {
    // Clear any existing countdown timer
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
    }

    this.isCountdownRunning = true;
    const countdownElement = document.getElementById("countdownTimer");
    let countdown = 10;

    // Show orb selection modal during countdown
    this.showOrbSelectionModal();

    const updateCountdown = () => {
      countdownElement.textContent = countdown;
      // Also update orb selection countdown if visible
      if (this.orbSelectionVisible) {
        document.getElementById("orbCountdownTimer").textContent = countdown;
      }
      countdown--;

      if (countdown >= 0) {
        this.countdownTimer = setTimeout(updateCountdown, 1000);
      } else {
        // Countdown finished
        this.isCountdownRunning = false;
        this.countdownTimer = null;
        // Hide orb selection modal
        this.hideOrbSelectionModal();
      }
    };

    updateCountdown();
  }

  showOrbSelectionModal() {
    if (this.orbSelectionVisible) return; // Already showing

    this.orbSelectionVisible = true;
    const overlay = document.getElementById("orbSelectionOverlay");
    const optionsContainer = document.getElementById("orbOptions");

    // Reset modal text for between-rounds selection
    document.querySelector("#orbSelectionModal h2").textContent =
      "Choose Your Orb";
    document.querySelector("#orbSelectionModal p").textContent =
      "Click any orb to continue to next round";
    document.getElementById("orbCountdown").innerHTML =
      'Auto-continues in <span id="orbCountdownTimer">10</span> seconds';

    // Clear existing options
    optionsContainer.innerHTML = "";

    // Create orb options
    this.orbTypes.forEach((orbType) => {
      const option = document.createElement("div");
      option.className = "orb-option";
      option.dataset.orbType = orbType;

      if (orbType === this.localPlayer.selectedSkin) {
        option.classList.add("selected");
      }

      // Create preview element
      const preview = document.createElement("div");
      preview.className = "orb-preview";

      // Try to show actual orb or fallback
      const orbCanvas = this.orbCanvases[orbType];
      if (orbCanvas) {
        const previewCanvas = document.createElement("canvas");
        previewCanvas.width = 225;
        previewCanvas.height = 225;
        const ctx = previewCanvas.getContext("2d");
        ctx.drawImage(orbCanvas, 0, 0, 225, 225);
        preview.appendChild(previewCanvas);
      } else {
        // Fallback colored circle
        preview.style.backgroundColor = "#ddd";
        preview.style.border = "2px solid #999";
      }

      // Create name element
      const name = document.createElement("div");
      name.className = "orb-name";

      // Custom orb names
      const orbNames = {
        orb1: "Chog",
        orb2: "Molandek",
        orb3: "Salmonad",
        orb4: "Keonegg",
      };
      name.textContent =
        orbNames[orbType] || `Orb ${orbType.charAt(orbType.length - 1)}`;

      option.appendChild(preview);
      option.appendChild(name);

      // Add click handler
      option.addEventListener("click", () => {
        this.selectOrb(orbType);
      });

      optionsContainer.appendChild(option);
    });

    // Show the modal
    overlay.style.display = "flex";
  }

  hideOrbSelectionModal() {
    this.orbSelectionVisible = false;
    const overlay = document.getElementById("orbSelectionOverlay");
    overlay.style.display = "none";

    // Clear any countdown timer if player selected early
    if (this.orbCountdownTimer) {
      clearTimeout(this.orbCountdownTimer);
      this.orbCountdownTimer = null;
    }
  }

  selectOrb(orbType) {
    // Update local player skin
    this.localPlayer.selectedSkin = orbType;

    // Update UI selection
    document.querySelectorAll(".orb-option").forEach((option) => {
      option.classList.remove("selected");
    });
    document
      .querySelector(`[data-orb-type="${orbType}"]`)
      .classList.add("selected");

    // Send selection to server for sync with other players
    this.publish(this.sessionId, "orbSelection", {
      playerId: this.playerId,
      selectedSkin: orbType,
    });

    console.log("Selected orb:", orbType);

    // Immediately hide the modal - player can continue playing
    this.hideOrbSelectionModal();
  }

  showFirstRoundOrbSelection() {
    // Only show if we haven't started any other orb selection
    if (this.orbSelectionVisible || this.isCountdownRunning) return;

    // Show orb selection modal for the first round
    this.orbSelectionVisible = true;
    const overlay = document.getElementById("orbSelectionOverlay");
    const optionsContainer = document.getElementById("orbOptions");

    // Update the modal text for first round
    document.querySelector("#orbSelectionModal h2").textContent =
      "Choose Your Orb";
    document.querySelector("#orbSelectionModal p").textContent =
      "Select your orb skin to start playing";

    // Clear existing options
    optionsContainer.innerHTML = "";

    // Create orb options
    this.orbTypes.forEach((orbType) => {
      const option = document.createElement("div");
      option.className = "orb-option";
      option.dataset.orbType = orbType;

      if (orbType === this.localPlayer.selectedSkin) {
        option.classList.add("selected");
      }

      // Create preview element
      const preview = document.createElement("div");
      preview.className = "orb-preview";

      // Try to show actual orb or fallback
      const orbCanvas = this.orbCanvases[orbType];
      if (orbCanvas) {
        const previewCanvas = document.createElement("canvas");
        previewCanvas.width = 225;
        previewCanvas.height = 225;
        const ctx = previewCanvas.getContext("2d");
        ctx.drawImage(orbCanvas, 0, 0, 225, 225);
        preview.appendChild(previewCanvas);
      } else {
        // Fallback colored circle
        preview.style.backgroundColor = "#ddd";
        preview.style.border = "2px solid #999";
      }

      // Create name element
      const name = document.createElement("div");
      name.className = "orb-name";

      // Custom orb names
      const orbNames = {
        orb1: "Chog",
        orb2: "Molandek",
        orb3: "Salmonad",
        orb4: "Keonegg",
      };
      name.textContent =
        orbNames[orbType] || `Orb ${orbType.charAt(orbType.length - 1)}`;

      option.appendChild(preview);
      option.appendChild(name);

      // Add click handler
      option.addEventListener("click", () => {
        this.selectOrb(orbType);
        // Modal will be hidden immediately by selectOrb()
      });

      optionsContainer.appendChild(option);
    });

    // Update countdown text for first round (no time pressure)
    document.getElementById("orbCountdown").innerHTML =
      "Click any orb to start playing!";

    // Show the modal
    overlay.style.display = "flex";
  }

  updateBlockchainStatus(status) {
    console.log("updateBlockchainStatus called with:", status);
    const messageElement = document.getElementById("blockchainMessage");
    const detailsElement = document.getElementById("transactionDetails");
    const txHashElement = document.getElementById("txHash");
    const blockNumberElement = document.getElementById("blockNumber");

    // Reset classes
    messageElement.classList.remove("success", "error", "pending");

    if (status.success === null) {
      // In progress
      messageElement.textContent =
        status.message || "⏳ Submitting scores to blockchain...";
      messageElement.classList.add("pending");
      detailsElement.style.display = "none";
    } else if (status.success === true) {
      messageElement.textContent = "✅ Scores saved to blockchain!";
      messageElement.classList.add("success");

      // Show transaction details
      if (status.transactionHash) {
        const shortHash = `${status.transactionHash.slice(
          0,
          8
        )}...${status.transactionHash.slice(-6)}`;
        txHashElement.innerHTML = `<a href="https://testnet.monadscan.com/tx/${status.transactionHash}" target="_blank">${shortHash}</a>`;
      }

      if (status.blockNumber) {
        blockNumberElement.textContent = status.blockNumber.toString();
      }

      detailsElement.style.display = "block";
    } else {
      messageElement.textContent = "❌ Failed to submit scores";
      messageElement.classList.add("error");
      detailsElement.style.display = "none";

      if (status.error) {
        console.error("Blockchain submission error:", status.error);
      }
    }
  }

  // Chat methods
  setupChat() {
    this.chatInput = document.getElementById("chatInput");
    this.chatSendButton = document.getElementById("chatSendButton");
    this.chatMessages = document.getElementById("chatMessages");

    // Setup event listeners
    this.chatSendButton.addEventListener("click", () => this.sendMessage());
    this.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  sendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.publish(this.sessionId, "sendMessage", {
      userId: this.playerId,
      text,
    });

    this.chatInput.value = "";
    this.chatInput.focus();
  }

  displayMessage(message) {
    const messageElement = this.createMessageElement(message);
    this.chatMessages.appendChild(messageElement);
    this.scrollChatToBottom();
  }

  createMessageElement(message) {
    const div = document.createElement("div");
    div.className = "chat-message";
    if (message.userId === this.playerId) {
      div.classList.add("own-message");
    }

    const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    div.innerHTML = `
            <span class="nickname">${this.escapeHtml(message.nickname)}:</span>
            <span class="timestamp">${time}</span><br>
            ${this.escapeHtml(message.text)}
          `;

    return div;
  }

  loadMessageHistory(messages) {
    this.chatMessages.innerHTML = "";
    messages.forEach((message) => {
      const messageElement = this.createMessageElement(message);
      this.chatMessages.appendChild(messageElement);
    });
    this.scrollChatToBottom();
  }

  announceUserJoined(data) {
    const div = document.createElement("div");
    div.className = "system-message";
    div.textContent = `${data.nickname} joined the game`;
    this.chatMessages.appendChild(div);
    this.scrollChatToBottom();
  }

  announceUserLeft(data) {
    const div = document.createElement("div");
    div.className = "system-message";
    div.textContent = `${data.nickname} left the game`;
    this.chatMessages.appendChild(div);
    this.scrollChatToBottom();
  }

  scrollChatToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Leaderboard methods
  setupLeaderboard() {
    this.leaderboardEntries = document.getElementById("leaderboardEntries");
  }

  updateLeaderboard(topPlayers) {
    // Clear existing entries
    this.leaderboardEntries.innerHTML = "";

    if (topPlayers.length === 0) {
      // Show empty state
      const emptyEntry = document.createElement("div");
      emptyEntry.className = "leaderboard-entry";
      emptyEntry.innerHTML = `
              <span class="leaderboard-rank">-</span>
              <span class="leaderboard-player">No players</span>
              <span class="leaderboard-score">-</span>
            `;
      this.leaderboardEntries.appendChild(emptyEntry);
      return;
    }

    // Add top players
    topPlayers.forEach((player, index) => {
      const rank = index + 1;
      const entry = document.createElement("div");
      entry.className = `leaderboard-entry rank-${rank}`;

      const rankDisplay = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
      const playerName = player.playerId.slice(-4);

      entry.innerHTML = `
              <span class="leaderboard-rank">${rankDisplay}</span>
              <span class="leaderboard-player">${playerName}</span>
              <span class="leaderboard-score">${player.fruitCount}</span>
            `;

      this.leaderboardEntries.appendChild(entry);
    });
  }

  render() {
    // Start performance measurement
    this.perfStats.startFrame();

    // Measure input latency
    this.perfStats.measureInputLatency();

    // Clear canvas with starry night gradient
    const gradient = this.ctx.createLinearGradient(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );
    gradient.addColorStop(0, "#1e3a4a");
    gradient.addColorStop(0.5, "#2c4f63");
    gradient.addColorStop(1, "#1a3b4d");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Save context for camera transform and zoom
    this.ctx.save();
    this.ctx.scale(1.12, 1.12); // 12% zoom in
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Draw food (protocol logos)
    this.gameState.food.forEach((food) => {
      // Skip food that we predict has been eaten
      if (!this.predictedEatenFood.has(food.id)) {
        const logo = this.protocolLogos[food.logoType];
        if (logo && logo.complete && logo.naturalWidth > 0) {
          // Draw logo centered at food position with rotation
          // Logo size can now be larger than players, with reasonable maximum
          const logoSize = Math.min(food.size * 1.5, 50); // Max size of 50 for bigger variety

          this.ctx.save();
          this.ctx.translate(food.x, food.y);
          this.ctx.rotate(food.angle || 0);
          this.ctx.drawImage(
            logo,
            -logoSize / 2,
            -logoSize / 2,
            logoSize,
            logoSize
          );
          this.ctx.restore();
        } else {
          // Fallback to circle if logo not loaded or failed
          this.ctx.fillStyle = "#FF6B6B";
          this.ctx.beginPath();
          this.ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    });

    // Draw islands with pre-rendered canvases for better performance
    this.gameState.islands.forEach((island) => {
      const islandCanvas = this.islandCanvases[island.islandType];
      if (islandCanvas) {
        // Draw from pre-rendered canvas (much faster than SVG)
        this.ctx.save();
        this.ctx.translate(island.x, island.y);
        this.ctx.drawImage(
          islandCanvas,
          -island.size,
          -island.size,
          island.size * 2,
          island.size * 2
        );
        this.ctx.restore();
      } else {
        // Fallback to black circle if island canvas not ready or failed
        this.ctx.fillStyle = "#2F4F2F";
        this.ctx.beginPath();
        this.ctx.arc(island.x, island.y, island.size, 0, Math.PI * 2);
        this.ctx.fill();

        // Island outline only for fallback circles
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    });

    // Draw other players (from server data)
    this.gameState.players.forEach((player) => {
      if (player.id !== this.playerId) {
        // Don't draw our own player from server data
        this.drawPlayerOrb(
          player.x,
          player.y,
          player.size,
          player.selectedSkin || "orb1",
          false,
          player.id
        );
      }
    });

    // Draw our own player from local prediction (most responsive)
    this.drawPlayerOrb(
      this.localPlayer.x,
      this.localPlayer.y,
      this.localPlayer.size,
      this.localPlayer.selectedSkin,
      true, // highlight our own player
      this.playerId
    );

    // Restore context
    this.ctx.restore();

    // Draw grid for reference (optional)
    this.drawGrid();

    // End performance measurement
    this.perfStats.endFrame();
  }

  drawPlayerOrb(
    x,
    y,
    size,
    selectedSkin,
    isOwnPlayer = false,
    playerId = null
  ) {
    const orbCanvas = this.orbCanvases[selectedSkin];
    if (orbCanvas) {
      // Draw from pre-rendered orb canvas
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.drawImage(orbCanvas, -size, -size, size * 2, size * 2);
      this.ctx.restore();
    } else {
      // Fallback to colored circle if orb not loaded
      this.ctx.fillStyle = isOwnPlayer ? this.localPlayer.color : "#4ECDC4";
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();

      // Add highlighting for own player
      if (isOwnPlayer) {
        this.ctx.strokeStyle = "#FFF";
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      }

      // Draw outline
      this.ctx.strokeStyle = "#000";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Draw player ID under the orb
    if (playerId) {
      const playerName = playerId.slice(-4);
      this.ctx.save();

      // Set text properties
      this.ctx.fillStyle = isOwnPlayer ? "#FFD700" : "#FFFFFF";
      this.ctx.strokeStyle = "#000000";
      this.ctx.lineWidth = 2;
      this.ctx.font = "bold 12px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "top";

      // Draw text with outline for better visibility
      const textY = y + size + 5;
      this.ctx.strokeText(playerName, x, textY);
      this.ctx.fillText(playerName, x, textY);

      this.ctx.restore();
    }
  }

  drawGrid() {
    this.ctx.strokeStyle = "rgba(0,0,0,0.1)";
    this.ctx.lineWidth = 1;

    const gridSize = 100;
    const zoomScale = 1.12;
    const effectiveWidth = window.innerWidth / zoomScale;
    const effectiveHeight = window.innerHeight / zoomScale;
    const startX = -(this.camera.x % gridSize);
    const startY = -(this.camera.y % gridSize);

    for (let x = startX; x < effectiveWidth; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, effectiveHeight);
      this.ctx.stroke();
    }

    for (let y = startY; y < effectiveWidth; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(effectiveWidth, y);
      this.ctx.stroke();
    }
  }
}

// Start the game
MopeGameModel.register("MopeGameModel");
Multisynq.Session.join({
  apiKey: API_KEY,
  appId: "com.mopeio.clone",
  model: MopeGameModel,
  view: MopeGameView,
  name: Multisynq.App.autoSession(),
  password: Multisynq.App.autoPassword(),
})
  .then((session) => {
    console.log("Joined game session:", session.id);

    // Debug: Log all available Multisynq.App methods
    console.log("Available Multisynq.App methods:", Object.keys(Multisynq.App));
    console.log("Full Multisynq.App object:", Multisynq.App);

    // Wait for session to be established, then create widget
    setTimeout(() => {
      console.log("Attempting to create widget dock...");

      try {
        // Try the standard widget dock first
        Multisynq.App.makeWidgetDock();
        console.log("makeWidgetDock() completed");

        // Also try QR-specific methods
        setTimeout(() => {
          try {
            console.log("Trying makeQRCanvas...");
            if (typeof Multisynq.App.makeQRCanvas === "function") {
              Multisynq.App.makeQRCanvas();
              console.log("makeQRCanvas() completed");
            }

            console.log("Trying qrcode method...");
            if (typeof Multisynq.App.qrcode === "function") {
              const qrResult = Multisynq.App.qrcode();
              console.log("qrcode() result:", qrResult);
            }

            console.log("Trying makeSessionWidgets...");
            if (typeof Multisynq.App.makeSessionWidgets === "function") {
              Multisynq.App.makeSessionWidgets();
              console.log("makeSessionWidgets() completed");
            }
          } catch (qrError) {
            console.error("QR method error:", qrError);
          }
        }, 500);

        // Check if widget was actually created
        setTimeout(() => {
          const bodyChildren = Array.from(document.body.children);
          console.log(
            "All body children after widget creation:",
            bodyChildren.map((el) => ({
              tagName: el.tagName,
              id: el.id,
              className: el.className,
              style: el.style.cssText,
              innerHTML:
                el.innerHTML.substring(0, 100) +
                (el.innerHTML.length > 100 ? "..." : ""),
            }))
          );

          // Look specifically for canvas elements (QR codes are often canvas)
          const canvases = document.querySelectorAll("canvas");
          console.log("Canvas elements found:", canvases.length);
          canvases.forEach((canvas, i) => {
            console.log(`Canvas ${i}:`, {
              width: canvas.width,
              height: canvas.height,
              style: canvas.style.cssText,
              parent: canvas.parentElement,
            });
          });
        }, 2000);
      } catch (error) {
        console.error("makeWidgetDock error:", error);
      }
    }, 3000);
  })
  .catch((error) => {
    console.error("Failed to join session:", error);
  });
