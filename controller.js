function main() {
    const serverUrl = "https://miaou.vps.webdock.cloud";
    let socket = null;
    let sessionCode = '';
    let playerId = '';
    let controlMode = 'arrows';
    let isDraggingWheel = false;
    let gameOverTimer = null; // Ajout pour gérer le timer

    const statusDiv = document.getElementById('status');
    const connectionWrapper = document.getElementById('connection-wrapper');
    const lobbyWrapper = document.getElementById('lobby-wrapper');
    const gameControlsView = document.getElementById('game-controls-view');
    const gameOverWrapper = document.getElementById('game-over-wrapper');

    const sessionCodeInput = document.getElementById('session-code-input');
    const connectButton = document.getElementById('connect-button');
    const nicknameInput = document.getElementById('nickname-input');
    const readyButton = document.getElementById('ready-button');
    const finalScoreText = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');

    const arrowsModeBtn = document.getElementById('arrows-mode-btn');
    const wheelModeBtn = document.getElementById('wheel-mode-btn');
    const arrowsControls = document.getElementById('arrows-controls');
    const leftButton = document.getElementById('left-button');
    const rightButton = document.getElementById('right-button');
    const wheelControls = document.getElementById('wheel-controls');
    const steeringWheel = document.getElementById('steering-wheel');

    function setStatus(message) {
        if (statusDiv) statusDiv.textContent = message;
    }

    function showView(viewName) {
        // --- AJOUT : Nettoyage du timer au changement de vue ---
        if (gameOverTimer) {
            clearInterval(gameOverTimer);
            gameOverTimer = null;
        }

        connectionWrapper.classList.add('hidden');
        lobbyWrapper.classList.add('hidden');
        gameControlsView.classList.add('hidden');
        gameOverWrapper.classList.add('hidden');
        const viewMap = {
            'connect': connectionWrapper,
            'lobby': lobbyWrapper,
            'controls': gameControlsView,
            'gameover': gameOverWrapper
        };
        if (viewMap[viewName]) {
            viewMap[viewName].classList.remove('hidden');
        }
        setStatus(statusMap[viewName] || 'En attente...');
    }
    
    const statusMap = {
        'connect': 'En attente...',
        'lobby': 'Connecté. En attente des joueurs...',
        'controls': 'Partie en cours',
        'gameover': 'Partie terminée !'
    };

    function setupSocketEvents() {
        socket.on('disconnect', () => {
            setStatus('Déconnecté.');
            showView('connect');
        });
        socket.on('invalid_session', () => {
            setStatus('Session invalide ou pleine.');
            sessionStorage.removeItem('racerSessionCode');
            sessionStorage.removeItem('racerPlayerId');
        });
        socket.on('session_closed', () => {
            setStatus('Session fermée par l\'hôte.');
            showView('connect');
            if (socket) socket.disconnect();
            sessionStorage.clear();
        });
        socket.on('lobby_joined', (data) => {
            sessionCode = sessionCodeInput.value;
            playerId = data.playerId;
            sessionStorage.setItem('racerSessionCode', sessionCode);
            sessionStorage.setItem('racerPlayerId', playerId);
            readyButton.disabled = false;
            readyButton.textContent = "Prêt";
            showView('lobby');
        });
        socket.on('start_game_for_all', () => {
            showView('controls')
        });
        socket.on('return_to_lobby', () => {
            readyButton.disabled = false;
            readyButton.textContent = "Prêt";
            restartButton.disabled = false;
            restartButton.textContent = "Rejouer";
            showView('lobby');
        });

        // --- MODIFICATION DE LA GESTION DE FIN DE PARTIE ---
        socket.on('game_over', (data) => {
            if (data && typeof data.score !== 'undefined') {
                finalScoreText.textContent = data.score;
            }
            showView('gameover');

            let countdown = 30;
            const originalStatus = statusDiv.textContent;
            setStatus(`Retour au lobby dans ${countdown}s...`);

            gameOverTimer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    setStatus(`Retour au lobby dans ${countdown}s...`);
                } else {
                    setStatus(originalStatus);
                    clearInterval(gameOverTimer);
                }
            }, 1000);
        });
    }

    function connect() {
        sessionCode = sessionCodeInput.value;
        if (sessionCode.length !== 6) {
            setStatus('Le code doit faire 6 caractères.');
            return;
        }
        setStatus('Connexion...');
        if (!socket || !socket.connected) {
            socket = io(serverUrl, {
                path: "/racer/socket.io/"
            });
            setupSocketEvents();
            socket.on('connect', () => {
                socket.emit('join_session', {
                    sessionCode
                });
            });
        } else {
            socket.emit('join_session', {
                sessionCode
            });
        }
    }

    function requestReplay() {
        socket.emit('request_replay', {
            sessionCode
        });
        restartButton.disabled = true;
        restartButton.textContent = "En attente des autres...";
    }
    
    // --- (le reste du fichier est inchangé) ---
    function switchControlMode(newMode) {
        controlMode = newMode;
        if (newMode === 'arrows') {
            arrowsModeBtn.classList.add('active');
            wheelModeBtn.classList.remove('active');
            arrowsControls.classList.remove('hidden');
            wheelControls.classList.add('hidden');
        } else {
            arrowsModeBtn.classList.remove('active');
            wheelModeBtn.classList.add('active');
            arrowsControls.classList.add('hidden');
            wheelControls.classList.remove('hidden');
        }
    }

    function checkForActiveSessions() {
        setStatus('Recherche de session...');
        const tempSocket = io(serverUrl, {
            path: "/racer/socket.io/"
        });
        let attempts = 0;
        const maxAttempts = 5;
        const pollingInterval = setInterval(() => {
            if (tempSocket.connected) {
                attempts++;
                if (attempts > maxAttempts) {
                    clearInterval(pollingInterval);
                    tempSocket.disconnect();
                    setStatus('Aucune session trouvée.');
                    return;
                }
                tempSocket.emit('request_active_sessions');
            }
        }, 1000);
        tempSocket.on('active_session_found', (data) => {
            if (data && data.sessionCode) {
                clearInterval(pollingInterval);
                setStatus('Session détectée !');
                autoFillCode(data.sessionCode);
                tempSocket.disconnect();
            }
        });
        tempSocket.on('disconnect', () => {
            clearInterval(pollingInterval);
        });
    }

    function autoFillCode(code) {
        let i = 0;
        sessionCodeInput.value = '';
        const interval = setInterval(() => {
            if (i < code.length) {
                sessionCodeInput.value += code[i];
                i++;
            } else {
                clearInterval(interval);
                connect();
            }
        }, 100);
    }

    function startTurn(direction) {
        if (controlMode !== 'arrows') return;
        socket.emit('start_turn', {
            sessionCode,
            direction
        });
    }

    function stopTurn() {
        if (controlMode !== 'arrows') return;
        socket.emit('stop_turn', {
            sessionCode
        });
    }

    function handleWheelMove(event) {
        if (!isDraggingWheel) return;
        event.preventDefault();
        const rect = steeringWheel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
        angle = Math.max(-90, Math.min(90, angle));
        steeringWheel.style.transform = `rotate(${angle}deg)`;
        socket.emit('steer', {
            sessionCode,
            angle
        });
    }

    function stopSteering() {
        if (!isDraggingWheel) return;
        isDraggingWheel = false;
        steeringWheel.style.transition = 'transform 0.2s ease-out';
        steeringWheel.style.transform = 'rotate(0deg)';
        socket.emit('steer', {
            sessionCode,
            angle: 0
        });
        setTimeout(() => {
            steeringWheel.style.transition = 'transform 0.1s linear';
        }, 200);
    }

    function startSteering(event) {
        if (controlMode !== 'wheel') return;
        isDraggingWheel = true;
        handleWheelMove(event);
    }
    
    function initialize() {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionCodeFromURL = urlParams.get('sessionCode');

        if (sessionCodeFromURL && sessionCodeFromURL.length === 6) {
            sessionCodeInput.value = sessionCodeFromURL;
            connect();
        } else {
            showView('connect');
            checkForActiveSessions();
        }
    }

    connectButton.addEventListener('click', connect);
    nicknameInput.addEventListener('input', () => socket.emit('update_name', {
        sessionCode,
        name: nicknameInput.value || 'Joueur'
    }));
    readyButton.addEventListener('click', () => {
        socket.emit('player_ready', {
            sessionCode
        });
        readyButton.textContent = "En attente...";
        readyButton.disabled = true;
    });
    restartButton.addEventListener('click', requestReplay);
    arrowsModeBtn.addEventListener('click', () => switchControlMode('arrows'));
    wheelModeBtn.addEventListener('click', () => switchControlMode('wheel'));
    leftButton.addEventListener('mousedown', () => startTurn('left'));
    leftButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startTurn('left');
    });
    rightButton.addEventListener('mousedown', () => startTurn('right'));
    rightButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startTurn('right');
    });
    ['mouseup', 'mouseleave', 'touchend'].forEach(evt => {
        leftButton.addEventListener(evt, stopTurn);
        rightButton.addEventListener(evt, stopTurn);
    });
    steeringWheel.addEventListener('mousedown', startSteering);
    steeringWheel.addEventListener('touchstart', startSteering);
    window.addEventListener('mousemove', handleWheelMove);
    window.addEventListener('touchmove', handleWheelMove);
    window.addEventListener('mouseup', stopSteering);
    window.addEventListener('touchend', stopSteering);
    
    initialize();
}

main();