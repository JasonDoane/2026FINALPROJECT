
const WIDTH = 800;
const HEIGHT = 600;

const COLORS = [
  0xff2d95, 0xff3b3b, 0xff9a3b, 0xffde3b, 0xfff36b, 0xa6ff3b,
  0x6bff6b, 0x3bffcc, 0x3b9bff, 0x4b6bff, 0x9b3bff
];

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0b0b0f',
  physics: { default: 'arcade', arcade: { debug: false, gravity: { y: 0 } } },
  scene: { preload, create, update }
};

new Phaser.Game(config);

function preload() {
  // Load the explosion sound effect
  this.load.audio('explosion', 'assests/dragon-studio-nuclear-explosion-386181.mp3');
}

function create() {
  // Set world bounds to be infinite
  this.physics.world.setBounds(-Infinity, -Infinity, Infinity, Infinity);
  
  // Configure camera for infinite world (no bounds)
  this.cameras.main.setZoom(1);
  
  const g = this.add.graphics();

  g.fillStyle(0xffffff);
  g.fillRect(0, 0, 16, 16);
  g.generateTexture('player', 16, 16);
  g.clear();

  g.fillRect(0, 0, 6, 12);
  g.generateTexture('bullet', 6, 12);
  g.clear();

  g.fillStyle(0xffffff);
  g.fillCircle(10, 10, 10);
  g.generateTexture('enemy', 20, 20);
  g.clear();

  this.player = this.physics.add.image(WIDTH/2, HEIGHT/2, 'player');
  this.player.setCollideWorldBounds(false); // Remove world bounds collision
  
  // Make camera follow player
  this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

  this.bullets = this.physics.add.group({ maxSize: 200 });
  this.enemies = this.physics.add.group({ maxSize: 300 });

  this.cursors = this.input.keyboard.createCursorKeys();
  this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  
  // Add WASD keys
  this.wasd = {
    up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
  };

  this.canShoot = true;
  this.time.addEvent({
    delay: 120,
    loop: true,
    callback: () => this.canShoot = true
  });

  this.time.addEvent({
    delay: 500,
    loop: true,
    callback: () => spawnEnemy.call(this)
  });

  this.physics.add.overlap(this.bullets, this.enemies, hitEnemy, null, this);
  
  // Add player-enemy collision
  this.physics.add.overlap(this.player, this.enemies, playerHitEnemy, null, this);
}

function update() {
  const speed = 200;
  this.player.setVelocity(0);

  // Arrow key movement
  if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
  if (this.cursors.right.isDown) this.player.setVelocityX(speed);
  if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
  if (this.cursors.down.isDown) this.player.setVelocityY(speed);
  
  // WASD movement
  if (this.wasd.left.isDown) this.player.setVelocityX(-speed);
  if (this.wasd.right.isDown) this.player.setVelocityX(speed);
  if (this.wasd.up.isDown) this.player.setVelocityY(-speed);
  if (this.wasd.down.isDown) this.player.setVelocityY(speed);

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
}

function shoot() {
  const bullet = this.bullets.get(this.player.x, this.player.y - 10, 'bullet');
  if (!bullet) return;

  bullet.setActive(true).setVisible(true);
  bullet.setVelocity(0, -400);
}

function spawnEnemy() {
  if (this.enemies.countActive(true) > 250) return;

  // Spawn enemies around the player's current position
    const playerX = this.player.x;
    const playerY = this.player.y;
    const spawnRadius = 1000;
    
    // Random angle and distance from player
    const angle = Phaser.Math.Between(0, 360);
    const distance = Phaser.Math.Between(spawnRadius/2, spawnRadius);
    
    const x = playerX + Math.cos(angle * Math.PI / 180) * distance;
    const y = playerY + Math.sin(angle * Math.PI / 180) * distance - 500; // Bias toward top
    
    const e = this.enemies.get(x, y, 'enemy');
    if (!e) return;

    e.setActive(true).setVisible(true);
    e.setVelocity(Phaser.Math.Between(-100,100), Phaser.Math.Between(50,150));
}

function hitEnemy(bullet, enemy) {
  bullet.setActive(false).setVisible(false);
  enemy.setActive(false).setVisible(false);
}

function playerHitEnemy(player, enemy) {
  // Play explosion sound
  this.sound.play('explosion');
  
  // Remove the enemy
  enemy.setActive(false).setVisible(false);
  
  // Optional: Add player damage or game over logic here
  // For now, just play sound and remove enemy
}
