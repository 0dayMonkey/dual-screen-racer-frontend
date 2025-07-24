function main() {
    const serverUrl = "https://miaou.vps.webdock.cloud";
    let socket = null;
    let sessionCode = '';

    const statusDiv = document.getElementById('status');
    const connectionWrapper = document.getElementById('connection-wrapper');
    const lobbyWrapper = document.getElementById('lobby-wrapper');
    const controlsWrapper = document.getElementById('controls-wrapper');
    const gameOverWrapper = document.getElementById('game-over-wrapper');
    const sessionCodeInput = document.getElementById('session-code-input');
    const connectButton = document.getElementById('connect-button');
    const readyButton = document.getElementById('ready-button');
    const nicknameInput = document.getElementById('nickname-input');

    const leftButton = document.getElementById('left-button');
    const rightButton = document.getElementById('right-button');
    const finalScoreText = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');

    function setStatus(message) {
        if (statusDiv) statusDiv.textContent = message;
    }

    function showView(viewName) {
        connectionWrapper.classList.add('hidden');
        lobbyWrapper.classList.add('hidden');
        controlsWrapper.classList.add('hidden');
        gameOverWrapper.classList.add('hidden');

        const viewMap = {
            'connect': connectionWrapper,
            'lobby': lobbyWrapper,
            'controls': controlsWrapper,
            'gameover': gameOverWrapper
        };
        if (viewMap[viewName]) {
            viewMap[viewName].classList.remove('hidden');
        }

        const statusMap = {
            'connect': 'En attente...',
            'lobby': `Connecté à la session ${sessionCode}. En attente des joueurs...`,
            'controls': `Partie en cours dans la session ${sessionCode}`,
            'gameover': 'Partie terminée !'
        };
        setStatus(statusMap[viewName] || 'En attente...');
    }

    function setupSocketEvents() {
        socket.on('disconnect', () => {
            setStatus('Déconnecté du serveur.');
            showView('connect');
        });
        socket.on('invalid_session', () => setStatus('Code de session invalide ou partie déjà commencée.'));
        socket.on('session_closed', () => {
            setStatus('La session de jeu a été fermée par l\'hôte.');
            showView('connect');
            if (socket) socket.disconnect();
        });

        socket.on('lobby_joined', (data) => {
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
            showView('lobby');
        });

        socket.on('game_over', (data) => {
            if (data && typeof data.score !== 'undefined') finalScoreText.textContent = data.score;
            showView('gameover');
        });
    }

    function startTurn(direction) {
        if (socket && socket.connected) socket.emit('start_turn', {
            sessionCode,
            direction
        });
    }

    function stopTurn() {
        if (socket && socket.connected) socket.emit('stop_turn', {
            sessionCode
        });
    }

    function connect() {
        sessionCode = sessionCodeInput.value;
        if (sessionCode.length !== 6) {
            setStatus('Le code doit faire 6 caractères.');
            return;
        }

        setStatus('Tentative de connexion...');
        if (!socket || !socket.connected) {
            socket = io(serverUrl, {
                path: "/racer/socket.io/"
            });
            setupSocketEvents();
            socket.on('connect', () => {
                setStatus('Connecté au serveur. Envoi du code de session...');
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

    function signalReady() {
        if (socket && socket.connected) {
            const name = nicknameInput.value || 'Joueur';

            socket.emit('player_ready', {
                sessionCode,
                name: name,
            });
            readyButton.textContent = "En attente...";
            readyButton.disabled = true;
        }
    }

    function requestReplay() {
        if (socket && socket.connected) socket.emit('request_replay', {
            sessionCode
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

    function addEventListeners(element, startCallback, endCallback) {
        if (element) {
            element.addEventListener('mousedown', startCallback);
            element.addEventListener('mouseup', endCallback);
            element.addEventListener('mouseleave', endCallback);
            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                startCallback();
            });
            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                endCallback();
            });
        }
    }

    addEventListeners(leftButton, () => startTurn('left'), stopTurn);
    addEventListeners(rightButton, () => startTurn('right'), stopTurn);
    connectButton.addEventListener('click', connect);
    readyButton.addEventListener('click', signalReady);
    restartButton.addEventListener('click', requestReplay);

    showView('connect');
    checkForActiveSessions();
}

main();