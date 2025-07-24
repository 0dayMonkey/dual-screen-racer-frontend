const GraphicsGenerator = {
    createAllTextures: function(scene) {
        this._createCarTexture(scene);
        this._createObstacleTexture(scene);
        this._createParticleTexture(scene);
        this._createRoadTexture(scene);
    },

    _createCarTexture: function(scene) {
        const carWidth = 40;
        const carHeight = 80;
        const g = scene.make.graphics({ x: 0, y: 0, add: false });

        g.fillGradientStyle(0xff0000, 0xff0000, 0x990000, 0x990000, 1);
        g.fillRect(0, 0, carWidth, carHeight);

        g.fillStyle(0x222222, 1);
        g.fillRect(5, 10, carWidth - 10, 20);

        g.fillStyle(0xffffff, 0.5);
        g.slice(carWidth / 2, carHeight / 2, carWidth * 0.8, Phaser.Math.DegToRad(260), Phaser.Math.DegToRad(280), true);
        g.fillPath();
        
        g.generateTexture('car_texture', carWidth, carHeight);
        g.destroy();
    },

    _createObstacleTexture: function(scene) {
        const boxSize = 60;
        const g = scene.make.graphics({ x: 0, y: 0, add: false });

        const topFace = [
            { x: 0, y: 15 }, { x: boxSize, y: 15 },
            { x: boxSize - 15, y: 0 }, { x: 15, y: 0 }
        ];
        const leftFace = [
            { x: 0, y: 15 }, { x: 15, y: 0 },
            { x: 15, y: boxSize - 15 }, { x: 0, y: boxSize }
        ];
        const rightFace = [
            { x: boxSize, y: 15 }, { x: boxSize, y: boxSize },
            { x: boxSize - 15, y: boxSize - 15 }, { x: boxSize - 15, y: 0 }
        ];
        
        g.fillStyle(0xab6f47, 1);
        g.fillPoints(topFace, true);
        
        g.fillStyle(0x8B4513, 1);
        g.fillPoints(leftFace, true);
        g.fillPoints(rightFace, true);

        g.generateTexture('obstacle_texture', boxSize, boxSize);
        g.destroy();
    },
    
    _createParticleTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(6, 6, 6);
        g.generateTexture('particle_texture', 12, 12);
        g.destroy();
    },

    _createRoadTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        
        const gameWidth = scene.scale.width;
        const gameHeight = scene.scale.height;

        const roadWidth = gameWidth * 0.7;
        const roadColor = 0x333333;
        const grassColor = 0x225522;
        const lineColor = 0xFFFF00;
        const lineWidth = 10;
        const dashLength = 50;
        const dashGap = 30;

        g.fillStyle(grassColor);
        g.fillRect(0, 0, gameWidth, gameHeight);

        const roadX = (gameWidth - roadWidth) / 2;
        g.fillStyle(roadColor);
        g.fillRect(roadX, 0, roadWidth, gameHeight);
        
        g.fillStyle(lineColor);
        for (let y = 0; y < gameHeight; y += dashLength + dashGap) {
            g.fillRect(gameWidth / 2 - lineWidth / 2, y, lineWidth, dashLength);
        }

        g.generateTexture('road_texture', gameWidth, gameHeight);
        g.destroy();
    },
};