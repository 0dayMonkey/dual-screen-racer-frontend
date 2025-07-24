class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, playerData) {
        super(scene, x, y, 'car_texture');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setTint(Phaser.Display.Color.ValueToColor(playerData.color).color);
        this.setDamping(false).setDrag(0).setMaxVelocity(800).setCollideWorldBounds(true);
        
        this.playerId = playerData.id;
        this.turning = 'none';
        this.score = 0;
    }

    updateMovement() {
        const forwardSpeed = 600;
        const turnSpeed = 350;

        this.body.velocity.y = -forwardSpeed;

        switch (this.turning) {
            case 'left':
                this.body.velocity.x = -turnSpeed;
                this.setAngle(-15);
                break;
            case 'right':
                this.body.velocity.x = turnSpeed;
                this.setAngle(15);
                break;
            case 'none':
                this.body.velocity.x *= 0.85;
                this.setAngle(this.angle * 0.85);
                break;
        }
    }
}