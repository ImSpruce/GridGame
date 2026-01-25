// ======================================================================== \\
// =========================== global variables =========================== \\

// general
let board;
const FPS = 60;
let context;

// world
const WORLD_ROW_COUNT = 45;
const WORLD_COLUMN_COUNT = 80;
const WORLD_TILE_SIZE = 32;
const WORLD_WIDTH = WORLD_COLUMN_COUNT * WORLD_TILE_SIZE;
const WORLD_HEIGHT = WORLD_ROW_COUNT * WORLD_TILE_SIZE;

// board / canvas
const BOARD_WIDTH = WORLD_COLUMN_COUNT * WORLD_TILE_SIZE * 0.5;
const BOARD_HEIGHT = WORLD_ROW_COUNT * WORLD_TILE_SIZE * 0.5;

// camera
const camera = {
  x: 0,           // Camera's current position in world coordinates
  y: 0,           
  targetX: 0,     // Camera's target position in world coordinates
  targetY: 0,     
  zoom: 1,
  minZoom: 0.5,
  maxZoom: 3,
  speed: 20,      // Speed at which the camera moves
  smoothness: 0.1 // How smoothly the camera follows the target position (0-1) (Interpolation factor)
};

// keys held state
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

// images
let baseTileImage_00;
let borderTileImage_01;
let grassTileImage_02;
let grassTileImage_03;



// tilemap
let tileMap = [];

for (let row = 0; row < WORLD_ROW_COUNT; row++) {
  tileMap[row] = [];
  for (let column = 0; column < WORLD_COLUMN_COUNT; column++) {

    if ((row + column) % 2 === 0) {
      tileMap[row][column] = 2; // 2 represents grass tile
    }
    else {
      tileMap[row][column] = 3; // 3 represents grass 2 tile
    }

    if (row === 0 || 
        row === WORLD_ROW_COUNT - 1 || 
        column === 0 || 
        column === WORLD_COLUMN_COUNT - 1
      ) {
      tileMap[row][column] = 1; // 1 represents border tile
    }
  }
}

let backgroundTiles = new Set();


// =============================== main code ============================== \\

window.onload = function() {
  board = document.getElementById("board");
  board.width = BOARD_WIDTH;
  board.height = BOARD_HEIGHT;
  context = board.getContext("2d");

  context.imageSmoothingEnabled = false;    //Ensures sharp images by disabeling interpolation of scaled images

  loadImages();
  loadMap();                                                                   //IDEA: Replace with createMap for Procedural Generation  

  camera.x = (WORLD_COLUMN_COUNT * WORLD_TILE_SIZE) / 2;
  camera.y = (WORLD_ROW_COUNT * WORLD_TILE_SIZE) / 2;
  camera.targetX = camera.x;
  camera.targetY = camera.y;

  update();   // start the game loop
  
  this.document.addEventListener("keydown", keyDownHandler);
  this.document.addEventListener("keyup", keyUpHandler);
  board.addEventListener("wheel", wheelHandler);
}

// Main game loop \\
function update() {
  updateCameraTarget();
  moveCamera();
  clampCamera();

  draw();

  setTimeout(update, 1000 / FPS); // calls Update again at fixed intervals to create the game loop
}


// =============================== Functions ============================== \\

// limits camera movement to stay within the world bounds
function clampCamera() {
  const HALF_WIDTH  = (BOARD_WIDTH  / camera.zoom) / 2;
  const HALF_HEIGHT = (BOARD_HEIGHT / camera.zoom) / 2;

  camera.targetX = Math.max(
    HALF_WIDTH,
    Math.min(WORLD_WIDTH - HALF_WIDTH, camera.targetX)
  );

  camera.targetY = Math.max(
    HALF_HEIGHT,
    Math.min(WORLD_HEIGHT - HALF_HEIGHT, camera.targetY)
  );
}

// smoothly moves camera towards target position by camera.smoothness %
function moveCamera() {
  camera.x = lerp(camera.x, camera.targetX, camera.smoothness);
  camera.y = lerp(camera.y, camera.targetY, camera.smoothness);
}

function wheelHandler(e) {
  e.preventDefault(); // prevent browser from scrolling 
  const zoomAmount = e.deltaY * -0.001;
  camera.zoom = Math.min(
    camera.maxZoom,
    Math.max(camera.minZoom, camera.zoom + zoomAmount)
  );
}

function keyDownHandler(e) {
  if (e.key in keysHeld) {
    keysHeld[e.key] = true;
    e.preventDefault();
  }
  if (e.key == "+") {
    camera.zoom = Math.min(camera.zoom + 0.1, camera.maxZoom);
  }
  else if (e.key == "-") {
    camera.zoom = Math.max(camera.zoom - 0.1, camera.minZoom);
  }
}

function keyUpHandler(e) {
  if (e.key in keysHeld) {
    keysHeld[e.key] = false;
  }
}

function updateCameraTarget() {
  if (keysHeld.w || keysHeld.ArrowUp) {
    camera.targetY -= camera.speed;
  }
  if (keysHeld.s || keysHeld.ArrowDown) {
    camera.targetY += camera.speed;
  }
  if (keysHeld.a || keysHeld.ArrowLeft) {
    camera.targetX -= camera.speed;
  }
  if (keysHeld.d || keysHeld.ArrowRight) {
    camera.targetX += camera.speed;
  }
}

function loadImages() {
  baseTileImage_00 = new Image();
  baseTileImage_00.src = "../assets/baseTile_00.png";

  borderTileImage_01 = new Image();
  borderTileImage_01.src = "../assets/borderTile_01.png";

  grassTileImage_02 = new Image();
  grassTileImage_02.src = "../assets/grassTile_02.png";
  
  grassTileImage_03 = new Image();
  grassTileImage_03.src = "../assets/grassTile_03.png";
}

function loadMap() {
  for (let row = 0; row < WORLD_ROW_COUNT; row++) {
    for (let column = 0; column < WORLD_COLUMN_COUNT; column++) {
      const TILE = tileMap[row][column];

      const X = column * WORLD_TILE_SIZE;
      const Y = row * WORLD_TILE_SIZE;
      
      switch (TILE) {
        case 0:
          backgroundTiles.add(new Block(baseTileImage_00, X, Y, WORLD_TILE_SIZE, WORLD_TILE_SIZE));
          break;
        case 1:
          backgroundTiles.add(new Block(borderTileImage_01, X, Y, WORLD_TILE_SIZE, WORLD_TILE_SIZE));
          break;
        case 2:
          backgroundTiles.add(new Block(grassTileImage_02, X, Y, WORLD_TILE_SIZE, WORLD_TILE_SIZE));
          break;
        case 3:
          backgroundTiles.add(new Block(grassTileImage_03, X, Y, WORLD_TILE_SIZE, WORLD_TILE_SIZE));
          break;
        default:
          backgroundTiles.add(new Block(baseTileImage_00, X, Y, WORLD_TILE_SIZE, WORLD_TILE_SIZE));
        
      }
    }
  }
}

function draw() {
  context.setTransform(1, 0, 0, 1, 0, 0);               // reset transform
  context.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);   // clear the board  

  // move origin to center of screen
  context.translate(BOARD_WIDTH / 2, BOARD_HEIGHT / 2); //Camera origin in the middle of the screen -> zooms towards center

  // apply zoom
  context.scale(camera.zoom, camera.zoom);              // zooms towards origin

  // move camera
  context.translate(-camera.x, -camera.y);              // move the world opposite to camera position

  // draw background tiles
  for (const tile of backgroundTiles) {
    context.drawImage(
      tile.image,
      tile.x,
      tile.y,
      tile.width,
      tile.height
    );
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

// linear interpolation function
function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

