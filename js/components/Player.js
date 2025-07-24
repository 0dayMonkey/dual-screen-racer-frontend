class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, playerData) {
        super(scene, x, y, 'car_texture');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.originalColor = Phaser.Display.Color.ValueToColor(playerData.color).color;
        this.setTint(this.originalColor);
        
        // La friction de base pour la route
        this.roadDrag = 0.98; 
        // Une friction beaucoup plus forte pour l'herbe
        this.grassDrag = 0.92; 

        this.setDamping(true).setDrag(this.roadDrag).setMaxVelocity(600).setCollideWorldBounds(true);
        
        this.playerId = playerData.id;
        this.name = playerData.name;
        this.turning = 'none';
        this.score = 0;
        this.offScreenSince = null;
    }

    updateMovement() {
        const forwardSpeed = 500;
        let currentSpeed;

        // --- 1. DÉFINITION DES LIMITES ---

        // Limites de la route (là où commence l'herbe)
        const roadLeftBoundary = this.scene.scale.width * 0.15;
        const roadRightBoundary = this.scene.scale.width * 0.85;
        
        // Murs invisibles (à mi-chemin dans l'herbe)
        const outerLeftBoundary = this.scene.scale.width * 0.075;
        const outerRightBoundary = this.scene.scale.width * 0.925;

        // --- 2. LOGIQUE DE RALENTISSEMENT CORRIGÉE ---

        // On vérifie si le joueur est sur l'herbe
        if (this.x < roadLeftBoundary || this.x > roadRightBoundary) {
            // Sur l'herbe : la vitesse de pointe est plus faible
            currentSpeed = forwardSpeed * 0.6; // 60% de la vitesse normale
            // ET la friction est beaucoup plus forte, ce qui crée un "coup de frein"
            this.setDrag(this.grassDrag);
        } else {
            // Sur la route : vitesse et friction normales
            currentSpeed = forwardSpeed;
            this.setDrag(this.roadDrag);
        }

        // --- 3. LOGIQUE DE MOUVEMENT (INCHANGÉE) ---

        const turnStrength = 3;   
        const maxAngle = 40;      
        const straighteningFactor = 0.05; 

        if (this.turning === 'left') {
            this.angle -= turnStrength;
        } else if (this.turning === 'right') {
            this.angle += turnStrength;
        }

        this.angle = Phaser.Math.Clamp(this.angle, -maxAngle, maxAngle);

        if (this.turning === 'none' && this.angle !== 0) {
            this.angle *= (1 - straighteningFactor);
        }

        this.scene.physics.velocityFromAngle(this.angle - 90, currentSpeed, this.body.velocity);

        // --- 4. APPLICATION DES MURS INVISIBLES ---

        // On s'assure que la position de la voiture reste DANS les murs invisibles
        this.x = Phaser.Math.Clamp(this.x, outerLeftBoundary, outerRightBoundary);
    }
}