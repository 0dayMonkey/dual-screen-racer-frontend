class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, playerData) {
        super(scene, x, y, 'car_texture');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.originalColor = Phaser.Display.Color.ValueToColor(playerData.color).color;
        this.setTint(this.originalColor);
        
        this.roadDrag = 0.98; 
        this.grassDrag = 0.92; 

        this.setDamping(true).setDrag(this.roadDrag).setMaxVelocity(600).setCollideWorldBounds(true);
        
        this.playerId = playerData.id;
        this.name = playerData.name;
        this.targetAngle = 0; // Angle cible, contrôlé par la manette
        this.score = 0;
        this.offScreenSince = null;
    }

    updateMovement() {
        const forwardSpeed = 500;
        let currentSpeed;

        const roadLeftBoundary = this.scene.scale.width * 0.15;
        const roadRightBoundary = this.scene.scale.width * 0.85;
        const outerLeftBoundary = this.scene.scale.width * 0.075;
        const outerRightBoundary = this.scene.scale.width * 0.925;

        // Logique de ralentissement
        if (this.x < roadLeftBoundary || this.x > roadRightBoundary) {
            currentSpeed = forwardSpeed * 0.6;
            this.setDrag(this.grassDrag);
        } else {
            currentSpeed = forwardSpeed;
            this.setDrag(this.roadDrag);
        }

        // Logique de rotation
        // On interpole l'angle actuel vers l'angle cible pour un mouvement fluide
        this.angle = Phaser.Math.Linear(this.angle, this.targetAngle, 0.1);

        // Appliquer la vitesse en fonction de l'angle
        this.scene.physics.velocityFromAngle(this.angle - 90, currentSpeed, this.body.velocity);

        // Appliquer les murs invisibles
        this.x = Phaser.Math.Clamp(this.x, outerLeftBoundary, outerRightBoundary);
    }
}