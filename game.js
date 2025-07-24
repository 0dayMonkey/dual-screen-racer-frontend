class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.socket = null;
        this.sessionCodeText = null;
        this.sessionCode = null;
    }

    create() {
        this.initializeText();
        this.initializeSocketConnection();
        this.setupSocketEvents();
    }

    initializeText() {
        this.sessionCodeText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Connexion en cours...', {
            fontSize: '40px', fontFamily: '"Courier New", Courier, monospace',
            color: '#ffffff', align: 'center',
            wordWrap: { width: this.scale.width - 40 }
        }).setOrigin(0.5);
    }

    initializeSocketConnection() {
        this.socket = io("https://miaou.vps.webdock.cloud", { path: "/racer/socket.io/" });
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            this.sessionCodeText.setText('Demande de session...');
            this.socket.emit('create_session');
        });

        this.socket.on('session_created', (data) => {
            if (data && data.sessionCode) {
                this.sessionCode = data.sessionCode;
                this.sessionCodeText.setText(`Entrez ce code sur votre manette :\n\n${this.sessionCode}`);
            } else {
                this.sessionCodeText.setText('Erreur : Code de session non reçu.');
            }
        });

        this.socket.on('connection_successful', () => {
             this.scene.start('GameScene', { socket: this.socket, sessionCode: this.sessionCode });
        });

        this.socket.on('disconnect', () => {
            this.sessionCodeText.setText('Déconnecté du serveur.');
        });
    }
}


class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.socket = null;
        this.sessionCode = null;
        this.player = null;
        this.obstacles = null;
        this.scoreText = null;
        this.road = null;
        this.isGameRunning = false;
        this.turning = 'none';
        
        this.scrollSpeed = 400;
        this.score = 0;
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
    }

    create() {
        GraphicsGenerator.createAllTextures(this);

        const roadWidth = this.scale.width * 0.7;
        const roadLeftBoundary = (this.scale.width - roadWidth) / 2;
        const roadRightBoundary = roadLeftBoundary + roadWidth;
        this.roadBoundaries = { left: roadLeftBoundary, right: roadRightBoundary, width: roadWidth };
        
        this.road = this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 'road_texture');

        this.player = this.physics.add.sprite(this.scale.width / 2, this.scale.height * 0.8, 'car_texture');
        this.player.setCollideWorldBounds(true);

        // --- Début de la configuration de la physique du joueur ---
        this.player.setDamping(true); // Active la prise en compte du "drag"
        this.player.setDrag(0.95); // Applique une friction pour que la voiture ralentisse d'elle-même
        this.player.setMaxVelocity(500); // Définit une vitesse horizontale maximale
        // --- Fin de la configuration de la physique ---

        this.obstacles = this.physics.add.group();
        this.physics.add.collider(this.player, this.obstacles, this.playerHitObstacle, null, this);

        this.score = 0;
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' });

        this.setupSocketListeners();
        this.startCountdown();
    }
    
    playerHitObstacle(player, obstacle) {
        this.gameOver();
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        const scrollAmount = this.scrollSpeed * (delta / 1000);
        this.road.tilePositionY -= scrollAmount;
        this.obstacles.incY(scrollAmount);

        // Appel de la logique de déplacement à chaque frame
        this.updatePlayerMovement();

        this.score += delta / 100;
        this.scoreText.setText('Score: ' + Math.floor(this.score));
        
        this.spawnObstaclesIfNeeded();
        this.cleanupObstacles();
    }

    /**
     * C'EST ICI LA NOUVELLE LOGIQUE DE DÉPLACEMENT DE LA VOITURE
     * Elle utilise un système d'accélération pour un contrôle plus fluide.
     */
    updatePlayerMovement() {
        // La force d'accélération appliquée quand on tourne.
        const acceleration = 1200; 

        if (this.turning === 'left') {
            // Applique une force d'accélération vers la gauche.
            this.player.setAccelerationX(-acceleration);
        } else if (this.turning === 'right') {
            // Applique une force d'accélération vers la droite.
            this.player.setAccelerationX(acceleration);
        } else {
            // Si on ne tourne pas, aucune force n'est appliquée.
            // La friction (setDrag) va progressivement ralentir et arrêter la voiture.
            this.player.setAccelerationX(0);
        }
    }

    cleanupObstacles() {
        this.obstacles.getChildren().forEach(obstacle => {
            if (obstacle.y > this.scale.height + 100) {
                obstacle.destroy();
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('start_turn', (data) => { if (this.isGameRunning) this.turning = data.direction; });
        this.socket.on('stop_turn', () => { this.turning = 'none'; });
    }

    startCountdown() {
        const countdownText = this.add.text(this.scale.width / 2, this.scale.height / 2, '3', { fontSize: '128px', fill: '#FFF', fontStyle: 'bold' }).setOrigin(0.5);
        let count = 3;
        const timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                count--;
                if (count > 0) countdownText.setText(String(count));
                else if (count === 0) countdownText.setText('GO!');
                else {
                    countdownText.destroy();
                    this.startGame();
                    timerEvent.remove();
                }
            },
            repeat: 3
        });
    }

    startGame() {
        this.isGameRunning = true;
    }

    spawnObstaclesIfNeeded() {
        if (this.obstacles.getLength() < 10 && Phaser.Math.Between(0, 100) > 90) { 
            const padding = 20; 
            const xPos = Phaser.Math.Between(this.roadBoundaries.left + padding, this.roadBoundaries.right - padding);
            const obstacle = this.obstacles.create(xPos, -50, 'obstacle_texture');
            this.physics.add.existing(obstacle, false);
            obstacle.body.setImmovable(true);
        }
    }

    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        
        const finalScore = Math.floor(this.score);

        this.add.particles(this.player.x, this.player.y, 'particle_texture', {
            speed: 200,
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 600,
            quantity: 40
        });
        
        this.player.destroy();
        
        this.socket.emit('game_over', { score: finalScore, sessionCode: this.sessionCode });

        this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', { fontSize: '64px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5);
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
            gravity: { y: 0 }
        }
    },
    scene: [LobbyScene, GameScene]
};

const game = new Phaser.Game(config);