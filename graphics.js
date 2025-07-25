const GraphicsGenerator = {
    createAllTextures: function(scene) {
        this._createCarTexture(scene);
        this._createParticleTexture(scene);
        this._createRoadTexture(scene);

        // NOUVEAU : Création de la texture pour la fumée
        this._createSmokeParticleTexture(scene);

        this._createBoxTexture(scene);
        this._createConeTexture(scene);
        this._createTireTexture(scene);
        this._createOilSpillTexture(scene);
        this._createBarrierTexture(scene);
        this._createTreeTexture(scene);
        this._createRockTexture(scene);
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

    _createParticleTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(6, 6, 6);
        g.generateTexture('particle_texture', 12, 12);
        g.destroy();
    },
    
    _createSmokeParticleTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const size = 16;
        // Création d'un cercle doux et semi-transparent
        g.fillGradientStyle(0xcccccc, 0xcccccc, 0xcccccc, 0xcccccc, 1, 1, 0, 0);
        g.fillCircle(size / 2, size / 2, size / 2);
        g.generateTexture('smoke_particle', size, size);
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
    
    _createBoxTexture: function(scene) {
        const boxSize = 60;
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const topFace = [ { x: 0, y: 15 }, { x: boxSize, y: 15 }, { x: boxSize - 15, y: 0 }, { x: 15, y: 0 } ];
        const leftFace = [ { x: 0, y: 15 }, { x: 15, y: 0 }, { x: 15, y: boxSize - 15 }, { x: 0, y: boxSize } ];
        const rightFace = [ { x: boxSize, y: 15 }, { x: boxSize, y: boxSize }, { x: boxSize - 15, y: boxSize - 15 }, { x: boxSize - 15, y: 0 } ];
        g.fillStyle(0xab6f47, 1);
        g.fillPoints(topFace, true);
        g.fillStyle(0x8B4513, 1);
        g.fillPoints(leftFace, true);
        g.fillPoints(rightFace, true);
        g.generateTexture('obstacle_box', boxSize, boxSize);
        g.destroy();
    },

    _createConeTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const coneWidth = 50;
        const coneHeight = 60;
        g.fillStyle(0x111111, 1);
        g.fillRect(0, coneHeight - 10, coneWidth, 10);
        g.fillStyle(0xFF4500, 1);
        g.fillTriangle(coneWidth / 2, 0, 0, coneHeight - 10, coneWidth, coneHeight - 10);
        g.fillStyle(0xFFFFFF, 1);
        g.fillRect(0, coneHeight / 2 - 8, coneWidth, 12);
        g.generateTexture('obstacle_cone', coneWidth, coneHeight);
        g.destroy();
    },

    _createTireTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const tireSize = 50;
        g.fillStyle(0x1a1a1a, 1);
        g.fillCircle(tireSize / 2, tireSize / 2, tireSize / 2);
        g.fillStyle(0x2d2d2d, 1);
        g.fillCircle(tireSize / 2, tireSize / 2, tireSize / 2.5);
        g.fillStyle(0xcccccc, 1);
        g.fillCircle(tireSize / 2, tireSize / 2, tireSize / 4);
        g.generateTexture('obstacle_tire', tireSize, tireSize);
        g.destroy();
    },

    _createOilSpillTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const spillSize = 80;
        g.fillStyle(0x0a0a0a, 0.8);
        g.fillEllipse(spillSize / 2, spillSize / 2, spillSize, spillSize * 0.7);
        g.fillStyle(0xFFFFFF, 0.2);
        g.fillEllipse(spillSize * 0.6, spillSize * 0.4, spillSize * 0.2, spillSize * 0.1);
        g.generateTexture('obstacle_oil', spillSize, spillSize);
        g.destroy();
    },

    _createBarrierTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const barrierWidth = 100;
        const barrierHeight = 40;
        g.fillStyle(0x8B4513);
        g.fillRect(5, 0, 10, barrierHeight);
        g.fillRect(barrierWidth - 15, 0, 10, barrierHeight);
        g.fillStyle(0xFFFFFF);
        g.fillRect(0, 5, barrierWidth, 20);
        g.fillStyle(0xFF0000);
        for (let i = 0; i < barrierWidth; i += 20) {
            g.fillRect(i + 5, 5, 10, 20);
        }
        g.generateTexture('obstacle_barrier', barrierWidth, barrierHeight);
        g.destroy();
    },

    _createTreeTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const treeSize = 80;
        g.fillStyle(0x228B22, 1);
        g.fillCircle(treeSize/2, treeSize/2, treeSize/2);
        g.fillStyle(0x3CB371, 1);
        g.fillCircle(treeSize*0.6, treeSize*0.6, treeSize/3);
        g.fillStyle(0x8B4513, 1);
        g.fillCircle(treeSize/2, treeSize/2, 10);
        g.generateTexture('obstacle_tree', treeSize, treeSize);
        g.destroy();
    },

    _createRockTexture: function(scene) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const rockSize = 70;
        const points = [ {x: 0, y: rockSize * 0.3}, {x: rockSize * 0.5, y: 0}, {x: rockSize, y: rockSize * 0.4}, {x: rockSize * 0.8, y: rockSize}, {x: rockSize * 0.2, y: rockSize * 0.9} ];
        g.fillStyle(0x808080, 1);
        g.fillPoints(points, true);
        g.lineStyle(2, 0x505050, 1);
        g.strokePoints(points, true);
        g.generateTexture('obstacle_rock', rockSize, rockSize);
        g.destroy();
    }
};