class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.socket = null;
        this.sessionCode = null;
        this.playerObjects = new Map();
        this.initialPlayers = [];
        this.qrCodeImage = null;
    }

    init(data) {
        this.socket = data.socket;
        this.sessionCode = data.sessionCode;
        this.initialPlayers = data.players || [];
    }

    create() {
        GraphicsGenerator.createAllTextures(this);

        // --- SOLUTION 1 : Bouton "Nouvelle Session" ---
        const newSessionButton = this.add.text(this.scale.width - 20, 20, 'Nouvelle Session', { 
            fontSize: '18px', 
            fontFamily: 'monospace', 
            color: '#ff4136',
            backgroundColor: 'rgba(0,0,0,0.3)',
            padding: { x: 10, y: 5 }
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true });

        newSessionButton.on('pointerdown', () => {
            sessionStorage.removeItem('racerSessionCode');
            window.location.reload();
        });
        // --- FIN SOLUTION 1 ---

        if (!this.socket) {
            this.socket = io("https://miaou.vps.webdock.cloud", { path: "/racer/socket.io/" });
            this.setupSocketEvents();
            
            const storedCode = sessionStorage.getItem('racerSessionCode');
            if (storedCode) {
                this.socket.emit('reconnect_host', { sessionCode: storedCode });
            } else {
                this.socket.emit('create_session');
            }
        } else {
            this.setupSocketEvents(); 
            this.redrawLobbyState();
        }
    }

    setupSocketEvents() {
        this.socket.off('session_created');
        this.socket.off('player_joined');
        this.socket.off('player_status_updated');
        this.socket.off('player_name_updated');
        this.socket.off('player_left');
        this.socket.off('start_game_for_all');
        this.socket.off('return_to_lobby');
        this.socket.off('host_reconnected');
        this.socket.off('session_not_found');

        this.socket.on('session_created', (data) => {
            this.sessionCode = data.sessionCode;
            sessionStorage.setItem('racerSessionCode', data.sessionCode);
            this.redrawLobbyState();
        });
        
        this.socket.on('host_reconnected', (data) => {
            this.sessionCode = data.sessionCode;
            this.initialPlayers = data.players;
            this.redrawLobbyState();
        });
        
        this.socket.on('session_not_found', () => {
            sessionStorage.removeItem('racerSessionCode');
            if (this.qrCodeImage) {
                this.qrCodeImage.destroy();
                this.qrCodeImage = null;
            }
            this.socket.emit('create_session');
        });

        this.socket.on('player_joined', (player) => {
            this.addPlayerToLobby(player);
        });

        this.socket.on('player_status_updated', ({ playerId, isReady }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).readyIndicator.setVisible(isReady);
            }
        });

        this.socket.on('player_name_updated', ({ playerId, newName }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).nameText.setText(newName);
            }
        });

        this.socket.on('player_left', ({ playerId }) => {
            if (this.playerObjects.has(playerId)) {
                const playerObject = this.playerObjects.get(playerId);
                playerObject.car.destroy();
                playerObject.readyIndicator.destroy();
                playerObject.nameText.destroy();
                this.playerObjects.delete(playerId);
                this.repositionPlayers();
            }
        });

        this.socket.on('start_game_for_all', (data) => {
            if (this.qrCodeImage) this.qrCodeImage.setVisible(false);
            this.scene.start('GameScene', { socket: this.socket, sessionCode: this.sessionCode, players: data.players });
        });

        this.socket.on('return_to_lobby', (data) => {
            this.scene.start('LobbyScene', { socket: this.socket, sessionCode: this.sessionCode, players: data.players });
        });
    }

    redrawLobbyState() {
        // Nettoyer uniquement les objets des joueurs, pas le bouton
        this.playerObjects.forEach(p => {
            p.car.destroy();
            p.nameText.destroy();
            p.readyIndicator.destroy();
        });
        this.playerObjects.clear();
        
        if (this.sessionCode) {
            // Recréer les textes et QR code si nécessaire
            if (this.sessionText) this.sessionText.destroy();
            this.sessionText = this.add.text(this.scale.width / 2, 50, `Session: ${this.sessionCode}`, { fontSize: '40px', color: '#FFFFFF', fontFamily: 'monospace' }).setOrigin(0.5);
            
            if (this.scanText) this.scanText.destroy();
            this.scanText = this.add.text(this.scale.width / 2, 100, 'Scannez le QR Code ou entrez le code', { fontSize: '20px', color: '#AAAAAA', fontFamily: 'monospace' }).setOrigin(0.5);
            
            this.generateAndDisplayQRCode();
        }
        
        this.initialPlayers.forEach(player => this.addPlayerToLobby(player));
    }
    
    generateAndDisplayQRCode() {
        const url = `https://harib-naim.fr/projects/racer/controller.html?sessionCode=${this.sessionCode}`;
        const textureKey = `qr_${this.sessionCode}`;

        if (this.textures.exists(textureKey)) {
            if (this.qrCodeImage) this.qrCodeImage.destroy();
            this.qrCodeImage = this.add.image(this.scale.width / 2, 220, textureKey).setScale(0.6);
            return;
        }

        const tempCanvas = document.createElement('canvas');
        new QRious({
            element: tempCanvas,
            value: url,
            size: 256
        });
        
        const qrDataURL = tempCanvas.toDataURL();
        
        this.textures.addBase64(textureKey, qrDataURL);
        
        this.textures.once(`addtexture-${textureKey}`, () => {
            if (this.qrCodeImage) this.qrCodeImage.destroy();
            this.qrCodeImage = this.add.image(this.scale.width / 2, 220, textureKey).setScale(0.6);
        });
    }

    addPlayerToLobby(player) {
        const spacing = 75;
        const startY = 320;
        const playerY = startY + this.playerObjects.size * spacing;

        const car = this.add.sprite(this.scale.width / 2, playerY, 'car_texture').setTint(Phaser.Display.Color.ValueToColor(player.color).color).setScale(1.0);
        const readyIndicator = this.add.text(car.x + 80, car.y, '✔', { fontSize: '38px', fill: '#2ECC40' }).setOrigin(0.5).setVisible(player.isReady);
        const nameText = this.add.text(car.x, car.y - 50, player.name || 'Joueur', { fontSize: '20px', fill: '#FFF' }).setOrigin(0.5);
        
        this.playerObjects.set(player.id, { car, readyIndicator, nameText });
        
        car.setAngle(90);
        car.x = -100;
        nameText.x = -100;
        
        this.tweens.add({ targets: [car, nameText], x: this.scale.width / 2 - 50, ease: 'Cubic.easeOut', duration: 800 });
    }

    repositionPlayers() {
        let i = 0;
        const spacing = 75;
        const startY = 320;
        this.playerObjects.forEach((playerUI) => {
            const targetY = startY + i * spacing;
            this.tweens.add({ 
                targets: [playerUI.car, playerUI.nameText, playerUI.readyIndicator], 
                y: targetY, 
                ease: 'power2', 
                duration: 500 
            });
            i++;
        });
    }
}