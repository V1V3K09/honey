import confetti from 'canvas-confetti';
import { sfx } from './audio-fx';

interface FallingItem {
  id: number;
  type: 'cake' | 'blessing' | 'samosa' | 'gift' | 'hazard';
  icon: string;
  name: string;
  x: number;
  y: number;
  vy: number;
  size: number;
  rot: number;
  rotSpeed: number;
  points: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
}

interface PopupText {
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
}

export class AkiArcadeGame {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 400;
  private height: number = 320;

  private state: 'start' | 'playing' | 'boss' | 'victory' | 'gameover' = 'start';
  private score: number = 0;
  private highScore: number = 0;
  private targetScore: number = 300;
  private lives: number = 3;
  private combo: number = 0;

  // Player Paddle (Aki's Feast Plate)
  private playerX: number = 200;
  private targetPlayerX: number = 200;
  private playerWidth: number = 84;
  private playerHeight: number = 18;

  // Game loop & spawning
  private items: FallingItem[] = [];
  private particles: Particle[] = [];
  private popups: PopupText[] = [];
  private lastSpawnTime: number = 0;
  private spawnInterval: number = 650;
  private animFrameId: number | null = null;
  private isVisible: boolean = false;
  private nextItemId: number = 1;

  // Boss wave state
  private bossTimer: number = 0;
  private bossHealth: number = 50;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = container.querySelector('.game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Load High Score
    try {
      this.highScore = parseInt(localStorage.getItem('aki_arcade_high') || '0', 10);
    } catch {
      this.highScore = 0;
    }

    this.resize();
    this.bindControls();
    this.setupObserver();
    this.renderInitialUI();
  }

  private resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    this.width = rect ? Math.max(320, rect.width) : 400;
    this.height = 320;
    this.canvas.width = this.width * Math.min(window.devicePixelRatio, 2);
    this.canvas.height = this.height * Math.min(window.devicePixelRatio, 2);
    this.ctx.scale(Math.min(window.devicePixelRatio, 2), Math.min(window.devicePixelRatio, 2));
    this.playerX = this.width / 2;
    this.targetPlayerX = this.width / 2;
  }

  private setupObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible && (this.state === 'playing' || this.state === 'boss')) {
            if (!this.animFrameId) this.loop(performance.now());
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(this.container);
  }

  private bindControls() {
    // Mouse movement inside canvas
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      this.targetPlayerX = (e.clientX - rect.left) * scaleX;
    });

    // Touch movement
    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        this.targetPlayerX = (e.touches[0].clientX - rect.left) * scaleX;
        e.preventDefault();
      }
    }, { passive: false });

    // Click canvas to start or attack during boss
    this.canvas.addEventListener('click', (e) => {
      if (this.state === 'start' || this.state === 'gameover' || this.state === 'victory') {
        this.start();
      } else if (this.state === 'boss') {
        this.hitBoss(rectifyCoords(e));
      }
    });

    const rectifyCoords = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (this.width / rect.width),
        y: (e.clientY - rect.top) * (this.height / rect.height)
      };
    };

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      // Only process when container or canvas is hovered or focused
      const isTarget = document.activeElement === this.container || 
                       this.container.contains(document.activeElement) || 
                       this.container.matches(':hover');

      if (!isTarget) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.targetPlayerX = Math.max(this.playerWidth / 2, this.targetPlayerX - 32);
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.targetPlayerX = Math.min(this.width - this.playerWidth / 2, this.targetPlayerX + 32);
        e.preventDefault();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (this.state === 'start' || this.state === 'gameover' || this.state === 'victory') {
          this.start();
          e.preventDefault();
        } else if (this.state === 'boss') {
          this.hitBoss({ x: this.width / 2, y: this.height / 2 });
          e.preventDefault();
        }
      }
    });

    // Start / Restart button listener
    const restartBtn = this.container.querySelector('.game-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.start());
    }

    const startBtn = this.container.querySelector('.btn-start-game');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.start());
    }

    window.addEventListener('resize', () => this.resize());
  }

  public start() {
    this.state = 'playing';
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.items = [];
    this.particles = [];
    this.popups = [];
    this.lastSpawnTime = performance.now();
    this.targetPlayerX = this.width / 2;
    this.playerX = this.width / 2;

    sfx.playPop();
    this.updateHUD();

    const startOverlay = this.container.querySelector('.game-start-overlay') as HTMLElement;
    if (startOverlay) startOverlay.style.display = 'none';

    const victoryOverlay = this.container.querySelector('.game-victory-overlay') as HTMLElement;
    if (victoryOverlay) victoryOverlay.classList.remove('is-active');

    const gameOverOverlay = this.container.querySelector('.game-over-overlay') as HTMLElement;
    if (gameOverOverlay) gameOverOverlay.style.display = 'none';

    if (!this.animFrameId) {
      this.loop(performance.now());
    }
  }

  private spawnItem(now: number) {
    const isSpecial = Math.random() < 0.25;
    const isHazard = Math.random() < 0.35;

    let item: FallingItem;
    const x = Math.random() * (this.width - 60) + 30;

    if (isHazard) {
      const hazards = [
        { icon: '⚡', name: 'LOWER BACK PAIN' },
        { icon: '📑', name: 'INCOME TAX BILL' },
        { icon: '⏰', name: 'MONDAY 6 AM ALARM' },
        { icon: '👴', name: 'GREY HAIR STRAND' }
      ];
      const h = hazards[Math.floor(Math.random() * hazards.length)];
      item = {
        id: this.nextItemId++,
        type: 'hazard',
        icon: h.icon,
        name: h.name,
        x,
        y: -30,
        vy: 2.2 + Math.random() * 1.4,
        size: 26,
        rot: 0,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        points: -1
      };
    } else if (isSpecial) {
      const specials = [
        { icon: '🪔', name: 'RADHE RADHE BLESSING', pts: 50 },
        { icon: '🎁', name: 'MYSTERY GIFT', pts: 70 },
        { icon: '✨', name: 'HOLY AURA STAR', pts: 40 }
      ];
      const s = specials[Math.floor(Math.random() * specials.length)];
      item = {
        id: this.nextItemId++,
        type: s.icon === '🪔' ? 'blessing' : 'gift',
        icon: s.icon,
        name: s.name,
        x,
        y: -30,
        vy: 1.8 + Math.random() * 0.8,
        size: 30,
        rot: 0,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        points: s.pts
      };
    } else {
      const treats = [
        { icon: '🎂', name: 'CAKE SLICE', pts: 20 },
        { icon: '🍬', name: 'LADDOO', pts: 25 },
        { icon: '🥟', name: 'SAMOSA', pts: 30 },
        { icon: '🍓', name: 'STRAWBERRY', pts: 15 }
      ];
      const t = treats[Math.floor(Math.random() * treats.length)];
      item = {
        id: this.nextItemId++,
        type: t.icon === '🎂' ? 'cake' : 'samosa',
        icon: t.icon,
        name: t.name,
        x,
        y: -30,
        vy: 2.0 + Math.random() * 1.2,
        size: 28,
        rot: 0,
        rotSpeed: (Math.random() - 0.5) * 0.06,
        points: t.pts
      };
    }

    this.items.push(item);
    this.lastSpawnTime = now;
  }

  private loop = (now: number) => {
    if (!this.isVisible && this.state !== 'start') {
      this.animFrameId = null;
      return;
    }

    // Update
    this.updateGame(now);

    // Draw
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private updateGame(now: number) {
    if (this.state !== 'playing' && this.state !== 'boss') return;

    // Smooth player paddle interpolation
    this.playerX += (this.targetPlayerX - this.playerX) * 0.22;
    this.playerX = Math.max(this.playerWidth / 2, Math.min(this.width - this.playerWidth / 2, this.playerX));

    // Spawn falling treats and hazards
    if (this.state === 'playing') {
      if (now - this.lastSpawnTime > this.spawnInterval) {
        this.spawnItem(now);
        // Slightly increase speed as score climbs
        this.spawnInterval = Math.max(420, 650 - this.score * 0.7);
      }

      // Check Boss trigger at 200 points
      if (this.score >= 200 && (this.state as string) !== 'boss') {
        this.triggerBossWave();
      }
    } else if (this.state === 'boss') {
      this.updateBoss(now);
    }

    // Update items
    const playerTop = this.height - 35;
    const playerBottom = playerTop + this.playerHeight;
    const playerLeft = this.playerX - this.playerWidth / 2;
    const playerRight = this.playerX + this.playerWidth / 2;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += it.vy;
      it.rot += it.rotSpeed;

      // Check catch collision with plate
      if (it.y + it.size / 2 >= playerTop && it.y - it.size / 2 <= playerBottom) {
        if (it.x >= playerLeft - 8 && it.x <= playerRight + 8) {
          this.handleCatch(it);
          this.items.splice(i, 1);
          continue;
        }
      }

      // Fell off screen
      if (it.y > this.height + 40) {
        if (it.type !== 'hazard') {
          // Dropped a treat -> reset combo
          this.combo = 0;
          this.updateHUD();
        }
        this.items.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.alpha -= 0.025;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 1.2;
      pop.alpha -= 0.025;
      if (pop.alpha <= 0) {
        this.popups.splice(i, 1);
      }
    }

    // Check Win Condition
    if (this.score >= this.targetScore && (this.state as string) !== 'victory') {
      this.triggerVictory();
    }
  }

  private handleCatch(item: FallingItem) {
    if (item.type === 'hazard') {
      // Ouch! Hit by hazard
      this.lives--;
      this.combo = 0;
      sfx.playHit(true);

      // Screen shake
      this.container.classList.remove('game-shake');
      void this.container.offsetWidth;
      this.container.classList.add('game-shake');

      this.spawnPopText(`OUCH! ${item.name}`, item.x, item.y, '#FF2E7E');
      this.spawnSparks(item.x, item.y, '#FF2E7E', 12);

      if (this.lives <= 0) {
        this.triggerGameOver();
      }
    } else {
      // Delicious catch!
      this.combo++;
      const comboBonus = Math.min(this.combo * 5, 25);
      const earned = item.points + comboBonus;
      this.score += earned;

      if (item.type === 'blessing') {
        sfx.playVictory();
        this.spawnPopText(`RADHE RADHE! +${earned}`, item.x, item.y, '#FFE600');
        this.spawnSparks(item.x, item.y, '#FFE600', 16);
      } else {
        sfx.playPop();
        const comboStr = this.combo > 1 ? ` (x${this.combo}!)` : '';
        this.spawnPopText(`+${earned}${comboStr}`, item.x, item.y, '#00E599');
        this.spawnSparks(item.x, item.y, '#00E599', 8);
      }
    }

    this.updateHUD();
  }

  private triggerBossWave() {
    this.state = 'boss';
    this.bossHealth = 40;
    this.bossTimer = performance.now();
    sfx.playWhoosh();

    const tauntEl = this.container.querySelector('.game-taunt') as HTMLElement;
    if (tauntEl) {
      tauntEl.textContent = '🎂 THE GIANT BIRTHDAY CAKE HAS ARRIVED! TAP TO CATCH! 🎂';
      tauntEl.style.color = '#FF4B00';
    }
  }

  private updateBoss(now: number) {
    // Rain fast bonus sparklers
    if (now - this.lastSpawnTime > 400) {
      this.spawnItem(now);
      this.lastSpawnTime = now;
    }
  }

  public hitBoss(coords: { x: number; y: number }) {
    if (this.state !== 'boss') return;

    this.bossHealth -= 4;
    this.score += 15;
    sfx.playHit();

    this.spawnPopText('-4 SMASH!', coords.x, coords.y, '#FF4B00');
    this.spawnSparks(coords.x, coords.y, '#FFE600', 10);
    this.updateHUD();

    if (this.bossHealth <= 0) {
      this.triggerVictory();
    }
  }

  private spawnSparks(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color,
        size: Math.random() * 4 + 2,
        alpha: 1,
        life: 1
      });
    }
  }

  private spawnPopText(text: string, x: number, y: number, color: string) {
    this.popups.push({
      text,
      x: Math.max(30, Math.min(this.width - 80, x)),
      y: Math.max(40, y),
      color,
      alpha: 1,
      scale: 1.2
    });
  }

  private triggerVictory() {
    this.state = 'victory';
    sfx.playVictory();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('aki_arcade_high', this.score.toString());
      } catch {}
    }

    confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.65 },
      colors: ['#ff4b00', '#ffe600', '#ff2e7e', '#00e599', '#7038ff']
    });

    const victoryOverlay = this.container.querySelector('.game-victory-overlay') as HTMLElement;
    if (victoryOverlay) {
      victoryOverlay.classList.add('is-active');
    }
    this.updateHUD();
  }

  private triggerGameOver() {
    this.state = 'gameover';
    sfx.playHit(true);

    const gameOverOverlay = this.container.querySelector('.game-over-overlay') as HTMLElement;
    if (gameOverOverlay) {
      gameOverOverlay.style.display = 'flex';
    }
    this.updateHUD();
  }

  private updateHUD() {
    const scoreVal = this.container.querySelector('.arcade-score-val');
    const comboVal = this.container.querySelector('.arcade-combo-val');
    const livesVal = this.container.querySelector('.arcade-lives-val');
    const progressFill = this.container.querySelector('.arcade-progress-fill') as HTMLElement;

    if (scoreVal) scoreVal.textContent = this.score.toString();
    if (comboVal) comboVal.textContent = `x${this.combo}`;
    if (livesVal) {
      const candles = ['☠️', '🕯️', '🕯️🕯️', '🕯️🕯️🕯️'];
      livesVal.textContent = candles[Math.max(0, Math.min(3, this.lives))];
    }
    if (progressFill) {
      const pct = Math.min(100, (this.score / this.targetScore) * 100);
      progressFill.style.width = `${pct}%`;
    }
  }

  private render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw Background Grid / Pattern
    this.ctx.fillStyle = '#FAF7F0';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw Falling Items
    for (const it of this.items) {
      this.ctx.save();
      this.ctx.translate(it.x, it.y);
      this.ctx.rotate(it.rot);

      // Icon
      this.ctx.font = `${it.size}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(it.icon, 0, 0);

      this.ctx.restore();
    }

    // Draw Boss Cake in Boss mode
    if (this.state === 'boss') {
      const bossX = this.width / 2;
      const bossY = 110;
      this.ctx.save();
      this.ctx.font = '64px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🎂', bossX, bossY);

      // Boss Health bar
      this.ctx.fillStyle = '#222';
      this.ctx.fillRect(bossX - 60, bossY - 48, 120, 10);
      this.ctx.fillStyle = '#FF4B00';
      this.ctx.fillRect(bossX - 58, bossY - 46, (this.bossHealth / 40) * 116, 6);

      this.ctx.font = 'bold 11px monospace';
      this.ctx.fillStyle = '#FF2E7E';
      this.ctx.fillText('⚡ TAP CAKE TO ATTACK! ⚡', bossX, bossY + 44);
      this.ctx.restore();
    }

    // Draw Player Paddle (Aki's Golden Plate)
    const plateY = this.height - 30;
    const plateLeft = this.playerX - this.playerWidth / 2;

    this.ctx.save();
    // Drop shadow
    this.ctx.fillStyle = '#121316';
    this.ctx.beginPath();
    this.ctx.roundRect(plateLeft + 3, plateY + 3, this.playerWidth, this.playerHeight, 8);
    this.ctx.fill();

    // Plate Base (Golden Yellow)
    this.ctx.fillStyle = '#FFE600';
    this.ctx.strokeStyle = '#121316';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.roundRect(plateLeft, plateY, this.playerWidth, this.playerHeight, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Plate Texture & Label
    this.ctx.fillStyle = '#121316';
    this.ctx.font = 'bold 9px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('★ AKI\'S PLATE ★', this.playerX, plateY + this.playerHeight / 2);

    this.ctx.restore();

    // Draw Particles
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Floating Popups
    for (const pop of this.popups) {
      this.ctx.save();
      this.ctx.globalAlpha = pop.alpha;
      this.ctx.font = 'bold 13px monospace';
      this.ctx.fillStyle = pop.color;
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(pop.text, pop.x, pop.y);
      this.ctx.fillText(pop.text, pop.x, pop.y);
      this.ctx.restore();
    }
  }

  private renderInitialUI() {
    this.render();
    this.updateHUD();
  }
}
