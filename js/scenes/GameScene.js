class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.isGameRunning = false;
        this.highestScore = 0; 
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
        this.playerInfo = data.players;
    }

    create() {
        this.highestScore = 0;
        this.road = this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 'road_texture');
        this.physics.world.setBounds(0, -1000000, this.scale.width, 1000000 + this.scale.height);

        this.obstacleManager = new ObstacleManager(this);

        this.players.clear();
        const playerSprites = [];
        this.playerInfo.forEach((playerData, index) => {
            const startX = (this.scale.width / (this.playerInfo.length + 1)) * (index + 1);
            const player = new Player(this, startX, this.scale.height - 150, playerData);
            this.players.set(playerData.id, player);
            playerSprites.push(player);
        });
        
        // MODIFICATION 1 : On configure la caméra au démarrage.
        // Cela évite un "saut" de caméra au début du jeu.
        const firstPlayerSprite = this.players.values().next().value;
        if (firstPlayerSprite) {
            this.cameras.main.startFollow(firstPlayerSprite, true, 0.1, 0.1); // Le `true` est important ici pour un démarrage direct.
            this.cameras.main.setZoom(1.2);
        }

        this.physics.add.collider(playerSprites, this.obstacleManager.getGroup(), this.playerHitObstacle, null, this);
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);
        this.setupSocketListeners();
        this.startCountdown();
    }
    
    playerHitObstacle(player, obstacle) {
        player.body.velocity.y = 250; 
        player.setTint(0xff0000);
        this.cameras.main.shake(100, 0.005);
        
        this.time.delayedCall(300, () => {
            player.setTint(player.originalColor);
        });
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        let leadPlayer = null;
        let leadPlayerY = Number.MAX_VALUE;

        this.players.forEach(player => {
            player.updateMovement();
            if (player.y < leadPlayerY) {
                leadPlayerY = player.y;
                leadPlayer = player;
            }
        });

        if (!leadPlayer) {
            if (this.isGameRunning) {
                 this.endGame();
            }
            return;
        }
        
        // MODIFICATION 2 : On ajuste les valeurs de "lerp" pour un suivi fluide.
        // Le `false` indique que si la cible de la caméra change, la transition sera douce.
        this.cameras.main.startFollow(leadPlayer, false, 0.1, 0.1);
        
        this.road.tilePositionY = leadPlayer.y;
        this.road.y = leadPlayer.y;
        this.obstacleManager.update(leadPlayer);
        
        let currentLeadScore = 0;
        this.players.forEach(player => {
            player.score = Math.max(0, Math.floor(-player.y / 10));
            if (player.score > currentLeadScore) {
                currentLeadScore = player.score;
            }
        });
        
        if (currentLeadScore > this.highestScore) {
            this.highestScore = currentLeadScore;
        }
        this.scoreText.setText('Score: ' + currentLeadScore);
        this.checkPlayerElimination();
    }
    
    checkPlayerElimination() {
        const cameraBounds = this.cameras.main.worldView;
        const playersToEliminate = [];

        this.players.forEach(player => {
            if (player.y > cameraBounds.bottom + 50) {
                playersToEliminate.push(player.playerId);
            }
        });

        playersToEliminate.forEach(playerId => {
            if (this.players.has(playerId)) {
                const player = this.players.get(playerId);
                const particles = this.add.particles(0, 0, 'particle_texture', { speed: 150, scale: { start: 1.2, end: 0 }, lifespan: 1000, gravityY: 200 });
                particles.emitParticleAt(player.x, player.y, 20);
                player.destroy();
                this.players.delete(playerId);
            }
        });
        
        if (this.isGameRunning && this.players.size === 0) {
            this.endGame();
        }
    }

    endGame() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        this.cameras.main.stopFollow();
        const endText = 'PARTIE TERMINÉE';
        this.add.text(this.cameras.main.worldView.x + this.scale.width / 2, this.cameras.main.worldView.y + this.scale.height / 2, endText, { fontSize: '64px', fill: '#ff0000' }).setOrigin(0.5);
        
        if (this.socket) {
            this.socket.emit('game_over', { score: this.highestScore, sessionCode: this.sessionCode });
        }
    }

    setupSocketListeners() {
        this.socket.on('start_turn', ({ playerId, direction }) => {
            if (this.players.has(playerId)) this.players.get(playerId).turning = direction;
        });
        this.socket.on('stop_turn', ({ playerId }) => {
            if (this.players.has(playerId)) this.players.get(playerId).turning = 'none';
        });
    }

    startCountdown() {
        const countdownText = this.add.text(this.scale.width / 2, this.scale.height / 2, '3', { fontSize: '128px', fill: '#FFF' }).setOrigin(0.5).setScrollFactor(0);
        let count = 3;
        this.time.addEvent({
            delay: 1000,
            callback: () => {
                count--;
                if (count > 0) countdownText.setText(String(count));
                else if (count === 0) countdownText.setText('GO!');
                else {
                    countdownText.destroy();
                    this.isGameRunning = true;
                }
            },
            repeat: 3
        });
    }
}