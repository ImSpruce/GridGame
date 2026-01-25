// ======================================================================== \\
// =========================== GLOBAL VARIABLES =========================== \\
// ======================================================================== \\

const FPS = 60;

// Main canvas / board
let board;          // main canvas
let boardContext;   // main context

let layers = {}     // Object for layer objects

// Tiles / Map
const WORLD_ROW_COUNT = 45;         // Number of tiles in Y direction (16:9)
const WORLD_COLUMN_COUNT = 80;      // Number of tiles in X direction (16:9)

let TILE_SIZE = 32;                 // Pixel size of a tile
let tileMap = [];                   // 2D array of tile-objects

const WORLD_SIZE_X = WORLD_COLUMN_COUNT * TILE_SIZE;
const WORLD_SIZE_Y = WORLD_ROW_COUNT * TILE_SIZE; 

let BUILDINGS = {};
let selectedBuildingType = null;

const TILE_TYPE = {
  DEFAULT: "default",
  GRASS: "grass",
  WATER: "water",
  FOREST: "forest",
  MOUNTAIN: "mountain"
}

// UI
const UI_BANNER_HEIGHT = 200;
let UI_IMAGES = {BANNER: null};

// Camera
const camera = {
  x: 0, y: 0,                             // Camera position
  targetX: 0, targetY: 0,                 // Camera movement target
  zoom: 1, minZoom: 0.5, maxZoom: 3,      // Camera zoom Level
  speed: 20, smoothness: 0.1              // Camera target movment speed, an camera follow rate
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
let seed = null;                                            // seed for random events to create deterministic maps
if (seed === null) {seed = (Math.random()*2**32)>>>0; };    // If seed === null -> generate random seed
const prng = mulberry32(seed);


// ======================================================================== \\
// =============================== CLASSES  =============================== \\
// ======================================================================== \\

class Layer {
  constructor(name, width, height, applyCamera=true, drawPriority=0) {
    this.name = name;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.context = this.canvas.getContext("2d");
    this.applyCamera = applyCamera;
    this.clear();
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(boardContext) {
    if (this.applyCamera) {
      boardContext.save();
      boardContext.translate(boardContext.canvas.width/2, boardContext.canvas.height/2);    // places world center on camera center, so zoom is towards camera center 
      boardContext.scale(camera.zoom, camera.zoom);                                         // zooms world by camera factor
      boardContext.translate(-camera.x, -camera.y);                                         // moves world under camera
      boardContext.drawImage(this.canvas, 0, 0);                                            // draws layer canvas on main canvas
      boardContext.restore();
    } else {
      boardContext.drawImage(this.canvas, 0, 0);                                            // draws layer canvas on unmoved main canvas
    }
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.clear();
  }
}

class Tile {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.building = null;
  }

  canPlaceBuilding(){
    return this.building === null && this.type !== this.TILE_TYPE.WATER;
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

  // ---------- LAYERS ---------- \\
  layers.world     =     new Layer("world",     WORLD_SIZE_X, WORLD_SIZE_Y, true);
  layers.buildings =     new Layer("buildings", WORLD_SIZE_X, WORLD_SIZE_Y, true);
  layers.ui        =     new Layer("ui",        board.width,  board.height, false);

  resizeCanvas();

  // --------- TILEMAP  --------- \\
  generateTileMap();


  // ---------- CAMERA ---------- \\
  camera.x = WORLD_SIZE_X / 2;              // Camera starting positon in the center of the board
  camera.y = WORLD_SIZE_Y / 2;
  camera.targetX = camera.x;                // Camera target position at camera position, to prevent movement in the beginning 
  camera.targetY = camera.y;


  // ---------- INPUT  ---------- \\
  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);
  board.addEventListener("mousedown", mouseDownHandler);
  document.addEventListener("mouseup", mouseUpHandler);
  board.addEventListener("mousemove", mouseMoveHandler);
  board.addEventListener("wheel", wheelHandler, {passive: false});                          // TODO ============================================== passiv weg machen, fehler lag nicht daran


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

  drawTileMap()
  drawAllLayers();
  
  requestAnimationFrame(update)
}

function drawAllLayers() {
  boardContext.clearRect(0, 0, board.width, board.height);    // Empties the main canvas

  for (let layer of Object.values(layers)) {                  // selects each layer object in layers
    layer.draw(boardContext);                                 // draws every layer of layers
  }
}

// ======================================================================== \\
// =============================== TILEMAP  =============================== \\
// ======================================================================== \\

function generateTileMap() {
  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    tileMap[row] = [];
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      tileMap[row][col] = new Tile(col * TILE_SIZE, row * TILE_SIZE, TILE_TYPE.DEFAULT) //TODO =========================================================================== TILE_TYPE
    }
  }
}

function drawTileMap() {
  const layer = layers.world;
  layer.clear();

  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      const tile = tileMap[row][col];
      
      // Beispiel: farbige Rechtecke
      switch(tile.type) {
        case TILE_TYPE.GRASS: layer.context.fillStyle = "green"; break;
        case TILE_TYPE.WATER: layer.context.fillStyle = "blue"; break;
        default: layer.context.fillStyle = "lightgrey";
      }

      layer.context.fillRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE);
      layer.context.strokeRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE); // optional: Kachelgitter
    }
  }
}

// ======================================================================== \\
// ================================ CAMERA ================================ \\
// ======================================================================== \\

function updateCameraTarget() {
  if (keysHeld.w || keysHeld.ArrowUp)    {camera.targetY -= camera.speed;}
  if (keysHeld.s || keysHeld.ArrowDown)  {camera.targetY += camera.speed;}
  if (keysHeld.a || keysHeld.ArrowLeft)  {camera.targetX -= camera.speed;}
  if (keysHeld.d || keysHeld.ArrowRight) {camera.targetX += camera.speed;}
}

function moveCamera() {
  camera.x = lerp(camera.x, camera.targetX, camera.smoothness);
  camera.y = lerp(camera.y, camera.targetY, camera.smoothness);
}

function clampCamera(){
  const halfWidth  = board.width/2/camera.zoom;
  const halfHeight = (board.height-UI_BANNER_HEIGHT)/2/camera.zoom;

  camera.targetX = Math.max(halfWidth, Math.min(WORLD_COLUMN_COUNT*TILE_SIZE-halfWidth, camera.targetX));
  camera.targetY = Math.max(halfHeight, Math.min(WORLD_ROW_COUNT*TILE_SIZE-halfHeight, camera.targetY));
}

// ======================================================================== \\
// =========================== CANVAS / RESIZE  =========================== \\
// ======================================================================== \\
function resizeCanvas() {
  board.width = window.innerWidth * 0.9;
  board.height = window.innerHeight * 0.9;

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
  if(keysHeld[e.key]!==undefined) { 
    keysHeld[e.key]=true; e.preventDefault(); 
  } 
}

function keyUpHandler(e) { 
  if(keysHeld[e.key]!==undefined) { 
    keysHeld[e.key]=false; e.preventDefault(); 
  } 
}

function mouseDownHandler(e) { 
  isDragging=true; 
  lastMouseX=e.clientX; 
  lastMouseY=e.clientY; 
}

function mouseMoveHandler(e) { 
  if(!isDragging) return;
  const dx=e.clientX-lastMouseX;
  const dy=e.clientY-lastMouseY;
  camera.targetX-=dx/camera.zoom;
  camera.targetY-=dy/camera.zoom;

  lastMouseX=e.clientX;
  lastMouseY=e.clientY;
}

function mouseUpHandler(e) { 
  isDragging=false; 
}

function wheelHandler(e) { 
  e.preventDefault(); 
  const zoomAmount = e.deltaY*-0.001;
  camera.zoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, camera.zoom+zoomAmount));
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
