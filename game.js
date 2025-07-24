class LobbyScene extends Phaser.Scene {
    constructor() {
        super({
            key: 'LobbyScene'
        });
        this.socket = null;
        this.sessionCode = null;
        this.sessionCodeText = null;
        this.playerObjects = new Map();
        this.initialPlayers = [];
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
        this.initialPlayers = data.players || [];
    }

    create() {
        GraphicsGenerator.createAllTextures(this);

        if (!this.socket) {
            this.socket = io("https://miaou.vps.webdock.cloud", {
                path: "/racer/socket.io/"
            });
            this.setupSocketEvents();
            this.socket.emit('create_session');
        } else {
            this.redrawLobbyState();
        }
    }

    setupSocketEvents() {
        this.socket.on('session_created', (data) => {
            this.sessionCode = data.sessionCode;
            this.redrawLobbyState();
        });

        this.socket.on('player_joined', (player) => {
            this.addPlayerToLobby(player);
        });

        this.socket.on('player_status_updated', ({
            playerId,
            isReady
        }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).readyIndicator.setVisible(isReady);
            }
        });

        this.socket.on('player_left', ({
            playerId
        }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).car.destroy();
                this.playerObjects.get(playerId).readyIndicator.destroy();
                this.playerObjects.delete(playerId);
                this.repositionPlayers();
            }
        });

        this.socket.on('start_game_for_all', (data) => {
            this.scene.start('GameScene', {
                socket: this.socket,
                sessionCode: this.sessionCode,
                players: data.players
            });
        });

        this.socket.on('return_to_lobby', (data) => {
            this.scene.start('LobbyScene', {
                socket: this.socket,
                sessionCode: this.sessionCode,
                players: data.players
            });
        });
    }

    redrawLobbyState() {
        this.children.removeAll();
        this.playerObjects.clear();

        if (this.sessionCode) {
            this.sessionCodeText = this.add.text(this.scale.width / 2, 50, `Session: ${this.sessionCode}`, {
                fontSize: '40px',
                fontFamily: 'monospace'
            }).setOrigin(0.5);
            this.add.text(this.scale.width / 2, 100, 'Les joueurs peuvent rejoindre...', {
                fontSize: '20px',
                fontFamily: 'monospace'
            }).setOrigin(0.5);
        }
        this.initialPlayers.forEach(player => this.addPlayerToLobby(player));
    }

    addPlayerToLobby(player) {
        const playerY = 150 + this.playerObjects.size * 100;
        const car = this.add.sprite(this.scale.width / 2, playerY, 'car_texture')
            .setTint(Phaser.Display.Color.ValueToColor(player.color).color)
            .setScale(1.2);

        const readyIndicator = this.add.text(car.x + 100, car.y, '✔', {
                fontSize: '48px',
                fill: '#2ECC40'
            })
            .setOrigin(0.5)
            .setVisible(player.isReady);

        this.playerObjects.set(player.id, {
            car,
            readyIndicator
        });
        
        car.setAngle(90);
        car.x = -100;

        this.tweens.add({
            targets: car,
            x: this.scale.width / 2 - 50,
            ease: 'Cubic.easeOut',
            duration: 1200
        });
    }

    repositionPlayers() {
        let i = 0;
        this.playerObjects.forEach(pObj => {
            const targetY = 150 + i * 100;
            this.tweens.add({
                targets: [pObj.car, pObj.readyIndicator],
                y: targetY,
                ease: 'power2',
                duration: 500,
            });
            i++;
        });
    }
}


class GameScene extends Phaser.Scene {
    constructor() {
        super({
            key: 'GameScene'
        });
        this.players = new Map();
        this.playerInfo = [];
        this.socket = null;
        this.sessionCode = null;
        this.road = null;
        this.scoreText = null;
        this.isGameRunning = false;
        this.obstacles = null;
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
        this.playerInfo = data.players;
    }

    create() {
        this.road = this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 'road_texture');

        const worldHeight = 1000000;
        this.physics.world.setBounds(0, -worldHeight, this.scale.width, worldHeight + this.scale.height);

        this.players.clear();
        this.playerInfo.forEach((playerData, index) => {
            const startX = (this.scale.width / (this.playerInfo.length + 1)) * (index + 1);
            const playerSprite = this.physics.add.sprite(startX, this.scale.height - 150, 'car_texture')
                .setTint(Phaser.Display.Color.ValueToColor(playerData.color).color);

            // MODIFICATION: Simplification de la physique pour une meilleure réactivité
            // La vélocité sera contrôlée directement dans updatePlayerMovement
            playerSprite.setDamping(false).setDrag(0).setMaxVelocity(800).setCollideWorldBounds(true);

            this.players.set(playerData.id, {
                sprite: playerSprite,
                turning: 'none',
                score: 0
            });
        });

        // La caméra suit toujours le joueur le plus en avant, qui sera déterminé dans la boucle update
        const firstPlayerSprite = this.players.values().next().value.sprite;
        if (firstPlayerSprite) {
            this.cameras.main.startFollow(firstPlayerSprite, true, 0.09, 0.09);
            this.cameras.main.setZoom(1.2);
        }

        this.obstacles = this.physics.add.group();
        this.physics.add.collider(Array.from(this.players.values()).map(p => p.sprite), this.obstacles, this.playerHitObstacle, null, this);

        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '24px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setScrollFactor(0);

        this.setupSocketListeners();
        this.startCountdown();
    }

    playerHitObstacle(playerSprite, obstacle) {
        // MODIFICATION: On ajoute un effet visuel à la collision avant de terminer
        obstacle.destroy(); // Détruit l'obstacle touché
        const particles = this.add.particles(0, 0, 'particle_texture', {
            speed: 200,
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            lifespan: 800,
            gravityY: 300,
            blendMode: 'ADD'
        });
        particles.emitParticleAt(playerSprite.x, playerSprite.y, 16);
        
        playerSprite.setTint(0xff0000); // La voiture devient rouge
        this.gameOver();
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        let leadPlayerY = Number.MAX_VALUE;
        let leadPlayer = null; // MODIFICATION: On stocke l'objet joueur complet, pas seulement le sprite

        this.players.forEach(player => {
            this.updatePlayerMovement(player, delta);
            if (player.sprite.y < leadPlayerY) {
                leadPlayerY = player.sprite.y;
                leadPlayer = player;
            }
        });

        if (!leadPlayer) return;

        // MODIFICATION (BUG FIX): La caméra suit le véritable joueur en tête
        this.cameras.main.startFollow(leadPlayer.sprite, true, 0.09, 0.09);

        this.road.tilePositionY = leadPlayer.sprite.y;
        this.road.y = leadPlayer.sprite.y;

        let leadScore = 0;
        this.players.forEach(player => {
            player.score = Math.max(0, Math.floor(-player.sprite.y / 10));
            if (player.score > leadScore) leadScore = player.score;
        });

        this.scoreText.setText('Score: ' + leadScore);
        
        // MODIFICATION (BUG FIX): On passe le joueur en tête aux fonctions de gestion des obstacles
        this.spawnObstaclesIfNeeded(leadPlayer);
        this.cleanupObstacles(leadPlayer);
    }

    // MODIFICATION (GESTION LATENCE): Nouvelle logique de mouvement plus directe et réactive
    updatePlayerMovement(player, delta) {
        const forwardSpeed = 600; // Vitesse de défilement vers le haut
        const turnSpeed = 350;    // Vitesse de déplacement latéral

        // La voiture avance toujours tout droit à vitesse constante
        player.sprite.body.velocity.y = -forwardSpeed;

        // On applique une vélocité latérale pour un changement de direction instantané
        switch (player.turning) {
            case 'left':
                player.sprite.body.velocity.x = -turnSpeed;
                player.sprite.setAngle(-15); // On incline le sprite pour l'effet visuel
                break;
            case 'right':
                player.sprite.body.velocity.x = turnSpeed;
                player.sprite.setAngle(15);
                break;
            case 'none':
                // On amortit le mouvement latéral pour un arrêt plus doux
                player.sprite.body.velocity.x *= 0.85; 
                // On redresse le sprite progressivement
                player.sprite.setAngle(player.sprite.angle * 0.85);
                break;
        }
    }

    // MODIFICATION (BUG FIX): La fonction accepte le joueur en tête comme argument
    cleanupObstacles(leadPlayer) {
        const camera = this.cameras.main;
        if (!leadPlayer) return;

        this.obstacles.getChildren().forEach(obstacle => {
            // Supprime les obstacles qui sont bien en dessous de la vue de la caméra
            if (obstacle.y > leadPlayer.sprite.y + camera.height) {
                obstacle.destroy();
            }
        });
    }

    setupSocketListeners() {
        this.socket.off('start_turn');
        this.socket.off('stop_turn');

        this.socket.on('start_turn', ({
            playerId,
            direction
        }) => {
            if (this.isGameRunning && this.players.has(playerId)) {
                this.players.get(playerId).turning = direction;
            }
        });
        this.socket.on('stop_turn', ({
            playerId
        }) => {
            if (this.isGameRunning && this.players.has(playerId)) {
                this.players.get(playerId).turning = 'none';
            }
        });
    }

    startCountdown() {
        const countdownText = this.add.text(this.scale.width / 2, this.scale.height / 2, '3', {
            fontSize: '128px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        let count = 3;
        this.time.addEvent({
            delay: 1000,
            callback: () => {
                count--;
                if (count > 0) countdownText.setText(String(count));
                else if (count === 0) countdownText.setText('GO!');
                else {
                    countdownText.destroy();
                    this.startGame();
                }
            },
            repeat: 3
        });
    }
    startGame() {
        this.isGameRunning = true;
    }
    
    // MODIFICATION (BUG FIX): La fonction accepte le joueur en tête comme argument
    spawnObstaclesIfNeeded(leadPlayer) {
        if (!leadPlayer) return;

        // On s'assure qu'il y a toujours des obstacles loin devant le joueur
        while (this.obstacles.getLength() < 20) {
            const roadLeftBoundary = this.scale.width * 0.2;
            const roadRightBoundary = this.scale.width * 0.8;
            
            // On génère un obstacle à une distance variable devant le joueur en tête
            const spawnY = leadPlayer.sprite.y - 800 - (Math.random() * this.scale.height * 1.5);
            const spawnX = Phaser.Math.Between(roadLeftBoundary, roadRightBoundary);
            
            const newObstacle = this.obstacles.create(spawnX, spawnY, 'obstacle_texture');
            newObstacle.body.setImmovable(true); // Les obstacles ne bougent pas lors d'une collision
        }
    }

    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        this.cameras.main.stopFollow();
        this.cameras.main.shake(300, 0.008); // Effet de secousse

        let finalScore = 0;
        this.players.forEach(p => {
            if (p.score > finalScore) finalScore = p.score;
        });

        this.add.text(this.cameras.main.worldView.x + this.scale.width / 2, this.cameras.main.worldView.y + this.scale.height / 2, 'GAME OVER', {
            fontSize: '64px',
            fill: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (this.socket) {
            this.socket.emit('game_over', {
                score: finalScore,
                sessionCode: this.sessionCode
            });
        }
    }
}

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%'
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                y: 0
            }
        }
    },
    scene: [LobbyScene, GameScene]
};

const game = new Phaser.Game(config);