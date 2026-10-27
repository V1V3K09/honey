// game-logic.ts — Game State, Rules, Scoring, and Collision Logic for "PROTECT HIS LAST BRAIN CELL"

export type GameState = 'ready' | 'playing' | 'paused' | 'victory' | 'defeat';

export type ThreatType = 'alarm' | 'exam' | 'responsibility' | 'deadline' | 'commonsense';
export type CollectibleType = 'samosa' | 'golden-samosa';

export interface ThreatData {
  id: number;
  type: ThreatType;
  name: string;
  damage: number;
  speed: number;
  radius: number;
  pointsOnBlock: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface CollectibleData {
  id: number;
  type: CollectibleType;
  name: string;
  points: number;
  heal: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GameStats {
  score: number;
  timeSurvived: number;
  threatsBlocked: number;
  samosasCollected: number;
  integrity: number;
  rank: string;
}

export interface GameLogicCallbacks {
  onStateChange: (state: GameState) => void;
  onIntegrityChange: (integrity: number, max: number) => void;
  onTimerUpdate: (secondsLeft: number) => void;
  onScoreUpdate: (score: number) => void;
  onStatsUpdate: (stats: GameStats) => void;
  onDialogue: (text: string, type?: 'info' | 'warn' | 'success' | 'danger') => void;
  onThreatBlocked: (threat: ThreatData) => void;
  onDamageTaken: (damage: number, threat: ThreatData) => void;
  onCollectibleGrabbed: (item: CollectibleData) => void;
  onVictory: (stats: GameStats) => void;
  onDefeat: (stats: GameStats) => void;
}

export class BrainGameLogic {
  public static readonly ROUND_DURATION = 45; // 45 seconds survival
  public static readonly MAX_INTEGRITY = 100;

  private state: GameState = 'ready';
  private integrity: number = BrainGameLogic.MAX_INTEGRITY;
  private timeRemaining: number = BrainGameLogic.ROUND_DURATION;
  private score: number = 0;
  private threatsBlockedCount: number = 0;
  private samosasCollectedCount: number = 0;

  // Timers and spawn tracking
  private lastSecondTick: number = 0;
  private nextThreatSpawnTime: number = 0;
  private nextCollectibleSpawnTime: number = 0;
  private nextDialogueTime: number = 0;
  private nextEntityId: number = 1;

  // Active game entities in math plane (Z = 0)
  public threats: ThreatData[] = [];
  public collectibles: CollectibleData[] = [];

  // Shield position & dimensions
  public shieldX: number = 0;
  public shieldY: number = 1.6;
  public shieldRadius: number = 0.55; // collision detection radius

  // Brain cell position & dimensions (centered)
  public brainX: number = 0;
  public brainY: number = 0;
  public brainRadius: number = 0.5;

  private callbacks: GameLogicCallbacks;

  private goofyDialogues = [
    { text: 'WARNING: COMMON SENSE DETECTED.', type: 'warn' as const },
    { text: 'RESPONSIBILITY APPROACHING FROM THE EAST.', type: 'danger' as const },
    { text: 'THE BRAIN CELL IS PANICKING!', type: 'warn' as const },
    { text: 'ONE CELL. ZERO BACKUP.', type: 'info' as const },
    { text: 'DEFLECT THAT MONDAY 6 AM ALARM!', type: 'warn' as const },
    { text: 'INCOMING TEXTBOOK: AVOID REALITY!', type: 'danger' as const },
    { text: 'GOLDEN SAMOSA INCOMING! GRAB IT FOR AKI!', type: 'success' as const },
    { text: 'RADHE RADHE DEVOTION SHIELD HOLDING STRONG.', type: 'info' as const },
    { text: 'NICE SHIELD WORK! NEURON SAFE FOR NOW.', type: 'success' as const }
  ];

  constructor(callbacks: GameLogicCallbacks) {
    this.callbacks = callbacks;
  }

  public getState(): GameState {
    return this.state;
  }

  public getStats(): GameStats {
    const timeSurvived = BrainGameLogic.ROUND_DURATION - this.timeRemaining;
    return {
      score: this.score,
      timeSurvived: Math.min(BrainGameLogic.ROUND_DURATION, Math.round(timeSurvived * 10) / 10),
      threatsBlocked: this.threatsBlockedCount,
      samosasCollected: this.samosasCollectedCount,
      integrity: this.integrity,
      rank: this.calculateRank(this.score)
    };
  }

  public calculateRank(score: number): string {
    if (score >= 1500) return 'GUARDIAN OF THE LAST NEURON';
    if (score >= 1000) return 'CERTIFIED SURVIVOR';
    if (score >= 500) return 'PART-TIME THINKER';
    return 'BRAIN CELL INTERN';
  }

  public start() {
    this.state = 'playing';
    this.integrity = BrainGameLogic.MAX_INTEGRITY;
    this.timeRemaining = BrainGameLogic.ROUND_DURATION;
    this.score = 0;
    this.threatsBlockedCount = 0;
    this.samosasCollectedCount = 0;
    this.threats = [];
    this.collectibles = [];
    this.shieldX = 0;
    this.shieldY = 1.6;

    this.lastSecondTick = 0;
    this.nextThreatSpawnTime = 0.8;
    this.nextCollectibleSpawnTime = 3.5;
    this.nextDialogueTime = 2.0;

    this.callbacks.onStateChange(this.state);
    this.callbacks.onIntegrityChange(this.integrity, BrainGameLogic.MAX_INTEGRITY);
    this.callbacks.onTimerUpdate(this.timeRemaining);
    this.callbacks.onScoreUpdate(this.score);
    this.callbacks.onDialogue('ROUND START: PROTECT HIS LAST BRAIN CELL!', 'info');
  }

  public pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.callbacks.onStateChange(this.state);
    this.callbacks.onDialogue('PAUSED: TAKING A BREATHER FROM RESPONSIBILITIES.', 'info');
  }

  public resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.callbacks.onStateChange(this.state);
    this.callbacks.onDialogue('RESUMED: KEEP THAT SHIELD UP!', 'info');
  }

  public update(delta: number) {
    if (this.state !== 'playing') return;

    // 1. Time countdown
    const prevTime = this.timeRemaining;
    this.timeRemaining = Math.max(0, this.timeRemaining - delta);
    this.callbacks.onTimerUpdate(this.timeRemaining);

    // Score: +10 pts per second survived
    if (Math.floor(prevTime) !== Math.floor(this.timeRemaining)) {
      this.score += 10;
      this.callbacks.onScoreUpdate(this.score);
      this.callbacks.onStatsUpdate(this.getStats());
    }

    // Check Victory
    if (this.timeRemaining <= 0) {
      this.triggerVictory();
      return;
    }

    // 2. Dialogue scheduler
    this.nextDialogueTime -= delta;
    if (this.nextDialogueTime <= 0) {
      const d = this.goofyDialogues[Math.floor(Math.random() * this.goofyDialogues.length)];
      this.callbacks.onDialogue(d.text, d.type);
      this.nextDialogueTime = 4.5 + Math.random() * 3.5;
    }

    // 3. Spawning threats
    this.nextThreatSpawnTime -= delta;
    if (this.nextThreatSpawnTime <= 0) {
      this.spawnThreat();
      // Difficulty curve: spawn interval accelerates from 1.6s down to 0.75s as time ticks
      const progress = 1 - (this.timeRemaining / BrainGameLogic.ROUND_DURATION);
      const interval = Math.max(0.72, 1.6 - progress * 0.88);
      this.nextThreatSpawnTime = interval + (Math.random() - 0.5) * 0.2;
    }

    // 4. Spawning collectibles (samosas)
    this.nextCollectibleSpawnTime -= delta;
    if (this.nextCollectibleSpawnTime <= 0) {
      this.spawnCollectible();
      this.nextCollectibleSpawnTime = 4.0 + Math.random() * 3.0;
    }

    // 5. Update threat physics & collisions
    for (let i = this.threats.length - 1; i >= 0; i--) {
      const t = this.threats[i];
      t.x += t.vx * delta;
      t.y += t.vy * delta;

      // Distance to Shield
      const dxShield = t.x - this.shieldX;
      const dyShield = t.y - this.shieldY;
      const distShield = Math.hypot(dxShield, dyShield);

      if (distShield <= t.radius + this.shieldRadius) {
        // Blocked by Shield!
        this.threatsBlockedCount++;
        this.score += t.pointsOnBlock;
        this.callbacks.onThreatBlocked(t);
        this.callbacks.onScoreUpdate(this.score);
        this.callbacks.onStatsUpdate(this.getStats());
        this.threats.splice(i, 1);
        continue;
      }

      // Distance to Brain Cell
      const dxBrain = t.x - this.brainX;
      const dyBrain = t.y - this.brainY;
      const distBrain = Math.hypot(dxBrain, dyBrain);

      if (distBrain <= t.radius + this.brainRadius) {
        // Hit Brain Cell!
        this.integrity = Math.max(0, this.integrity - t.damage);
        this.callbacks.onDamageTaken(t.damage, t);
        this.callbacks.onIntegrityChange(this.integrity, BrainGameLogic.MAX_INTEGRITY);
        this.callbacks.onStatsUpdate(this.getStats());
        this.threats.splice(i, 1);

        if (this.integrity <= 0) {
          this.triggerDefeat();
          return;
        }
        continue;
      }

      // Out of bounds cleanup (arena bounds R > 5)
      if (Math.hypot(t.x, t.y) > 5.5) {
        this.threats.splice(i, 1);
      }
    }

    // 6. Update collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.x += c.vx * delta;
      c.y += c.vy * delta;

      // Distance to Shield
      const dxShield = c.x - this.shieldX;
      const dyShield = c.y - this.shieldY;
      const distShield = Math.hypot(dxShield, dyShield);

      if (distShield <= c.radius + this.shieldRadius) {
        // Grabbed by Shield!
        this.samosasCollectedCount++;
        this.score += c.points;
        if (c.heal > 0) {
          this.integrity = Math.min(BrainGameLogic.MAX_INTEGRITY, this.integrity + c.heal);
          this.callbacks.onIntegrityChange(this.integrity, BrainGameLogic.MAX_INTEGRITY);
        }
        this.callbacks.onCollectibleGrabbed(c);
        this.callbacks.onScoreUpdate(this.score);
        this.callbacks.onStatsUpdate(this.getStats());
        this.collectibles.splice(i, 1);
        continue;
      }

      // Out of bounds cleanup
      if (Math.hypot(c.x, c.y) > 5.5) {
        this.collectibles.splice(i, 1);
      }
    }
  }

  private spawnThreat() {
    const types: ThreatType[] = ['alarm', 'exam', 'responsibility', 'deadline', 'commonsense'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    // Spawn on an outer circle (radius 3.6 - 4.2)
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 3.8 + Math.random() * 0.4;
    const x = Math.cos(angle) * spawnDist;
    const y = Math.sin(angle) * spawnDist;

    // Fly toward the brain center with slight jitter
    const targetX = (Math.random() - 0.5) * 0.2;
    const targetY = (Math.random() - 0.5) * 0.2;
    const dirX = targetX - x;
    const dirY = targetY - y;
    const len = Math.hypot(dirX, dirY);

    // Speed curve increases over time
    const timeProgress = 1 - (this.timeRemaining / BrainGameLogic.ROUND_DURATION);
    const baseSpeed = 1.35 + timeProgress * 0.75 + Math.random() * 0.3;

    let damage = 10;
    let name = 'Alarm Clock';
    let radius = 0.32;

    switch (chosenType) {
      case 'alarm':
        damage = 10;
        name = 'Alarm Clock';
        radius = 0.32;
        break;
      case 'exam':
        damage = 15;
        name = 'Exam Textbook';
        radius = 0.36;
        break;
      case 'responsibility':
        damage = 15;
        name = 'Adult Responsibility';
        radius = 0.36;
        break;
      case 'deadline':
        damage = 15;
        name = 'Urgent Deadline';
        radius = 0.35;
        break;
      case 'commonsense':
        damage = 10;
        name = 'Common Sense';
        radius = 0.32;
        break;
    }

    this.threats.push({
      id: this.nextEntityId++,
      type: chosenType,
      name,
      damage,
      speed: baseSpeed,
      radius,
      pointsOnBlock: 25,
      x,
      y,
      vx: (dirX / len) * baseSpeed,
      vy: (dirY / len) * baseSpeed
    });
  }

  private spawnCollectible() {
    const isRare = Math.random() < 0.3;
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 3.6;
    const x = Math.cos(angle) * spawnDist;
    const y = Math.sin(angle) * spawnDist;

    // Drifts gently across arena, not directly through center
    const targetAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
    const vx = Math.cos(targetAngle) * 0.95;
    const vy = Math.sin(targetAngle) * 0.95;

    this.collectibles.push({
      id: this.nextEntityId++,
      type: isRare ? 'golden-samosa' : 'samosa',
      name: isRare ? 'Healing Golden Samosa' : 'Golden Samosa',
      points: 50,
      heal: isRare ? 5 : 0,
      radius: 0.32,
      x,
      y,
      vx,
      vy
    });
  }

  private triggerVictory() {
    this.state = 'victory';
    const stats = this.getStats();
    this.callbacks.onStateChange(this.state);
    this.callbacks.onDialogue('THE LAST BRAIN CELL SURVIVED. HAPPY BIRTHDAY, YOU ABSOLUTE MENACE.', 'success');
    this.callbacks.onVictory(stats);
  }

  private triggerDefeat() {
    this.state = 'defeat';
    const stats = this.getStats();
    this.callbacks.onStateChange(this.state);
    this.callbacks.onDialogue('THE LAST BRAIN CELL HAS LEFT THE CHAT.', 'danger');
    this.callbacks.onDefeat(stats);
  }
}
