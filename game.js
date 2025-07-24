class LobbyScene extends Phaser.Scene {
    constructor() { super({ key: 'LobbyScene' }); }
    create() {
        this.add.text(400, 300, 'Connexion en cours...', { fontSize: '40px', fontFamily: '"Courier New", Courier', color: '#ffffff', align: 'center' }).setOrigin(0.5);
        const socket = io("https://miaou.vps.webdock.cloud", { path: "/racer/socket.io/" });
        socket.on('connect', () => {
            this.add.text(400, 300, 'Demande de session...').setOrigin(0.5).setColor('#ffff00');
            socket.emit('create_session');
        });
        socket.on('session_created', (data) => {
            if (data && data.sessionCode) {
                this.add.text(400, 300, `Entrez ce code sur votre manette :\n\n${data.sessionCode}`, {align: 'center', fontSize: '40px'}).setOrigin(0.5);
            }
        });
        socket.on('connection_successful', () => {
             this.scene.start('GameScene', { socket: socket });
        });
    }
}


class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.socket = null;
        this.player = null;
        this.obstacles = null;
        this.road = null;
        this.scoreText = null;
        this.isGameRunning = false;
        this.turning = 'none'; 
        this.forwardSpeed = 400; 
    }

    init(data) {
        this.socket = data.socket;
    }

create() {
    GraphicsGenerator.createAllTextures(this);

    this.road = this.add.tileSprite(400, 300, 800, 600, 'road_texture'); // Taille ajustée
    this.road.tileScaleY = 0.5; // Ajustement de l'échelle pour la hauteur

    this.player = this.physics.add.sprite(400, 500, 'car_texture').setDamping(true).setDrag(0.98).setAngularDrag(400).setMaxVelocity(600);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09).setZoom(1.2);

    this.obstacles = this.physics.add.group({ immovable: true });
    this.physics.add.collider(this.player, this.obstacles);

    this.scoreText = this.add.text(0, 0, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);

    this.setupSocketListeners();
    this.startCountdown();
},
    
    update(time) {
        if (!this.isGameRunning) return;

        this.updatePlayerMovement();
        
        this.road.tilePositionY = this.player.y;

        if (this.player.y > this.cameras.main.scrollY + this.cameras.main.height + 200) {
            this.gameOver();
        }

        this.scoreText.setText('Score: ' + Math.floor(this.player.y / -10));
        this.spawnObstaclesIfNeeded();
    }
    
    updatePlayerMovement() {
        const angularVelocity = 300;
        if (this.turning === 'left') {
            this.player.setAngularVelocity(-angularVelocity);
        } else if (this.turning === 'right') {
            this.player.setAngularVelocity(angularVelocity);
        } else {
            this.player.setAngularVelocity(0);
        }

        // Toujours avancer dans la direction où la voiture pointe
        // La rotation de 0 est vers la droite, donc on soustrait 90 degrés (PI/2) pour pointer vers le haut
        this.physics.velocityFromRotation(this.player.rotation - Math.PI / 2, this.forwardSpeed, this.player.body.velocity);
    }

    setupSocketListeners() {
        this.socket.on('start_turn', (data) => {
            if (data && data.direction) this.turning = data.direction;
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
        const spawnDistance = 800;
        while (this.obstacles.getLength() < 20) {
            const y = this.player.y - spawnDistance - (Math.random() * spawnDistance);
            const x = Phaser.Math.Between(100, 700);
            this.obstacles.create(x, y, 'obstacle_texture');
        }
    }

    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        
        const particles = this.add.particles(0, 0, 'particle_texture', {
            speed: 200, scale: { start: 1, end: 0 }, blendMode: 'ADD', lifespan: 600
        });
        particles.createEmitter().explode(32, this.player.x, this.player.y);
        
        this.player.destroy();
        this.socket.emit('game_over', { score: Math.floor(this.player.y / -10) });
    }
}

// NOTE: Assurez-vous que graphics.js est chargé avant ce fichier
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