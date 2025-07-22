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
        this.laneLines = null;
        this.isGameRunning = false;
        this.scrollSpeed = 8;
        this.timer = 0;
    }

    init(data) {
        this.socket = data.socket;
    }

    create() {
        this.createGraphics();
        
        this.add.rectangle(400, 300, 800, 600, 0x404040); 
        this.laneLines = this.physics.add.group();
        this.time.addEvent({ delay: 200, callback: this.spawnLaneLine, callbackScope: this, loop: true });

        this.player = this.physics.add.sprite(400, 500, 'car_texture').setCollideWorldBounds(true);
        this.obstacles = this.physics.add.group();
        this.physics.add.collider(this.player, this.obstacles, this.gameOver, null, this);
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#FFF' });

        this.setupSocketListeners();
        this.startCountdown();
    }
    
    createGraphics() {
        const carGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        carGraphics.fillStyle(0xff0000, 1.0);
        carGraphics.fillRect(0, 0, 40, 80);
        carGraphics.generateTexture('car_texture', 40, 80);
        carGraphics.destroy();
        
        const obstacleGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        obstacleGraphics.fillStyle(0x8B4513, 1.0);
        obstacleGraphics.fillRect(0, 0, 60, 60);
        obstacleGraphics.generateTexture('obstacle_texture', 60, 60);
        obstacleGraphics.destroy();
        
        const lineGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        lineGraphics.fillStyle(0xFFFF00, 1.0);
        lineGraphics.fillRect(0, 0, 10, 40);
        lineGraphics.generateTexture('line_texture', 10, 40);
        lineGraphics.destroy();
    }

    update(time) {
        if (!this.isGameRunning) {
            return;
        }
        
        this.scrollSpeed += 0.005;
        this.physics.world.setBounds(0, 0, 800, 600);
        
        // --- NOUVELLE PHYSIQUE ---
        // Applique une friction pour que la voiture se redresse.
        if (this.player.body.velocity.x !== 0) {
            this.player.setVelocityX(this.player.body.velocity.x * 0.95);
        }
        // --- FIN DE LA NOUVELLE PHYSIQUE ---
        
        this.laneLines.children.iterate(line => {
            if (line && line.y > 650) {
                line.destroy();
            }
        });
        
        this.obstacles.children.iterate(obstacle => {
            if (obstacle && obstacle.y > 650) {
                obstacle.destroy();
            }
        });

        this.timer = time;
        this.scoreText.setText('Score: ' + Math.floor(time / 100));
    }
    
    setupSocketListeners() {
        this.socket.on('game_state_update', (data) => {
            if (this.isGameRunning && data && data.action) {
                this.handlePlayerInput(data.action);
            }
        });
    }

    handlePlayerInput(action) {
        const moveForce = 400; // Augmenté pour donner une impulsion plus forte
        if (action === 'left') {
            this.player.setVelocityX(-moveForce);
        } else if (action === 'right') {
            this.player.setVelocityX(moveForce);
        }
    }
    
    startCountdown() {
        const countdownText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, '3', { fontSize: '96px', fill: '#FFF' }).setOrigin(0.5);
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
        this.timer = 0;
        this.time.addEvent({
            delay: 1500, // Le temps entre chaque obstacle
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });
    }
    
    spawnLaneLine() {
        if (!this.isGameRunning) return;
        const line = this.laneLines.create(400, -40, 'line_texture');
        line.setVelocityY(this.scrollSpeed * 60);
    }

    spawnObstacle() {
        if (!this.isGameRunning) return;
        const x = Phaser.Math.Between(100, 700);
        const obstacle = this.obstacles.create(x, -50, 'obstacle_texture');
        obstacle.setVelocityY(this.scrollSpeed * 30); 
    }

    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        this.player.setTint(0xff0000);
        this.socket.emit('game_over', { score: Math.floor(this.timer / 100) });

        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER', { fontSize: '64px', fill: '#ff0000' }).setOrigin(0.5);
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