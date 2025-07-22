function main() {
    const serverUrl = 'https://miaou.vps.webdock.cloud:8888';
    let socket = null;
    let sessionCode = '';

    const statusDiv = document.getElementById('status');
    const connectionWrapper = document.getElementById('connection-wrapper');
    const controlsWrapper = document.getElementById('controls-wrapper');
    const sessionCodeInput = document.getElementById('session-code-input');
    const connectButton = document.getElementById('connect-button');
    const leftButton = document.getElementById('left-button');
    const rightButton = document.getElementById('right-button');

    function setStatus(message) {
        if (statusDiv) {
            statusDiv.textContent = message;
        }
    }

    function showControls() {
        connectionWrapper.classList.add('hidden');
        controlsWrapper.classList.remove('hidden');
        setStatus(`Connecté à la session ${sessionCode}`);
    }

    function setupSocketEvents() {
        socket.on('connect', () => setStatus('Connecté au serveur'));
        socket.on('disconnect', () => setStatus('Déconnecté'));
        socket.on('invalid_session', () => setStatus('Code de session invalide.'));
        socket.on('connection_successful', showControls);
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
        socket = io(serverUrl);
        setupSocketEvents();
        socket.on('connect', () => {
             socket.emit('join_session', { sessionCode });
        });
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
}

main();