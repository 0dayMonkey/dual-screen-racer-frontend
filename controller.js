function main() {
    const serverUrl = "https://miaou.vps.webdock.cloud";
    let socket = null;
    let sessionCode = '';
    let playerId = '';
    let controlMode = 'arrows';
    let isDraggingWheel = false;
    let gameOverTimer = null;

    const statusDiv = document.getElementById('status');
    const connectionWrapper = document.getElementById('connection-wrapper');
    const lobbyWrapper = document.getElementById('lobby-wrapper');
    const gameControlsView = document.getElementById('game-controls-view');
    const gameOverWrapper = document.getElementById('game-over-wrapper');
    
    const sessionCodeInput = document.getElementById('session-code-input');
    const connectButton = document.getElementById('connect-button');
    const searchSessionsButton = document.getElementById('search-sessions-button');
    const sessionListContainer = document.getElementById('session-list-container');
    const sessionList = document.getElementById('session-list');
    const nicknameInput = document.getElementById('nickname-input');
    const nicknameError = document.getElementById('nickname-error');
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

    const statusMap = {
        'connect': 'En attente...',
        'lobby': 'Connecté. En attente des joueurs...',
        'controls': 'Partie en cours',
        'gameover': 'Partie terminée !'
    };

    function showView(viewName) {
        if (gameOverTimer) {
            clearInterval(gameOverTimer);
            gameOverTimer = null;
        }

        // Retire 'active' de toutes les vues pour les cacher/animer leur sortie
        connectionWrapper.classList.remove('active');
        lobbyWrapper.classList.remove('active');
        gameControlsView.classList.remove('active');
        gameOverWrapper.classList.remove('active');

        const viewMap = {
            'connect': connectionWrapper,
            'lobby': lobbyWrapper,
            'controls': gameControlsView,
            'gameover': gameOverWrapper
        };
        
        // Attendre un court instant pour que l'animation de sortie se termine avant de cacher
        setTimeout(() => {
            connectionWrapper.classList.add('hidden');
            lobbyWrapper.classList.add('hidden');
            gameControlsView.classList.add('hidden');
            gameOverWrapper.classList.add('hidden');
            
            if (viewMap[viewName]) {
                const activeView = viewMap[viewName];
                activeView.classList.remove('hidden');
                // Forcer un reflow pour que l'animation d'entrée fonctionne
                void activeView.offsetWidth; 
                activeView.classList.add('active');
            }
        }, 300); // Doit correspondre à la durée de la transition CSS

        setStatus(statusMap[viewName] || 'En attente...');
    }

    function setupSocketEvents() {
        socket.on('disconnect', () => {
            setStatus('Déconnecté.');
            showView('connect');
        });
        socket.on('invalid_session', (data) => {
            let message = (data && data.message) ? data.message : 'Session invalide ou pleine.';
            setStatus(message);
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
            showView('controls');
        });
        socket.on('return_to_lobby', () => {
            readyButton.disabled = false;
            readyButton.textContent = "Prêt";
            restartButton.disabled = false;
            restartButton.textContent = "Rejouer";
            showView('lobby');
        });
        socket.on('game_over', (data) => {
            if (data && typeof data.score !== 'undefined') {
                finalScoreText.textContent = data.score;
            }
            showView('gameover');

            let countdown = 30;
            setStatus(`Retour au lobby dans ${countdown}s...`);

            gameOverTimer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    setStatus(`Retour au lobby dans ${countdown}s...`);
                } else {
                    setStatus(statusMap['gameover']);
                    clearInterval(gameOverTimer);
                }
            }, 1000);
        });
        socket.on('name_already_taken', () => {
            if (nicknameError) nicknameError.textContent = "Ce pseudo est déjà utilisé.";
            setTimeout(() => {
                if (nicknameError) nicknameError.textContent = "";
            }, 3000);
        });
    }

    function connect() {
        sessionCode = sessionCodeInput.value;
        if (sessionCode.length !== 6) {
            setStatus('Le code doit faire 6 caractères.');
            return;
        }
        setStatus('Connexion...');
        connectButton.disabled = true;
        if (!socket || !socket.connected) {
            socket = io(serverUrl, {
                path: "/racer/socket.io/"
            });
            setupSocketEvents();
            socket.on('connect', () => {
                socket.emit('join_session', { sessionCode });
                connectButton.disabled = false;
            });
        } else {
            socket.emit('join_session', { sessionCode });
            connectButton.disabled = false;
        }
    }
    
    function searchForActiveSessions() {
        setStatus('Recherche de session...');
        searchSessionsButton.disabled = true;
        sessionListContainer.classList.add('hidden');
        sessionList.innerHTML = '';
        
        const tempSocket = io(serverUrl, { path: "/racer/socket.io/", timeout: 5000 });
        
        const searchTimeout = setTimeout(() => {
            tempSocket.disconnect();
            setStatus('La recherche a échoué. Réessayez.');
            searchSessionsButton.disabled = false;
        }, 5000);

        tempSocket.on('connect', () => {
            tempSocket.emit('request_active_sessions');
        });

        tempSocket.on('available_sessions_list', (sessions) => {
            clearTimeout(searchTimeout);
            searchSessionsButton.disabled = false;

            if (sessions.length > 0) {
                setStatus('Sessions trouvées !');
                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

                sessions.forEach(session => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>Session ${session.sessionCode} (${session.playerCount}/10)</span><span>&rsaquo;</span>`;
                    li.addEventListener('click', async () => {
                        sessionListContainer.classList.add('hidden');
                        sessionCodeInput.value = '';
                        connectButton.disabled = true;
                        
                        for (const digit of session.sessionCode) {
                            sessionCodeInput.value += digit;
                            await sleep(120);
                        }
                        
                        connect();
                    });
                    sessionList.appendChild(li);
                });
                sessionListContainer.classList.remove('hidden');
            } else {
                setStatus('Aucune session trouvée.');
            }
            tempSocket.disconnect();
        });

        tempSocket.on('connect_error', () => {
            clearTimeout(searchTimeout);
            tempSocket.disconnect();
            setStatus('Erreur de connexion au serveur.');
            searchSessionsButton.disabled = false;
        });
    }

    function requestReplay() {
        if(nicknameError) nicknameError.textContent = "";
        socket.emit('request_replay', { sessionCode });
        restartButton.disabled = true;
        restartButton.textContent = "En attente des autres...";
    }

    function switchControlMode(newMode) {
        controlMode = newMode;
        arrowsModeBtn.classList.remove('active');
        wheelModeBtn.classList.remove('active');
        arrowsControls.classList.add('hidden');
        wheelControls.classList.add('hidden');

        if (newMode === 'arrows') {
            arrowsModeBtn.classList.add('active');
            arrowsControls.classList.remove('hidden');
        } else {
            wheelModeBtn.classList.add('active');
            wheelControls.classList.remove('hidden');
        }
    }

    function startTurn(direction) {
        if (controlMode !== 'arrows') return;
        socket.emit('start_turn', { sessionCode, direction });
    }

    function stopTurn() {
        if (controlMode !== 'arrows') return;
        socket.emit('stop_turn', { sessionCode });
    }

    function handleWheelMove(event) {
        if (!isDraggingWheel) return;
        event.preventDefault();
        const rect = steeringWheel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const angle = ((clientX - centerX) / (rect.width / 2)) * 90;
        const clampedAngle = Math.max(-90, Math.min(90, angle));
        steeringWheel.style.transform = `rotate(${clampedAngle}deg)`;
        socket.emit('steer', { sessionCode, angle: clampedAngle });
    }

    function stopSteering() {
        if (!isDraggingWheel) return;
        isDraggingWheel = false;
        steeringWheel.style.transition = 'transform 0.2s ease-out';
        steeringWheel.style.transform = 'rotate(0deg)';
        socket.emit('steer', { sessionCode, angle: 0 });
        setTimeout(() => {
            steeringWheel.style.transition = '';
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
        }
    }

    connectButton.addEventListener('click', connect);
    searchSessionsButton.addEventListener('click', searchForActiveSessions);
    nicknameInput.addEventListener('input', () => {
        if(nicknameError) nicknameError.textContent = "";
        const newName = nicknameInput.value || 'Joueur';
        sessionStorage.setItem('racerNickname', newName);
        if (socket && socket.connected) {
            socket.emit('update_name', { sessionCode, name: newName });
        }
    });
    readyButton.addEventListener('click', () => {
        socket.emit('player_ready', { sessionCode });
        readyButton.textContent = "En attente...";
        readyButton.disabled = true;
    });
    restartButton.addEventListener('click', requestReplay);
    arrowsModeBtn.addEventListener('click', () => switchControlMode('arrows'));
    wheelModeBtn.addEventListener('click', () => switchControlMode('wheel'));
    leftButton.addEventListener('mousedown', () => startTurn('left'));
    leftButton.addEventListener('touchstart', (e) => { e.preventDefault(); startTurn('left'); });
    rightButton.addEventListener('mousedown', () => startTurn('right'));
    rightButton.addEventListener('touchstart', (e) => { e.preventDefault(); startTurn('right'); });
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