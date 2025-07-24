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
        this.turning = 'none'; // 'left', 'right', ou 'none'
    }

    init(data) {
        this.socket = data.socket;
    }

    create() {
        GraphicsGenerator.createAllTextures(this);

        this.road = this.add.tileSprite(400, 300, 800, 600, 'road_texture');
        this.player = this.physics.add.sprite(400, 500, 'car_texture');

        // Configuration de la physique de la voiture
        this.player.setDamping(true); // Permet le ralentissement progressif
        this.player.setDrag(0.99);    // Friction de l'air/route
        this.player.setMaxVelocity(600); // Vitesse maximale

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.1);

        // Les obstacles sont maintenant des corps statiques qui ne provoquent pas de 'game over' au contact
        this.obstacles = this.physics.add.group({ immovable: true });
        this.physics.add.collider(this.player, this.obstacles);

        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);

        this.setupSocketListeners();
        this.startCountdown();
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        this.updatePlayerMovement();
        this.checkGameOverCondition();

        // Le défilement de la route est maintenant lié à la position Y du joueur
        this.road.tilePositionY = this.player.y;

        // Mise à jour du score basé sur la distance parcourue (vers le haut de l'écran)
        this.scoreText.setText('Score: ' + Math.max(0, Math.floor(-this.player.y / 10)));
        
        this.spawnObstaclesIfNeeded();
    }

    updatePlayerMovement() {
        const forwardSpeed = 400;
        const turnStrength = 15; // Force de rotation
        const maxAngle = 30;     // Angle de braquage maximum en degrés
        const straighteningFactor = 0.05; // Vitesse à laquelle la voiture se redresse

        // 1. Appliquer la rotation en fonction de l'input
        if (this.turning === 'left') {
            this.player.angle -= turnStrength;
        } else if (this.turning === 'right') {
            this.player.angle += turnStrength;
        }

        // 2. Limiter l'angle de braquage
        this.player.angle = Phaser.Math.Clamp(this.player.angle, -maxAngle, maxAngle);

        // 3. Redresser la voiture automatiquement
        if (this.turning === 'none' && this.player.angle !== 0) {
            this.player.angle *= (1 - straighteningFactor);
        }

        // 4. Toujours avancer dans la direction où la voiture pointe
        // La rotation de 0 est vers la droite, donc on soustrait 90 degrés pour pointer vers le haut
        this.physics.velocityFromAngle(this.player.angle - 90, forwardSpeed, this.player.body.velocity);
    }
    
    checkGameOverCondition() {
        // La partie est perdue si la voiture sort par le bas de la vue de la caméra
        const cameraBottom = this.cameras.main.scrollY + this.cameras.main.height;
        if (this.player.y > cameraBottom + this.player.height) {
            this.gameOver();
        }
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
        const spawnDistance = 1000; // Distance à laquelle les obstacles apparaissent devant le joueur
        while (this.obstacles.getLength() < 15) { // Maintenir un certain nombre d'obstacles dans le monde
            const yPos = this.player.y - spawnDistance - (Math.random() * spawnDistance);
            const xPos = Phaser.Math.Between(100, 700);
            const obstacle = this.obstacles.create(xPos, yPos, 'obstacle_texture');
            obstacle.setImmovable(true);
        }
    }

    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        
        const particles = this.add.particles(0, 0, 'particle_texture', {
            speed: 200,
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 600
        });
        particles.createEmitter().explode(32, this.player.x, this.player.y);
        
        this.player.destroy();
        
        this.socket.emit('game_over', { score: Math.max(0, Math.floor(-this.player.y / 10)) });

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