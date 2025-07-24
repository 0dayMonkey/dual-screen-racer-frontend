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

        car.x = -100;
        this.tweens.add({
            targets: car,
            x: this.scale.width / 2,
            ease: 'power2',
            duration: 800,
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
        GraphicsGenerator.createAllTextures(this);
        this.road = this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 'road_texture');

        const worldHeight = 1000000;
        this.physics.world.setBounds(0, -worldHeight, this.scale.width, worldHeight + this.scale.height);

        this.players.clear();
        this.playerInfo.forEach((playerData, index) => {
            const startX = (this.scale.width / (this.playerInfo.length + 1)) * (index + 1);
            const playerSprite = this.physics.add.sprite(startX, this.scale.height - 150, 'car_texture')
                .setTint(Phaser.Display.Color.ValueToColor(playerData.color).color);

            playerSprite.setDamping(true).setDrag(0.98).setMaxVelocity(600).setCollideWorldBounds(true);

            this.players.set(playerData.id, {
                sprite: playerSprite,
                turning: 'none',
                score: 0
            });
        });

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
        this.gameOver();
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        let leadPlayerY = 0;
        this.players.forEach(player => {
            this.updatePlayerMovement(player);
            if (player.sprite.y < leadPlayerY) {
                leadPlayerY = player.sprite.y;
            }
        });

        let leadScore = 0;
        this.players.forEach(player => {
            player.score = Math.max(0, Math.floor(-player.sprite.y / 10));
            if (player.score > leadScore) leadScore = player.score;
        });

        this.road.tilePositionY = leadPlayerY;
        this.scoreText.setText('Score: ' + leadScore);

        this.spawnObstaclesIfNeeded();
        this.cleanupObstacles();
    }

    updatePlayerMovement(player) {
        const forwardSpeed = 500;
        const turnStrength = 3;
        const maxAngle = 40;
        const straighteningFactor = 0.05;

        if (player.turning === 'left') {
            player.sprite.angle -= turnStrength;
        } else if (player.turning === 'right') {
            player.sprite.angle += turnStrength;
        }

        player.sprite.angle = Phaser.Math.Clamp(player.sprite.angle, -maxAngle, maxAngle);

        if (player.turning === 'none' && player.sprite.angle !== 0) {
            player.sprite.angle *= (1 - straighteningFactor);
        }

        this.physics.velocityFromAngle(player.sprite.angle - 90, forwardSpeed, player.sprite.body.velocity);
    }

    cleanupObstacles() {
        const camera = this.cameras.main;
        if (!this.playerInfo || this.playerInfo.length === 0) return;
        const leadPlayer = this.players.get(this.playerInfo[0].id);
        if (!leadPlayer) return;

        this.obstacles.getChildren().forEach(obstacle => {
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

    spawnObstaclesIfNeeded() {
        if (!this.playerInfo || this.playerInfo.length === 0) return;
        const leadPlayer = this.players.get(this.playerInfo[0].id);
        if (!leadPlayer) return;

        while (this.obstacles.getLength() < 20) {
            const spawnY = leadPlayer.sprite.y - 800 - (Math.random() * this.scale.height);
            const spawnX = Phaser.Math.Between(this.scale.width * 0.2, this.scale.width * 0.8);
            this.obstacles.create(spawnX, spawnY, 'obstacle_texture');
        }
    }

    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        this.cameras.main.stopFollow();

        let finalScore = 0;
        this.players.forEach(p => {
            if (p.score > finalScore) finalScore = p.score;
        });

        this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
            fontSize: '64px',
            fill: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

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