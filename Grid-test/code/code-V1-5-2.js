// ======================================================================== \\
// =========================== global variables =========================== \\

// general
let board;
let boardContext;
let layers = {};
let drawOrder = ["world","ui"];

const FPS = 60;
let seed = 42;  // set Seed, set to null for random seed

if (seed === null) {
  seed = Math.floor(Math.random() * 1000000);
}
const prng = mulberry32(seed)                   // Pseudo Random Number Generator with Mulberry32

// world
const WORLD_ROW_COUNT = 45;
const WORLD_COLUMN_COUNT = 80;
const WORLD_TILE_SIZE = 32;
const WORLD_WIDTH = WORLD_COLUMN_COUNT * WORLD_TILE_SIZE;
const WORLD_HEIGHT = WORLD_ROW_COUNT * WORLD_TILE_SIZE;

// board / canvas
const BOARD_WIDTH = WORLD_COLUMN_COUNT * WORLD_TILE_SIZE * 0.5;
const BOARD_HEIGHT = WORLD_ROW_COUNT * WORLD_TILE_SIZE * 0.5;

const UI_BANNER_HEIGHT = 200;

// camera
const camera = {
  x:          0,    // Camera's current position in world coordinates
  y:          0,
  targetX:    0,    // Camera's target position in world coordinates
  targetY:    0,
  zoom:       1,    // Current zoom level
  minZoom:    0.5,
  maxZoom:    3,
  speed:      20,   // Speed at which the camera moves
  smoothness: 0.1,  // How smoothly the camera follows the target (0-1 interpolation factor)
};

// keys held state
const keysHeld = {
  w:          false,
  a:          false,
  s:          false,
  d:          false,
  ArrowUp:    false,
  ArrowDown:  false,
  ArrowLeft:  false,
  ArrowRight: false,
};

// mouse drag state
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// tile types
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

// tile images "enum"
const TILE_IMAGES = {
  [TILE_TYPE.BASE]:          null,
  [TILE_TYPE.BORDER]:        null,
  [TILE_TYPE.GRASS_1]:       null,
  [TILE_TYPE.GRASS_2]:       null,
  [TILE_TYPE.FOREST]:        null,
  [TILE_TYPE.WATER]:         null,
  [TILE_TYPE.MOUNTAIN]:      null,
  [TILE_TYPE.MOUNTAIN_GOLD]: null
};


const UI_IMAGES = {
  BANNER:                    null,
};

// tilemap
tileMap = generateMap(generateHeightMap());

let backgroundTiles = new Set();

// =============================== main code ============================== \\

window.onload = function () {

  board = document.getElementById("board");
  board.width = BOARD_WIDTH;
  board.height = BOARD_HEIGHT;
  boardContext = board.getContext("2d");

  addLayer("world", WORLD_WIDTH, WORLD_HEIGHT, false);
  addLayer("ui", BOARD_WIDTH, BOARD_HEIGHT, true);

  loadImages();
  loadMap();

  camera.x = WORLD_WIDTH / 2; // position camera in center of world
  camera.y = WORLD_HEIGHT / 2;
  camera.targetX = camera.x; // set target to current position prevent movment at start
  camera.targetY = camera.y;

  update();

  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);

  board.addEventListener("wheel", wheelHandler);
  board.addEventListener("mousedown", mouseDownHandler);
  board.addEventListener("mousemove", mouseMoveHandler);
  document.addEventListener("mouseup", mouseUpHandler);
};

// =============================== Game Loop ============================== \\

function update() {
  updateCameraTarget();
  moveCamera();
  clampCamera();

  drawLayers(boardContext);

  setTimeout(update, 1000 / FPS);
}

// =============================== Camera ============================== \\

// limits camera movement to stay within the world bounds
function clampCamera() {

  const HALF_WIDTH = BOARD_WIDTH / camera.zoom / 2;
  const HALF_HEIGHT = BOARD_HEIGHT / camera.zoom / 2;

  const UI_Y_OFFSET = UI_BANNER_HEIGHT / camera.zoom * 0.9;

  camera.targetX = Math.max(
    HALF_WIDTH,
    Math.min(WORLD_WIDTH - HALF_WIDTH, camera.targetX)
  );

  camera.targetY = Math.max(
    HALF_HEIGHT,
    Math.min(WORLD_HEIGHT - HALF_HEIGHT + UI_Y_OFFSET, camera.targetY)
  );
}

// smoothly moves camera towards target position by camera.smoothness %
function moveCamera() {
  camera.x = lerp(camera.x, camera.targetX, camera.smoothness);
  camera.y = lerp(camera.y, camera.targetY, camera.smoothness);
}

// =============================== Input ============================== \\

function wheelHandler(e) {
  e.preventDefault(); // prevent browser from scrolling
  const zoomAmount = e.deltaY * -0.001;
  camera.zoom = Math.min(
    // clamp zoom level
    camera.maxZoom,
    Math.max(camera.minZoom, camera.zoom + zoomAmount)
  );
}

// sets key state in keysHeld object
function keyDownHandler(e) {
  if (e.key in keysHeld) {
    keysHeld[e.key] = true;
    e.preventDefault();
  }
}

// resets key state in keysHeld object
function keyUpHandler(e) {
  if (e.key in keysHeld) {
    keysHeld[e.key] = false;
  }
}

// updates camera target position based on keys held
function updateCameraTarget() {
  if (keysHeld.w || keysHeld.ArrowUp) camera.targetY -= camera.speed;
  if (keysHeld.s || keysHeld.ArrowDown) camera.targetY += camera.speed;
  if (keysHeld.a || keysHeld.ArrowLeft) camera.targetX -= camera.speed;
  if (keysHeld.d || keysHeld.ArrowRight) camera.targetX += camera.speed;
}

// =============================== Mouse Drag ============================== \\

function mouseDownHandler(e) {
  if (e.button === 0) {
    // middle mouse button
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    e.preventDefault();
  }
}

function mouseMoveHandler(e) {
  if (!isDragging) return;

  const deltaX = e.clientX - lastMouseX;
  const deltaY = e.clientY - lastMouseY;

  camera.targetX -= deltaX / camera.zoom;
  camera.targetY -= deltaY / camera.zoom;

  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
}

function mouseUpHandler(e) {
  if (e.button === 0) {
    isDragging = false;
  }
}

// =============================== Rendering ============================== \\

function drawWorldLayer() {
  const layer = layers["world"];
  
  layer.context.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

  for (const tile of backgroundTiles) {
    layer.context.drawImage(tile.image, tile.x, tile.y, tile.width, tile.height);
  }
}

function drawUiLayer() {
  const layer = layers["ui"];

  layer.context.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

  layer.context.drawImage(UI_IMAGES.BANNER, 0, layer.canvas.height - UI_BANNER_HEIGHT, layer.canvas.width, UI_BANNER_HEIGHT);
}

function drawLayers(boardContext) {
  // clear main canvas
  boardContext.clearRect(0, 0, boardContext.canvas.width, boardContext.canvas.height);

  drawWorldLayer();
  drawUiLayer()

  for (const name of drawOrder) {
    const layer = layers[name];
    if (!layer) continue;

    if (layer.static) {
      // static layer -> UI, etc
      boardContext.drawImage(layer.canvas, 0, 0);
    } else {
      // movable layer -> apply camera
      boardContext.save();

      boardContext.translate(BOARD_WIDTH / 2, BOARD_HEIGHT / 2);     // move origin to center of screen
      boardContext.scale(camera.zoom, camera.zoom);                  // apply camera zoom
      boardContext.translate(-camera.x, -camera.y);                  // move the world opposite to camera position
      
      boardContext.drawImage(layer.canvas, 0, 0);
      
      boardContext.restore();
    }
  }
}

// =============================== Helpers ============================== \\

function addLayer(name, width, height, isStatic = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  // initially clear layer
  context.clearRect(0, 0, width, height);
  
  // ensures sharp images by disabling browser interpolation of scaled images
  context.imageSmoothingEnabled = false;

  // store in object
  layers[name] = {
    canvas: canvas,
    context: context,
    static: isStatic
  };

  return layers[name].context;
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

// linear interpolation function
function lerp(start, end, amount) {
  return start + (end - start) * amount;
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
  UI_IMAGES.BANNER.src = "../assets/UI_banner.png"
}

function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ================================= Map ================================ \\

function loadMap() {

  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    for (let col = 0; col < WORLD_COLUMN_COUNT; col++) {
      const tileType = tileMap[row][col];
      const img = TILE_IMAGES[tileType] || TILE_IMAGES[TILE_TYPE.BASE];

      backgroundTiles.add(
        new Block(
          img,
          col * WORLD_TILE_SIZE,
          row * WORLD_TILE_SIZE,
          WORLD_TILE_SIZE,
          WORLD_TILE_SIZE
        )
      )
    }
  }
}

function generateHeightMap() {
  let heightMap = [];
  // generate height map with random values
  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    heightMap[row] = [];
    for (let column = 0; column < WORLD_COLUMN_COUNT; column++) {
      heightMap[row][column] = prng()
    }
  }

  // smooth height map multiple times
  for (let i = 0; i < 4; i++) {
    heightMap = smoothHeightMap(heightMap);
  }
  return heightMap;
}

// Averages each tile with its 8 neighbors
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
  let tileMap = [];
  // assign tile types based on height map values to tileMap
  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    tileMap[row] = [];
    for (let column = 0; column < WORLD_COLUMN_COUNT; column++) {
      
      if (                                 // Border tiles
        row === 0 ||
        row === WORLD_ROW_COUNT - 1 ||
        column === 0 ||
        column === WORLD_COLUMN_COUNT - 1
      ) {
        tileMap[row][column] = TILE_TYPE.BORDER;
      } 
      else {
        const height = heightMap[row][column];

        if (height < 0.44) {
          tileMap[row][column] = TILE_TYPE.WATER;
        } else if (height < 0.5) {
          tileMap[row][column] = TILE_TYPE.GRASS_1;
        } else if (height < 0.6) {
          tileMap[row][column] = TILE_TYPE.GRASS_2;
        } else if (height < 0.9){
          tileMap[row][column] = TILE_TYPE.MOUNTAIN;
        } else if (height < 1.0){
          tileMap[row][column] = TILE_TYPE.MOUNTAIN_GOLD;
        }
        
      }
    }
  }
  return tileMap;
}

// ======================================================================== \\

