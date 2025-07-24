class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = scene.physics.add.group({
            immovable: true
        });

        // --- DEBUT DE LA MODIFICATION ---
        // Liste de toutes les textures d'obstacles disponibles
        this.obstacleTextures = [
            'obstacle_box',
            'obstacle_cone',
            'obstacle_tire',
            'obstacle_oil',
            'obstacle_barrier',
            'obstacle_tree',
            'obstacle_rock'
        ];
        // --- FIN DE LA MODIFICATION ---
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
        while (this.obstacles.getLength() < 20) { // Vous pouvez augmenter ce nombre pour plus de densité
            // --- DEBUT DE LA MODIFICATION ---
            // Choisir une texture aléatoire dans la liste
            const randomTexture = Phaser.Math.RND.pick(this.obstacleTextures);

            // Certains obstacles (arbres, rochers) devraient apparaître plutôt sur l'herbe
            let spawnX;
            const roadLeftBoundary = scene.scale.width * 0.15;
            const roadRightBoundary = scene.scale.width * 0.85;

            if (randomTexture === 'obstacle_tree' || randomTexture === 'obstacle_rock') {
                // Apparaît sur le côté gauche OU le côté droit
                if (Phaser.Math.Between(0, 1) === 0) {
                    spawnX = Phaser.Math.Between(0, roadLeftBoundary - 40);
                } else {
                    spawnX = Phaser.Math.Between(roadRightBoundary + 40, scene.scale.width);
                }
            } else {
                // Les autres obstacles apparaissent sur la route
                spawnX = Phaser.Math.Between(roadLeftBoundary, roadRightBoundary);
            }
            // --- FIN DE LA MODIFICATION ---

            const spawnY = leadPlayer.y - 800 - (Math.random() * scene.scale.height * 1.5);
            
            // On crée l'obstacle avec la texture choisie
            this.obstacles.create(spawnX, spawnY, randomTexture);
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