class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        this.load.image('road', 'https://i.imgur.com/qB4y3c1.png');
        this.load.image('car', 'https://i.imgur.com/x6e551j.png');
        this.load.image('obstacle', 'https://i.imgur.com/V3iU0a9.png');
    }

    create() {
        this.scene.start('LobbyScene');
    }
}


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
        this.scrollSpeed = 5;
        this.timer = 0;
    }

    init(data) {
        this.socket = data.socket;
    }

    create() {
        this.road = this.add.tileSprite(400, 300, 800, 600, 'road');
        this.player = this.physics.add.sprite(400, 500, 'car').setCollideWorldBounds(true);
        this.obstacles = this.physics.add.group();
        this.physics.add.collider(this.player, this.obstacles, this.gameOver, null, this);
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#FFF' });

        this.setupSocketListeners();
        this.startCountdown();
    }

    update(time) {
        if (!this.isGameRunning) {
            return;
        }
        this.road.tilePositionY -= this.scrollSpeed;
        this.scrollSpeed += 0.005; 
        
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
        const moveDistance = 300;
        if (action === 'left') {
            this.player.setVelocityX(-moveDistance);
        } else if (action === 'right') {
            this.player.setVelocityX(moveDistance);
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
            delay: 1500,
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });
    }

    spawnObstacle() {
        if (!this.isGameRunning) return;
        const x = Phaser.Math.Between(100, 700);
        const obstacle = this.obstacles.create(x, -50, 'obstacle');
        obstacle.setVelocityY(this.scrollSpeed * 60); 
    }

    gameOver() {
        this.isGameRunning = false;
        this.physics.pause();
        this.player.setTint(0xff0000);
        this.socket.emit('game_over', { score: Math.floor(this.timer / 100) });

        const gameOverText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER', { fontSize: '64px', fill: '#ff0000' }).setOrigin(0.5);
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
    scene: [PreloadScene, LobbyScene, GameScene]
};

const game = new Phaser.Game(config);