const WIDTH = 800;
const HEIGHT = 600;
const WORLD_HEIGHT = 200000; // effectively infinite vertical world

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0b0b0f',
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

function preload() {}

function create() {
  const scene = this;

  // Create simple textures for player, enemy, bullet and colored shards
  const g = this.add.graphics();
  g.fillStyle(0xffffff);
  g.fillRect(0, 0, 16, 16);
  g.generateTexture('player', 16, 16);
  g.clear();

  g.fillStyle(0xffffff);
  g.fillCircle(12, 12, 12);
  g.generateTexture('enemy', 24, 24);
  g.clear();

  g.fillStyle(0xffffff);
  g.fillRect(0, 0, 6, 14);
  g.generateTexture('bullet', 6, 14);
  g.clear();

  // Bolder, many colors (neon palette)
  const colors = [
    0xff2d95, 0xff3b3b, 0xff9a3b, 0xffde3b, 0xfff36b, 0xa6ff3b,
    0x6bff6b, 0x3bffcc, 0x3b9bff, 0x4b6bff, 0x9b3bff, 0xde3bff,
    0xff3bd1, 0xff6b9b, 0xffb86b, 0x6bffd9, 0x38ffd6, 0x8affff
  ];

  // Generate both round shards and long line textures for each color
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    // round shard
    g.fillStyle(c);
    g.fillCircle(8, 8, 8);
    g.generateTexture('shard' + i, 16, 16);
    g.clear();
    // thin line / streak texture
    g.fillStyle(c);
    g.fillRect(0, 0, 2, 28);
    g.generateTexture('line' + i, 2, 28);
    g.clear();
  }

  // Player
  // place player near the bottom of a very tall world so they can move "up" infinitely
  this.physics.world.setBounds(0, 0, WIDTH, WORLD_HEIGHT);
  this.cameras.main.setBounds(0, 0, WIDTH, WORLD_HEIGHT);
  this.player = this.physics.add.image(WIDTH / 2, WORLD_HEIGHT - 100, 'player').setCollideWorldBounds(true);
  // tint the player blue for a bold look
  this.player.setTint(0x3b9bff);
  this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
  this.cameras.main.setDeadzone(WIDTH * 0.25, HEIGHT * 0.18);
  this.player.setDamping(true);
  this.player.setDrag(0.8);

  // Groups
  this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: true });
  this.enemies = this.physics.add.group();

  // Controls
  this.cursors = this.input.keyboard.createCursorKeys();
  this.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  // WASD controls
  this.WASD = this.input.keyboard.addKeys({ W: Phaser.Input.Keyboard.KeyCodes.W, A: Phaser.Input.Keyboard.KeyCodes.A, S: Phaser.Input.Keyboard.KeyCodes.S, D: Phaser.Input.Keyboard.KeyCodes.D });

  // Score and UI
  this.score = 0;
  this.scoreText = this.add.text(12, 12, 'Score: 0', { font: '20px Arial', fill: '#ffffff' }).setDepth(10);

  // Spawn enemies rapidly around the camera to create a dense, hectic feel
  this.spawnInterval = 700; // initial ms
  this.spawnTimer = this.time.addEvent({ delay: this.spawnInterval, callback: spawnEnemyBurst, callbackScope: this, loop: true });

  // Collisions
  this.physics.add.overlap(this.bullets, this.enemies, onBulletHitEnemy, null, this);
  this.physics.add.overlap(this.player, this.enemies, onPlayerHit, null, this);

  // Difficulty ramp: increase spawn rate and intensity over time
  this.time.addEvent({ delay: 8000, loop: true, callback: () => {
    this.spawnInterval = Math.max(100, this.spawnInterval - 60);
    this.spawnTimer.remove(false);
    this.spawnTimer = this.time.addEvent({ delay: this.spawnInterval, callback: spawnEnemyBurst, callbackScope: this, loop: true });
  }});

  // Fast-paced feel: allow rapid-fire
  this.lastFired = 0;
  this.shootRate = 120; // ms

  // Camera scale for retro look
  this.cameras.main.setZoom(1);

  // Helper: spawn a single enemy somewhere around the current camera view
  function spawnEnemy() {
    const camTop = Math.floor(scene.cameras.main.worldView.y);
    const camBottom = camTop + HEIGHT;
    const x = Phaser.Math.Between(30, WIDTH - 30);
    // spawn slightly above the camera view so enemies drop into view
    const y = camTop - Phaser.Math.Between(20, 160);
    const e = scene.physics.add.image(x, y, 'enemy');
    e.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(100, 320));
    e.setData('hp', 1);
    scene.enemies.add(e);
  }

  // Spawn a burst of enemies (1-5) for higher density
  function spawnEnemyBurst() {
    const count = Phaser.Math.Between(2, 6);
    for (let i = 0; i < count; i++) {
      spawnEnemy();
    }
    // occasionally add a fast kamikaze enemy from the sides
    if (Phaser.Math.Between(0, 10) > 8) {
      const side = Phaser.Math.Between(0, 1) ? -40 : WIDTH + 40;
      const y = Math.floor(scene.cameras.main.worldView.y) + Phaser.Math.Between(50, HEIGHT - 50);
      const e = scene.physics.add.image(side, y, 'enemy');
      const vx = side < 0 ? Phaser.Math.Between(160, 340) : Phaser.Math.Between(-340, -160);
      e.setVelocity(vx, Phaser.Math.Between(-40, 40));
      scene.enemies.add(e);
    }
    // sometimes spawn a chaser enemy that homes on the player
    if (Phaser.Math.Between(0, 12) > 9) {
      spawnChaser();
    }
  }

  // Spawn a homing chaser enemy
  function spawnChaser() {
    const camTop = Math.floor(scene.cameras.main.worldView.y);
    const x = Phaser.Math.Between(40, WIDTH - 40);
    const y = camTop - Phaser.Math.Between(80, 220);
    const c = scene.physics.add.image(x, y, 'enemy');
    c.setData('isChaser', true);
    c.setData('chaseSpeed', Phaser.Math.Between(120, 220));
    c.setScale(1.1);
    scene.enemies.add(c);
  }

  // Explosion: spawn many colored shards as physics sprites (bigger, faster, bolder)
  this.spawnExplosion = function(x, y, amount = 72) {
    for (let i = 0; i < amount; i++) {
      const colorIdx = Phaser.Math.Between(0, colors.length - 1);
      // randomly choose round shard or line streak for variety
      const useLine = Phaser.Math.FloatBetween(0, 1) > 0.6;
      const key = useLine ? ('line' + colorIdx) : ('shard' + colorIdx);
      const s = scene.physics.add.image(x, y, key);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(useLine ? 240 : 160, useLine ? 920 : 680);
      s.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      s.setAngularVelocity(useLine ? Phaser.Math.Between(-400, 400) : Phaser.Math.Between(-1000, 1000));
      s.setScale(useLine ? Phaser.Math.FloatBetween(0.8, 3.6) : Phaser.Math.FloatBetween(0.9, 2.2));
      s.setDrag(useLine ? 8 : 20);
      s.setDepth(6);
      s.setAlpha(1);
      // rotate line shards to match their velocity vector
      if (useLine) {
        s.rotation = angle;
        // lengthen visually by scaling Y depending on speed
        s.setScale(1, Phaser.Math.Clamp(speed / 200, 1, 6));
      }
      // Fade to a more visible final alpha to keep bold colors
      scene.tweens.add({ targets: s, alpha: 0.5, ease: 'Cubic.easeOut', duration: 1200, onComplete: () => s.destroy() });
    }
  };

  // Explosion on large burst for flashy effect
  this.bigBoom = (x,y) => { this.spawnExplosion(x,y,96); };

  // Decorative neon lines that scroll slowly for bold background lines
  this.neonLines = this.add.group();
  function spawnNeonLine() {
    const colorIdx = Phaser.Math.Between(0, colors.length - 1);
    const camLeft = Math.floor(scene.cameras.main.worldView.x);
    const y = Math.floor(scene.cameras.main.worldView.y) + Phaser.Math.Between(0, HEIGHT);
    // create a tiled sprite positioned in world-space so it spans the full viewport width
    const line = scene.add.tileSprite(camLeft + WIDTH / 2, y, WIDTH, 8, 'line' + colorIdx).setOrigin(0.5, 0.5);
    line.setAlpha(0.14);
    line.setDepth(1);
    // ensure it moves with the world (not fixed to camera)
    line.setScrollFactor(1);
    scene.neonLines.add(line);
    // slowly move line downward relative to world so camera parallax shows motion
    scene.tweens.add({ targets: line, y: line.y + Phaser.Math.Between(60, 260), duration: Phaser.Math.Between(6000, 16000), ease: 'Sine.easeInOut', onComplete: () => { line.destroy(); } });
  }
  // spawn many neon lines over time
  this.time.addEvent({ delay: 300, loop: true, callback: spawnNeonLine });

  function onBulletHitEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.destroy();
    scene.spawnExplosion(enemy.x, enemy.y, Phaser.Math.Between(32, 64));
    scene.score += 10;
    scene.scoreText.setText('Score: ' + scene.score);
  }

  function onPlayerHit(player, enemy) {
    enemy.destroy();
    scene.bigBoom(player.x, player.y);
    scene.cameras.main.shake(300, 0.02);
    // small penalty and respawn
    scene.score = Math.max(0, scene.score - 50);
    scene.scoreText.setText('Score: ' + scene.score);
  }

  // Add initial barrage of color bursts
  // initial visual burst around the player's starting area
  this.time.addEvent({ delay: 1000, callback: () => { this.bigBoom(this.player.x, this.player.y - 40); }, callbackScope: this });
}

function update(time, delta) {
  const s = this;
  // Player movement
  const speed = 360;
  // Horizontal movement: cursors or A/D
  if (s.cursors.left.isDown || (s.WASD && s.WASD.A.isDown)) {
    s.player.setVelocityX(-speed);
  } else if (s.cursors.right.isDown || (s.WASD && s.WASD.D.isDown)) {
    s.player.setVelocityX(speed);
  } else {
    s.player.setVelocityX(0);
  }

  // Vertical movement: cursors or W/S
  if (s.cursors.up.isDown || (s.WASD && s.WASD.W.isDown)) s.player.setVelocityY(-160);
  else if (s.cursors.down.isDown || (s.WASD && s.WASD.S.isDown)) s.player.setVelocityY(160);
  else s.player.setVelocityY(0);

  // Shooting
  if (s.space.isDown && time > s.lastFired + s.shootRate) {
    s.lastFired = time;
    const b = s.physics.add.image(s.player.x, s.player.y - 14, 'bullet');
    b.setVelocityY(-520);
    b.setDepth(2);
    s.bullets.add(b);
    // small muzzle explosion
    s.spawnExplosion(s.player.x, s.player.y - 18, 10);
    // add a short-lived bullet trail using a colored line texture
    (function createTrail(bullet) {
      const colorIdx = Phaser.Math.Between(0, colors.length - 1);
      const trail = scene.add.image(bullet.x, bullet.y + 6, 'line' + colorIdx).setDepth(3);
      trail.setAlpha(0.95);
      trail.setScale(1, 0.6);
      trail.rotation = Math.PI / 2;
      // follow the bullet for a short time then fade
      const follow = scene.time.addEvent({ delay: 16, repeat: 8, callback: () => { if (!bullet.active) return; trail.x = bullet.x; trail.y = bullet.y + 6; } });
      scene.tweens.add({ targets: trail, alpha: 0.15, duration: 400, ease: 'Quad.easeOut', delay: 200, onComplete: () => { follow.remove(false); trail.destroy(); } });
    })(b);
  }

  // Clean up bullets off-screen (relative to camera)
  const camTop = Math.floor(s.cameras.main.worldView.y);
  const camBottom = camTop + HEIGHT;
  s.bullets.children.each(function(b) { if (b && (b.y < camTop - 200 || b.y > camBottom + 200)) b.destroy(); });

  // Enemies that move off the visible area: penalize if they pass below the camera, otherwise just destroy
  s.enemies.children.each(function(e) {
    if (!e) return;
    // If this enemy is a chaser, update its velocity toward the player
    if (e.getData && e.getData('isChaser')) {
      const speed = e.getData('chaseSpeed') || 180;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, s.player.x, s.player.y);
      e.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      // add a small visual pulse for chasers
      e.setTint(0xffe066);
    }
    if (e.y > camBottom + 240) {
      s.spawnExplosion(e.x, camBottom - 20, 14);
      e.destroy();
      s.score = Math.max(0, s.score - 2);
      s.scoreText.setText('Score: ' + s.score);
    } else if (e.y < camTop - 600 || e.x < -200 || e.x > WIDTH + 200) {
      e.destroy();
    }
  });
}
