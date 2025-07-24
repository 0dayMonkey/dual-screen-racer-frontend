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
        this.roadWidth = 400;
        this.roadLeftBoundary = 0;
        this.roadRightBoundary = 0;
    }

    init(data) {
        this.socket = data.socket;
    }

 create() {
        GraphicsGenerator.createAllTextures(this);

        // La route utilise la nouvelle texture qui fait toute la largeur du jeu
        this.road = this.add.tileSprite(400, 300, 800, 600, 'road_texture');

        // Définir les limites physiques de la route
        this.roadLeftBoundary = (800 - this.roadWidth) / 2;
        this.roadRightBoundary = this.roadLeftBoundary + this.roadWidth;

        this.player = this.physics.add.sprite(400, 500, 'car_texture');

        this.player.setMaxVelocity(600); // Vitesse maximale

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
        
        // Le défilement de la route est maintenant lié à la position Y du joueur
        this.road.tilePositionY = this.player.y;

        this.scoreText.setText('Score: ' + Math.max(0, Math.floor(-this.player.y / 10)));
        
        // Appel des deux nouvelles fonctions
        this.spawnObstaclesIfNeeded();
        this.cleanupObstacles(); // <-- AJOUTER CETTE LIGNE
    }

    updatePlayerMovement() {
        const forwardSpeed = 450;
        // La force de rotation est plus faible pour un mouvement plus fluide
        const turnStrength = 2.5; 
        const maxAngle = 30;     // Angle de braquage maximum en degrés
        const straighteningFactor = 0.04; // Vitesse à laquelle la voiture se redresse

        // 1. Appliquer la rotation en fonction de l'input
        if (this.turning === 'left') {
            this.player.angle -= turnStrength;
        } else if (this.turning === 'right') {
            this.player.angle += turnStrength;
        }

        // 2. Limiter l'angle de braquage
        this.player.angle = Phaser.Math.Clamp(this.player.angle, -maxAngle, maxAngle);

        // 3. Redresser la voiture automatiquement quand on ne tourne pas
        if (this.turning === 'none' && this.player.angle !== 0) {
            this.player.angle *= (1 - straighteningFactor);
            // Si l'angle est très proche de zéro, on le met à zéro pour arrêter le mouvement
            if (Math.abs(this.player.angle) < 0.1) {
                this.player.angle = 0;
            }
        }

        // 4. Toujours avancer dans la direction où la voiture pointe
        this.physics.velocityFromAngle(this.player.angle - 90, forwardSpeed, this.player.body.velocity);
    }
    

    cleanupObstacles() {
        const cameraTop = this.cameras.main.scrollY;
        this.obstacles.getChildren().forEach(obstacle => {
            // Si un obstacle est 500px en dessous de ce que la caméra voit, on le supprime
            if (obstacle.y > cameraTop + this.cameras.main.height + 500) {
                obstacle.destroy();
            }
        });
    }
    
    checkBoundaries() {
        const cameraBottom = this.cameras.main.scrollY + this.cameras.main.height;
        
        // Condition de Game Over :
        // - Le joueur sort par le bas de l'écran
        // - Le joueur touche la bordure gauche ou droite de la route
        if (this.player.y > cameraBottom + this.player.height || 
            this.player.x < this.roadLeftBoundary || 
            this.player.x > this.roadRightBoundary) {
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
        // Distance à laquelle les obstacles apparaissent devant le joueur
        const spawnDistance = 1000; 
        
        // On maintient un maximum de 7 obstacles dans le monde au lieu de 15
        while (this.obstacles.getLength() < 7) { 
            // Position en Y, loin devant le joueur
            const yPos = this.player.y - spawnDistance - (Math.random() * spawnDistance);
            
            // Position en X, calculée pour être DANS les limites de la route
            // On ajoute un petit padding pour ne pas apparaître collé au bord
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