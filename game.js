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
        this.road = null;
        this.scoreText = null;
        this.isGameRunning = false;
        this.turning = 'none';
        this.score = 0;
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
    }

    create() {
        GraphicsGenerator.createAllTextures(this);

        // La route est un grand sprite qui défile
        this.road = this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 'road_texture');

        // Création du joueur au centre
        this.player = this.physics.add.sprite(this.scale.width / 2, this.scale.height / 2, 'car_texture');
        this.player.setDamping(true);
        this.player.setDrag(0.98);
        this.player.setMaxVelocity(600);

        // La caméra suit le joueur
        this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
        this.cameras.main.setZoom(1.2);

        this.obstacles = this.physics.add.group();
        this.physics.add.collider(this.player, this.obstacles, this.playerHitObstacle, null, this);

        this.score = 0;
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);

        this.setupSocketListeners();
        this.startCountdown();
    }
    
    playerHitObstacle(player, obstacle) {
        this.gameOver();
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        // Mise à jour du mouvement et de la physique du joueur
        this.updatePlayerMovement();

        // Le défilement de la route est basé sur la position du joueur pour donner une illusion de vitesse
        this.road.tilePositionY = this.player.y;

        // Le score est basé sur la distance parcourue (position Y négative)
        this.score = Math.max(0, Math.floor(-this.player.y / 10));
        this.scoreText.setText('Score: ' + this.score);
        
        this.spawnObstaclesIfNeeded();
        this.checkBoundaries();
    }

    /**
     * LOGIQUE DE PHYSIQUE CONFORME À VOTRE DEMANDE
     */
    updatePlayerMovement() {
        // 1. Mouvement avant constant
        const forwardSpeed = 500;

        // 2. Mécanique de rotation
        const turnStrength = 3; // Force de la rotation
        if (this.turning === 'left') {
            this.player.angle -= turnStrength;
        } else if (this.turning === 'right') {
            this.player.angle += turnStrength;
        }

        // 3. Angle de braquage limité
        const maxAngle = 40; // Angle maximal en degrés
        this.player.angle = Phaser.Math.Clamp(this.player.angle, -maxAngle, maxAngle);

        // 4. Force de recentrage automatique
        const straighteningFactor = 0.05; // Vitesse de redressement
        if (this.turning === 'none' && this.player.angle !== 0) {
            this.player.angle *= (1 - straighteningFactor);
        }

        // Applique la vitesse dans la direction où la voiture pointe
        // L'angle 0 est vers la droite, on retire 90 degrés pour pointer vers le haut
        this.physics.velocityFromAngle(this.player.angle - 90, forwardSpeed, this.player.body.velocity);
    }

    checkBoundaries() {
        // Condition de défaite : si la voiture sort trop loin de la vue de la caméra
        const cameraBounds = this.cameras.main.getBounds();
        if (!Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), cameraBounds)) {
            // Un petit délai pour éviter une défaite instantanée si on touche juste le bord
            this.time.delayedCall(200, () => {
                if (!Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), this.cameras.main.getBounds())) {
                    this.gameOver();
                }
            });
        }
    }

    setupSocketListeners() {
        this.socket.on('start_turn', (data) => { if (this.isGameRunning) this.turning = data.direction; });
        this.socket.on('stop_turn', () => { this.turning = 'none'; });
        this.socket.on('start_new_game', () => { this.scene.restart(); });
    }

    startCountdown() {
        const countdownText = this.add.text(this.player.x, this.player.y, '3', { fontSize: '128px', fill: '#FFF', fontStyle: 'bold' }).setOrigin(0.5);
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
        const spawnDistance = 1200; // Apparaissent plus loin devant
        if (this.obstacles.getLength() < 15) { 
            const yPos = this.player.y - spawnDistance - (Math.random() * spawnDistance);
            const xPos = this.player.x + Phaser.Math.Between(-this.scale.width, this.scale.width);
            const obstacle = this.obstacles.create(xPos, yPos, 'obstacle_texture');
            this.physics.add.existing(obstacle, true);
        }
    }

    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        
        const finalScore = this.score;

        // On place les particules et le texte sur la position finale du joueur
        this.add.particles(this.player.x, this.player.y, 'particle_texture', {
            speed: 200, scale: { start: 1, end: 0 }, blendMode: 'ADD', lifespan: 600, quantity: 40
        });
        this.add.text(this.player.x, this.player.y, 'GAME OVER', { fontSize: '64px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5);
        
        this.player.destroy();
        
        this.socket.emit('game_over', { score: finalScore, sessionCode: this.sessionCode });

        this.time.delayedCall(5000, () => {
            if (this.scene.isActive()) {
                this.socket.emit('request_replay', { sessionCode: this.sessionCode });
            }
        }, [], this);
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