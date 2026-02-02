/*
Credit:
---COMPLETE UI BOOK STYLES PACK LICENSE---
By Crusenho Agus Hennihuno - https://crusenho.itch.io/complete-ui-book-styles-pack
*/

// ======================================================================== //
// ============================== CONSTANTS =============================== //
// ======================================================================== //

const WORLD_ROW_COUNT = 27;
const WORLD_COLUMN_COUNT = 48;
const TILE_SIZE = 32;
const WORLD_SIZE_X = WORLD_COLUMN_COUNT * TILE_SIZE;
const WORLD_SIZE_Y = WORLD_ROW_COUNT * TILE_SIZE;

const UI_BANNER_HEIGHT = 200;
const UI_BUTTON_SIZE = 80;
const UI_BUTTON_PADDING = 20;
const UI_BUTTON_START_X = 50;
const UI_RESOURCE_SIZE = 40;
const UI_RESOURCE_LINE_HEIGHT = 50;

const INCOME_INTERVAL = 2000; // Generate income every 2 seconds

const TILE_TYPE = {
  BASE:          0,
  BORDER:        1,
  GRASS_1:       2,
  GRASS_2:       3,
  FOREST:        4,
  WATER:         5,
  MOUNTAIN:      6,
  MOUNTAIN_GOLD: 7
};

const RESOURCES = {
  WOOD:  "wood",
  STONE: "stone",
  GOLD:  "gold"
};

// Building definitions - acts as a template/factory
const BUILDING_TYPES = {
  LOGGER: {
    id:   "logger",
    name: "Logger",
    image: null,
    cost: { [RESOURCES.WOOD]: 25, [RESOURCES.STONE]: 0, [RESOURCES.GOLD]: 50 },
    income: { [RESOURCES.WOOD]: 2 },
    canBePlacedOn: (tile) => tile.type === TILE_TYPE.GRASS_1 || tile.type === TILE_TYPE.GRASS_2
  },

  STONE_MINE: {
    id: "stone_mine",
    name: "Stone Mine",
    image: null,
    cost: { [RESOURCES.WOOD]: 75, [RESOURCES.STONE]: 50, [RESOURCES.GOLD]: 150 },
    income: { [RESOURCES.STONE]: 3 },
    canBePlacedOn: (tile) => tile.type === TILE_TYPE.MOUNTAIN
  },

  GOLD_MINE: {
    id: "gold_mine",
    name: "Gold Mine",
    image: null,
    cost: { [RESOURCES.WOOD]: 50, [RESOURCES.STONE]: 100, [RESOURCES.GOLD]: 200 },
    income: { [RESOURCES.GOLD]: 5 },
    canBePlacedOn: (tile) => tile.type === TILE_TYPE.MOUNTAIN_GOLD
  }
};

// ======================================================================== //
// =============================== CLASSES ================================ //
// ======================================================================== //

class Layer {
  constructor(name, width, height, applyCamera = true) {
    this.name = name;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.context = this.canvas.getContext("2d");
    this.context.imageSmoothingEnabled = false;
    this.applyCamera = applyCamera;
    this.clear();
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(boardContext, camera) {
    if (this.applyCamera) {
      boardContext.save();
      boardContext.translate(boardContext.canvas.width / 2, boardContext.canvas.height / 2);
      boardContext.scale(camera.zoom, camera.zoom);
      boardContext.translate(-camera.x, -camera.y);
      boardContext.drawImage(this.canvas, 0, 0);
      boardContext.restore();
    } else {
      boardContext.drawImage(this.canvas, 0, 0);
    }
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.imageSmoothingEnabled = false;
    this.clear();
  }
}

class Tile {
  constructor(col, row, type, image) {
    this.col = col;
    this.row = row;
    this.type = type;
    this.image = image;
    this.building = null;
  }

  get x() { return this.col * TILE_SIZE; }
  get y() { return this.row * TILE_SIZE; }
  get width() { return TILE_SIZE; }
  get height() { return TILE_SIZE; }

  canPlaceBuilding(buildingType) {
    return this.building === null && buildingType.canBePlacedOn(this);
  }

  placeBuilding(buildingType) {
    if (this.canPlaceBuilding(buildingType)) {
      this.building = new Building(buildingType, this);
      return true;
    }
    return false;
  }

  removeBuilding() {
    if (this.building) {
      this.building = null;
      return true;
    }
    return false;
  }
}

class Building {
  constructor(type, tile) {
    this.type = type;
    this.tile = tile;
  }

  get image() { return this.type.image; }
  get width() { return TILE_SIZE; }
  get height() { return TILE_SIZE; }
  get income() { return this.type.income; }
}

class UIButton {
  constructor(x, y, buildingType) {
    this.x = x;
    this.y = y;
    this.width = UI_BUTTON_SIZE;
    this.height = UI_BUTTON_SIZE;
    this.buildingType = buildingType;
    this.isHovered = false;
    this.isSelected = false;
  }

  contains(x, y) {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height;
  }

  canAfford(resources) {
    for (let resource in this.buildingType.cost) {
      if (resources[resource] < this.buildingType.cost[resource]) {
        return false;
      }
    }
    return true;
  }

  draw(ctx, resources) {
    const canAfford = this.canAfford(resources);

    // Background
    ctx.fillStyle = this.isSelected ? "#4a90e2" : 
                    (!canAfford ? "#222" : (this.isHovered ? "#555" : "#333"));
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Border
    ctx.strokeStyle = this.isSelected ? "#fff" : (!canAfford ? "#444" : "#777");
    ctx.lineWidth = this.isSelected ? 3 : 2;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Building icon
    if (this.buildingType.image && this.buildingType.image.complete) {
      const padding = 10;
      ctx.globalAlpha = canAfford ? 1.0 : 0.4;
      ctx.drawImage(
        this.buildingType.image,
        this.x + padding,
        this.y + padding,
        this.width - padding * 2,
        this.height - padding * 2
      );
      ctx.globalAlpha = 1.0;
    }

    // Cost display (compact format)
    this.drawCosts(ctx, resources);
  }

  drawCosts(ctx, resources) {
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    
    let yOffset = this.y + this.height - 28;
    const xStart = this.x + 5;
    
    const costDisplay = [
      { resource: RESOURCES.WOOD, label: "W", color: "#8B4513" },
      { resource: RESOURCES.STONE, label: "S", color: "#808080" },
      { resource: RESOURCES.GOLD, label: "G", color: "#FFD700" }
    ];

    for (let { resource, label, color } of costDisplay) {
      const cost = this.buildingType.cost[resource];
      if (cost > 0) {
        ctx.fillStyle = resources[resource] >= cost ? color : "#ff4444";
        ctx.fillText(`${label}:${cost}`, xStart, yOffset);
        yOffset += 12;
      }
    }
  }
}

// ======================================================================== //
// ============================== MANAGERS ================================ //
// ======================================================================== //

class ResourceManager {
  constructor() {
    this.resources = {
      [RESOURCES.WOOD]: 100,
      [RESOURCES.STONE]: 100,
      [RESOURCES.GOLD]: 500
    };
    this.lastIncomeTime = 0;
  }

  canAfford(costs) {
    for (let resource in costs) {
      if (this.resources[resource] < costs[resource]) {
        return false;
      }
    }
    return true;
  }

  deduct(costs) {
    for (let resource in costs) {
      this.resources[resource] -= costs[resource];
    }
  }

  add(resource, amount) {
    this.resources[resource] += amount;
  }

  generateIncome(timestamp, tiles) {
    if (!this.lastIncomeTime) {
      this.lastIncomeTime = timestamp;
      return;
    }

    if (timestamp - this.lastIncomeTime >= INCOME_INTERVAL) {
      const totalIncome = this.calculateTotalIncome(tiles);
      
      for (let resource in totalIncome) {
        if (totalIncome[resource] > 0) {
          this.resources[resource] += totalIncome[resource];
        }
      }

      this.lastIncomeTime = timestamp;
    }
  }

  calculateTotalIncome(tiles) {
    const income = {
      [RESOURCES.WOOD]: 0,
      [RESOURCES.STONE]: 0,
      [RESOURCES.GOLD]: 0
    };

    for (let row of tiles) {
      for (let tile of row) {
        if (tile.building && tile.building.income) {
          for (let resource in tile.building.income) {
            income[resource] += tile.building.income[resource];
          }
        }
      }
    }

    return income;
  }

  calculateIncomePerSecond(tiles) {
    const totalIncome = this.calculateTotalIncome(tiles);
    const intervalsPerSecond = 1000 / INCOME_INTERVAL;
    
    const incomePerSecond = {};
    for (let resource in totalIncome) {
      incomePerSecond[resource] = totalIncome[resource] * intervalsPerSecond;
    }
    
    return incomePerSecond;
  }
}

class Camera {
  constructor() {
    this.x = WORLD_SIZE_X / 2;
    this.y = WORLD_SIZE_Y / 2;
    this.targetX = this.x;
    this.targetY = this.y;
    this.zoom = 1;
    this.minZoom = 0.675;
    this.maxZoom = 5;
    this.speed = 20;
    this.smoothness = 0.1;
  }

  update(keysHeld) {
    // Update target based on keyboard input
    if (keysHeld.w || keysHeld.ArrowUp) this.targetY -= this.speed;
    if (keysHeld.s || keysHeld.ArrowDown) this.targetY += this.speed;
    if (keysHeld.a || keysHeld.ArrowLeft) this.targetX -= this.speed;
    if (keysHeld.d || keysHeld.ArrowRight) this.targetX += this.speed;

    // Smooth movement
    this.x = lerp(this.x, this.targetX, this.smoothness);
    this.y = lerp(this.y, this.targetY, this.smoothness);
  }

  clamp(boardWidth, boardHeight) {
    const halfWidth = boardWidth / 2 / this.zoom;
    const halfHeight = (boardHeight - UI_BANNER_HEIGHT) / 2 / this.zoom;
    const uiOffset = UI_BANNER_HEIGHT / this.zoom / 2;

    this.targetX = Math.max(halfWidth, Math.min(WORLD_SIZE_X - halfWidth, this.targetX));
    this.targetY = Math.max(halfHeight + uiOffset, Math.min(WORLD_SIZE_Y - halfHeight + uiOffset, this.targetY));
  }

  screenToWorld(screenX, screenY, boardWidth, boardHeight) {
    const centerX = boardWidth / 2;
    const centerY = boardHeight / 2;
    
    return {
      x: this.x + (screenX - centerX) / this.zoom,
      y: this.y + (screenY - centerY) / this.zoom
    };
  }

  adjustZoom(delta) {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom + delta));
  }

  pan(dx, dy) {
    this.targetX -= dx / this.zoom;
    this.targetY -= dy / this.zoom;
  }
}

class InputManager {
  constructor() {
    this.keysHeld = {
      w: false, a: false, s: false, d: false,
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
    };
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
  }

  handleKeyDown(e, onEscape) {
    if (this.keysHeld[e.key] !== undefined) {
      this.keysHeld[e.key] = true;
      e.preventDefault();
    }
    
    if (e.key === "Escape") {
      onEscape();
    }
  }

  handleKeyUp(e) {
    if (this.keysHeld[e.key] !== undefined) {
      this.keysHeld[e.key] = false;
      e.preventDefault();
    }
  }

  handleMouseDown(e, onRightClick) {
    if (e.button === 0) {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      e.preventDefault();
    } else if (e.button === 2) {
      onRightClick();
      e.preventDefault();
    }
  }

  handleMouseUp(e) {
    if (e.button === 0) {
      this.isDragging = false;
    }
  }

  handleMouseMove(e, canvas, onMove) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    onMove(mouseX, mouseY);

    if (this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return { dx, dy, dragging: true };
    }

    return { dx: 0, dy: 0, dragging: false };
  }
}

class WorldGenerator {
  constructor(seed = 42) {
    this.seed = seed === null ? (Math.random() * 2**32) >>> 0 : seed;
    this.prng = this.createPRNG(this.seed);
  }

  createPRNG(seed) {
    return function() {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  generate(tileImages) {
    const heightMap = this.generateHeightMap();
    return this.createTiles(heightMap, tileImages);
  }

  generateHeightMap() {
    let heightMap = Array(WORLD_ROW_COUNT).fill(null)
      .map(() => Array(WORLD_COLUMN_COUNT).fill(null).map(() => this.prng()));

    // Smooth the height map multiple times
    for (let i = 0; i < 4; i++) {
      heightMap = this.smoothHeightMap(heightMap);
    }
    
    return heightMap;
  }

  smoothHeightMap(map) {
    const copy = map.map(row => row.slice());

    for (let row = 1; row < WORLD_ROW_COUNT - 1; row++) {
      for (let col = 1; col < WORLD_COLUMN_COUNT - 1; col++) {
        // Don't smooth gold mountains (high values)
        if (copy[row][col] < 0.995) {
          let sum = 0;
          let count = 0;

          // Average with 8 neighbors
          for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
              sum += map[row + y][col + x];
              count++;
            }
          }
          copy[row][col] = sum / count;
        }
      }
    }
    return copy;
  }

  createTiles(heightMap, tileImages) {
    const tiles = [];
    
    for (let row = 0; row < WORLD_ROW_COUNT; row++) {
      tiles[row] = [];
      for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
        const tileType = this.getTileType(row, col, heightMap[row][col]);
        const image = tileImages[tileType] || tileImages[TILE_TYPE.BASE];
        tiles[row][col] = new Tile(col, row, tileType, image);
      }
    }
    
    return tiles;
  }

  getTileType(row, col, height) {
    // Border tiles
    if (row === 0 || row === WORLD_ROW_COUNT - 1 ||
        col === 0 || col === WORLD_COLUMN_COUNT - 1) {
      return TILE_TYPE.BORDER;
    }

    // Terrain based on height
    if (height < 0.44) return TILE_TYPE.WATER;
    if (height < 0.5) return TILE_TYPE.GRASS_1;
    if (height < 0.6) return TILE_TYPE.GRASS_2;
    if (height < 0.9) return TILE_TYPE.MOUNTAIN;
    return TILE_TYPE.MOUNTAIN_GOLD;
  }
}

class UIManager {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.buttons = [];
    this.selectedBuilding = null;
    this.icons = {
      banner: null,
      wood: null,
      stone: null,
      gold: null
    };
  }

  initializeButtons(boardHeight) {
    this.buttons = [];
    const bannerY = boardHeight - UI_BANNER_HEIGHT;
    const buttonY = bannerY + (UI_BANNER_HEIGHT - UI_BUTTON_SIZE) / 2;
    let buttonX = UI_BUTTON_START_X;

    // Create a button for each building type
    for (let buildingType of Object.values(BUILDING_TYPES)) {
      this.buttons.push(new UIButton(buttonX, buttonY, buildingType));
      buttonX += UI_BUTTON_SIZE + UI_BUTTON_PADDING;
    }
  }

  updateHovers(mouseX, mouseY) {
    for (let button of this.buttons) {
      button.isHovered = button.contains(mouseX, mouseY);
    }
  }

  handleClick(mouseX, mouseY) {
    for (let button of this.buttons) {
      if (button.contains(mouseX, mouseY)) {
        if (button.canAfford(this.resourceManager.resources)) {
          this.selectedBuilding = button.buildingType;
          this.updateSelection();
          console.log(`Selected: ${this.selectedBuilding.name}`);
        } else {
          console.log(`Cannot afford ${button.buildingType.name}!`);
        }
        return true;
      }
    }
    return false;
  }

  updateSelection() {
    for (let button of this.buttons) {
      button.isSelected = (button.buildingType === this.selectedBuilding);
    }
  }

  deselect() {
    this.selectedBuilding = null;
    this.updateSelection();
  }

  draw(ctx, boardHeight, tiles) {
    // Draw banner background
    if (this.icons.banner && this.icons.banner.complete) {
      ctx.drawImage(
        this.icons.banner,
        0,
        boardHeight - UI_BANNER_HEIGHT,
        ctx.canvas.width,
        UI_BANNER_HEIGHT
      );
    }

    // Draw buttons
    for (let button of this.buttons) {
      button.draw(ctx, this.resourceManager.resources);
    }

    // Draw resources
    this.drawResources(ctx, boardHeight, tiles);
  }

  drawResources(ctx, boardHeight, tiles) {
    const bannerY = boardHeight - UI_BANNER_HEIGHT;
    const startX = ctx.canvas.width - 200;
    const startY = bannerY + 30;
    
    const incomePerSecond = this.resourceManager.calculateIncomePerSecond(tiles);
    
    const resourceDisplay = [
      { type: RESOURCES.WOOD, icon: this.icons.wood, color: "#8B4513" },
      { type: RESOURCES.STONE, icon: this.icons.stone, color: "#808080" },
      { type: RESOURCES.GOLD, icon: this.icons.gold, color: "#FFD700" }
    ];

    resourceDisplay.forEach((res, index) => {
      const yPos = startY + index * UI_RESOURCE_LINE_HEIGHT;
      
      // Draw icon
      if (res.icon && res.icon.complete) {
        ctx.drawImage(res.icon, startX, yPos, UI_RESOURCE_SIZE, UI_RESOURCE_SIZE);
      }
      
      // Draw amount
      ctx.fillStyle = res.color;
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "left";
      ctx.fillText(
        this.resourceManager.resources[res.type],
        startX + UI_RESOURCE_SIZE + 8,
        yPos + 28
      );

      // Draw income per second
      if (incomePerSecond[res.type] > 0) {
        ctx.fillStyle = "#90EE90";
        ctx.font = "14px Arial";
        ctx.fillText(
          `+${incomePerSecond[res.type].toFixed(1)}/s`,
          startX + UI_RESOURCE_SIZE + 70,
          yPos + 28
        );
      }
    });
  }
}

// ======================================================================== //
// ============================ GAME MANAGER ============================== //
// ======================================================================== //

class Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.layers = {};
    this.tiles = [];
    this.tileImages = {};
    
    this.camera = new Camera();
    this.resourceManager = new ResourceManager();
    this.uiManager = new UIManager(this.resourceManager);
    this.inputManager = new InputManager();
    this.worldGenerator = new WorldGenerator(42);
    
    this.hoveredTile = null;
  }

  initialize() {
    // Setup canvas
    this.canvas = document.getElementById("board");
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    // Create layers
    this.layers.world = new Layer("world", WORLD_SIZE_X, WORLD_SIZE_Y, true);
    this.layers.buildings = new Layer("buildings", WORLD_SIZE_X, WORLD_SIZE_Y, true);
    this.layers.preview = new Layer("preview", WORLD_SIZE_X, WORLD_SIZE_Y, true);
    this.layers.ui = new Layer("ui", this.canvas.width, this.canvas.height, false);

    // Load assets and generate world
    this.loadImages();
    this.tiles = this.worldGenerator.generate(this.tileImages);
    
    // Setup UI
    this.resizeCanvas();
    
    // Setup input handlers
    this.setupInputHandlers();
    
    // Start game loop
    this.update();
  }

  setupInputHandlers() {
    document.addEventListener("keydown", (e) => 
      this.inputManager.handleKeyDown(e, () => this.uiManager.deselect())
    );
    
    document.addEventListener("keyup", (e) => 
      this.inputManager.handleKeyUp(e)
    );
    
    this.canvas.addEventListener("mousedown", (e) => 
      this.inputManager.handleMouseDown(e, () => this.uiManager.deselect())
    );
    
    document.addEventListener("mouseup", (e) => 
      this.inputManager.handleMouseUp(e)
    );
    
    this.canvas.addEventListener("mousemove", (e) => {
      const result = this.inputManager.handleMouseMove(e, this.canvas, (mx, my) => {
        this.uiManager.updateHovers(mx, my);
        const worldPos = this.camera.screenToWorld(mx, my, this.canvas.width, this.canvas.height);
        this.hoveredTile = this.getTileAt(worldPos.x, worldPos.y);
      });
      
      if (result.dragging) {
        this.camera.pan(result.dx, result.dy);
      }
    });
    
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.camera.adjustZoom(e.deltaY * -0.001);
    }, { passive: false });
    
    this.canvas.addEventListener("click", (e) => this.handleClick(e));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if UI button was clicked
    if (this.uiManager.handleClick(mouseX, mouseY)) {
      return;
    }

    // Try to place building
    if (this.uiManager.selectedBuilding) {
      const worldPos = this.camera.screenToWorld(mouseX, mouseY, this.canvas.width, this.canvas.height);
      const tile = this.getTileAt(worldPos.x, worldPos.y);
      this.tryPlaceBuilding(tile);
    }
  }

  tryPlaceBuilding(tile) {
    if (!tile || !this.uiManager.selectedBuilding) return;

    const building = this.uiManager.selectedBuilding;

    // Check affordability
    if (!this.resourceManager.canAfford(building.cost)) {
      console.log(`Not enough resources to build ${building.name}`);
      return;
    }

    // Try to place
    if (tile.placeBuilding(building)) {
      this.resourceManager.deduct(building.cost);
      console.log(`Placed ${building.name} at (${tile.col}, ${tile.row})`);
    } else {
      console.log(`Cannot place ${building.name} here`);
    }
  }

  getTileAt(worldX, worldY) {
    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);
    
    if (row >= 0 && row < WORLD_ROW_COUNT && col >= 0 && col < WORLD_COLUMN_COUNT) {
      return this.tiles[row][col];
    }
    
    return null;
  }

  update(timestamp = 0) {
    // Update game state
    this.camera.update(this.inputManager.keysHeld);
    this.camera.clamp(this.canvas.width, this.canvas.height);
    this.resourceManager.generateIncome(timestamp, this.tiles);

    // Render
    this.render();

    requestAnimationFrame((t) => this.update(t));
  }

  render() {
    this.drawWorldLayer();
    this.drawBuildingsLayer();
    this.drawPreviewLayer();
    this.drawUILayer();
    this.drawAllLayers();
  }

  drawWorldLayer() {
    const layer = this.layers.world;
    layer.clear();

    for (let row of this.tiles) {
      for (let tile of row) {
        if (tile.image && tile.image.complete) {
          layer.context.drawImage(tile.image, tile.x, tile.y, tile.width, tile.height);
        }
      }
    }
  }

  drawBuildingsLayer() {
    const layer = this.layers.buildings;
    layer.clear();

    for (let row of this.tiles) {
      for (let tile of row) {
        if (tile.building && tile.building.image && tile.building.image.complete) {
          layer.context.drawImage(
            tile.building.image,
            tile.x,
            tile.y,
            tile.building.width,
            tile.building.height
          );
        }
      }
    }
  }

  drawPreviewLayer() {
    const layer = this.layers.preview;
    layer.clear();

    if (this.uiManager.selectedBuilding && this.hoveredTile) {
      const canPlace = this.hoveredTile.canPlaceBuilding(this.uiManager.selectedBuilding);
      
      layer.context.globalAlpha = 0.6;
      
      // Draw building preview
      if (this.uiManager.selectedBuilding.image && this.uiManager.selectedBuilding.image.complete) {
        layer.context.drawImage(
          this.uiManager.selectedBuilding.image,
          this.hoveredTile.x,
          this.hoveredTile.y,
          TILE_SIZE,
          TILE_SIZE
        );
      }
      
      // Color overlay (green=valid, red=invalid)
      layer.context.fillStyle = canPlace ? "rgba(0, 255, 0, 0.3)" : "rgba(255, 0, 0, 0.3)";
      layer.context.fillRect(this.hoveredTile.x, this.hoveredTile.y, TILE_SIZE, TILE_SIZE);
      
      layer.context.globalAlpha = 1.0;
    }
  }

  drawUILayer() {
    const layer = this.layers.ui;
    layer.clear();
    this.uiManager.draw(layer.context, this.canvas.height, this.tiles);
  }

  drawAllLayers() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let layer of Object.values(this.layers)) {
      layer.draw(this.ctx, this.camera);
    }
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth * 0.9;
    this.canvas.height = window.innerHeight * 0.9;
    this.ctx.imageSmoothingEnabled = false;

    this.camera.minZoom = Math.max(
      this.canvas.width / WORLD_SIZE_X,
      this.canvas.height / WORLD_SIZE_Y
    );

    // Resize layers
    for (let layer of Object.values(this.layers)) {
      if (!layer.applyCamera) {
        layer.resize(this.canvas.width, this.canvas.height);
      } else {
        layer.resize(WORLD_SIZE_X, WORLD_SIZE_Y);
      }
    }

    this.uiManager.initializeButtons(this.canvas.height);
  }

  loadImages() {
    // Tile images
    const tileImagePaths = {
      [TILE_TYPE.BASE]: "../assets/baseTile.png",
      [TILE_TYPE.BORDER]: "../assets/borderTile.png",
      [TILE_TYPE.GRASS_1]: "../assets/grassTile_02.png",
      [TILE_TYPE.GRASS_2]: "../assets/grassTile_01.png",
      [TILE_TYPE.WATER]: "../assets/waterTile.png",
      [TILE_TYPE.MOUNTAIN]: "../assets/mountainTile.png",
      [TILE_TYPE.MOUNTAIN_GOLD]: "../assets/mountainTile_Gold.png"
    };

    for (let [type, path] of Object.entries(tileImagePaths)) {
      this.tileImages[type] = new Image();
      this.tileImages[type].src = path;
    }

    // Building images
    BUILDING_TYPES.LOGGER.image = new Image();
    BUILDING_TYPES.LOGGER.image.src = "../assets/logger.png";
    
    BUILDING_TYPES.STONE_MINE.image = new Image();
    BUILDING_TYPES.STONE_MINE.image.src = "../assets/stoneMine.png";
    
    BUILDING_TYPES.GOLD_MINE.image = new Image();
    BUILDING_TYPES.GOLD_MINE.image.src = "../assets/goldMine.png";

    // UI images
    this.uiManager.icons.banner = new Image();
    this.uiManager.icons.banner.src = "../assets/UI_banner.png";
    
    this.uiManager.icons.wood = new Image();
    this.uiManager.icons.wood.src = "../assets/wood_icon.png";
    
    this.uiManager.icons.stone = new Image();
    this.uiManager.icons.stone.src = "../assets/stone_icon.png";
    
    this.uiManager.icons.gold = new Image();
    this.uiManager.icons.gold.src = "../assets/gold_icon.png";
  }
}

// ======================================================================== //
// ============================= UTILITIES ================================ //
// ======================================================================== //

function lerp(start, end, t) {
  return start + (end - start) * t;
}

// ======================================================================== //
// ============================== STARTUP ================================= //
// ======================================================================== //

window.onload = function() {
  const game = new Game();
  game.initialize();
};