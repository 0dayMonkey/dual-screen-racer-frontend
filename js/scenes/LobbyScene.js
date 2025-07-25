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
        
        // --- Header UI ---
        this.add.text(this.scale.width / 2, 40, 'Dual Screen Racer', { 
            fontSize: '48px', 
            fontFamily: 'monospace',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

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

        // --- Socket Connection ---
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
            this.repositionPlayers();
        });

        this.socket.on('player_status_updated', ({ playerId, isReady }) => {
            if (this.playerObjects.has(playerId)) {
                const playerCard = this.playerObjects.get(playerId);
                const readyIndicator = playerCard.getData('readyIndicator');
                readyIndicator.setVisible(isReady);
                 this.tweens.add({
                    targets: readyIndicator,
                    scale: { from: 1.5, to: 1 },
                    alpha: { from: 0, to: 1 },
                    duration: 300,
                    ease: 'Cubic.easeOut'
                });
            }
        });

        this.socket.on('player_name_updated', ({ playerId, newName }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).getData('nameText').setText(newName);
            }
        });

        this.socket.on('player_left', ({ playerId }) => {
            if (this.playerObjects.has(playerId)) {
                const playerCard = this.playerObjects.get(playerId);
                this.tweens.add({
                    targets: playerCard,
                    alpha: 0,
                    scale: 0.8,
                    duration: 300,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        playerCard.destroy();
                        this.playerObjects.delete(playerId);
                        this.repositionPlayers();
                    }
                });
            }
        });

        this.socket.on('start_game_for_all', (data) => {
            this.tweens.add({
                targets: [this.qrCodeImage, this.sessionText, this.scanText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.scene.start('GameScene', { socket: this.socket, sessionCode: this.sessionCode, players: data.players });
                }
            });
        });

        this.socket.on('return_to_lobby', (data) => {
            this.scene.start('LobbyScene', { socket: this.socket, sessionCode: this.sessionCode, players: data.players });
        });
    }

    redrawLobbyState() {
        // Clean up existing objects
        this.playerObjects.forEach(p => p.destroy());
        this.playerObjects.clear();
        
        if (this.sessionCode) {
            // Main info display
            if (this.sessionText) this.sessionText.destroy();
            this.sessionText = this.add.text(this.scale.width / 2, 120, `Code: ${this.sessionCode}`, { 
                fontSize: '40px', color: '#FFFFFF', fontFamily: 'monospace',
                backgroundColor: 'rgba(0,0,0,0.2)', padding: {x: 20, y: 10},
            }).setOrigin(0.5);
            
            if (this.scanText) this.scanText.destroy();
            this.scanText = this.add.text(this.scale.width / 2, 180, 'Scannez pour rejoindre', { 
                fontSize: '20px', color: '#AAAAAA', fontFamily: 'monospace' 
            }).setOrigin(0.5);
            
            this.generateAndDisplayQRCode();
        }
        
        this.initialPlayers.forEach(player => this.addPlayerToLobby(player));
        this.repositionPlayers();
    }
    
    generateAndDisplayQRCode() {
        const url = `https://harib-naim.fr/projects/racer/controller.html?sessionCode=${this.sessionCode}`;
        const textureKey = `qr_${this.sessionCode}`;

        if (this.textures.exists(textureKey)) {
            if (this.qrCodeImage) this.qrCodeImage.destroy();
            this.qrCodeImage = this.add.image(this.scale.width / 2, 280, textureKey).setScale(0.5);
            return;
        }

        const tempCanvas = document.createElement('canvas');
        new QRious({ element: tempCanvas, value: url, size: 256 });
        
        this.textures.addBase64(textureKey, tempCanvas.toDataURL());
        
        this.textures.once(`addtexture-${textureKey}`, () => {
            if (this.qrCodeImage) this.qrCodeImage.destroy();
            this.qrCodeImage = this.add.image(this.scale.width / 2, 280, textureKey).setScale(0.5);
        });
    }

    addPlayerToLobby(player) {
        // --- Player Card Container ---
        const cardWidth = 250;
        const cardHeight = 150;
        const playerCard = this.add.container(0, 0); // Position will be set by repositionPlayers

        // Card background
        const background = this.add.graphics()
            .fillStyle(0x000000, 0.3)
            .fillRoundedRect(0, 0, cardWidth, cardHeight, 16);
        
        // Player Name
        const nameText = this.add.text(cardWidth / 2, 25, player.name || 'Joueur', { 
            fontSize: '24px', 
            fill: '#FFF',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Car sprite
        const car = this.add.sprite(cardWidth / 2, 85, 'car_texture')
            .setTint(Phaser.Display.Color.ValueToColor(player.color).color)
            .setScale(1.2)
            .setAngle(90);

        // Ready indicator
        const readyIndicator = this.add.text(cardWidth - 30, cardHeight - 30, '✔', { 
            fontSize: '38px', 
            fill: '#2ECC40' 
        }).setOrigin(0.5).setVisible(player.isReady);

        // Add all elements to the container
        playerCard.add([background, nameText, car, readyIndicator]);
        playerCard.setSize(cardWidth, cardHeight);

        // Store references to elements for easy access
        playerCard.setData({ nameText, car, readyIndicator });
        
        this.playerObjects.set(player.id, playerCard);

        // Entrance animation
        playerCard.setScale(0);
        this.tweens.add({
            targets: playerCard,
            scale: 1,
            duration: 400,
            ease: 'Cubic.easeOut'
        });
    }

    repositionPlayers() {
        const columns = 2;
        const cardWidth = 250;
        const spacingX = 40;
        const spacingY = 20;
        const totalWidth = (columns * cardWidth) + ((columns - 1) * spacingX);
        const startX = (this.scale.width - totalWidth) / 2 + (cardWidth/2);
        const startY = 450;

        let i = 0;
        this.playerObjects.forEach((playerCard) => {
            const row = Math.floor(i / columns);
            const col = i % columns;
            
            const targetX = startX + col * (cardWidth + spacingX);
            const targetY = startY + row * (playerCard.height + spacingY);

            this.tweens.add({
                targets: playerCard,
                x: targetX,
                y: targetY,
                duration: 500,
                ease: 'Power2'
            });
            i++;
        });
    }
}