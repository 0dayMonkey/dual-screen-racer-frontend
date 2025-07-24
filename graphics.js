const GraphicsGenerator = {
createAllTextures: function(scene) {
    this._createCarTexture(scene);
    this._createObstacleTexture(scene);
    this._createLineTexture(scene);
    this._createParticleTexture(scene);
    this._createRoadTexture(scene); // Ajout de la texture de la route
},

    _createCarTexture: function(scene) {
        const carWidth = 40;
        const carHeight = 80;
        const g = scene.make.graphics({ x: 0, y: 0, add: false });

        // Car body with gradient
        g.fillGradientStyle(0xff0000, 0xff0000, 0x990000, 0x990000, 1);
        g.fillRect(0, 0, carWidth, carHeight);

        // Windshield
        g.fillStyle(0x222222, 1);
        g.fillRect(5, 10, carWidth - 10, 20);

        // Glossy highlight
        g.fillStyle(0xffffff, 0.5);
        g.slice(carWidth / 2, carHeight / 2, carWidth * 0.8, Phaser.Math.DegToRad(260), Phaser.Math.DegToRad(280), true);
        g.fillPath();
        
        g.generateTexture('car_texture', carWidth, carHeight);
        g.destroy();
    },

    _createObstacleTexture: function(scene) {
        const boxSize = 60;
        const g = scene.make.graphics({ x: 0, y: 0, add: false });

        // 3D Box look
        const topFace = [
            { x: 0, y: 15 },
            { x: boxSize, y: 15 },
            { x: boxSize - 15, y: 0 },
            { x: 15, y: 0 }
        ];
        const leftFace = [
            { x: 0, y: 15 },
            { x: 15, y: 0 },
            { x: 15, y: boxSize - 15 },
            { x: 0, y: boxSize }
        ];
        const rightFace = [
            { x: boxSize, y: 15 },
            { x: boxSize, y: boxSize },
            { x: boxSize - 15, y: boxSize - 15 },
            { x: boxSize - 15, y: 0 }
        ];
        
        // Draw faces
        g.fillStyle(0xab6f47, 1); // Lighter top face
        g.fillPoints(topFace, true);
        
        g.fillStyle(0x8B4513, 1); // Darker side faces
        g.fillPoints(leftFace, true);
        g.fillPoints(rightFace, true);

        g.generateTexture('obstacle_texture', boxSize, boxSize);
        g.destroy();
    },
    
    _createLineTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xFFFF00, 0.8);
        g.fillRect(0, 0, 10, 40);
        g.generateTexture('line_texture', 10, 40);
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
    const width = 400;
    const height = 800;
    const laneWidth = 80;
    const lineWidth = 10;
    const lineColor = 0xFFFF00;
    const roadColor = 0x333333;

    g.fillStyle(roadColor);
    g.fillRect(0, 0, width, height);

    g.fillStyle(lineColor);
    g.fillRect(width / 2 - lineWidth / 2, 0, lineWidth, height);
    g.fillRect(laneWidth - lineWidth / 2, 0, lineWidth, height);
    g.fillRect(width - laneWidth - lineWidth / 2, 0, lineWidth, height);

    g.generateTexture('road_texture', width, height);
    g.destroy();
},

};