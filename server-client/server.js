const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const axios = require('axios');
const { JSDOM } = require('jsdom');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
let anchors_allowed = false;
let parameters_allowed = false;

app.use(express.static('public')); // Serve static files from the 'public' directory

io.on('connection', (socket) => {
    console.log('A client connected');

    // Handle button state changes
    socket.on('setAnchorsAllowed', (state) => {
        anchors_allowed = state;
        console.log(`Anchors allowed: ${anchors_allowed}`);
    });

    socket.on('setParametersAllowed', (state) => {
        parameters_allowed = state;
        console.log(`Parameters allowed: ${parameters_allowed}`);
    });

    socket.on('startScraping', async ({ urls, depth }) => {
        console.log('Scraping started');
        await scrapper(urls, depth, socket);
    });
});

async function scrapper(urls, wantedDepth, socket) {
    console.log(`Parameters allowed: ${parameters_allowed}`);
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--headless');
    chromeOptions.addArguments("--ignore-certificate-errors");
    chromeOptions.addArguments("--disable-web-security");
    chromeOptions.addArguments("--allow-running-insecure-content");
    chromeOptions.setUserPreferences({ "profile.managed_default_content_settings.images": 2 });

    let driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();

    const visitedUrls = new Set();

    async function getAnchorsFromSoup(soup) {
        const document = soup.window.document;
        return Array.from(document.querySelectorAll('a'));
    }

    async function isUrlValid(url) {
        try {
            const response = await axios.head(url, { maxRedirects: 10 });
            return response.status !== 404;
        } catch (error) {
            console.log(`Request exception for URL ${url}: ${error}`);
            return false;
        }
    }

    async function exploreUrls(baseUrl, currentUrl, depth, wantedDepth) {
        depth += 1;

        if (visitedUrls.has(currentUrl)) {
            return;
        }
        if (!anchors_allowed) {
            if (new URL(currentUrl).hash) {
                return;
            }
        }

        if (!parameters_allowed) {
            if (new URL(currentUrl).search) {
                return;
            }
        }

        visitedUrls.add(currentUrl);

        if (await isUrlValid(currentUrl)) {
            socket.emit('urlDiscovered', currentUrl);
        }
        if (depth >= wantedDepth) {
            return;
        }

        await driver.get(currentUrl);
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);

        const pageSource = await driver.getPageSource();
        const soup = new JSDOM(pageSource);
        const anchors = await getAnchorsFromSoup(soup);

        for (const anchor of anchors) {
            try {
                const href = anchor.href;
                if (href) {
                    const fullUrl = new URL(href, currentUrl).toString();
                    if (new URL(fullUrl).hostname === new URL(baseUrl).hostname && !new URL(fullUrl).hash) {
                        await exploreUrls(baseUrl, fullUrl, depth, wantedDepth);
                    }
                }
            } catch (error) {
                console.log(`Exception occurred while processing ${anchor}: ${error}`);
            }
        }
    }

    for (const startUrl of urls) {
        let depth = -1;
        await exploreUrls(startUrl, startUrl, depth, wantedDepth);
    }

    await driver.quit();
    console.log('Scraping completed.');
}

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
