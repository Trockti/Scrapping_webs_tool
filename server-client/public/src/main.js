const socket = io();

// Handle button clicks for toggling anchors
document.getElementById('anchors').addEventListener('click', () => {
    const button = document.getElementById('anchors');
    button.classList.toggle('active');
    button.classList.toggle('inactive');
    const isActive = button.classList.contains('active');
    socket.emit('setAnchorsAllowed', isActive);
    console.log('Anchors button clicked');
});

// Handle button clicks for toggling parameters
document.getElementById('parameters').addEventListener('click', () => {
    const button = document.getElementById('parameters');
    button.classList.toggle('active');
    button.classList.toggle('inactive');
    const isActive = button.classList.contains('active');
    socket.emit('setParametersAllowed', isActive);
    console.log('Parameters button clicked');
});

// Handle scraping start
document.getElementById('scrapeButton').addEventListener('click', () => {
    const urls = document.getElementById('urlInput').value.split(',').map(url => url.trim());
    const depth = parseInt(document.getElementById('depthInput').value, 10);
    if (urls.length && !isNaN(depth)) {
        document.getElementById('output').textContent = ''; // Clear previous output
        socket.emit('startScraping', { urls, depth });
    }
});

// Handle Pause button click
document.getElementById('pause').addEventListener('click', () => {
    socket.emit('pauseScraping');
    console.log('Scraping paused');
});

// Handle Resume button click (Reuse the start button as resume button)
document.getElementById('start').addEventListener('click', () => {
    socket.emit('resumeScraping');
    console.log('Scraping resumed');
});

// Handle Stop button click (Reusing the next step button as stop button)
document.getElementById('nextstep').addEventListener('click', () => {
    socket.emit('stopScraping');
    console.log('Scraping stopped');
});

// Handle receiving discovered URLs
socket.on('urlDiscovered', (url) => {
    const output = document.getElementById('output');
    output.textContent += url + '\n'; // Append discovered URL
    output.scrollTop = output.scrollHeight; // Auto-scroll to the bottom
});
