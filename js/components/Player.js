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
        this.targetAngle = 0;
        this.score = 0;
        this.offScreenSince = null;

        // NOUVEAU : Création de l'émetteur de particules de fumée
        this.smokeEmitter = scene.add.particles(0, 0, 'smoke_particle', {
            speed: { min: 10, max: 30 },
            angle: { min: 85, max: 95 }, // Dirigé vers l'arrière de la voiture
            scale: { start: 1, end: 0 },
            alpha: { start: 0.4, end: 0 },
            lifespan: 400,
            frequency: 80, // Émission plus ou moins continue quand activé
            blendMode: 'NORMAL'
        });

        // Attache l'émetteur au joueur avec un décalage pour sortir de l'arrière
        // Le décalage est appliqué par rapport au centre du sprite non-rotaté
        this.smokeEmitter.startFollow(this, 0, this.height / 2);
        this.smokeEmitter.emitting = false; // Commence désactivé
    }

    updateMovement() {
        const forwardSpeed = 500;
        let currentSpeed;

        const roadLeftBoundary = this.scene.scale.width * 0.15;
        const roadRightBoundary = this.scene.scale.width * 0.85;

        if (this.x < roadLeftBoundary || this.x > roadRightBoundary) {
            currentSpeed = forwardSpeed * 0.6;
            this.setDrag(this.grassDrag);
        } else {
            currentSpeed = forwardSpeed;
            this.setDrag(this.roadDrag);
        }

        this.angle = Phaser.Math.Linear(this.angle, this.targetAngle, 0.1);
        this.scene.physics.velocityFromAngle(this.angle - 90, currentSpeed, this.body.velocity);
        
        // Appliquer les murs invisibles (si nécessaire, semble être géré par world bounds)
        // this.x = Phaser.Math.Clamp(this.x, outerLeftBoundary, outerRightBoundary);

        // NOUVEAU : Gère l'émission de fumée en fonction de la vitesse
        if (this.body.velocity.length() > 200) {
            this.smokeEmitter.emitting = true;
        } else {
            this.smokeEmitter.emitting = false;
        }
    }

    // MODIFIÉ : S'assurer que l'émetteur est détruit avec le joueur
    destroy(fromScene) {
        if (this.smokeEmitter) {
            this.smokeEmitter.destroy();
        }
        super.destroy(fromScene);
    }
}