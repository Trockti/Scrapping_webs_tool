const socket = io();

let isPaused = false;

// Toggle visibility of azure options
document.getElementById('azureOptionsButton').addEventListener('click', () => {
    const advancedOptions = document.getElementById('azureOptions');
    advancedOptions.style.display = advancedOptions.style.display === 'none' ? 'flex' : 'none';
});

// Handle button to upload a file to Azure
document.getElementById('Azure').addEventListener('click', async () => {
    const URL = document.getElementById('azureURL').value;
    if (URL == '') {
        const accountName = document.getElementById('azureAccountName').value;
        const sasToken = document.getElementById('azureToken').value;
        const containerName = document.getElementById('azureContainerName2').value;

        if (accountName == '' || sasToken == '' || containerName == '') {
            alert('Please fill in all the fields');
            return;
        }

        try {
            const response = await fetch('/upload-to-azure', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accountName: accountName,
                    sasToken: sasToken,
                    containerName: containerName
                })
            });

            const result = await response.text();
            alert(result);
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error uploading file');
        }
    } else {
        // Handle the case where the link is provided (if applicable)
        const containerName = document.getElementById('azureContainerName1').value;
        try {
            const response = await fetch('/upload-to-azure-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    URL: URL,
                    containerName: containerName
                    })
            });

            const result = await response.text();
            alert(result);
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error uploading file');
        }
        
    }
});

// Toggle visibility of advanced options
document.getElementById('advancedOptionsButton').addEventListener('click', () => {
    const advancedOptions = document.getElementById('advancedOptions');
    advancedOptions.style.display = advancedOptions.style.display === 'none' ? 'flex' : 'none';
});

// Toggle button between Pause and Resume
document.getElementById('toggleButton').addEventListener('click', () => {
    const toggleButton = document.getElementById('toggleButton');
    
    if (socket.connected) {
        if (isPaused) {
            // Resume the scraping
            socket.emit('resumeScraping');
            toggleButton.textContent = 'Pause';
            toggleButton.classList.remove('resumed');
            toggleButton.classList.add('paused');
            isPaused = false;
            console.log('Scraping resumed');
        } else {
            // Pause the scraping
            socket.emit('pauseScraping');
            toggleButton.textContent = 'Resume';
            toggleButton.classList.remove('paused');
            toggleButton.classList.add('resumed');
            isPaused = true;
            console.log('Scraping paused');
        }
    } else {
        console.error('Socket not connected');
    }
});

// Handle Stop button click
document.getElementById('stopButton').addEventListener('click', () => {
    if (socket.connected) {
        socket.emit('stopScraping');
        console.log('Scraping stopped');

        // Reset the toggle button to Pause state
        const toggleButton = document.getElementById('toggleButton');
        toggleButton.textContent = 'Pause';
        toggleButton.classList.remove('active');
        toggleButton.classList.add('inactive');
        isPaused = false;
    } else {
        console.error('Socket not connected');
    }
});

// Handle button clicks for toggling anchors
document.getElementById('anchors').addEventListener('click', () => {
    if (socket.connected) {
        const button = document.getElementById('anchors');
        button.classList.toggle('active');
        button.classList.toggle('inactive');
        const isActive = button.classList.contains('active');
        socket.emit('setAnchorsAllowed', isActive);
        console.log('Anchors button clicked');
    } else {
        console.error('Socket not connected');
    }
});

// Handle button clicks for toggling parameters
document.getElementById('parameters').addEventListener('click', () => {
    if (socket.connected) {
        const button = document.getElementById('parameters');
        button.classList.toggle('active');
        button.classList.toggle('inactive');
        const isActive = button.classList.contains('active');
        socket.emit('setParametersAllowed', isActive);
        console.log('Parameters button clicked');
    } else {
        console.error('Socket not connected');
    }
});

// Handle scraping start
document.getElementById('scrapeButton').addEventListener('click', () => {
    if (socket.connected) {
        const urls = document.getElementById('urlInput').value.split(',').map(url => url.trim());
        const depth = parseInt(document.getElementById('depthInput').value, 10);
        if (urls.length) {
            document.getElementById('output').textContent = ''; // Clear previous output
            if (isNaN(depth)) {
                socket.emit('eliminateDepth',  false );
                console.log('Depth is not a number');
            }
            else {
                console.log('Depth is a number');
                socket.emit('eliminateDepth',  true );
            }
            socket.emit('startScraping', { urls, depth });
        }
    } else {
        console.error('Socket not connected');
    }
});

// Handle Download button click
document.getElementById('downloadFile').addEventListener('click', () => {
    const baseURL = window.location.origin; // Get the base URL of the current server
    const filePath = '/download'; // Path to the file download endpoint
    
    // Create a new tab
    const downloadWindow = window.open(baseURL + filePath, '_blank');
    
    // Use setTimeout to close the tab after a short delay
    setTimeout(() => {
        if (downloadWindow) {
            downloadWindow.close();
        }
    }, 3000); // Adjust delay as needed
});

// Handle receiving discovered URLs
socket.on('urlDiscovered', (url) => {
    const output = document.getElementById('output');
    output.textContent += url + '\n'; // Append discovered URL
    output.scrollTop = output.scrollHeight; // Auto-scroll to the bottom
});
