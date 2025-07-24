class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.isGameRunning = false;
        this.highestScore = 0; 
        this.finalScores = [];
        // MODIFICATION : Vitesse de défilement de la caméra (en pixels par seconde)
        this.cameraSpeed = 400; 
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
        
        // On retire startFollow d'ici, la caméra sera gérée manuellement dans update()
        this.cameras.main.setZoom(1.2);

        this.physics.add.collider(Array.from(this.players.values()), this.obstacleManager.getGroup(), this.playerHitObstacle, null, this);
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);
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

        // 1. La caméra avance verticalement à une vitesse constante
        this.cameras.main.scrollY -= (this.cameraSpeed * delta) / 1000;

        let leadPlayer = null;
        let leadPlayerY = Number.MAX_VALUE;

        // On met à jour les joueurs et on trouve le leader
        this.players.forEach(player => {
            player.updateMovement(delta);
            if (player.y < leadPlayerY) {
                leadPlayerY = player.y;
                leadPlayer = player;
            }
        });
        
        // 2. La caméra suit le leader horizontalement de manière douce
        if (leadPlayer) {
            const targetX = leadPlayer.x - this.cameras.main.width / 2;
            this.cameras.main.scrollX = Phaser.Math.Interpolation.Linear([this.cameras.main.scrollX, targetX], 0.05);
        }
        
        // MODIFICATION : Correction de la position de la route
        // La route reste toujours centrée sur la caméra.
        this.road.y = this.cameras.main.worldView.centerY;
        // Le défilement de la texture est géré séparément pour donner l'illusion de mouvement.
        this.road.tilePositionY = this.cameras.main.scrollY;
        
        if (!leadPlayer) {
            if (this.isGameRunning) this.endGame();
            return;
        }
        
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
        this.players.forEach(player => {
            if (player.y > cameraBounds.bottom + 50) {
                playersToEliminate.push(player.playerId);
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
        
        if (this.isGameRunning && this.players.size === 0) this.endGame();
    }

    endGame() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        
        this.physics.pause();
        // La caméra est déjà indépendante, pas besoin de stopFollow

        this.players.forEach(player => {
            this.finalScores.push({ id: player.playerId, score: player.score });
            player.destroy();
        });
        this.players.clear();

        const rect = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, 400, 300, 0x000000, 0.7).setScrollFactor(0);
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
                    this.isGameRunning = true;
                }
            },
            repeat: 3
        });
    }
}