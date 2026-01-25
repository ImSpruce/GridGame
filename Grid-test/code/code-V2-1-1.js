/*
TODOs / Verbesserungen
- resizeCanvas() wird zweimal aufgerufen (in onload)
- Einmal reicht nach Layer-Initialisierung ??

- UI Layer muss nicht jeden Frame neu gezeichnet werden
- Zeichne nur bei Resize neu

- helper Funktion -> getTileAt(worldX, WorldY) {}


*/
// ======================================================================== \\
// =========================== GLOBAL VARIABLES =========================== \\
// ======================================================================== \\

// Main canvas / board
let board;
let boardContext;

let layers = {};

// Tiles / Map
const WORLD_ROW_COUNT = 45;
const WORLD_COLUMN_COUNT = 80;
const TILE_SIZE = 32;

let tileMap = [];
let backgroundTiles = [];

const WORLD_SIZE_X = WORLD_COLUMN_COUNT * TILE_SIZE;
const WORLD_SIZE_Y = WORLD_ROW_COUNT * TILE_SIZE;

// Tile Types
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

// Tile Images
const TILE_IMAGES = {
  [TILE_TYPE.BASE]:           null,
  [TILE_TYPE.BORDER]:         null,
  [TILE_TYPE.GRASS_1]:        null,
  [TILE_TYPE.GRASS_2]:        null,
  [TILE_TYPE.FOREST]:         null,
  [TILE_TYPE.WATER]:          null,
  [TILE_TYPE.MOUNTAIN]:       null,
  [TILE_TYPE.MOUNTAIN_GOLD]:  null
};

// UI
const UI_BANNER_HEIGHT = 200;
let UI_IMAGES = { BANNER: null };

// Camera
const camera = {
  x: 0, 
  y: 0,
  targetX: 0, 
  targetY: 0,
  zoom: 1, 
  minZoom: 0.675, 
  maxZoom: 5,
  speed: 20, 
  smoothness: 0.1
};

// Input
const keysHeld = {
  w:          false,
  a:          false,
  s:          false,
  d:          false,
  ArrowUp:    false,
  ArrowDown:  false,
  ArrowLeft:  false,
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
  get width()  { return TILE_SIZE; }
  get height() { return TILE_SIZE; }

  canPlaceBuilding() {
    return this.building === null &&
           this.type !== TILE_TYPE.WATER &&
           this.type !== TILE_TYPE.BORDER;
  }

  placeBuilding(building) {
    if (this.canPlaceBuilding()) {
      this.building = building;
      this.building.tile = this;
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
  constructor(type, image, width, height, cost) {
    this.type = type;
    this.image = image;
    this.width = width;
    this.height = height;
    this.cost = cost;
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
  drawUiLayer();
  drawAllLayers();

  requestAnimationFrame(update);
}

function drawAllLayers() {
  boardContext.clearRect(0, 0, board.width, board.height);

  for (let layer of Object.values(layers)) {
    layer.draw(boardContext);
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
      if (copy[row][col] < 0.995) {                                   // doesnt smooth out Gold
        let sum = 0;
        let count = 0;

        for (let y = -1; y <= 1; y++) {                               // Averages Tile with its 8 neighbours 
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
  let tileMap = [];
  
  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    tileMap[row] = [];
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      
      if (row === 0 || row === WORLD_ROW_COUNT - 1 ||               // Generates Map Border
          col === 0 || col === WORLD_COLUMN_COUNT - 1) {
        tileMap[row][col] = TILE_TYPE.BORDER;
      } else {                                                      // assinges Tiles to hight of noisemap
        const height = heightMap[row][col];

        if (height < 0.44) {
          tileMap[row][col] = TILE_TYPE.WATER;
        } else if (height < 0.5) {
          tileMap[row][col] = TILE_TYPE.GRASS_1;
        } else if (height < 0.6) {
          tileMap[row][col] = TILE_TYPE.GRASS_2;
        } else if (height < 0.9) {
          tileMap[row][col] = TILE_TYPE.MOUNTAIN;
        } else if (height < 1.0) {
          tileMap[row][col] = TILE_TYPE.MOUNTAIN_GOLD;
        }
      }
    }
  }
  return tileMap;
}

function loadMap() {

  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    backgroundTiles[row] = [];
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      const tileType = tileMap[row][col];
      const image = TILE_IMAGES[tileType] || TILE_IMAGES[TILE_TYPE.BASE];

      backgroundTiles[row][col] = new Tile(col, row, tileType, image);
    }
  }
}

function drawWorldLayer() {
  const layer = layers.world;
  layer.clear();

  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      const tile = backgroundTiles[row][col];
      if (tile.image && tile.image.complete) {
        layer.context.drawImage(tile.image, tile.x, tile.y, tile.width, tile.height);
      }
    }
  }
}

function drawUiLayer() {
  const layer = layers.ui;
  layer.clear();

  if (UI_IMAGES.BANNER && UI_IMAGES.BANNER.complete) {
    layer.context.drawImage(
      UI_IMAGES.BANNER,
      0,
      layer.canvas.height - UI_BANNER_HEIGHT,
      layer.canvas.width,
      UI_BANNER_HEIGHT
    );
  }
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
  const uiOffset = UI_BANNER_HEIGHT / camera.zoom / 2;

  camera.targetX = Math.max(
    halfWidth,
    Math.min(WORLD_SIZE_X - halfWidth, camera.targetX)
  );

  camera.targetY = Math.max(
    halfHeight + uiOffset,
    Math.min(WORLD_SIZE_Y - halfHeight + uiOffset, camera.targetY)
  );
}

// ======================================================================== \\
// =========================== CANVAS / RESIZE  =========================== \\
// ======================================================================== \\

function resizeCanvas() {
  board.width = window.innerWidth * 0.9;        // sets main canvas 90 % of Window
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
}

// ======================================================================== \\