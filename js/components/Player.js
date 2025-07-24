class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, playerData) {
        super(scene, x, y, 'car_texture');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.originalColor = Phaser.Display.Color.ValueToColor(playerData.color).color;
        this.setTint(this.originalColor);
        
        this.setDamping(true).setDrag(0.98).setMaxVelocity(600).setCollideWorldBounds(true);
        
        this.playerId = playerData.id;
        this.turning = 'none';
        this.score = 0;
        this.offScreenSince = null;

    }

    updateMovement() {
        const forwardSpeed = 500;
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

        this.scene.physics.velocityFromAngle(this.angle - 90, forwardSpeed, this.body.velocity);
    }
}