/*Credit:
---COMPLETE UI BOOK STYLES PACK LICENSE---
By Crusenho Agus Hennihuno - https://crusenho.itch.io/complete-ui-book-styles-pack
*/

/*
TODOs / Verbesserungen

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

// Resources
const RESOURCES = {
  WOOD: "wood",
  STONE: "stone",
  GOLD: "gold"
};

let playerResources = {
  [RESOURCES.WOOD]: 100,
  [RESOURCES.STONE]: 100,
  [RESOURCES.GOLD]: 500
};

// Building Definitons
const BUILDING = {
  GOLD_MINE: {
    id: "gold_mine",
    name: "Gold Mine",

    image: null,
    width: TILE_SIZE,
    height: TILE_SIZE,

    cost: {
      [RESOURCES.WOOD]: 50,
      [RESOURCES.STONE]: 100,
      [RESOURCES.GOLD]: 200
    },

    canBePlacedOn(tile) {
      return tile.type === TILE_TYPE.MOUNTAIN_GOLD;
    }
  },

  LOGGER: {
    id: "logger",
    name: "Logger",

    image: null,
    width: TILE_SIZE,
    height: TILE_SIZE,

    cost: {
      [RESOURCES.WOOD]: 25,
      [RESOURCES.STONE]: 0,
      [RESOURCES.GOLD]: 50
    },

    canBePlacedOn(tile) {
      return tile.type === TILE_TYPE.GRASS_1 || 
             tile.type === TILE_TYPE.GRASS_2;
    }
  },

  STONE_MINE: {
    id: "stone_mine",
    name: "Stone Mine",

    image: null,
    width: TILE_SIZE,
    height: TILE_SIZE,

    cost: {
      [RESOURCES.WOOD]: 75,
      [RESOURCES.STONE]: 50,
      [RESOURCES.GOLD]: 150
    },

    canBePlacedOn(tile) {
      return tile.type === TILE_TYPE.MOUNTAIN;
    }
  }
}

// UI
const UI_BANNER_HEIGHT = 200;
const UI_BUTTON_SIZE = 80;
const UI_BUTTON_PADDING = 20;
const UI_BUTTON_START_X = 50;

const UI_RESOURCE_SIZE = 40;
const UI_RESOURCE_PADDING = 15;

let UI_IMAGES = { 
  BANNER: null,
  WOOD_ICON: null,
  STONE_ICON: null,
  GOLD_ICON: null
};

let uiButtons = [];

// Building Selection State
let selectedBuilding = null;
let hoveredTile = null;
let mouseWorldX = 0;
let mouseWorldY = 0;

// Camera
const camera = {
  x:          0, 
  y:          0,
  targetX:    0, 
  targetY:    0,
  zoom:       1, 
  minZoom:    0.675, 
  maxZoom:    5,
  speed:     20, 
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

  placeBuilding(buildingDefinition) {
    if (this.building === null && buildingDefinition.canBePlacedOn(this)) {
      this.building = new Building(buildingDefinition);
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
  constructor(definition) {
    this.definition = definition;
    this.tile = null;
  }

  get image()  {return this.definition.image;}
  get width()  {return this.definition.width;}
  get height() {return this.definition.height;}
}

class UIButton {
  constructor(x, y, width, height, building, image) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.building = building;
    this.image = image;
    this.isHovered = false;
    this.isSelected = false;
  }

  contains(x, y) {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height;
  }

  canAfford() {
    for (let resource in this.building.cost) {
      if (playerResources[resource] < this.building.cost[resource]) {
        return false;
      }
    }
    return true;
  }

  draw(ctx) {
    const canAfford = this.canAfford();

    // Background
    ctx.fillStyle = this.isSelected ? "#4a90e2" : 
                    (!canAfford ? "#222" : (this.isHovered ? "#555" : "#333"));
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Border
    ctx.strokeStyle = this.isSelected ? "#fff" : 
                      (!canAfford ? "#444" : "#777");
    ctx.lineWidth = this.isSelected ? 3 : 2;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Building Image
    if (this.image && this.image.complete) {
      const padding = 10;
      ctx.globalAlpha = canAfford ? 1.0 : 0.4;
      ctx.drawImage(
        this.image,
        this.x + padding,
        this.y + padding,
        this.width - padding * 2,
        this.height - padding * 2
      );
      ctx.globalAlpha = 1.0;
    }

    // Cost Display (compact)
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    
    let yOffset = this.y + this.height - 28;
    const xStart = this.x + 5;
    
    if (this.building.cost[RESOURCES.WOOD] > 0) {
      ctx.fillStyle = playerResources[RESOURCES.WOOD] >= this.building.cost[RESOURCES.WOOD] ? "#8B4513" : "#ff4444";
      ctx.fillText(`W:${this.building.cost[RESOURCES.WOOD]}`, xStart, yOffset);
      yOffset += 12;
    }
    
    if (this.building.cost[RESOURCES.STONE] > 0) {
      ctx.fillStyle = playerResources[RESOURCES.STONE] >= this.building.cost[RESOURCES.STONE] ? "#808080" : "#ff4444";
      ctx.fillText(`S:${this.building.cost[RESOURCES.STONE]}`, xStart, yOffset);
      yOffset += 12;
    }
    
    if (this.building.cost[RESOURCES.GOLD] > 0) {
      ctx.fillStyle = playerResources[RESOURCES.GOLD] >= this.building.cost[RESOURCES.GOLD] ? "#FFD700" : "#ff4444";
      ctx.fillText(`G:${this.building.cost[RESOURCES.GOLD]}`, xStart, yOffset);
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
  layers.preview = new Layer("preview", WORLD_SIZE_X, WORLD_SIZE_Y, true);
  layers.ui = new Layer("ui", board.width, board.height, false);

  resizeCanvas();

  // --------- TILEMAP  --------- \\
  loadImages();
  generateAndLoadMap();

  // --------- UI BUTTONS --------- \\
  initializeUIButtons();

  // ---------- CAMERA ---------- \\
  camera.x = WORLD_SIZE_X / 2;  // sets camera to center of world
  camera.y = WORLD_SIZE_Y / 2;  
  camera.targetX = camera.x;    // sets target to camera to prevent inital movement
  camera.targetY = camera.y;

  // ---------- INPUT  ---------- \\
  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);
  board.addEventListener("mousedown", mouseDownHandler);
  document.addEventListener("mouseup", mouseUpHandler);
  board.addEventListener("mousemove", mouseMoveHandler);
  board.addEventListener("wheel", wheelHandler, { passive: false });
  board.addEventListener("click", clickHandler);
  board.addEventListener("contextmenu", (e) => e.preventDefault());  // Prevent right-click menu

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
  drawBuildingLayer();
  drawPreviewLayer();
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

function drawBuildingLayer() {
  const layer = layers.buildings;
  layer.clear();

  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      const tile = backgroundTiles[row][col];
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

function drawPreviewLayer() {
  const layer = layers.preview;
  layer.clear();

  if (selectedBuilding && hoveredTile) {
    const canPlace = selectedBuilding.canBePlacedOn(hoveredTile);
    
    // Semi-transparent overlay
    layer.context.globalAlpha = 0.6;
    
    if (selectedBuilding.image && selectedBuilding.image.complete) {
      layer.context.drawImage(
        selectedBuilding.image,
        hoveredTile.x,
        hoveredTile.y,
        selectedBuilding.width,
        selectedBuilding.height
      );
    }
    
    // Colored overlay (green = valid, red = invalid)
    layer.context.fillStyle = canPlace ? "rgba(0, 255, 0, 0.3)" : "rgba(255, 0, 0, 0.3)";
    layer.context.fillRect(hoveredTile.x, hoveredTile.y, TILE_SIZE, TILE_SIZE);
    
    layer.context.globalAlpha = 1.0;
  }
}

function drawUiLayer() {
  const layer = layers.ui;
  layer.clear();

  // Draw Banner
  if (UI_IMAGES.BANNER && UI_IMAGES.BANNER.complete) {
    layer.context.drawImage(
      UI_IMAGES.BANNER,
      0,
      layer.canvas.height - UI_BANNER_HEIGHT,
      layer.canvas.width,
      UI_BANNER_HEIGHT
    );
  }

  // Draw Buttons
  for (let button of uiButtons) {
    button.draw(layer.context);
  }

  // Draw Resources (top-right of banner)
  drawResources(layer.context);
}

function drawResources(ctx) {
  const bannerY = board.height - UI_BANNER_HEIGHT;
  const startX = board.width - 250;
  const centerY = bannerY + UI_BANNER_HEIGHT / 2;
  
  let xOffset = 0;
  
  // Wood
  if (UI_IMAGES.WOOD_ICON && UI_IMAGES.WOOD_ICON.complete) {
    ctx.drawImage(
      UI_IMAGES.WOOD_ICON,
      startX + xOffset,
      centerY - UI_RESOURCE_SIZE / 2,
      UI_RESOURCE_SIZE,
      UI_RESOURCE_SIZE
    );
  }
  
  ctx.fillStyle = "#8B4513";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "left";
  ctx.fillText(
    playerResources[RESOURCES.WOOD],
    startX + xOffset + UI_RESOURCE_SIZE + 8,
    centerY + 8
  );
  
  xOffset += 80;
  
  // Stone
  if (UI_IMAGES.STONE_ICON && UI_IMAGES.STONE_ICON.complete) {
    ctx.drawImage(
      UI_IMAGES.STONE_ICON,
      startX + xOffset,
      centerY - UI_RESOURCE_SIZE / 2,
      UI_RESOURCE_SIZE,
      UI_RESOURCE_SIZE
    );
  }
  
  ctx.fillStyle = "#808080";
  ctx.fillText(
    playerResources[RESOURCES.STONE],
    startX + xOffset + UI_RESOURCE_SIZE + 8,
    centerY + 8
  );
  
  xOffset += 80;
  
  // Gold
  if (UI_IMAGES.GOLD_ICON && UI_IMAGES.GOLD_ICON.complete) {
    ctx.drawImage(
      UI_IMAGES.GOLD_ICON,
      startX + xOffset,
      centerY - UI_RESOURCE_SIZE / 2,
      UI_RESOURCE_SIZE,
      UI_RESOURCE_SIZE
    );
  }
  
  ctx.fillStyle = "#FFD700";
  ctx.fillText(
    playerResources[RESOURCES.GOLD],
    startX + xOffset + UI_RESOURCE_SIZE + 8,
    centerY + 8
  );
}

// ======================================================================== \\
// ================================== UI ================================== \\
// ======================================================================== \\

function initializeUIButtons() {
  uiButtons = [];
  
  const bannerY = board.height - UI_BANNER_HEIGHT;
  const buttonY = bannerY + (UI_BANNER_HEIGHT - UI_BUTTON_SIZE) / 2;
  
  let buttonX = UI_BUTTON_START_X;
  
  // Add Logger Button
  uiButtons.push(new UIButton(
    buttonX,
    buttonY,
    UI_BUTTON_SIZE,
    UI_BUTTON_SIZE,
    BUILDING.LOGGER,
    BUILDING.LOGGER.image
  ));
  
  buttonX += UI_BUTTON_SIZE + UI_BUTTON_PADDING;
  
  // Add Stone Mine Button
  uiButtons.push(new UIButton(
    buttonX,
    buttonY,
    UI_BUTTON_SIZE,
    UI_BUTTON_SIZE,
    BUILDING.STONE_MINE,
    BUILDING.STONE_MINE.image
  ));
  
  buttonX += UI_BUTTON_SIZE + UI_BUTTON_PADDING;
  
  // Add Gold Mine Button
  uiButtons.push(new UIButton(
    buttonX,
    buttonY,
    UI_BUTTON_SIZE,
    UI_BUTTON_SIZE,
    BUILDING.GOLD_MINE,
    BUILDING.GOLD_MINE.image
  ));
}

function updateUIButtons(mouseX, mouseY) {
  for (let button of uiButtons) {
    button.isHovered = button.contains(mouseX, mouseY);
  }
}

// ======================================================================== \\
// ============================== BUILDINGS =============================== \\
// ======================================================================== \\

function handleBuildingPlacement(tile) {
  if (!selectedBuilding || !tile) return;
  
  // Check if player can afford the building
  for (let resource in selectedBuilding.cost) {
    if (playerResources[resource] < selectedBuilding.cost[resource]) {
      console.log(`Not enough ${resource}! Need ${selectedBuilding.cost[resource]}, have ${playerResources[resource]}`);
      return;
    }
  }
  
  if (tile.placeBuilding(selectedBuilding)) {
    // Deduct costs
    for (let resource in selectedBuilding.cost) {
      playerResources[resource] -= selectedBuilding.cost[resource];
    }
    
    console.log(`Placed ${selectedBuilding.name} at (${tile.col}, ${tile.row})`);
    console.log(`Resources: Wood=${playerResources[RESOURCES.WOOD]}, Stone=${playerResources[RESOURCES.STONE]}, Gold=${playerResources[RESOURCES.GOLD]}`);
  } else {
    console.log(`Cannot place ${selectedBuilding.name} here`);
  }
}

function updateButtonSelection() {
  for (let button of uiButtons) {
    button.isSelected = (button.building === selectedBuilding);
  }
}

function deselectBuilding() {
  selectedBuilding = null;
  updateButtonSelection();
  console.log("Building deselected");
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

  camera.minZoom = Math.max(board.width / WORLD_SIZE_X, board.height / WORLD_SIZE_Y);

  for (let layer of Object.values(layers)) {
    if (!layer.applyCamera) {
      layer.resize(board.width, board.height);
    } else {
      layer.resize(WORLD_SIZE_X, WORLD_SIZE_Y);
    }
  }

  initializeUIButtons();  // Recalculate button positions
  drawAllLayers();
}

// ======================================================================== \\
// ================================ INPUT  ================================ \\
// ======================================================================== \\

function keyDownHandler(e) {
  if (keysHeld[e.key] !== undefined) {
    keysHeld[e.key] = true;
    e.preventDefault();
  }
  
  // Deselect building with ESC
  if (e.key === "Escape") {
    deselectBuilding();
  }
}

function keyUpHandler(e) {
  if (keysHeld[e.key] !== undefined) {
    keysHeld[e.key] = false;
    e.preventDefault();
  }
}

function mouseDownHandler(e) {
  if (e.button === 0) {  // Left click
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    e.preventDefault();
  } else if (e.button === 2) {  // Right click
    deselectBuilding();
    e.preventDefault();
  }
}

function mouseMoveHandler(e) {
  const rect = board.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Update UI Button Hovers
  updateUIButtons(mouseX, mouseY);

  // Update World Mouse Position
  const worldPos = screenToWorld(mouseX, mouseY);
  mouseWorldX = worldPos.x;
  mouseWorldY = worldPos.y;
  hoveredTile = getTileAt(mouseWorldX, mouseWorldY);

  // Handle Dragging
  if (isDragging) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;

    camera.targetX -= dx / camera.zoom;
    camera.targetY -= dy / camera.zoom;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
}

function mouseUpHandler(e) {
  if (e.button === 0) {
    isDragging = false;
  }
}

function clickHandler(e) {
  const rect = board.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Check UI Button Clicks
  let buttonClicked = false;
  for (let button of uiButtons) {
    if (button.contains(mouseX, mouseY)) {
      if (button.canAfford()) {
        selectedBuilding = button.building;
        updateButtonSelection();
        console.log(`Selected: ${selectedBuilding.name}`);
      } else {
        console.log(`Cannot afford ${button.building.name}!`);
      }
      buttonClicked = true;
      break;
    }
  }

  // If no button clicked, try to place building
  if (!buttonClicked && selectedBuilding) {
    const worldPos = screenToWorld(mouseX, mouseY);
    const tile = getTileAt(worldPos.x, worldPos.y);
    handleBuildingPlacement(tile);
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

function screenToWorld(screenX, screenY) {
  // Transform screen coordinates to world coordinates
  const centerX = board.width / 2;
  const centerY = board.height / 2;
  
  const worldX = camera.x + (screenX - centerX) / camera.zoom;
  const worldY = camera.y + (screenY - centerY) / camera.zoom;
  
  return { x: worldX, y: worldY };
}

function getTileAt(worldX, worldY) {
  const col = Math.floor(worldX / TILE_SIZE);
  const row = Math.floor(worldY / TILE_SIZE);
  
  if (row >= 0 && row < WORLD_ROW_COUNT && col >= 0 && col < WORLD_COLUMN_COUNT) {
    return backgroundTiles[row][col];
  }
  
  return null;
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
 
  
  BUILDING.GOLD_MINE.image = new Image();
  BUILDING.GOLD_MINE.image.src = "../assets/goldMine.png";

  BUILDING.LOGGER.image = new Image();
  BUILDING.LOGGER.image.src = "../assets/logger.png";

  BUILDING.STONE_MINE.image = new Image();
  BUILDING.STONE_MINE.image.src = "../assets/stoneMine.png";

  UI_IMAGES.BANNER = new Image();
  UI_IMAGES.BANNER.src = "../assets/UI_banner.png";

  UI_IMAGES.WOOD_ICON = new Image();
  UI_IMAGES.WOOD_ICON.src = "../assets/wood_icon.png";

  UI_IMAGES.STONE_ICON = new Image();
  UI_IMAGES.STONE_ICON.src = "../assets/stone_icon.png";

  UI_IMAGES.GOLD_ICON = new Image();
  UI_IMAGES.GOLD_ICON.src = "../assets/gold_icon.png";
}

// ======================================================================== \\