const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const { URL } = require('url');

let anchors = false;
let Parameters = false;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Por favor, introduzca las URL's de las que desea extraer los datos: ", initialUrls => {
    rl.question("Por favor, introduzca la profundidad de la búsqueda: ", wantedDepthStr => {
        let wantedDepth;
        try {
            wantedDepth = parseInt(wantedDepthStr);
        } catch (error) {
            console.log("El valor ingresado no es un número válido.");
            wantedDepth = 1; // Default to 1 if invalid depth is provided
        }

        const urlsList = initialUrls.split(" ");
        console.log(urlsList);

        // Clear the file content before starting
        fs.writeFileSync("RAG_TXT.txt", "");

        // Setup Chrome options

        const chromeOptions = new chrome.Options()
            .addArguments("--headless")
            .addArguments("--ignore-certificate-errors")
            .addArguments("--disable-web-security")
            .addArguments("--allow-running-insecure-content")
            .setUserPreferences({ "profile.managed_default_content_settings.images": 2 });
        // Initialize the WebDriver
        const driver = new Builder()
            .forBrowser('chrome')
            .setChromeOptions(chromeOptions)
            .build();

        // Set of visited URLs to avoid loops
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

            if (!anchors) {
                if (new URL(currentUrl).hash) {
                    return;
                }
            }

            if (!Parameters) {
                if (new URL(currentUrl).search) {
                    return;
                }
            }

            // Add the current URL to the set of visited URLs
            visitedUrls.add(currentUrl);

            // Check if the URL is valid (not 404)
            if (await isUrlValid(currentUrl)) {
                fs.appendFileSync("RAG_TXT.txt", currentUrl + '\n');
            }
            if (depth >= wantedDepth) {
                return;
            }

            // Open the current URL
            await driver.get(currentUrl);
            await driver.wait(until.elementLocated(By.tagName('body')), 10000);

            // Extract the page source and create a JSDOM object
            const pageSource = await driver.getPageSource();
            const soup = new JSDOM(pageSource);

            // Extract all anchor tags
            anchors = await getAnchorsFromSoup(soup);

            // Extract and visit new URLs
            for (const anchor of anchors) {
                try {
                    const href = anchor.href;
                    if (href) {
                        const fullUrl = new URL(href, currentUrl).toString();
                        // Check if the URL is within the same domain and doesn't contain a hash fragment
                        if (new URL(fullUrl).hostname === new URL(baseUrl).hostname && !new URL(fullUrl).hash) {
                            await exploreUrls(baseUrl, fullUrl, depth, wantedDepth);
                        }
                    }
                } catch (error) {
                    console.log(`Exception occurred while processing ${anchor}: ${error}`);
                }
            }
        }

        (async () => {
            for (const startUrl of urlsList) {
                let depth = -1;
                // Start exploration from the initial URL
                await exploreUrls(startUrl, startUrl, depth, wantedDepth);
            }

            // Print all visited URLs
            for (const url of visitedUrls) {
                console.log(url);
            }

            // Close the driver
            await driver.quit();
            rl.close();
        })();
    });
});