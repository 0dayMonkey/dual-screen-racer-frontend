class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, playerData) {
        super(scene, x, y, 'car_texture');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.originalColor = Phaser.Display.Color.ValueToColor(playerData.color).color;
        this.setTint(this.originalColor);
        
        this.setDamping(true).setDrag(0.98).setMaxVelocity(600).setCollideWorldBounds(true);
        
        this.playerId = playerData.id;
        this.name = playerData.name; // Ligne ajoutée

        this.turning = 'none';
        this.score = 0;
        this.offScreenSince = null;

    }

    updateMovement() {
        // --- DEBUT DE LA MODIFICATION ---

        const forwardSpeed = 500; // Vitesse sur la route
        const grassSpeed = 250;   // Vitesse sur l'herbe (plus lente)
        let currentSpeed;

        // Définir les limites de la route
        // La route fait 70% de la largeur, centrée.
        // L'herbe est donc sur les 15% de chaque côté.
        const roadLeftBoundary = this.scene.scale.width * 0.15;
        const roadRightBoundary = this.scene.scale.width * 0.85;

        // Vérifier si la voiture est sur l'herbe
        if (this.x < roadLeftBoundary || this.x > roadRightBoundary) {
            currentSpeed = grassSpeed;
            // Optionnel : faire vibrer légèrement la voiture sur l'herbe
            this.x += Math.random() * 2 - 1; 
        } else {
            currentSpeed = forwardSpeed;
        }

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

        // On utilise la vitesse déterminée (currentSpeed)
        this.scene.physics.velocityFromAngle(this.angle - 90, currentSpeed, this.body.velocity);

        // --- FIN DE LA MODIFICATION ---
    }
}