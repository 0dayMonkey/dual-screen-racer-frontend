class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = scene.physics.add.group({
            immovable: true
        });
    }

    getGroup() {
        return this.obstacles;
    }

    update(leadPlayer) {
        if (!leadPlayer) return;
        this._spawn(leadPlayer);
        this._cleanup(leadPlayer);
    }

    _spawn(leadPlayer) {
        const scene = this.scene;
        while (this.obstacles.getLength() < 20) {
            const roadLeftBoundary = scene.scale.width * 0.2;
            const roadRightBoundary = scene.scale.width * 0.8;
            
            const spawnY = leadPlayer.y - 800 - (Math.random() * scene.scale.height * 1.5);
            const spawnX = Phaser.Math.Between(roadLeftBoundary, roadRightBoundary);
            
            this.obstacles.create(spawnX, spawnY, 'obstacle_texture');
        }
    }

    _cleanup(leadPlayer) {
        const camera = this.scene.cameras.main;
        this.obstacles.getChildren().forEach(obstacle => {
            if (obstacle.y > leadPlayer.y + camera.height) {
                obstacle.destroy();
            }
        });
    }
}