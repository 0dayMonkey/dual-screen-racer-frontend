class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.isGameRunning = false;
        this.highestScore = 0; 
        this.finalScores = [];
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
        this.playerInfo = data.players; 
    }

    create() {
        this.highestScore = 0;
        this.finalScores = [];

        this.road = this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 'road_texture');
        this.physics.world.setBounds(0, -1000000, this.scale.width, 1000000 + this.scale.height);

        this.obstacleManager = new ObstacleManager(this);

        this.players.clear();
        this.playerInfo.forEach((playerData, index) => {
            const startX = (this.scale.width / (this.playerInfo.length + 1)) * (index + 1);
            const player = new Player(this, startX, this.scale.height - 150, playerData);
            this.players.set(playerData.id, player);
        });
        
        this.physics.add.collider(Array.from(this.players.values()), this.obstacleManager.getGroup(), this.playerHitObstacle, null, this);
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);
        
        // On s'assure que toutes les fonctions nécessaires sont présentes et appelées
        this.setupSocketListeners();
        this.startCountdown();
    }
    
    playerHitObstacle(player, obstacle) {
        player.body.velocity.y = 250; 
        player.setTint(0xff0000);
        this.cameras.main.shake(100, 0.005);
        this.time.delayedCall(300, () => player.setTint(player.originalColor));
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        if (this.players.size === 0) {
            if (this.isGameRunning) this.endGame();
            return;
        }

        let leadPlayer = null;
        let leadPlayerY = Number.MAX_VALUE;
        let minX = Number.MAX_VALUE;
        let maxX = Number.MIN_VALUE;

        this.players.forEach(player => {
            player.updateMovement(delta);
            if (player.y < leadPlayerY) {
                leadPlayerY = player.y;
                leadPlayer = player;
            }
            minX = Math.min(minX, player.x);
            maxX = Math.max(maxX, player.x);
        });

        // --- NOUVELLE LOGIQUE DE CAMÉRA CONDITIONNELLE ---
        
        // S'il y a plus d'un joueur, on utilise le zoom dynamique
        if (this.players.size > 1) {
            const playerSpread = maxX - minX;
            const padding = this.scale.width * 0.4;
            const targetZoom = Phaser.Math.Clamp(this.scale.width / (playerSpread + padding), 0.6, 1.2);
            this.cameras.main.setZoom(Phaser.Math.Interpolation.Linear([this.cameras.main.zoom, targetZoom], 0.05));

            // On centre la caméra sur le milieu du groupe
            const groupCenterX = (minX + maxX) / 2;
            const targetX = groupCenterX - this.cameras.main.width / 2;
            this.cameras.main.scrollX = Phaser.Math.Interpolation.Linear([this.cameras.main.scrollX, targetX], 0.05);

        } else { // S'il ne reste qu'un seul joueur
            // On revient à un zoom standard et stable
            this.cameras.main.setZoom(Phaser.Math.Interpolation.Linear([this.cameras.main.zoom, 1.2], 0.05));

            // On suit simplement ce dernier joueur horizontalement
            const targetX = leadPlayer.x - this.cameras.main.width / 2;
            this.cameras.main.scrollX = Phaser.Math.Interpolation.Linear([this.cameras.main.scrollX, targetX], 0.05);
        }

        // Le suivi vertical reste le même dans les deux cas
        const targetY = leadPlayer.y - this.scale.height * 0.8;
        const newScrollY = Math.min(this.cameras.main.scrollY, targetY);
        this.cameras.main.scrollY = Phaser.Math.Interpolation.Linear([this.cameras.main.scrollY, newScrollY], 0.05);

        // --- FIN DE LA LOGIQUE DE CAMÉRA ---

        this.road.y = this.cameras.main.worldView.centerY;
        this.road.tilePositionY = this.cameras.main.scrollY;
        
        this.obstacleManager.update(leadPlayer);
        
        let currentLeadScore = 0;
        this.players.forEach(player => {
            player.score = Math.max(0, Math.floor(-(player.y - this.scale.height) / 10));
            if (player.score > currentLeadScore) currentLeadScore = player.score;
        });
        
        if (currentLeadScore > this.highestScore) this.highestScore = currentLeadScore;
        this.scoreText.setText('Score: ' + currentLeadScore);
        
        this.checkPlayerElimination();
    }
    
    checkPlayerElimination() {
        const cameraBounds = this.cameras.main.worldView;
        const playersToEliminate = [];
        const eliminationDelay = 2000;

        this.players.forEach(player => {
            if (player.y > cameraBounds.bottom + 50) {
                if (player.offScreenSince === null) {
                    player.offScreenSince = this.time.now;
                }
                player.setAlpha(0.5);
                if (this.time.now - player.offScreenSince > eliminationDelay) {
                    playersToEliminate.push(player.playerId);
                }
            } else {
                player.offScreenSince = null;
                player.setAlpha(1);
            }
        });

        playersToEliminate.forEach(playerId => {
            if (this.players.has(playerId)) {
                const player = this.players.get(playerId);
                this.finalScores.push({ id: player.playerId, score: player.score });
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

        this.players.forEach(player => {
            this.finalScores.push({ id: player.playerId, score: player.score });
            player.destroy();
        });
        this.players.clear();

        const rect = this.add.rectangle(this.cameras.main.worldView.centerX, this.cameras.main.worldView.centerY, 400, 300, 0x000000, 0.7).setScrollFactor(0);
        const title = this.add.text(rect.x, rect.y - 120, 'Scores Finaux', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5).setScrollFactor(0);
        this.finalScores.sort((a, b) => b.score - a.score);

        this.finalScores.forEach((scoreEntry, index) => {
            const playerInfo = this.playerInfo.find(p => p.id === scoreEntry.id);
            const color = playerInfo ? playerInfo.color : '#FFFFFF';
            const yPos = title.y + 60 + (index * 40);
            this.add.text(rect.x, yPos, `Joueur ${index + 1}: ${scoreEntry.score}`, { fontSize: '24px' }).setOrigin(0.5).setScrollFactor(0).setTint(Phaser.Display.Color.ValueToColor(color).color);
        });

        if (this.socket) this.socket.emit('game_over', { score: this.highestScore, sessionCode: this.sessionCode });
        this.time.delayedCall(10000, () => this.scene.start('LobbyScene', { socket: this.socket, sessionCode: this.sessionCode, players: this.playerInfo }));
    }

    setupSocketListeners() {
        this.socket.on('start_turn', ({ playerId, direction }) => { if (this.players.has(playerId)) this.players.get(playerId).turning = direction; });
        this.socket.on('stop_turn', ({ playerId }) => { if (this.players.has(playerId)) this.players.get(playerId).turning = 'none'; });
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
                    // C'est cette ligne qui démarre le jeu.
                    this.isGameRunning = true;
                }
            },
            repeat: 3
        });
    }
}