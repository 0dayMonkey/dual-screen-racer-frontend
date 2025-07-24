class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.socket = null;
        this.sessionCode = null;
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
            this.socket = io("https://miaou.vps.webdock.cloud", { path: "/racer/socket.io/" });
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

        this.socket.on('player_joined', (player) => this.addPlayerToLobby(player));

        this.socket.on('player_status_updated', ({ playerId, isReady }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).readyIndicator.setVisible(isReady);
            }
        });

        this.socket.on('player_left', ({ playerId }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).car.destroy();
                this.playerObjects.get(playerId).readyIndicator.destroy();
                this.playerObjects.delete(playerId);
                this.repositionPlayers();
            }
        });

        this.socket.on('start_game_for_all', (data) => {
            this.scene.start('GameScene', { socket: this.socket, sessionCode: this.sessionCode, players: data.players });
        });

        this.socket.on('return_to_lobby', (data) => {
            this.scene.start('LobbyScene', { socket: this.socket, sessionCode: this.sessionCode, players: data.players });
        });
    }

    redrawLobbyState() {
        this.children.removeAll();
        this.playerObjects.clear();
        if (this.sessionCode) {
            this.add.text(this.scale.width / 2, 50, `Session: ${this.sessionCode}`, { fontSize: '40px', fontFamily: 'monospace' }).setOrigin(0.5);
            this.add.text(this.scale.width / 2, 100, 'Les joueurs peuvent rejoindre...', { fontSize: '20px', fontFamily: 'monospace' }).setOrigin(0.5);
        }
        this.initialPlayers.forEach(player => this.addPlayerToLobby(player));
    }

    addPlayerToLobby(player) {
        const playerY = 150 + this.playerObjects.size * 100;
        const car = this.add.sprite(this.scale.width / 2, playerY, 'car_texture').setTint(Phaser.Display.Color.ValueToColor(player.color).color).setScale(1.2);
        const readyIndicator = this.add.text(car.x + 100, car.y, '✔', { fontSize: '48px', fill: '#2ECC40' }).setOrigin(0.5).setVisible(player.isReady);
        this.playerObjects.set(player.id, { car, readyIndicator });
        car.setAngle(90);
        car.x = -100;
        this.tweens.add({ targets: car, x: this.scale.width / 2 - 50, ease: 'Cubic.easeOut', duration: 1200 });
    }

    repositionPlayers() {
        let i = 0;
        this.playerObjects.forEach(pObj => {
            const targetY = 150 + i * 100;
            this.tweens.add({ targets: [pObj.car, pObj.readyIndicator], y: targetY, ease: 'power2', duration: 500 });
            i++;
        });
    }
}