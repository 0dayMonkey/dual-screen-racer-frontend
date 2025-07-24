class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.socket = null;
        this.sessionCodeText = null;
    }

    create() {
        this.initializeText();
        this.initializeSocketConnection();
        this.setupSocketEvents();
    }

    initializeText() {
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        this.sessionCodeText = this.add.text(screenCenterX, screenCenterY, 'Connexion en cours...', {
            fontSize: '40px',
            fontFamily: '"Courier New", Courier, monospace',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: this.cameras.main.width - 40 }
        }).setOrigin(0.5);
    }

    initializeSocketConnection() {
        this.socket = io("https://miaou.vps.webdock.cloud", {
            path: "/racer/socket.io/"
        });
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            this.sessionCodeText.setText('Demande de session...');
            this.socket.emit('create_session');
        });

        this.socket.on('session_created', (data) => {
            this.handleSessionCreated(data);
        });

        this.socket.on('connection_successful', () => {
             this.scene.start('GameScene', { socket: this.socket });
        });

        this.socket.on('disconnect', () => {
            this.sessionCodeText.setText('Déconnecté du serveur.');
        });
    }

    handleSessionCreated(data) {
        if (data && data.sessionCode) {
            const code = data.sessionCode;
            this.sessionCodeText.setText(`Entrez ce code sur votre manette :\n\n${code}`);
        } else {
            this.sessionCodeText.setText('Erreur : Code de session non reçu.');
        }
    }
}


class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.socket = null;
        this.player = null;
        this.obstacles = null;
        this.scoreText = null;
        this.road = null;
        this.isGameRunning = false;
        this.turning = 'none';
        
        this.roadWidth = 400;
        this.roadLeftBoundary = 0;
        this.roadRightBoundary = 0;
    }

    init(data) {
        this.socket = data.socket;
    }

    create() {
        GraphicsGenerator.createAllTextures(this);

        this.road = this.add.tileSprite(400, 300, 800, 600, 'road_texture');

        this.roadLeftBoundary = (800 - this.roadWidth) / 2;
        this.roadRightBoundary = this.roadLeftBoundary + this.roadWidth;

        this.player = this.physics.add.sprite(400, 500, 'car_texture');

        this.player.setMaxVelocity(600); 

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.1);
        
        this.obstacles = this.physics.add.group({ immovable: true });
        this.physics.add.collider(this.player, this.obstacles);

        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);

        this.setupSocketListeners();
        this.startCountdown();
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        this.updatePlayerMovement();
        this.checkBoundaries(); 
        
        this.road.tilePositionY = this.player.y;

        this.scoreText.setText('Score: ' + Math.max(0, Math.floor(-this.player.y / 10)));
        
        this.spawnObstaclesIfNeeded();
        this.cleanupObstacles();
    }

    updatePlayerMovement() {
        const forwardSpeed = 450;
        const turnStrength = 2.5; 
        const maxAngle = 30;
        const straighteningFactor = 0.04;

        if (this.turning === 'left') {
            this.player.angle -= turnStrength;
        } else if (this.turning === 'right') {
            this.player.angle += turnStrength;
        }

        this.player.angle = Phaser.Math.Clamp(this.player.angle, -maxAngle, maxAngle);

        if (this.turning === 'none' && this.player.angle !== 0) {
            this.player.angle *= (1 - straighteningFactor);
            if (Math.abs(this.player.angle) < 0.1) {
                this.player.angle = 0;
            }
        }

        this.physics.velocityFromAngle(this.player.angle - 90, forwardSpeed, this.player.body.velocity);
    }
    
    checkBoundaries() {
        const cameraBottom = this.cameras.main.scrollY + this.cameras.main.height;
        
        if (this.player.y > cameraBottom + this.player.height || 
            this.player.x < this.roadLeftBoundary || 
            this.player.x > this.roadRightBoundary) {
            this.gameOver();
        }
    }
    
    cleanupObstacles() {
        const cameraTop = this.cameras.main.scrollY;
        this.obstacles.getChildren().forEach(obstacle => {
            if (obstacle.y > cameraTop + this.cameras.main.height + 500) {
                obstacle.destroy();
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('start_turn', (data) => {
            if (this.isGameRunning && data && data.direction) {
                this.turning = data.direction;
            }
        });
        this.socket.on('stop_turn', () => {
            this.turning = 'none';
        });
    }

    startCountdown() {
        const countdownText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, '3', { fontSize: '128px', fill: '#FFF', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
        let count = 3;
        const timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                count--;
                if (count > 0) {
                    countdownText.setText(String(count));
                } else if (count === 0) {
                    countdownText.setText('GO!');
                } else {
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
        const spawnDistance = 1000; 
        
        while (this.obstacles.getLength() < 7) { 
            const yPos = this.player.y - spawnDistance - (Math.random() * spawnDistance);
            
            const padding = 20; 
            const xPos = Phaser.Math.Between(this.roadLeftBoundary + padding, this.roadRightBoundary - padding);

            const obstacle = this.obstacles.create(xPos, yPos, 'obstacle_texture');
            obstacle.setImmovable(true);
        }
    }

    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        
        const finalScore = Math.max(0, Math.floor(-this.player.y / 10));

        const particles = this.add.particles(0, 0, 'particle_texture', {
            speed: 200,
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 600
        });
        particles.createEmitter().explode(32, this.player.x, this.player.y);
        
        this.player.destroy();
        
        this.socket.emit('game_over', { score: finalScore });

        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER', { fontSize: '64px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    },
    scene: [LobbyScene, GameScene]
};

const game = new Phaser.Game(config);