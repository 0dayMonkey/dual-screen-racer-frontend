class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.socket = null;
        this.sessionCode = null;
        this.sessionCodeText = null;
        // NOUVEAU : Map pour stocker les objets graphiques des joueurs (texte, icône prêt)
        this.playerObjects = new Map(); 
    }

    create() {
        this.initializeSocketConnection();
        this.setupSocketEvents();
    }

    initializeSocketConnection() {
        this.socket = io("https://miaou.vps.webdock.cloud", { path: "/racer/socket.io/" });
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            this.socket.emit('create_session');
        });

        this.socket.on('session_created', (data) => {
            this.sessionCode = data.sessionCode;
            // Affiche le code de session et les instructions
            if (this.sessionCodeText) this.sessionCodeText.destroy();
            this.sessionCodeText = this.add.text(this.scale.width / 2, 50, `Session: ${this.sessionCode}`, { fontSize: '40px', fontFamily: 'monospace' }).setOrigin(0.5);
            this.add.text(this.scale.width / 2, 100, 'Les joueurs peuvent rejoindre...', { fontSize: '20px', fontFamily: 'monospace' }).setOrigin(0.5);
        });

        // NOUVEAU : Gère l'arrivée d'un nouveau joueur dans le lobby
        this.socket.on('player_joined', (player) => {
            this.addPlayerToLobby(player);
        });
        
        // NOUVEAU : Gère la mise à jour du statut d'un joueur
        this.socket.on('player_status_updated', ({ playerId, isReady }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).readyIndicator.setVisible(isReady);
            }
        });

        // NOUVEAU : Gère le départ d'un joueur
        this.socket.on('player_left', ({ playerId }) => {
            if (this.playerObjects.has(playerId)) {
                this.playerObjects.get(playerId).car.destroy();
                this.playerObjects.get(playerId).readyIndicator.destroy();
                this.playerObjects.delete(playerId);
                this.repositionPlayers();
            }
        });
        
        // NOUVEAU : Gère le lancement global du jeu
        this.socket.on('start_game_for_all', (data) => {
            this.scene.start('GameScene', { socket: this.socket, sessionCode: this.sessionCode, players: data.players });
        });
        
        // NOUVEAU : Gère le retour au lobby
        this.socket.on('return_to_lobby', (data) => {
             this.scene.start('LobbyScene', { socket: this.socket, sessionCode: this.sessionCode, players: data.players });
        });
    }
    
    // NOUVELLE MÉTHODE pour ajouter un joueur à l'écran du lobby
    addPlayerToLobby(player) {
        const playerY = 150 + this.playerObjects.size * 100;
        const car = this.add.sprite(this.scale.width / 2, playerY, 'car_texture')
                          .setTint(Phaser.Display.Color.ValueToColor(player.color).color)
                          .setScale(1.2);
        
        const readyIndicator = this.add.text(car.x + 100, car.y, '✔', { fontSize: '48px', fill: '#2ECC40' })
                                     .setOrigin(0.5)
                                     .setVisible(player.isReady);

        this.playerObjects.set(player.id, { car, readyIndicator });

        // Animation d'entrée
        car.x = -100;
        this.tweens.add({
            targets: car,
            x: this.scale.width / 2,
            ease: 'power2',
            duration: 800,
        });
    }
    
    // NOUVELLE MÉTHODE pour repositionner les joueurs si l'un d'eux part
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
        super({ key: 'GameScene' });
        // ... (propriétés existantes)
        // CHANGEMENT : this.player devient this.players, une Map
        this.players = new Map();
        this.playerInfo = []; // Pour stocker les données initiales des joueurs
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
        // CHANGEMENT : On récupère la liste des joueurs
        this.playerInfo = data.players;
    }

    create() {
        GraphicsGenerator.createAllTextures(this);
        this.road = this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 'road_texture');
        this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

        // CHANGEMENT : Crée un sprite pour chaque joueur
        this.playerInfo.forEach((playerData, index) => {
            const startX = (this.scale.width / (this.playerInfo.length + 1)) * (index + 1);
            const playerSprite = this.physics.add.sprite(startX, this.scale.height - 150, 'car_texture')
                                       .setTint(Phaser.Display.Color.ValueToColor(playerData.color).color);
            
            playerSprite.setDamping(true).setDrag(0.98).setMaxVelocity(600).setCollideWorldBounds(true);
            
            // On stocke le sprite et l'état de contrôle dans la Map des joueurs
            this.players.set(playerData.id, {
                sprite: playerSprite,
                turning: 'none',
                score: 0
            });
        });
        
        // La caméra suit le premier joueur pour le moment. Une caméra multi-joueurs serait plus complexe.
        const firstPlayerSprite = this.players.values().next().value.sprite;
        if(firstPlayerSprite) {
            this.cameras.main.startFollow(firstPlayerSprite, true, 0.09, 0.09);
            this.cameras.main.setZoom(1.2);
        }
        
        this.obstacles = this.physics.add.group();
        // Le collider est maintenant pour tous les joueurs
        this.physics.add.collider(Array.from(this.players.values()).map(p => p.sprite), this.obstacles, this.playerHitObstacle, null, this);
        
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }).setScrollFactor(0);
        
        this.setupSocketListeners();
        this.startCountdown();
    }
    
    playerHitObstacle(playerSprite, obstacle) {
        // Le jeu se termine pour tout le monde si un joueur est touché
        this.gameOver();
    }

    update(time, delta) {
        if (!this.isGameRunning) return;

        // Met à jour chaque joueur
        this.players.forEach(player => {
            this.updatePlayerMovement(player);
        });
        
        // Le score et la route suivent le joueur le plus avancé
        let leadY = 0;
        let leadScore = 0;
        this.players.forEach(player => {
            if(player.sprite.y < leadY) leadY = player.sprite.y;
            player.score = Math.max(0, Math.floor(-player.sprite.y / 10));
            if(player.score > leadScore) leadScore = player.score;
        });

        this.road.tilePositionY += 5; // Défilement constant
        this.scoreText.setText('Score: ' + leadScore);
        
        // La logique de spawn et de nettoyage reste similaire
        this.spawnObstaclesIfNeeded();
        this.cleanupObstacles();
    }
    
    // La méthode de mouvement est maintenant appliquée à un joueur spécifique
    updatePlayerMovement(player) {
        const forwardSpeed = 500;
        const turnStrength = 3;
        const maxAngle = 40;
        
        const velocity = this.physics.velocityFromAngle(player.sprite.angle - 90, forwardSpeed);
        player.sprite.setVelocity(velocity.x, velocity.y);

        if (player.turning === 'left') {
            player.sprite.angle = Phaser.Math.Clamp(player.sprite.angle - turnStrength, -maxAngle, maxAngle);
        } else if (player.turning === 'right') {
            player.sprite.angle = Phaser.Math.Clamp(player.sprite.angle + turnStrength, -maxAngle, maxAngle);
        } else {
             // Redressement automatique
            if (player.sprite.angle !== 0) {
                 player.sprite.angle *= 0.95;
            }
        }
    }

    cleanupObstacles() {
        const camera = this.cameras.main;
        this.obstacles.getChildren().forEach(obstacle => {
            // Supprime les obstacles qui sont bien en dessous de la vue de la caméra
            if (obstacle.y > camera.scrollY + camera.height + 200) {
                obstacle.destroy();
            }
        });
    }

    setupSocketListeners() {
        // CHANGEMENT : Les événements de contrôle ciblent un joueur spécifique
        this.socket.on('start_turn', ({ playerId, direction }) => {
            if (this.isGameRunning && this.players.has(playerId)) {
                this.players.get(playerId).turning = direction;
            }
        });
        this.socket.on('stop_turn', ({ playerId }) => {
            if (this.players.has(playerId)) {
                this.players.get(playerId).turning = 'none';
            }
        });
    }

    startCountdown() {
        const countdownText = this.add.text(this.scale.width / 2, this.scale.height / 2, '3', { 
            fontSize: '128px', fill: '#FFF', fontStyle: 'bold' 
        }).setOrigin(0.5).setScrollFactor(0);
        
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
                }
            },
            repeat: 3
        });
    }
    startGame() {
        this.isGameRunning = true;
    }
    
    spawnObstaclesIfNeeded() {
        if(this.obstacles.getLength() < 20) { // Maintient un certain nombre d'obstacles
            const camera = this.cameras.main;
            const spawnY = camera.scrollY - 200; // Apparaît au-dessus de l'écran
            const spawnX = Phaser.Math.Between(this.scale.width * 0.2, this.scale.width * 0.8);
            
            const obstacle = this.obstacles.create(spawnX, spawnY, 'obstacle_texture');
            obstacle.body.setImmovable(true);
        }
    }
    
    gameOver() {
        if (!this.isGameRunning) return;
        this.isGameRunning = false;
        this.physics.pause();
        this.cameras.main.stopFollow();

        let finalScore = 0;
        this.players.forEach(p => { if (p.score > finalScore) finalScore = p.score; });

        this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', { 
            fontSize: '64px', fill: '#ff0000', fontStyle: 'bold' 
        }).setOrigin(0.5).setScrollFactor(0);
        
        this.socket.emit('game_over', { score: finalScore, sessionCode: this.sessionCode });
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
            //, debug: true // Décommenter pour voir les boîtes de collision
        }
    },
    scene: [LobbyScene, GameScene]
};

const game = new Phaser.Game(config);