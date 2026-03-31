const WIDTH = 800;
const HEIGHT = 600;

const COLORS = [
  0xff2d95, 0xff3b3b, 0xff9a3b, 0xffde3b, 0xfff36b, 0xa6ff3b,
  0x6bff6b, 0x3bffcc, 0x3b9bff, 0x4b6bff, 0x9b3bff
];

// Define all scene functions first
function preload() {
  // Load the explosion sound effect
  this.load.audio('explosion', 'assests/dragon-studio-nuclear-explosion-386181.mp3');
  // Load background music
  this.load.audio('bgMusic', 'assests/0331.MP3');
}

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0b0b0f',
  physics: { default: 'arcade', arcade: { debug: false, gravity: { y: 0 } } },
  scene: { 
    preload, 
    create, 
    update
  },
  fps: { target: 60, forceSetTimeOut: true },
  render: { pixelArt: false, antialias: true }
};

new Phaser.Game(config);

function create() {
  // Set world bounds to be infinite
  this.physics.world.setBounds(-Infinity, -Infinity, Infinity, Infinity);
  
  // Configure camera for infinite world (no bounds)
  this.cameras.main.setZoom(1);
  
  // Define colors before using them
  this.originalPlayerColor = 0xffffff;
  this.readyPlayerColor = 0x4169e1; // Royal blue
  
  const g = this.add.graphics();

  g.fillStyle(0xffffff);
  g.fillRect(0, 0, 16, 16);
  g.generateTexture('player', 16, 16);
  g.clear();

  g.fillRect(0, 0, 6, 12);
  g.generateTexture('bullet', 6, 12);
  g.clear();

  // Generate purple enemy texture
  g.fillStyle(0x800080); // Purple
  g.fillCircle(10, 10, 10);
  g.generateTexture('enemy_purple', 20, 20);
  g.clear();
  
  this.enemyTextures = ['enemy_purple']; // Only purple texture
  
  // Generate triangle enemy texture
  g.fillStyle(0x00ff00); // Green
  g.fillTriangle(10, 0, 0, 20, 20, 20); // Triangle pointing up
  g.generateTexture('triangle_enemy', 20, 20);
  g.clear();
  
  // Generate pentagon health pickup texture
  g.fillStyle(0xffff00); // Yellow
  g.beginPath();
  g.moveTo(10, 0); // Top point
  g.lineTo(19, 6); // Top right
  g.lineTo(16, 18); // Bottom right
  g.lineTo(4, 18); // Bottom left
  g.lineTo(1, 6); // Top left
  g.closePath();
  g.fillPath();
  g.generateTexture('pentagon_health', 20, 20);
  g.clear();
  
  // Generate hexagon enemy texture
  g.fillStyle(0xff0000); // Red
  g.beginPath();
  g.moveTo(10, 0); // Top point
  g.lineTo(17, 5); // Top right
  g.lineTo(17, 15); // Bottom right
  g.lineTo(10, 20); // Bottom point
  g.lineTo(3, 15); // Bottom left
  g.lineTo(3, 5); // Top left
  g.closePath();
  g.fillPath();
  g.generateTexture('hexagon_enemy', 20, 20);
  g.clear();
  
  // Track triangle enemies
  this.triangleEnemies = this.physics.add.group({ maxSize: 50 });
  
  // Track hexagon enemies
  this.hexagonEnemies = this.physics.add.group({ maxSize: 30 });
  
  // Track pentagon health pickups
  this.pentagonPickups = this.physics.add.group({ maxSize: 10 });

  this.player = this.physics.add.image(WIDTH/2, HEIGHT/2, 'player');
  this.player.setCollideWorldBounds(false); // Remove world bounds collision
  
  // Make camera follow player with smoother following
  this.cameras.main.startFollow(this.player, true, 0.1, 0.1); // Reduced lerp for smoother following
  this.cameras.main.setRoundPixels(false); // Allow sub-pixel positioning
  
  // Set initial player color to royal blue (ready state)
  this.player.tint = this.readyPlayerColor;

  this.bullets = this.physics.add.group({ maxSize: 200 });
  this.enemies = this.physics.add.group({ maxSize: 500 }); // Increased from 300

  this.cursors = this.input.keyboard.createCursorKeys();
  this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  
  // Add WASD keys
  this.wasd = {
    up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
  };
  
  // Add shift key for teleport
  this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  
  // Add E key for explosion ability
  this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  
  // Teleport cooldown
  this.canTeleport = true;
  this.teleportCooldown = 2000; // 2 second cooldown
  
  // Explosion ability cooldown
  this.canExplode = true;
  this.explosionCooldown = 2000; // 2 second cooldown
  
  // Setup background music
  this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.5 });
  
  // Add key listener to start music on first key press
  this.musicStarted = false;
  const startMusic = () => {
    if (!this.musicStarted) {
      this.musicStarted = true;
      this.bgMusic.play();
    }
  };
  
  // Listen for any key press
  this.input.keyboard.on('keydown', startMusic);
  this.input.on('pointerdown', startMusic);
  
  // Score system
  this.score = 0;
  this.scoreText = this.add.text(10, 10, 'Score: 0', {
    fontSize: '20px',
    fill: '#ffffff',
    fontFamily: 'Arial'
  });
  this.scoreText.setScrollFactor(0); // Keep text fixed on screen
  
  // Health system
  this.health = 3;
  this.maxHealth = 3;
  this.hearts = [];
  this.invulnerable = false; // Add invulnerability state
  
  // Create heart sprites (red squares)
  for (let i = 0; i < this.maxHealth; i++) {
    const heart = this.add.graphics();
    heart.fillStyle(0xff0000);
    heart.fillRect(10 + i * 25, 40, 20, 20); // Red square
    heart.setScrollFactor(0); // Keep fixed on screen
    this.hearts.push(heart);
  }

  this.canShoot = true;
  this.time.addEvent({
    delay: 120,
    loop: true,
    callback: () => this.canShoot = true
  });

  this.time.addEvent({
    delay: 50, // Reduced from 200ms to 50ms for much faster spawning
    loop: true,
    callback: () => spawnEnemy.call(this)
  });
  
  // Triangle enemy spawner (only when score >= 15)
  this.time.addEvent({
    delay: 1500, // Spawn triangle every 1.5 seconds (more common)
    loop: true,
    callback: () => {
      if (this.score >= 15) {
        spawnTriangleEnemy.call(this);
      }
    }
  });
  
  // Hexagon enemy spawner (only when score >= 20)
  this.time.addEvent({
    delay: 3000, // Spawn hexagon every 3 seconds
    loop: true,
    callback: () => {
      if (this.score >= 20) {
        spawnHexagonEnemy.call(this);
      }
    }
  });
  
  // Pentagon health pickup spawner (more common)
  this.time.addEvent({
    delay: 5000, // Try to spawn every 5 seconds (was 10 seconds)
    loop: true,
    callback: () => {
      if (Math.random() < 0.5) { // 50% chance to spawn (was 30%)
        spawnPentagonPickup.call(this);
      }
    }
  });
  
  // Score increment timer - increase score by 1 every 3 seconds
  this.time.addEvent({
    delay: 1500,
    loop: true,
    callback: () => {
      this.score++;
      this.scoreText.setText('Score: ' + this.score);
    }
  });

  this.physics.add.overlap(this.bullets, this.enemies, hitEnemy, null, this);
  this.physics.add.overlap(this.bullets, this.triangleEnemies, hitEnemy, null, this);
  
  // Add player-enemy collision
  this.physics.add.overlap(this.player, this.enemies, playerHitEnemy, null, this);
  this.physics.add.overlap(this.player, this.triangleEnemies, playerHitEnemy, null, this);
  this.physics.add.overlap(this.player, this.hexagonEnemies, playerHitEnemy, null, this);
  
  // Add player-pentagon collision for health restoration
  this.physics.add.overlap(this.player, this.pentagonPickups, collectPentagon, null, this);
  
  // Ensure triangle enemies have proper physics bodies
  this.triangleEnemies.children.each(triangle => {
    triangle.body.setSize(20, 20); // Ensure collision box matches sprite size
  });
}

function update() {
  // If game is over, don't process any input or updates
  if (this.gameOver) return;
  
  const speed = 200;
  
  // Update triangle enemies
  this.triangleEnemies.children.each(triangle => {
    if (!triangle.active) return;
    
    // Initialize if needed
    if (!triangle.currentDirection) {
      triangle.distanceTraveled = 0;
      triangle.targetDistance = Phaser.Math.Between(1200, 3000); // 1200-3000px
      
      // Choose random direction (no player tracking)
      const directions = ['up', 'down', 'left', 'right'];
      triangle.currentDirection = Phaser.Utils.Array.GetRandom(directions);
    }
    
    // Check if traveled enough distance
    if (triangle.distanceTraveled >= triangle.targetDistance) {
      // Reset distance and choose new random direction
      triangle.distanceTraveled = 0;
      triangle.targetDistance = Phaser.Math.Between(1200, 3000); // 1200-3000px
      
      // Choose new random direction
      const directions = ['up', 'down', 'left', 'right'];
      triangle.currentDirection = Phaser.Utils.Array.GetRandom(directions);
    }
    
    // Move in current direction (faster speed)
    switch(triangle.currentDirection) {
      case 'right':
        triangle.setVelocity(360, 0);
        break;
      case 'left':
        triangle.setVelocity(-360, 0);
        break;
      case 'down':
        triangle.setVelocity(0, 360);
        break;
      case 'up':
        triangle.setVelocity(0, -360);
        break;
    }
    
    // Track distance traveled
    triangle.distanceTraveled += 360; // Since moving 360px per frame
  });
  
  // Update hexagon enemies (track player)
  this.hexagonEnemies.children.each(hexagon => {
    if (!hexagon.active) return;
    
    // Calculate direction to player
    const dx = this.player.x - hexagon.x;
    const dy = this.player.y - hexagon.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Normalize and apply speed (slower than triangles but persistent)
      const speed = 150;
      hexagon.setVelocity((dx / distance) * speed, (dy / distance) * speed);
    }
  });
  
  // Use interpolation for smoother movement
  const targetX = this.player.x;
  const targetY = this.player.y;
  
  // Track current movement direction for teleport
  let moveX = 0;
  let moveY = 0;

  // Arrow key movement
  if (this.cursors.left.isDown) {
    this.player.setVelocityX(-speed);
    moveX = -1;
  }
  if (this.cursors.right.isDown) {
    this.player.setVelocityX(speed);
    moveX = 1;
  }
  if (this.cursors.up.isDown) {
    this.player.setVelocityY(-speed);
    moveY = -1;
  }
  if (this.cursors.down.isDown) {
    this.player.setVelocityY(speed);
    moveY = 1;
  }
  
  // WASD movement
  if (this.wasd.left.isDown) {
    this.player.setVelocityX(-speed);
    moveX = -1;
  }
  if (this.wasd.right.isDown) {
    this.player.setVelocityX(speed);
    moveX = 1;
  }
  if (this.wasd.up.isDown) {
    this.player.setVelocityY(-speed);
    moveY = -1;
  }
  if (this.wasd.down.isDown) {
    this.player.setVelocityY(speed);
    moveY = 1;
  }
  
  // Stop movement if no keys pressed
  if (!this.cursors.left.isDown && !this.cursors.right.isDown && 
      !this.wasd.left.isDown && !this.wasd.right.isDown) {
    this.player.setVelocityX(0);
  }
  if (!this.cursors.up.isDown && !this.cursors.down.isDown && 
      !this.wasd.up.isDown && !this.wasd.down.isDown) {
    this.player.setVelocityY(0);
  }
  
  // Handle teleport
  if (this.shiftKey.isDown && this.canTeleport) {
    teleport.call(this, moveX, moveY);
    this.canTeleport = false;
    
    // Change player back to original color when used
    this.player.tint = this.originalPlayerColor;
    
    // Reset cooldown and update color
    this.time.addEvent({
      delay: this.teleportCooldown,
      callback: () => {
        this.canTeleport = true;
        // Change player to royal blue when ready
        this.player.tint = this.readyPlayerColor;
      }
    });
  }
  
  // Handle explosion ability
  if (this.eKey.isDown && this.canExplode) {
    explodeEnemies.call(this);
    this.canExplode = false;
    
    // Reset cooldown
    this.time.addEvent({
      delay: this.explosionCooldown,
      callback: () => this.canExplode = true
    });
  }

  if (this.space.isDown && this.canShoot) {
    shoot.call(this);
    this.canShoot = false;
  }

  // cleanup far enemies (increased distance for infinite world)
  this.enemies.children.each(e => {
    if (!e.active) return;
    const dx = e.x - this.player.x;
    const dy = e.y - this.player.y;
    if (dx*dx + dy*dy > 2000*2000) {
      e.setActive(false).setVisible(false);
    }
  });
  
  // cleanup far triangle enemies
  this.triangleEnemies.children.each(e => {
    if (!e.active) return;
    const dx = e.x - this.player.x;
    const dy = e.y - this.player.y;
    if (dx*dx + dy*dy > 2000*2000) {
      e.setActive(false).setVisible(false);
    }
  });
  
  // cleanup far hexagon enemies
  this.hexagonEnemies.children.each(e => {
    if (!e.active) return;
    const dx = e.x - this.player.x;
    const dy = e.y - this.player.y;
    if (dx*dx + dy*dy > 2000*2000) {
      e.setActive(false).setVisible(false);
    }
  });
  
  // cleanup far pentagon pickups
  this.pentagonPickups.children.each(p => {
    if (!p.active) return;
    const dx = p.x - this.player.x;
    const dy = p.y - this.player.y;
    if (dx*dx + dy*dy > 2000*2000) {
      p.setActive(false).setVisible(false);
    }
  });
}

function spawnTriangleEnemy() {
  if (this.triangleEnemies.countActive(true) > 10) return;
  
  const playerX = this.player.x;
  const playerY = this.player.y;
  const minDistance = 200; // Spawn further away than normal enemies
  const spawnRadius = 1200;
  
  // Find valid spawn position
  let angle, distance, x, y;
  do {
    angle = Phaser.Math.Between(0, 360);
    distance = Phaser.Math.Between(minDistance, spawnRadius);
    
    x = playerX + Math.cos(angle * Math.PI / 180) * distance;
    y = playerY + Math.sin(angle * Math.PI / 180) * distance;
  } while (Math.sqrt((x - playerX) * (x - playerX) + (y - playerY) * (y - playerY)) < minDistance);
  
  const triangle = this.triangleEnemies.get(x, y, 'triangle_enemy');
  if (!triangle) return;
  
  triangle.setActive(true).setVisible(true);
  
  // Set initial movement properties
  triangle.distanceTraveled = 0;
  triangle.targetDistance = Phaser.Math.Between(1200, 3000); // 1200-3000px
  triangle.currentDirection = null;
}

function spawnHexagonEnemy() {
  if (this.hexagonEnemies.countActive(true) > 5) return;
  
  const playerX = this.player.x;
  const playerY = this.player.y;
  const minDistance = 300; // Spawn further away
  const spawnRadius = 1200;
  
  // Find valid spawn position
  let angle, distance, x, y;
  do {
    angle = Phaser.Math.Between(0, 360);
    distance = Phaser.Math.Between(minDistance, spawnRadius);
    
    x = playerX + Math.cos(angle * Math.PI / 180) * distance;
    y = playerY + Math.sin(angle * Math.PI / 180) * distance;
  } while (Math.sqrt((x - playerX) * (x - playerX) + (y - playerY) * (y - playerY)) < minDistance);
  
  const hexagon = this.hexagonEnemies.get(x, y, 'hexagon_enemy');
  if (!hexagon) return;
  
  hexagon.setActive(true).setVisible(true);
  hexagon.setVelocity(0); // Will be updated in update function
}

function spawnPentagonPickup() {
  if (this.pentagonPickups.countActive(true) > 3) return;
  
  const playerX = this.player.x;
  const playerY = this.player.y;
  const minDistance = 100; // Spawn closer to player
  const spawnRadius = 300; // Much smaller spawn radius
  
  // Find valid spawn position
  let angle, distance, x, y;
  do {
    angle = Phaser.Math.Between(0, 360);
    distance = Phaser.Math.Between(minDistance, spawnRadius);
    
    x = playerX + Math.cos(angle * Math.PI / 180) * distance;
    y = playerY + Math.sin(angle * Math.PI / 180) * distance;
  } while (Math.sqrt((x - playerX) * (x - playerX) + (y - playerY) * (y - playerY)) < minDistance);
  
  const pentagon = this.pentagonPickups.get(x, y, 'pentagon_health');
  if (!pentagon) return;
  
  pentagon.setActive(true).setVisible(true);
  pentagon.setVelocity(0); // Stationary pickup
}

function collectPentagon(player, pentagon) {
  // Remove the pentagon
  pentagon.setActive(false).setVisible(false);
  
  // Restore 1 heart if not at max health
  if (this.health < this.maxHealth) {
    this.health++;
    
    // Show the restored heart
    if (this.health > 0 && this.health <= this.hearts.length) {
      this.hearts[this.health - 1].setVisible(true);
    }
  }
}

function shoot() {
  const bullet = this.bullets.get(this.player.x, this.player.y - 10, 'bullet');
  if (!bullet) return;

  bullet.setActive(true).setVisible(true);
  bullet.setVelocity(0, -400);
}

function spawnEnemy() {
  if (this.enemies.countActive(true) > 400) return; // Increased from 250

  // Spawn enemies around the player's current position
    const playerX = this.player.x;
    const playerY = this.player.y;
    const spawnRadius = 1000;
    const minDistance = 150; // Minimum distance from player
    
    // Random angle and distance from player
    let angle, distance, x, y;
    
    // Keep trying until we find a valid spawn position
    do {
      angle = Phaser.Math.Between(0, 360);
      distance = Phaser.Math.Between(minDistance, spawnRadius);
      
      x = playerX + Math.cos(angle * Math.PI / 180) * distance;
      y = playerY + Math.sin(angle * Math.PI / 180) * distance - 500; // Bias toward top
    } while (Math.sqrt((x - playerX) * (x - playerX) + (y - playerY) * (y - playerY)) < minDistance);
    
    const e = this.enemies.get(x, y, 'enemy_purple');
    if (!e) return;

    e.setActive(true).setVisible(true);
  // Speed increases by 100 every 20 score points indefinitely
  const speedIncrease = Math.floor(this.score / 20) * 100;
  const speed = 200 + speedIncrease;
  e.setVelocity(Phaser.Math.Between(-speed, speed), Phaser.Math.Between(-speed, speed));
}

function hitEnemy(bullet, enemy) {
  bullet.setActive(false).setVisible(false);
  enemy.setActive(false).setVisible(false);
}

function playerHitEnemy(player, enemy) {
  // Check if player is invulnerable
  if (this.invulnerable) return;
  
  // Make player invulnerable for 1 second
  this.invulnerable = true;
  this.time.addEvent({
    delay: 1000,
    callback: () => this.invulnerable = false
  });
  
  // Play explosion sound
  this.sound.play('explosion');
  
  // Remove the enemy
  enemy.setActive(false).setVisible(false);
  
  // Reduce health by 1
  this.health--;
  
  // Remove a heart
  if (this.health >= 0 && this.health < this.hearts.length) {
    this.hearts[this.health].setVisible(false);
  }
  
  // Check for game over
  if (this.health <= 0) {
    // Stop all game activity
    this.time.paused = true;
    this.player.setVelocity(0);
    this.player.setAcceleration(0);
    this.gameOver = true; // Add game over flag
    
    // Create game over screen
    const gameOverScreen = this.add.graphics();
    gameOverScreen.fillStyle(0x000000, 0.8); // Semi-transparent black background
    gameOverScreen.fillRect(0, 0, WIDTH, HEIGHT);
    gameOverScreen.setScrollFactor(0); // Fixed to camera
    gameOverScreen.setDepth(1000);
    
    // Game over text
    const gameOverText = this.add.text(WIDTH/2, HEIGHT/2 - 50, 'GAME OVER', {
      fontSize: '48px',
      fill: '#ff0000',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });
    gameOverText.setOrigin(0.5);
    gameOverText.setScrollFactor(0); // Fixed to camera
    gameOverText.setDepth(1001);
    
    // Final score text
    const finalScoreText = this.add.text(WIDTH/2, HEIGHT/2 + 20, 'Final Score: ' + this.score, {
      fontSize: '24px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    });
    finalScoreText.setOrigin(0.5);
    finalScoreText.setScrollFactor(0); // Fixed to camera
    finalScoreText.setDepth(1001);
    
    // Restart instruction
    const restartText = this.add.text(WIDTH/2, HEIGHT/2 + 80, 'Press R to Restart', {
      fontSize: '20px',
      fill: '#ffff00',
      fontFamily: 'Arial'
    });
    restartText.setOrigin(0.5);
    restartText.setScrollFactor(0); // Fixed to camera
    restartText.setDepth(1001);
    
    // Store references for cleanup
    this.gameOverScreen = gameOverScreen;
    this.gameOverTexts = [gameOverText, finalScoreText, restartText];
    
    // Add restart key listener
    this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.rKey.on('down', () => {
      // Clean up game over screen
      if (this.gameOverScreen) {
        this.gameOverScreen.destroy();
      }
      if (this.gameOverTexts) {
        this.gameOverTexts.forEach(text => text.destroy());
      }
      
      // Reset game state
      this.health = 3;
      this.score = 0;
      this.scoreText.setText('Score: ' + this.score);
      
      // Reset hearts
      this.hearts.forEach(heart => heart.setVisible(true));
      
      // Reset player position
      this.player.setPosition(WIDTH/2, HEIGHT/2);
      
      // Clear all enemies
      this.enemies.children.each(enemy => {
        enemy.setActive(false).setVisible(false);
      });
      this.triangleEnemies.children.each(triangle => {
        triangle.setActive(false).setVisible(false);
      });
      this.pentagonPickups.children.each(pentagon => {
        pentagon.setActive(false).setVisible(false);
      });
      
      // Resume game
      this.time.paused = false;
      this.gameOver = false; // Reset game over flag
      
      // Reset abilities
      this.canTeleport = true;
      this.canExplode = true;
      this.player.tint = this.readyPlayerColor;
    });
  }
  
  // Flash player to show invulnerability
  this.player.setAlpha(0.5);
  this.time.addEvent({
    delay: 1000,
    callback: () => this.player.setAlpha(1)
  });
}

function teleport(moveX, moveY) {
  // If not moving, teleport in a random direction
  if (moveX === 0 && moveY === 0) {
    const angle = Phaser.Math.Between(0, 360);
    moveX = Math.cos(angle * Math.PI / 180);
    moveY = Math.sin(angle * Math.PI / 180);
  }
  
  // Normalize diagonal movement
  const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
  if (magnitude > 0) {
    moveX = moveX / magnitude;
    moveY = moveY / magnitude;
  }
  
  // Teleport 100px in the direction of travel
  const teleportDistance = 100;
  const newX = this.player.x + moveX * teleportDistance;
  const newY = this.player.y + moveY * teleportDistance;
  
  // Create teleport effect (optional visual feedback)
  const flash = this.add.graphics();
  flash.fillStyle(0xffffff, 0.5);
  flash.fillCircle(this.player.x, this.player.y, 30);
  flash.setDepth(1000);
  
  // Move player
  this.player.setPosition(newX, newY);
  
  // Remove flash effect after 100ms
  this.time.addEvent({
    delay: 100,
    callback: () => flash.destroy()
  });
}

function explodeEnemies() {
  const explosionRadius = 150;
  const playerX = this.player.x;
  const playerY = this.player.y;
  
  // Temporarily disable player-enemy collision
  this.physics.world.disable(this.player, this.enemies);
  this.physics.world.disable(this.player, this.triangleEnemies);
  this.physics.world.disable(this.player, this.hexagonEnemies);
  
  // Create red explosion circle effect
  const explosion = this.add.graphics();
  explosion.fillStyle(0xff0000, 0.3); // Red with transparency
  explosion.fillCircle(playerX, playerY, explosionRadius);
  explosion.setDepth(999);
  
  // Play explosion sound
  this.sound.play('explosion');
  
  // Destroy all enemies within radius without affecting player health
  let enemiesDestroyed = 0;
  this.enemies.children.each(enemy => {
    if (!enemy.active) return;
    
    const dx = enemy.x - playerX;
    const dy = enemy.y - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= explosionRadius) {
      enemy.setActive(false).setVisible(false);
      enemiesDestroyed++;
    }
  });
  
  // Also destroy triangle enemies within radius
  this.triangleEnemies.children.each(triangle => {
    if (!triangle.active) return;
    
    const dx = triangle.x - playerX;
    const dy = triangle.y - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= explosionRadius) {
      triangle.setActive(false).setVisible(false);
      enemiesDestroyed++;
    }
  });
  
  // Also destroy hexagon enemies within radius
  this.hexagonEnemies.children.each(hexagon => {
    if (!hexagon.active) return;
    
    const dx = hexagon.x - playerX;
    const dy = hexagon.y - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= explosionRadius) {
      hexagon.setActive(false).setVisible(false);
      enemiesDestroyed++;
    }
  });
  
  // Add points for enemies destroyed
  if (enemiesDestroyed > 0) {
    this.score += enemiesDestroyed;
    this.scoreText.setText('Score: ' + this.score);
  }
  
  // Re-enable collision after a short delay
  this.time.addEvent({
    delay: 100,
    callback: () => {
      this.physics.world.enable(this.player, this.enemies);
      this.physics.world.enable(this.player, this.triangleEnemies);
      this.physics.world.enable(this.player, this.hexagonEnemies);
      this.physics.add.overlap(this.player, this.enemies, playerHitEnemy, null, this);
      this.physics.add.overlap(this.player, this.triangleEnemies, playerHitEnemy, null, this);
      this.physics.add.overlap(this.player, this.hexagonEnemies, playerHitEnemy, null, this);
    }
  });
  
  // Remove explosion effect after 200ms
  this.time.addEvent({
    delay: 200,
    callback: () => explosion.destroy()
  });
}
