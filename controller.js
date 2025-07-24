function main() {
    const serverUrl = "https://miaou.vps.webdock.cloud";
    let socket = null;
    let sessionCode = '';

    const statusDiv = document.getElementById('status');
    const connectionWrapper = document.getElementById('connection-wrapper');
    // ... (déclarations de variables inchangées) ...

    function setStatus(message) { /* ... */ }
    function showView(viewName) { /* ... */ }

    function setupSocketEvents() {
        // ... (contenu de la fonction inchangé) ...
    }

    function startTurn(direction) { /* ... */ }
    function stopTurn() { /* ... */ }
    
    function connect() {
        sessionCode = sessionCodeInput.value;
        if (sessionCode.length !== 6) { setStatus('Le code doit faire 6 caractères.'); return; }
        setStatus('Tentative de connexion...');
        if (!socket || !socket.connected) {
            // CORRECTION : On se connecte en utilisant le chemin spécifié.
            socket = io(serverUrl, {
                path: "/racer/socket.io/"
            });
            setupSocketEvents();
            socket.on('connect', () => {
                 setStatus('Connecté au serveur. Envoi du code de session...');
                 socket.emit('join_session', { sessionCode });
            });
        } else {
            socket.emit('join_session', { sessionCode });
        }
    }

    function signalReady() { /* ... */ }
    function requestReplay() { /* ... */ }
    function autoFillCode(code) { /* ... */ }

    function checkForActiveSessions() {
        setStatus('Recherche de session...');
        // CORRECTION : Le socket temporaire utilise aussi le bon chemin.
        const tempSocket = io(serverUrl, {
            path: "/racer/socket.io/"
        });
        let attempts = 0;
        const maxAttempts = 5;
        const pollingInterval = setInterval(() => {
            if (tempSocket.connected) {
                attempts++;
                if (attempts > maxAttempts) { clearInterval(pollingInterval); tempSocket.disconnect(); setStatus('Aucune session trouvée.'); return; }
                tempSocket.emit('request_active_sessions');
            }
        }, 1000);
        tempSocket.on('active_session_found', (data) => { if (data && data.sessionCode) { clearInterval(pollingInterval); setStatus('Session détectée !'); autoFillCode(data.sessionCode); tempSocket.disconnect(); } });
        tempSocket.on('disconnect', () => { clearInterval(pollingInterval); });
    }

    function addEventListeners(element, startCallback, endCallback) { /* ... */ }
    const lobbyWrapper = document.getElementById('lobby-wrapper'); const controlsWrapper = document.getElementById('controls-wrapper'); const gameOverWrapper = document.getElementById('game-over-wrapper'); const sessionCodeInput = document.getElementById('session-code-input'); const connectButton = document.getElementById('connect-button'); const readyButton = document.getElementById('ready-button'); const leftButton = document.getElementById('left-button'); const rightButton = document.getElementById('right-button'); const finalScoreText = document.getElementById('final-score'); const restartButton = document.getElementById('restart-button');
    showView('connect');
    checkForActiveSessions();
    addEventListeners(leftButton, () => startTurn('left'), stopTurn); addEventListeners(rightButton, () => startTurn('right'), stopTurn); connectButton.addEventListener('click', connect); readyButton.addEventListener('click', signalReady); restartButton.addEventListener('click', requestReplay);
}
main();