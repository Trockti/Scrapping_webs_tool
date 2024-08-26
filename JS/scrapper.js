const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const axios = require('axios');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


function extractImagesfromURL(htmlString) {
    /**
     * Extracts all substrings that start with '"https:' or '"http:', 
     * optionally followed by 'www.', followed by any number of characters, 
     * and ending with a double-quote.
     * 
     * @param {string} text - The input text containing multiple lines.
     * @returns {Array} - A list of substrings that match the pattern.
     */
    const imgTagRegex = /<img\b[^>]*\bsrc=["']([^"']*)["'][^>]*>/gi;
    const matches = [];
    let match;
  
    // Use the regular expression to find all matches in the HTML string
    while ((match = imgTagRegex.exec(htmlString)) !== null) {
      // Push the captured src value into the matches array
      matches.push(match[1]);
    }
  
    return matches;
  }

  // Function to download an image
async function downloadImage(url, Path) {
    console.log('Downloading image:', url);
    console.log('Path:', Path);
    let savePath = path.join(__dirname, Path);
    console.log('Saving to:', savePath);
    try {
      // Get the response data as a stream
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
      });
  
      // Ensure the directory exists
      const folderPath = path.dirname(savePath);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
  
      // Pipe the stream to a writable file stream
      response.data.pipe(fs.createWriteStream(savePath));
  
      // Return a promise that resolves when the download is complete
      return new Promise((resolve, reject) => {
        response.data.on('end', () => {
          console.log('Download completed!');
          resolve();
        });
  
        response.data.on('error', (err) => {
          console.error('Error downloading image:', err);
          reject(err);
        });
      });
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  }
  

rl.question("Please enter the URLs you want to extract data from: ", initialUrls => {
    rl.question("Please enter the depth of the search: ", async wantedDepthStr => {
        let wantedDepth;
        try {
            wantedDepth = parseInt(wantedDepthStr);
        } catch (error) {
            console.log("The value entered is not a valid number.");
            wantedDepth = 1; // Default to 1 if invalid depth is provided
        }

        const urlsList = initialUrls.split(" ");
        console.log(urlsList);

        // Clear the file content before starting
        fs.writeFileSync("output/RAG_TXT.txt", "");
        fs.writeFileSync("output/page_text.txt", "");

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

        async function getFullHTMLIncludingShadowRoots(element) {
            // If it's a text node, return its content
            if (element.nodeType === Node.TEXT_NODE) {
                return element.textContent.trim();
            }

            // If it's a comment node, return the comment
            if (element.nodeType === Node.COMMENT_NODE) {
                return `<!-- ${element.textContent} -->`;
            }

            // If it's an element node, start building the HTML string
            let outerHTML = `<${element.tagName.toLowerCase()}`;

            // Add attributes
            for (let attr of element.attributes) {
                outerHTML += ` ${attr.name}="${attr.value}"`;
            }

            outerHTML += '>';

            // Handle shadow DOM if present
            if (element.shadowRoot) {
                outerHTML += '<!-- Start of Shadow Root -->';
                for (const child of element.shadowRoot.childNodes) {
                    outerHTML += await getFullHTMLIncludingShadowRoots(child);
                }
                outerHTML += '<!-- End of Shadow Root -->';
            }

            // Recursively process child nodes
            for (const child of element.childNodes) {
                outerHTML += await getFullHTMLIncludingShadowRoots(child);
            }

            // Close the tag
            outerHTML += `</${element.tagName.toLowerCase()}>`;

            return outerHTML;
        }

        async function exploreUrls(baseUrl, currentUrl, depth, wantedDepth) {
            if (depth >= wantedDepth || visitedUrls.has(currentUrl)) {
                return;
            }

            visitedUrls.add(currentUrl);
            depth += 1;

            // Open the current URL
            await driver.get(currentUrl);
            await driver.wait(until.elementLocated(By.tagName('body')), 10000);

        // Get the text content of all elements
        const pageText = await driver.executeScript(`
            return document.body.innerText;
        `);

        console.log("Extracted Text:", pageText);

        // Save the text to a file (optional)
        fs.writeFileSync("output/page_text.txt", pageText);

        // Extract all visible text content from the DOM and shadow roots
        const extractedText = await driver.executeScript(`
            function getTextFromShadowRoot(shadowRoot) {
                let text = '';

                shadowRoot.childNodes.forEach(child => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        if (child.textContent.trim()) {
                            text += child.textContent.trim() + '\\n';
                        }
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        // Recursively get text from shadow roots and elements
                        if (child.shadowRoot) {
                            text += getTextFromShadowRoot(child.shadowRoot);
                        }
                        text += getAllInnerText(child);
                    }
                });

                return text;
            }

            function getAllInnerText(node) {
                let textContent = '';

                // For element nodes, avoid <script> and <style> elements
                if (node.nodeType === Node.ELEMENT_NODE &&
                    node.tagName.toLowerCase() !== 'script' &&
                    node.tagName.toLowerCase() !== 'style') {
                    
                    // If element has a shadow root, process it
                    if (node.shadowRoot) {
                        textContent += getTextFromShadowRoot(node.shadowRoot);
                    }

                    // Recursively process child nodes
                    node.childNodes.forEach(childNode => {
                        textContent += getAllInnerText(childNode);
                    });
                }

                // For text nodes, directly add the text
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.trim()) textContent += node.textContent.trim() + '\\n';
                }

                return textContent;
            }

            // Start with the document root
            return getAllInnerText(document.documentElement);
        `);

        // Print or save the extracted text
        console.log("Extracted Shadow DOM Text:", extractedText);

        // Optional: Save the text to a file
        fs.writeFileSync("output/URL_text_all.txt", extractedText);

        if (!fs.existsSync("output/images")) {
            fs.mkdirSync("output/images", { recursive: true });
          }
          else {
            // Restart output folder
            fs.rm("output/images", { recursive: true });
          }
        
        const images = extractImagesfromURL(await driver.getPageSource());



        // Print the extracted images
        console.log("Extracted Images:", images);


        // Download the images
        await Promise.all(images.map(async (imageUrl, index) => {
            console.log("Downloading extension:", imageUrl.split('.').pop());  
            let extension = imageUrl.split('.').pop() == 'svg' ? imageUrl.split('.').pop(): 'png';
            let image = new URL(imageUrl, currentUrl).toString();
            await downloadImage(image, `output/images/${index}.${extension}`);
        }));

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
