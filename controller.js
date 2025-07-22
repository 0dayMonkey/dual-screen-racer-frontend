function main() {
    const serverUrl = "https://miaou.vps.webdock.cloud";
    const socketOptions = {
        path: "/racer/socket.io/"
    };
    let socket = null;
    let sessionCode = '';

    const statusDiv = document.getElementById('status');
    const connectionWrapper = document.getElementById('connection-wrapper');
    const controlsWrapper = document.getElementById('controls-wrapper');
    const gameOverWrapper = document.getElementById('game-over-wrapper');
    
    const sessionCodeInput = document.getElementById('session-code-input');
    const connectButton = document.getElementById('connect-button');
    const leftButton = document.getElementById('left-button');
    const rightButton = document.getElementById('right-button');
    const finalScoreText = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');

    function setStatus(message) {
        if (statusDiv) {
            statusDiv.textContent = message;
        }
    }
    
    function showView(viewName) {
        connectionWrapper.classList.add('hidden');
        controlsWrapper.classList.add('hidden');
        gameOverWrapper.classList.add('hidden');
        
        if (viewName === 'connect') {
            connectionWrapper.classList.remove('hidden');
            setStatus('En attente...');
        } else if (viewName === 'controls') {
            controlsWrapper.classList.remove('hidden');
            setStatus(`Connecté à la session ${sessionCode}`);
        } else if (viewName === 'gameover') {
            gameOverWrapper.classList.remove('hidden');
            setStatus('Partie terminée !');
        }
    }

    function setupSocketEvents() {
        socket.on('connect', () => setStatus('Connecté au serveur'));
        socket.on('disconnect', () => {
            setStatus('Déconnecté');
            showView('connect');
        });
        socket.on('invalid_session', () => setStatus('Code de session invalide.'));
        socket.on('connection_successful', () => showView('controls'));
        socket.on('game_over', (data) => {
            if (data && typeof data.score !== 'undefined') {
                finalScoreText.textContent = data.score;
            }
            showView('gameover');
        });
    }

    function emitPlayerInput(action) {
        if (socket && socket.connected) {
            socket.emit('player_input', { sessionCode, action });
        }
    }
    
    function connect() {
        sessionCode = sessionCodeInput.value.toUpperCase();
        if (sessionCode.length !== 6) {
            setStatus('Le code doit faire 6 caractères.');
            return;
        }
        
        setStatus('Tentative de connexion...');
        socket = io(serverUrl, socketOptions);
        setupSocketEvents();
        socket.on('connect', () => {
             socket.emit('join_session', { sessionCode });
        });
    }
    
    function restartPage() {
        window.location.reload();
    }

    if (connectButton) {
        connectButton.addEventListener('click', connect);
    }
    if (leftButton) {
        leftButton.addEventListener('click', () => emitPlayerInput('left'));
    }
    if (rightButton) {
        rightButton.addEventListener('click', () => emitPlayerInput('right'));
    }
    if (restartButton) {
        restartButton.addEventListener('click', restartPage);
    }
    
    showView('connect');
}

main();