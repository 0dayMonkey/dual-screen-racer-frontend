class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.isGameRunning = false;
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
        this.playerInfo = data.players;
    }

    create() {
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

        this.setupSocketListeners();
        this.startCountdown();
    }

    // MODIFICATION : La collision n'est plus éliminatoire mais applique une pénalité physique.
    playerHitObstacle(player, obstacle) {
        // Appliquer un "choc" en inversant brièvement la vélocité verticale
        player.body.velocity.y = 250; 

        // Ajouter un effet visuel pour le choc
        player.setTint(0xff0000); // Le joueur devient rouge
        this.cameras.main.shake(100, 0.005); // Secousse légère de la caméra
        
        // Retirer le tint après un court instant
        this.time.delayedCall(300, () => {
            player.clearTint();
        });
        
        // L'obstacle n'est PAS détruit, il reste une barrière.
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        let leadPlayer = null;
        let leadPlayerY = Number.MAX_VALUE;

        // Met à jour le mouvement de tous les joueurs et trouve celui en tête
        this.players.forEach(player => {
            player.updateMovement();
            if (player.y < leadPlayerY) {
                leadPlayerY = player.y;
                leadPlayer = player;
            }
        });

        if (!leadPlayer) {
            // S'il n'y a plus de joueur en tête (ex: dernier joueur éliminé), on termine la partie.
            if (this.players.size > 0) {
                 this.endGame();
            }
            return;
        }
        
        // Mise à jour de la caméra et de l'environnement
        this.cameras.main.startFollow(leadPlayer, true, 0.09, 0.09);
        this.road.tilePositionY = leadPlayer.y;
        this.road.y = leadPlayer.y;

        // Mise à jour des obstacles et du score
        this.obstacleManager.update(leadPlayer);
        
        let leadScore = 0;
        this.players.forEach(player => {
            player.score = Math.max(0, Math.floor(-player.y / 10));
            if (player.score > leadScore) leadScore = player.score;
        });
        this.scoreText.setText('Score: ' + leadScore);

        // MODIFICATION : Logique d'élimination par la caméra
        this.checkPlayerElimination();
    }
    
    // MODIFICATION : Nouvelle fonction pour vérifier si des joueurs sont hors champ
    checkPlayerElimination() {
        const cameraBounds = this.cameras.main.worldView;
        const playersToEliminate = [];

        this.players.forEach(player => {
            // Si la position Y du joueur est en dessous du bas de la caméra, il est éliminé
            if (player.y > cameraBounds.bottom + 50) { // On ajoute une petite marge de 50px
                playersToEliminate.push(player.playerId);
            }
        });

        // On supprime les joueurs éliminés
        playersToEliminate.forEach(playerId => {
            if (this.players.has(playerId)) {
                const player = this.players.get(playerId);
                
                // Effet visuel pour l'élimination
                const particles = this.add.particles(0, 0, 'particle_texture', { speed: 150, scale: { start: 1.2, end: 0 }, lifespan: 1000, gravityY: 200 });
                particles.emitParticleAt(player.x, player.y, 20);
                
                player.destroy(); // Supprime le sprite du joueur
                this.players.delete(playerId); // Supprime le joueur de la liste des joueurs actifs
            }
        });
        
        // MODIFICATION : Condition de fin de partie. S'il reste 1 joueur ou moins, la partie se termine.
        if (this.isGameRunning && this.players.size <= 1) {
            this.endGame();
        }
    }

    // MODIFICATION : L'ancienne fonction gameOver() est renommée et adaptée pour la fin de partie
    endGame() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        
        this.physics.pause();
        this.cameras.main.stopFollow();
        
        let winnerText = 'FIN DE LA PARTIE';
        let finalScore = 0;

        // S'il reste un joueur, il est le gagnant
        if (this.players.size === 1) {
            const winner = this.players.values().next().value;
            winnerText = 'VAINQUEUR !';
            finalScore = winner.score;
            this.cameras.main.startFollow(winner); // La caméra se centre sur le vainqueur
        } else {
             // Si tout le monde a été éliminé, on prend le meilleur score calculé
             this.players.forEach(p => { if (p.score > finalScore) finalScore = p.score; });
        }


        this.add.text(this.cameras.main.worldView.x + this.scale.width / 2, this.cameras.main.worldView.y + this.scale.height / 2, winnerText, { fontSize: '64px', fill: '#00ff00' }).setOrigin(0.5);
        
        if (this.socket) {
            this.socket.emit('game_over', { score: finalScore, sessionCode: this.sessionCode });
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