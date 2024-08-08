import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';

import { JSDOM } from 'jsdom';
import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as readline from 'readline';
import { URL } from 'url';



let anchors: HTMLAnchorElement[] = [];
let Parameters: boolean = false;
let anchorsOnly: boolean = false;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

scrapper();

export function scrapper(): void {
    rl.question("Por favor, introduzca las URL's de las que desea extraer los datos: ", async (initialUrls: string) => {
        rl.question("Por favor, introduzca la profundidad de la búsqueda: ", async (wantedDepthStr: string) => {
            let wantedDepth: number;
            try {
                wantedDepth = parseInt(wantedDepthStr, 10);
                if (isNaN(wantedDepth)) {
                    throw new Error('Invalid number');
                }
            } catch (error) {
                console.log("El valor ingresado no es un número válido.");
                wantedDepth = 1; // Default to 1 if invalid depth is provided
            }

            const urlsList: string[] = initialUrls.split(" ");
            console.log(urlsList);

            // Clear the file content before starting
            fs.writeFileSync("RAG_TXT.txt", "");

            // Crear una instancia de opciones de Chrome
            const chromeOptions = new chrome.Options();
            
            // Configurar las opciones de Chrome según sea necesario
            chromeOptions.addArguments('--headless');
            chromeOptions.addArguments("--ignore-certificate-errors")
            chromeOptions.addArguments("--disable-web-security")
            chromeOptions.addArguments("--allow-running-insecure-content")
            chromeOptions.setUserPreferences({ "profile.managed_default_content_settings.images": 2 });

            // Crear una instancia del navegador utilizando las opciones de Chrome
            let driver: WebDriver = new Builder()
                .forBrowser('chrome')
                .setChromeOptions(chromeOptions)
                .build();

            const visitedUrls: Set<string> = new Set();

            async function getAnchorsFromSoup(soup: JSDOM): Promise<HTMLAnchorElement[]> {
                const document: Document = soup.window.document;
                return Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
            }

            async function isUrlValid(url: string): Promise<boolean> {
                try {
                    const response: AxiosResponse = await axios.head(url, { maxRedirects: 10 });
                    return response.status !== 404;
                } catch (error) {
                    console.log(`Request exception for URL ${url}: ${error}`);
                    return false;
                }
            }

            async function exploreUrls(baseUrl: string, currentUrl: string, depth: number, wantedDepth: number): Promise<void> {
                depth += 1;

                if (visitedUrls.has(currentUrl)) {
                    return;
                }

                if (!anchorsOnly) {
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
                const pageSource: string = await driver.getPageSource();
                const soup: JSDOM = new JSDOM(pageSource);

                // Extract all anchor tags
                anchors = await getAnchorsFromSoup(soup);

                // Extract and visit new URLs
                for (const anchor of anchors) {
                    try {
                        const href: string = anchor.href;
                        if (href) {
                            const fullUrl: string = new URL(href, currentUrl).toString();
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
                    let depth: number = -1;
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
}

