// Globale Variablen für das Spielbrett
let board; // Das HTML5 Canvas-Element für das Spiel
const rowCount = 21; // Anzahl der Zeilen im Spielfeld
const columnCount = 19; // Anzahl der Spalten im Spielfeld
const tileSize = 32; // Größe eines einzelnen Tiles in Pixeln
const boardWidth = columnCount * tileSize; // Gesamtbreite des Spielfelds
const boardHeight = rowCount * tileSize; // Gesamthöhe des Spielfelds
let context; // 2D-Kontext des Canvas für das Zeichnen

// Bilder für die Spielobjekte
let blueGhostImage;
let orangeGhostImage;
let pinkGhostImage;
let redGhostImage;
let pacmanUpImage;
let pacmanDownImage;
let pacmanLeftImage;
let pacmanRightImage;
let wallImage;

// Tile-Map: Definiert das Layout des Spielfelds
// X = Wand, O = Überspringen, P = Pac-Man, ' ' = Essen
// Geister: b = blau, o = orange, p = pink, r = rot
const tileMap = [
    "XXXXXXXXXXXXXXXXXXX",
    "X        X        X",
    "X XX XXX X XXX XX X",
    "X                 X",
    "X XX X XXXXX X XX X",
    "X    X       X    X",
    "XXXX XXXX XXXX XXXX",
    "OOOX X       X XOOO",
    "XXXX X XXrXX X XXXX",
    "O       bpo       O",
    "XXXX X XXXXX X XXXX",
    "OOOX X       X XOOO",
    "XXXX X XXXXX X XXXX",
    "X        X        X",
    "X XX XXX X XXX XX X",
    "X  X     P     X  X",
    "XX X X XXXXX X X XX",
    "X    X   X   X    X",
    "X XXXXXX X XXXXXX X",
    "X                 X",
    "XXXXXXXXXXXXXXXXXXX" 
];

const walls = new Set();
const foods = new Set();
const ghosts = new Set();
let pacman;

const directions = ['U', 'D', 'L', 'R'];
let score = 0;
let lives = 3;
let gameOver = false;

window.onload = function() {
    board = this.document.getElementById("board"); // Canvas-Element holen
    board.height = boardHeight;                   // Höhe setzen
    board.width = boardWidth;                    // Breite setzen
    context = board.getContext("2d");           // 2D-Kontext für Zeichnen

    loadImages(); // Bilder laden
    loadMap(); // Spielfeld aus der Tile-Map erstellen
    // Zufällige Richtungen für Geister setzen
    for (let ghost of ghosts.values()) {
        const newDirection = directions[Math.floor(Math.random() * 4)];
        ghost.updateDirection(newDirection);
    }
    update(); // Spiel-Loop starten
    document.addEventListener("keyup", movePacman); // Event-Listener für Tasten
}

// Lädt alle Bilder für die Spielobjekte
function loadImages() {
    wallImage = new Image();
    wallImage.src = "../assets/wall.png";

    blueGhostImage = new Image();
    blueGhostImage.src = "../assets/blueGhost.png";
    orangeGhostImage = new Image();
    orangeGhostImage.src = "../assets/orangeGhost.png";
    pinkGhostImage = new Image();
    pinkGhostImage.src = "../assets/pinkGhost.png";
    redGhostImage = new Image();
    redGhostImage.src = "../assets/redGhost.png";

    pacmanUpImage = new Image();
    pacmanUpImage.src = "../assets/pacmanUp.png";
    pacmanDownImage = new Image();
    pacmanDownImage.src = "../assets/pacmanDown.png";
    pacmanLeftImage = new Image();
    pacmanLeftImage.src = "../assets/pacmanLeft.png";
    pacmanRightImage = new Image();
    pacmanRightImage.src = "../assets/pacmanRight.png";
}

// Erstellt das Spielfeld basierend auf der Tile-Map
function loadMap() {
    walls.clear(); // Vorherige Wände löschen
    foods.clear(); // Vorheriges Essen löschen
    ghosts.clear(); // Vorherige Geister löschen

    // Durch jede Zeile und Spalte iterieren
    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < columnCount; c++) {
            const row = tileMap[r];
            const tileMapChar = row[c]; // Zeichen an aktueller Position

            const x = c * tileSize; // X-Koordinate berechnen
            const y = r * tileSize; // Y-Koordinate berechnen

            // Je nach Zeichen das entsprechende Objekt erstellen
            if (tileMapChar == 'X') {
                const wall = new Block(wallImage, x, y, tileSize, tileSize);
                walls.add(wall);
            }
            else if (tileMapChar == 'b') {
                const blueGhost = new Block(blueGhostImage, x, y, tileSize, tileSize);
                ghosts.add(blueGhost);
            }
            else if (tileMapChar == 'o') {
                const orangeGhost = new Block(orangeGhostImage, x, y, tileSize, tileSize);
                ghosts.add(orangeGhost);
            }
            else if (tileMapChar == 'p') {
                const pinkGhost = new Block(pinkGhostImage, x, y, tileSize, tileSize);
                ghosts.add(pinkGhost);
            }
            else if (tileMapChar == 'r') {
                const redGhost = new Block(redGhostImage, x, y, tileSize, tileSize);
                ghosts.add(redGhost);
            }
            else if (tileMapChar == 'P') {
                pacman = new Block(pacmanRightImage, x, y, tileSize, tileSize);
            }
            else if (tileMapChar == ' ') {
                const food = new Block(null, x + 14, y + 14, 4, 4); // Kleines Essensstück
                foods.add(food);
            }
        }
    }
}

// Hauptspiel-Loop: Aktualisiert und zeichnet das Spiel
function update() {
    if (gameOver) {
        return; // Spiel beenden, wenn Game Over
    }
    move(); // Bewegungen berechnen
    draw(); // Spielfeld zeichnen
    setTimeout(update, 1000/20); // Nächsten Frame in 50ms planen (20 FPS)
}

// Zeichnet alle Spielobjekte auf das Canvas
function draw() {
    context.clearRect(0, 0, boardWidth, boardHeight); // Canvas löschen
    // Pac-Man zeichnen
    context.drawImage(pacman.image, pacman.x, pacman.y, pacman.width, pacman.height);
    // Geister zeichnen
    for (let ghost of ghosts) {
        context.drawImage(ghost.image, ghost.x, ghost.y, ghost.width, ghost.height);
    }
    // Wände zeichnen
    for (let wall of walls) {
        context.drawImage(wall.image, wall.x, wall.y, wall.width, wall.height);
    }
    // Essen als weiße Rechtecke zeichnen
    context.fillStyle = "white";
    for (let food of foods) {
        context.fillRect(food.x, food.y, food.width, food.height);
    }

    // Punktestand und Leben anzeigen
    context.fillStyle = "white";
    context.font = "14px Sans-Serif";
    if (gameOver) {
        context.fillText("Game Over: " + String(score), tileSize / 2, tileSize / 2);
    }
    else {
        context.fillText("x" + String(lives) + " " + String(score), tileSize / 2, tileSize / 2);
    }
}

// Behandelt die Bewegung aller Objekte und Kollisionen
function move() {
    // Pac-Man bewegen
    pacman.x += pacman.velocityX;
    pacman.y += pacman.velocityY;

    // Kollision mit Wänden prüfen und rückgängig machen
    for (wall of walls.values()) {
        if (collision(pacman, wall)) {
            pacman.x -= pacman.velocityX;
            pacman.y -= pacman.velocityY;
            break;
        }
    }

    // Geister bewegen und Kollisionen prüfen
    for (let ghost of ghosts.values()) {
        // Kollision mit Pac-Man: Leben verlieren
        if (collision(pacman, ghost)) {
            lives -= 1;
            if (lives <= 0) {
                gameOver = true;
                return;
            }
            resetPositions(); // Positionen zurücksetzen
        }

        // Spezielle Logik für Geister in der Mitte (zufällige Richtung)
        if (ghost.y == tileSize * 9 && ghost.direction != 'U' && ghost.direction != 'D' && ghost.direction != 'R') {
            if (Math.random() < 0.5) { ghost.updateDirection('U'); } else { ghost.updateDirection('D'); }
        }

        // Geist bewegen
        ghost.x += ghost.velocityX;
        ghost.y += ghost.velocityY;

        // Kollision mit Wänden oder Spielfeldrändern prüfen
        for (wall of walls.values()) {
            if (collision(ghost, wall) || ghost.x <= 0 || ghost.x + ghost.width >= boardWidth) {
                ghost.x -= ghost.velocityX;
                ghost.y -= ghost.velocityY;
                const newDirection = directions[Math.floor(Math.random() * 4)]; // Neue zufällige Richtung
                ghost.updateDirection(newDirection);
                break;
            }
        }
    }

    // Kollision mit Essen prüfen
    let foodeaten = null;
    for (let food of foods.values()) {
        if (collision(pacman, food)) {
            foodeaten = food;
            score += 10; // Punkte erhöhen
            break;
        }
    }
    foods.delete(foodeaten); // Gegessenes Essen entfernen

    // Wenn alles Essen aufgegessen: Nächstes Level laden
    if (foods.size == 0) {
        loadMap();
        resetPositions();
    }
}

// Behandelt Tastatureingaben für Pac-Man-Bewegung
function movePacman(e) {
    if (gameOver) {
        // Spiel neu starten
        loadMap();
        resetPositions();
        score = 0;
        lives = 3;
        gameOver = false;
        update(); // Spiel-Loop neu starten
        return;
    }
    // Richtung basierend auf Taste setzen
    if (e.code == "ArrowUp" || e.code == "KeyW") {
        pacman.updateDirection('U');
    }
    else if (e.code == "ArrowDown" || e.code == "KeyS") {
        pacman.updateDirection('D');
    }
    else if (e.code == "ArrowLeft" || e.code == "KeyA") {
        pacman.updateDirection('L');
    }
    else if (e.code == "ArrowRight" || e.code == "KeyD") {
        pacman.updateDirection('R');
    }

    // Bild von Pac-Man entsprechend der Richtung aktualisieren
    if (pacman.direction == 'U') {
        pacman.image = pacmanUpImage;
    }
    else if (pacman.direction == 'D') {
        pacman.image = pacmanDownImage;
    }
    else if (pacman.direction == 'L') {
        pacman.image = pacmanLeftImage;
    }
    else if (pacman.direction == 'R') {
        pacman.image = pacmanRightImage;
    }
}

// Prüft, ob zwei Objekte kollidieren (AABB-Kollision)
function collision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// Setzt alle Positionen auf die Startpositionen zurück
function resetPositions() {
    pacman.reset();
    pacman.velocityX = 0;
    pacman.velocityY = 0;
    for (let ghost of ghosts.values()) {
        ghost.reset();
        const newDirection = directions[Math.floor(Math.random() * 4)];
        ghost.updateDirection(newDirection);
    }
}

// Klasse für alle Spielobjekte (Blöcke wie Wände, Geister, Pac-Man, Essen)
class Block {
    constructor(image, x, y, width, height) {
        this.image = image; // Bild des Objekts
        this.x = x; // X-Position
        this.y = y; // Y-Position
        this.width = width; // Breite
        this.height = height; // Höhe

        this.startX = x; // Start-X-Position für Reset
        this.startY = y; // Start-Y-Position für Reset

        this.direction = 'R'; // Aktuelle Richtung
        this.velocityX = 0; // Geschwindigkeit in X-Richtung
        this.velocityY = 0; // Geschwindigkeit in Y-Richtung
    }

    // Aktualisiert die Richtung und prüft auf Kollisionen
    updateDirection(direction) {
        const prevDirection = this.direction;
        this.direction = direction;
        this.updateVelocity(); // Geschwindigkeit basierend auf Richtung setzen
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Kollision mit Wänden prüfen und bei Bedarf rückgängig machen
        for (let wall of walls.values()) {
            if (collision(this, wall)) {
                this.x -= this.velocityX;
                this.y -= this.velocityY;
                this.direction = prevDirection; // Alte Richtung wiederherstellen
                this.updateVelocity();
                break;
            }
        }
    }

    // Setzt die Geschwindigkeit basierend auf der aktuellen Richtung
    updateVelocity() {
        switch (this.direction) {
            case 'U':
                this.velocityX = 0;
                this.velocityY = -tileSize / 4; // Nach oben bewegen
                break;
            case 'D':
                this.velocityX = 0;
                this.velocityY = tileSize / 4; // Nach unten bewegen
                break;
            case 'L':
                this.velocityX = -tileSize / 4; // Nach links bewegen
                this.velocityY = 0;
                break;
            case 'R':
                this.velocityX = tileSize / 4; // Nach rechts bewegen
                this.velocityY = 0;
                break;
        }
    }

    // Setzt Position auf Startposition zurück
    reset() {
        this.x = this.startX;
        this.y = this.startY;
    }
}
