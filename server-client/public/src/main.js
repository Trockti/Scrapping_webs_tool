const socket = io();

// Handle button clicks
document.getElementById('anchors').addEventListener('click', () => {
    const button = document.getElementById('anchors');
    button.classList.toggle('active');
    button.classList.toggle('inactive');
    const isActive = button.classList.contains('active');
    socket.emit('setAnchorsAllowed', isActive);
    console.log('anchors Button clicked');
});

document.getElementById('parameters').addEventListener('click', () => {
    const button = document.getElementById('parameters');
    button.classList.toggle('active');
    button.classList.toggle('inactive');
    const isActive = button.classList.contains('active');
    socket.emit('setParametersAllowed', isActive);
    console.log('parameters Button clicked');
});

document.getElementById('scrapeButton').addEventListener('click', () => {
    const urls = document.getElementById('urlInput').value.split(',').map(url => url.trim());
    const depth = parseInt(document.getElementById('depthInput').value, 10);
    if (urls.length && !isNaN(depth)) {
        document.getElementById('output').textContent = '';
        socket.emit('startScraping', { urls, depth });
    }
});

socket.on('urlDiscovered', (url) => {
    const output = document.getElementById('output');
    output.textContent += url + '\n'; // Append discovered URL
    output.scrollTop = output.scrollHeight; // Auto-scroll to the bottom
});
