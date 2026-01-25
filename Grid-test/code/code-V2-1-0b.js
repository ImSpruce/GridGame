// ======================================================================== \\
// =========================== GLOBAL VARIABLES =========================== \\
// ======================================================================== \\

const FPS = 60;

// Main canvas / board
let board;
let boardContext;

let layers = {};

// Tiles / Map
const WORLD_ROW_COUNT = 45;
const WORLD_COLUMN_COUNT = 80;
const TILE_SIZE = 32;

let tileMap = [];
let backgroundTiles = new Set();

const WORLD_SIZE_X = WORLD_COLUMN_COUNT * TILE_SIZE;
const WORLD_SIZE_Y = WORLD_ROW_COUNT * TILE_SIZE;

// Tile Types
const TILE_TYPE = {
  BASE: 0,
  BORDER: 1,
  GRASS_1: 2,
  GRASS_2: 3,
  FOREST: 4,
  WATER: 5,
  MOUNTAIN: 6,
  MOUNTAIN_GOLD: 7
};

// Tile Images
const TILE_IMAGES = {
  [TILE_TYPE.BASE]: null,
  [TILE_TYPE.BORDER]: null,
  [TILE_TYPE.GRASS_1]: null,
  [TILE_TYPE.GRASS_2]: null,
  [TILE_TYPE.FOREST]: null,
  [TILE_TYPE.WATER]: null,
  [TILE_TYPE.MOUNTAIN]: null,
  [TILE_TYPE.MOUNTAIN_GOLD]: null
};

// Buildings
const BUILDING_TYPE = {
  HOUSE: "house",
  FARM: "farm",
  MINE: "mine",
  TOWER: "tower"
};

const BUILDING_IMAGES = {
  [BUILDING_TYPE.HOUSE]: null,
  [BUILDING_TYPE.FARM]: null,
  [BUILDING_TYPE.MINE]: null,
  [BUILDING_TYPE.TOWER]: null
};

let buildings = [];
let selectedBuildingType = null;

// UI
const UI_BANNER_HEIGHT = 200;
let UI_IMAGES = { BANNER: null };

// Camera
const camera = {
  x: 0, y: 0,
  targetX: 0, targetY: 0,
  zoom: 1, minZoom: 0.5, maxZoom: 3,
  speed: 20, smoothness: 0.1
};

// Input
const keysHeld = {
  w: false,
  a: false,
  s: false,
  d: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false
};

let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Randomness
let seed = 42; // Set to null for random seed
if (seed === null) { seed = (Math.random() * 2**32) >>> 0; }
const prng = mulberry32(seed);

// ======================================================================== \\
// =============================== CLASSES  =============================== \\
// ======================================================================== \\

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

  draw(boardContext) {
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

class Block {
  constructor(image, x, y, width, height) {
    this.image = image;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

class Tile {
  constructor(x, y, row, col, type) {
    this.x = x;
    this.y = y;
    this.row = row;
    this.col = col;
    this.type = type;
    this.building = null;
  }

  canPlaceBuilding() {
    return this.building === null && 
           this.type !== TILE_TYPE.WATER && 
           this.type !== TILE_TYPE.BORDER;
  }

  placeBuilding(building) {
    if (this.canPlaceBuilding()) {
      this.building = building;
      building.tile = this;
      return true;
    }
    return false;
  }

  removeBuilding() {
    if (this.building) {
      this.building.tile = null;
      this.building = null;
      return true;
    }
    return false;
  }
}

class Building {
  constructor(type, x, y, width, height) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.image = BUILDING_IMAGES[type];
    this.tile = null;
  }

  draw(context) {
    if (this.image && this.image.complete) {
      context.drawImage(this.image, this.x, this.y, this.width, this.height);
    } else {
      // Fallback: draw colored rectangle
      context.fillStyle = this.getFallbackColor();
      context.fillRect(this.x, this.y, this.width, this.height);
      context.strokeStyle = "#000";
      context.strokeRect(this.x, this.y, this.width, this.height);
    }
  }

  getFallbackColor() {
    switch(this.type) {
      case BUILDING_TYPE.HOUSE: return "#8B4513";
      case BUILDING_TYPE.FARM: return "#DAA520";
      case BUILDING_TYPE.MINE: return "#696969";
      case BUILDING_TYPE.TOWER: return "#4A4A4A";
      default: return "#CCC";
    }
  }
}

// ======================================================================== \\
// ================================ START  ================================ \\
// ======================================================================== \\

window.onload = function() {
  board = document.getElementById("board");
  boardContext = board.getContext("2d");
  boardContext.imageSmoothingEnabled = false;

  // ---------- LAYERS ---------- \\
  layers.world = new Layer("world", WORLD_SIZE_X, WORLD_SIZE_Y, true);
  layers.buildings = new Layer("buildings", WORLD_SIZE_X, WORLD_SIZE_Y, true);
  layers.ui = new Layer("ui", board.width, board.height, false);

  resizeCanvas();

  // --------- TILEMAP  --------- \\
  loadImages();
  generateAndLoadMap();

  // ---------- CAMERA ---------- \\
  camera.x = WORLD_SIZE_X / 2;
  camera.y = WORLD_SIZE_Y / 2;
  camera.targetX = camera.x;
  camera.targetY = camera.y;

  // ---------- INPUT  ---------- \\
  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);
  board.addEventListener("mousedown", mouseDownHandler);
  document.addEventListener("mouseup", mouseUpHandler);
  board.addEventListener("mousemove", mouseMoveHandler);
  board.addEventListener("wheel", wheelHandler, { passive: false });
  board.addEventListener("click", clickHandler);

  // ---------- RESIZE ---------- \\
  window.addEventListener("resize", resizeCanvas);

  // ----------- LOOP ----------- \\
  update();
};

// ======================================================================== \\
// ================================= LOOP ================================= \\
// ======================================================================== \\

function update() {
  updateCameraTarget();
  moveCamera();
  clampCamera();

  drawWorldLayer();
  drawBuildingsLayer();
  drawUiLayer();
  drawAllLayers();

  requestAnimationFrame(update);
}

function drawAllLayers() {
  boardContext.clearRect(0, 0, board.width, board.height);

  // Draw in correct order: world -> buildings -> ui
  const drawOrder = ["world", "buildings", "ui"];
  for (let layerName of drawOrder) {
    if (layers[layerName]) {
      layers[layerName].draw(boardContext);
    }
  }
}

// ======================================================================== \\
// =============================== TILEMAP  =============================== \\
// ======================================================================== \\

function generateAndLoadMap() {
  const heightMap = generateHeightMap();
  tileMap = generateMap(heightMap);
  loadMap();
}

function generateHeightMap() {
  let heightMap = [];
  
  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    heightMap[row] = [];
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      heightMap[row][col] = prng();
    }
  }

  for (let i = 0; i < 4; i++) {
    heightMap = smoothHeightMap(heightMap);
  }
  
  return heightMap;
}

function smoothHeightMap(map) {
  const copy = map.map(row => row.slice());

  for (let row = 1; row < WORLD_ROW_COUNT - 1; row++) {
    for (let col = 1; col < WORLD_COLUMN_COUNT - 1; col++) {
      if (copy[row][col] < 0.995) {
        let sum = 0;
        let count = 0;

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

function generateMap(heightMap) {
  let map = [];
  
  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    map[row] = [];
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      let tileType;
      
      if (row === 0 || row === WORLD_ROW_COUNT - 1 || 
          col === 0 || col === WORLD_COLUMN_COUNT - 1) {
        tileType = TILE_TYPE.BORDER;
      } else {
        const height = heightMap[row][col];

        if (height < 0.44) {
          tileType = TILE_TYPE.WATER;
        } else if (height < 0.5) {
          tileType = TILE_TYPE.GRASS_1;
        } else if (height < 0.6) {
          tileType = TILE_TYPE.GRASS_2;
        } else if (height < 0.9) {
          tileType = TILE_TYPE.MOUNTAIN;
        } else {
          tileType = TILE_TYPE.MOUNTAIN_GOLD;
        }
      }
      
      map[row][col] = new Tile(
        col * TILE_SIZE,
        row * TILE_SIZE,
        row,
        col,
        tileType
      );
    }
  }
  return map;
}

function loadMap() {
  backgroundTiles.clear();
  
  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      const tile = tileMap[row][col];
      const img = TILE_IMAGES[tile.type] || TILE_IMAGES[TILE_TYPE.BASE];

      backgroundTiles.add(
        new Block(
          img,
          tile.x,
          tile.y,
          TILE_SIZE,
          TILE_SIZE
        )
      );
    }
  }
}

function drawWorldLayer() {
  const layer = layers.world;
  layer.clear();

  for (const tile of backgroundTiles) {
    if (tile.image && tile.image.complete) {
      layer.context.drawImage(tile.image, tile.x, tile.y, tile.width, tile.height);
    }
  }
}

// ======================================================================== \\
// ============================== BUILDINGS =============================== \\
// ======================================================================== \\

function drawBuildingsLayer() {
  const layer = layers.buildings;
  layer.clear();

  for (const building of buildings) {
    building.draw(layer.context);
  }
}

function addBuilding(type, row, col) {
  if (row < 0 || row >= WORLD_ROW_COUNT || col < 0 || col >= WORLD_COLUMN_COUNT) {
    return null;
  }

  const tile = tileMap[row][col];
  
  if (!tile.canPlaceBuilding()) {
    console.log("Cannot place building here!");
    return null;
  }

  const building = new Building(
    type,
    col * TILE_SIZE,
    row * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE
  );

  if (tile.placeBuilding(building)) {
    buildings.push(building);
    return building;
  }

  return null;
}

function removeBuilding(row, col) {
  if (row < 0 || row >= WORLD_ROW_COUNT || col < 0 || col >= WORLD_COLUMN_COUNT) {
    return false;
  }

  const tile = tileMap[row][col];
  
  if (tile.building) {
    const building = tile.building;
    tile.removeBuilding();
    
    const index = buildings.indexOf(building);
    if (index > -1) {
      buildings.splice(index, 1);
    }
    return true;
  }

  return false;
}

// ======================================================================== \\
// ================================== UI ================================== \\
// ======================================================================== \\

function drawUiLayer() {
  const layer = layers.ui;
  layer.clear();

  // Draw banner
  if (UI_IMAGES.BANNER && UI_IMAGES.BANNER.complete) {
    layer.context.drawImage(
      UI_IMAGES.BANNER,
      0,
      layer.canvas.height - UI_BANNER_HEIGHT,
      layer.canvas.width,
      UI_BANNER_HEIGHT
    );
  }

  // Draw building selection UI
  drawBuildingSelectionUI(layer.context);
}

function drawBuildingSelectionUI(context) {
  const buttonWidth = 80;
  const buttonHeight = 60;
  const padding = 10;
  const startX = 20;
  const startY = context.canvas.height - UI_BANNER_HEIGHT + 20;

  const buildingTypes = [
    { type: BUILDING_TYPE.HOUSE, label: "House" },
    { type: BUILDING_TYPE.FARM, label: "Farm" },
    { type: BUILDING_TYPE.MINE, label: "Mine" },
    { type: BUILDING_TYPE.TOWER, label: "Tower" }
  ];

  buildingTypes.forEach((item, index) => {
    const x = startX + index * (buttonWidth + padding);
    const y = startY;

    // Draw button background
    if (selectedBuildingType === item.type) {
      context.fillStyle = "#4A90E2";
    } else {
      context.fillStyle = "#333";
    }
    context.fillRect(x, y, buttonWidth, buttonHeight);

    // Draw border
    context.strokeStyle = "#FFF";
    context.lineWidth = 2;
    context.strokeRect(x, y, buttonWidth, buttonHeight);

    // Draw icon/preview
    if (BUILDING_IMAGES[item.type] && BUILDING_IMAGES[item.type].complete) {
      const imgSize = 30;
      context.drawImage(
        BUILDING_IMAGES[item.type],
        x + (buttonWidth - imgSize) / 2,
        y + 5,
        imgSize,
        imgSize
      );
    }

    // Draw label
    context.fillStyle = "#FFF";
    context.font = "12px Arial";
    context.textAlign = "center";
    context.fillText(item.label, x + buttonWidth / 2, y + buttonHeight - 10);
  });

  // Draw instructions
  context.fillStyle = "#FFF";
  context.font = "14px Arial";
  context.textAlign = "left";
  context.fillText(
    "Click building type, then click map to place. Right-click to remove.",
    startX,
    startY + buttonHeight + 25
  );
}

// ======================================================================== \\
// ================================ CAMERA ================================ \\
// ======================================================================== \\

function updateCameraTarget() {
  if (keysHeld.w || keysHeld.ArrowUp)    { camera.targetY -= camera.speed; }
  if (keysHeld.s || keysHeld.ArrowDown)  { camera.targetY += camera.speed; }
  if (keysHeld.a || keysHeld.ArrowLeft)  { camera.targetX -= camera.speed; }
  if (keysHeld.d || keysHeld.ArrowRight) { camera.targetX += camera.speed; }
}

function moveCamera() {
  camera.x = lerp(camera.x, camera.targetX, camera.smoothness);
  camera.y = lerp(camera.y, camera.targetY, camera.smoothness);
}

function clampCamera() {
  const halfWidth = board.width / 2 / camera.zoom;
  const halfHeight = (board.height - UI_BANNER_HEIGHT) / 2 / camera.zoom;
  const uiOffset = UI_BANNER_HEIGHT / camera.zoom * 0.5;

  camera.targetX = Math.max(
    halfWidth,
    Math.min(WORLD_SIZE_X - halfWidth, camera.targetX)
  );

  camera.targetY = Math.max(
    halfHeight,
    Math.min(WORLD_SIZE_Y - halfHeight + uiOffset, camera.targetY)
  );
}

// ======================================================================== \\
// =========================== CANVAS / RESIZE  =========================== \\
// ======================================================================== \\

function resizeCanvas() {
  board.width = window.innerWidth * 0.9;
  board.height = window.innerHeight * 0.9;
  boardContext.imageSmoothingEnabled = false;

  for (let layer of Object.values(layers)) {
    if (!layer.applyCamera) {
      layer.resize(board.width, board.height);
    } else {
      layer.resize(WORLD_SIZE_X, WORLD_SIZE_Y);
    }
  }
}

// ======================================================================== \\
// ================================ INPUT  ================================ \\
// ======================================================================== \\

function keyDownHandler(e) {
  if (keysHeld[e.key] !== undefined) {
    keysHeld[e.key] = true;
    e.preventDefault();
  }
}

function keyUpHandler(e) {
  if (keysHeld[e.key] !== undefined) {
    keysHeld[e.key] = false;
    e.preventDefault();
  }
}

function mouseDownHandler(e) {
  if (e.button === 0) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    e.preventDefault();
  }
}

function mouseMoveHandler(e) {
  if (!isDragging) return;

  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;

  camera.targetX -= dx / camera.zoom;
  camera.targetY -= dy / camera.zoom;

  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
}

function mouseUpHandler(e) {
  if (e.button === 0) {
    isDragging = false;
  }
}

function wheelHandler(e) {
  e.preventDefault();
  const zoomAmount = e.deltaY * -0.001;
  camera.zoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, camera.zoom + zoomAmount));
}

function clickHandler(e) {
  const rect = board.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // Check if click is in UI area
  if (clickY > board.height - UI_BANNER_HEIGHT) {
    handleUiClick(clickX, clickY);
    return;
  }

  // Convert screen coordinates to world coordinates
  const worldX = (clickX - board.width / 2) / camera.zoom + camera.x;
  const worldY = (clickY - board.height / 2) / camera.zoom + camera.y;

  const col = Math.floor(worldX / TILE_SIZE);
  const row = Math.floor(worldY / TILE_SIZE);

  if (e.button === 2 || e.ctrlKey) {
    // Right click or Ctrl+Click: remove building
    removeBuilding(row, col);
  } else if (selectedBuildingType) {
    // Left click with selected building: place building
    addBuilding(selectedBuildingType, row, col);
  }
}

function handleUiClick(clickX, clickY) {
  const buttonWidth = 80;
  const buttonHeight = 60;
  const padding = 10;
  const startX = 20;
  const startY = board.height - UI_BANNER_HEIGHT + 20;

  const buildingTypes = [
    BUILDING_TYPE.HOUSE,
    BUILDING_TYPE.FARM,
    BUILDING_TYPE.MINE,
    BUILDING_TYPE.TOWER
  ];

  buildingTypes.forEach((type, index) => {
    const x = startX + index * (buttonWidth + padding);
    const y = startY;

    if (clickX >= x && clickX <= x + buttonWidth &&
        clickY >= y && clickY <= y + buttonHeight) {
      selectedBuildingType = selectedBuildingType === type ? null : type;
    }
  });
}

// Prevent context menu on right click
board.addEventListener("contextmenu", (e) => e.preventDefault());

// ======================================================================== \\
// =============================== HELPERS  =============================== \\
// ======================================================================== \\

function lerp(start, end, smoothness) {
  return start + (end - start) * smoothness;
}

function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImages() {
  TILE_IMAGES[TILE_TYPE.BASE] = new Image();
  TILE_IMAGES[TILE_TYPE.BASE].src = "../assets/baseTile.png";

  TILE_IMAGES[TILE_TYPE.BORDER] = new Image();
  TILE_IMAGES[TILE_TYPE.BORDER].src = "../assets/borderTile.png";

  TILE_IMAGES[TILE_TYPE.GRASS_1] = new Image();
  TILE_IMAGES[TILE_TYPE.GRASS_1].src = "../assets/grassTile_02.png";

  TILE_IMAGES[TILE_TYPE.GRASS_2] = new Image();
  TILE_IMAGES[TILE_TYPE.GRASS_2].src = "../assets/grassTile_01.png";

  TILE_IMAGES[TILE_TYPE.WATER] = new Image();
  TILE_IMAGES[TILE_TYPE.WATER].src = "../assets/waterTile.png";

  TILE_IMAGES[TILE_TYPE.MOUNTAIN] = new Image();
  TILE_IMAGES[TILE_TYPE.MOUNTAIN].src = "../assets/mountainTile.png";

  TILE_IMAGES[TILE_TYPE.MOUNTAIN_GOLD] = new Image();
  TILE_IMAGES[TILE_TYPE.MOUNTAIN_GOLD].src = "../assets/mountainTile_Gold.png";

  UI_IMAGES.BANNER = new Image();
  UI_IMAGES.BANNER.src = "../assets/UI_banner.png";

  // Load building images (optional - will use fallback colors if not available)
  BUILDING_IMAGES[BUILDING_TYPE.HOUSE] = new Image();
  BUILDING_IMAGES[BUILDING_TYPE.HOUSE].src = "../assets/house.png";

  BUILDING_IMAGES[BUILDING_TYPE.FARM] = new Image();
  BUILDING_IMAGES[BUILDING_TYPE.FARM].src = "../assets/farm.png";

  BUILDING_IMAGES[BUILDING_TYPE.MINE] = new Image();
  BUILDING_IMAGES[BUILDING_TYPE.MINE].src = "../assets/mine.png";

  BUILDING_IMAGES[BUILDING_TYPE.TOWER] = new Image();
  BUILDING_IMAGES[BUILDING_TYPE.TOWER].src = "../assets/tower.png";
}

// ======================================================================== \\