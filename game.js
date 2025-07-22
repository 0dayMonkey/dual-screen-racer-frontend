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

        this.sessionCodeText = this.add.text(screenCenterX, screenCenterY, 'Connexion au serveur...', {
            fontSize: '40px',
            fontFamily: '"Courier New", Courier, monospace',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: this.cameras.main.width - 40 }
        }).setOrigin(0.5);
    }

    initializeSocketConnection() {
        this.socket = io('http://miaou.vps.webdock.cloud:8888');
    }
    
    setupSocketEvents() {
        this.socket.on('connect', () => {
            this.sessionCodeText.setText('Demande de code de session...');
            this.socket.emit('create_session');
        });

        this.socket.on('session_created', (data) => {
            this.handleSessionCreated(data);
        });
        
        this.socket.on('connection_successful', () => {
             this.sessionCodeText.setText('Manette connectée !\nLa partie va commencer...');
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

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: [LobbyScene]
};

const game = new Phaser.Game(config);