class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.isGameRunning = false;
        // MODIFICATION: On ajoute un état pour la fin de partie
        this.isGameOver = false;
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
        this.playerInfo = data.players;
    }

    create() {
        this.isGameOver = false; // Réinitialiser l'état à la création
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

        this.physics.add.collider(playerSprites, this.obstacleManager.getGroup(), this.playerHitObstacle, null, this);

        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);
        this.playersAliveText = this.add.text(this.scale.width - 16, 16, '', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setOrigin(1, 0).setScrollFactor(0);


        this.setupSocketListeners();
        this.startCountdown();
    }

    update(time, delta) {
        if (!this.isGameRunning || this.isGameOver) return;

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
             // S'il n'y a plus de joueur en tête (tout le monde a été éliminé)
            if (this.players.size === 0 && !this.isGameOver) {
                this.gameOver(); // On termine la partie
            }
            return;
        }

        this.cameras.main.startFollow(leadPlayer, true, 0.09, 0.09);
        this.road.tilePositionY = leadPlayer.y;
        this.road.y = leadPlayer.y;

        this.obstacleManager.update(leadPlayer);
        
        // MODIFICATION: Logique d'élimination si un joueur sort de l'écran
        const cameraBottom = this.cameras.main.worldView.bottom;
        const playersToDelete = [];

        this.players.forEach(player => {
            if (player.y > cameraBottom + player.displayHeight / 2) {
                playersToDelete.push(player);
            }
        });

        playersToDelete.forEach(player => this.eliminatePlayer(player));

        // MODIFICATION: Vérification de la condition de victoire (dernier joueur en vie)
        if (this.players.size <= 1 && this.playerInfo.length > 1) {
            this.gameOver(leadPlayer); // Le joueur en tête est le gagnant
        }
        
        // Mise à jour des scores et textes
        let leadScore = 0;
        this.players.forEach(player => {
            player.score = Math.max(0, Math.floor(-player.y / 10));
            if (player.score > leadScore) leadScore = player.score;
        });
        this.scoreText.setText('Score: ' + leadScore);
        this.playersAliveText.setText(`Joueurs: ${this.players.size} / ${this.playerInfo.length}`);
    }
    
    // MODIFICATION: La collision ne termine plus le jeu, elle pénalise le joueur
    playerHitObstacle(player, obstacle) {
        if (player.isStunned) return; // Ignore les collisions si déjà sonné

        obstacle.destroy(); // On peut garder la destruction de l'obstacle
        
        // Effet de "stun"
        player.isStunned = true;
        player.setTint(0xff6666); // Flash rouge
        player.body.velocity.y = 150; // Rebond en arrière
        player.body.velocity.x = 0;

        const particles = this.add.particles(0, 0, 'particle_texture', { speed: 100, scale: { start: 1, end: 0 }, lifespan: 400, gravityY: 300 });
        particles.emitParticleAt(player.x, player.y, 8);

        // Le joueur reprend le contrôle après une courte période
        this.time.delayedCall(700, () => {
            player.isStunned = false;
            player.clearTint();
        });
    }

    // NOUVELLE FONCTION: Pour gérer l'élimination d'un joueur
    eliminatePlayer(player) {
        if (!this.players.has(player.playerId)) return; // Déjà éliminé

        // 1. Notifier le serveur (qui notifiera le contrôleur)
        this.socket.emit('player_eliminated', { 
            sessionCode: this.sessionCode, 
            playerId: player.playerId 
        });

        // 2. Effet visuel
        const particles = this.add.particles(0, 0, 'particle_texture', { speed: 200, scale: { start: 1.2, end: 0 }, lifespan: 1000, gravityY: 200, blendMode: 'ADD' });
        particles.emitParticleAt(player.x, player.y, 30);

        // 3. Retirer le joueur du jeu
        this.players.delete(player.playerId);
        player.destroy();
    }

    setupSocketListeners() {
        this.socket.on('start_turn', ({ playerId, direction }) => {
            if (this.isGameRunning && this.players.has(playerId)) this.players.get(playerId).turning = direction;
        });
        this.socket.on('stop_turn', ({ playerId }) => {
            if (this.isGameRunning && this.players.has(playerId)) this.players.get(playerId).turning = 'none';
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

    // MODIFICATION: La fonction peut maintenant accepter un gagnant
    gameOver(winner = null) {
        if (this.isGameOver) return;
        this.isGameOver = true;

        this.isGameRunning = false;
        this.physics.pause();
        this.cameras.main.stopFollow();
        this.cameras.main.shake(300, 0.008);

        let finalScore = 0;
        let message = "GAME OVER";

        if(winner) {
            message = `VAINQUEUR !`;
            finalScore = winner.score;
            // On fait un zoom sur le gagnant
            this.cameras.main.pan(winner.x, winner.y, 1000, 'Cubic.easeOut');
            this.cameras.main.zoomTo(1.8, 1000, 'Cubic.easeOut');
        }

        // Affiche le message de fin
        this.add.text(this.cameras.main.worldView.x + this.scale.width / 2, this.cameras.main.worldView.y + this.scale.height / 2, message, { fontSize: '64px', fill: '#00ff00', fontStyle: 'bold' }).setOrigin(0.5);

        // On attend un peu avant de notifier les manettes, pour laisser le temps à l'animation
        this.time.delayedCall(3000, () => {
            this.socket.emit('game_over', { 
                score: finalScore, 
                sessionCode: this.sessionCode 
            });
        });
    }
}