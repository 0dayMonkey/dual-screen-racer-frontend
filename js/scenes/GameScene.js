class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.isGameRunning = false;
        this.highestScore = 0; 
        
        // MODIFICATION : Propriétés pour la caméra et les scores
        this.cameraTarget = null; 
        this.finalScores = [];
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
        // On garde une copie des infos des joueurs pour l'écran des scores
        this.playerInfo = data.players; 
    }

    create() {
        // Réinitialisation des états pour une nouvelle partie
        this.highestScore = 0;
        this.cameraTarget = null;
        this.finalScores = [];

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
        
        this.cameras.main.setZoom(1.2);

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
            // S'il n'y a plus de joueur, la partie est finie
            if (this.isGameRunning) this.endGame();
            return;
        }
        
        // MODIFICATION : Logique de caméra améliorée
        // On ne change la cible de la caméra que si le leader change
        if (leadPlayer !== this.cameraTarget) {
            this.cameraTarget = leadPlayer;
            this.cameras.main.startFollow(this.cameraTarget, false, 0.1, 0.1);
        }
        
        this.road.tilePositionY = leadPlayer.y;
        this.road.y = leadPlayer.y;
        this.obstacleManager.update(leadPlayer);
        
        let currentLeadScore = 0;
        this.players.forEach(player => {
            player.score = Math.max(0, Math.floor(-player.y / 10));
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
                
                // MODIFICATION : On enregistre le score avant de supprimer le joueur
                this.finalScores.push({ 
                    id: player.playerId, 
                    score: player.score 
                });

                const particles = this.add.particles(0, 0, 'particle_texture', { speed: 150, scale: { start: 1.2, end: 0 }, lifespan: 1000, gravityY: 200 });
                particles.emitParticleAt(player.x, player.y, 20);
                player.destroy();
                this.players.delete(playerId);
            }
        });
        
        // La partie se termine si tous les joueurs ont été éliminés
        if (this.isGameRunning && this.players.size === 0) {
            this.endGame();
        }
    }

    // MODIFICATION : Fin de partie entièrement revue
    endGame() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        
        this.physics.pause();
        this.cameras.main.stopFollow(); // La caméra s'arrête

        // On enregistre le score du ou des derniers joueurs restants s'il y en a
        this.players.forEach(player => {
            this.finalScores.push({ id: player.playerId, score: player.score });
            player.destroy();
        });
        this.players.clear();

        // Création de l'écran des scores
        const rect = this.add.rectangle(this.cameras.main.worldView.centerX, this.cameras.main.worldView.centerY, 400, 300, 0x000000, 0.7).setScrollFactor(0);
        const title = this.add.text(rect.x, rect.y - 120, 'Scores Finaux', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5).setScrollFactor(0);

        // Trier les scores du meilleur au moins bon
        this.finalScores.sort((a, b) => b.score - a.score);

        // Afficher chaque score
        this.finalScores.forEach((scoreEntry, index) => {
            const playerInfo = this.playerInfo.find(p => p.id === scoreEntry.id);
            const color = playerInfo ? playerInfo.color : '#FFFFFF';
            
            const yPos = title.y + 60 + (index * 40);
            this.add.text(rect.x, yPos, `Joueur ${index + 1}: ${scoreEntry.score}`, { fontSize: '24px' })
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setTint(Phaser.Display.Color.ValueToColor(color).color);
        });

        // Envoyer le meilleur score au serveur pour la manette
        if (this.socket) {
            this.socket.emit('game_over', { score: this.highestScore, sessionCode: this.sessionCode });
        }

        // Retour au lobby après 10 secondes
        this.time.delayedCall(10000, () => {
            this.scene.start('LobbyScene', { 
                socket: this.socket, 
                sessionCode: this.sessionCode, 
                players: this.playerInfo 
            });
        });
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