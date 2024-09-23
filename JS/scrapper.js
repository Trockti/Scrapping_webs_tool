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


        const urlsList = initialUrls.split(" ");
        console.log(urlsList);


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

        
        
        
        async function exploreUrls(baseUrl, currentUrl, depth) {


            visitedUrls.add(currentUrl);
            depth += 1;

            // Open the current URL
            await driver.get(currentUrl);
            await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        

        let folder = currentUrl.replace(/[^a-zA-Z0-9]/g, '_')

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        else {
            fs.rmdirSync(folder, { recursive: true });
            fs.mkdirSync(folder, { recursive: true });
        }
        
        // Extract all visible text content from the DOM and shadow roots
        const extractedText = await driver.executeScript(`
            function getTextFromShadowRoot(shadowRoot, visitedNodes, excludedTags) {
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
                        } else {
                            text += getAllInnerText(child);
                        }
                    }
                });
                return text;
            }
        
            function getAllInnerText(node, visitedNodes = new Set(), excludedTags = []) {
                let textContent = '';
        
                if (node.nodeType === Node.ELEMENT_NODE &&
                    node.tagName.toLowerCase() !== 'script' &&
                    node.tagName.toLowerCase() !== 'style') {
        
                    // Skip processing if the tag is in the exclusion list
                    if (excludedTags.includes(node.tagName.toLowerCase())) {
                        return '';
                    }
        
                    // Prevent duplicate processing of the same element
                    if (visitedNodes.has(node)) {
                        return '';
                    }
                    visitedNodes.add(node);
        
                    if (node.shadowRoot) {
                        textContent += getTextFromShadowRoot(node.shadowRoot, visitedNodes, excludedTags);
                    }
        
                    node.childNodes.forEach(childNode => {
                        textContent += getAllInnerText(childNode, visitedNodes, excludedTags);
                    });
                }
        
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.trim()) {
                        textContent += node.textContent.trim() + '\\n';
                    }
                }
        
                return textContent;
            }
            
            
            // Define which tags/components to exclude
            const excludedTags = ['one-nav-bar-menu-item', 'a', 'one-global-header']; // Add more tags as needed
        
            return getAllInnerText(document.body, new Set(), excludedTags);
        `);


        // Optional: Save the text to a file
        fs.writeFileSync(`${folder}/URL_text_all.txt`, extractedText);

        const page_data = {
            url: currentUrl,
            text: extractedText,
        }
        fs.writeFileSync(`${folder}/page_data.jsonl`, JSON.stringify(page_data, null, 2));
        
        const complete_html = await driver.executeScript(`
            // Function to extract the shadow DOM content recursively
            function getAllHTMLIncludingShadowRoots(node) {
                let html = node.outerHTML || '';
                
                // If node has a shadow root, recurse into it
                if (node.shadowRoot) {
                    let shadowRootHTML = '';
                    for (const child of node.shadowRoot.children) {
                        shadowRootHTML += getAllHTMLIncludingShadowRoots(child);
                    }
                    html = html.replace('</' + node.tagName.toLowerCase() + '>', shadowRootHTML + '</' + node.tagName.toLowerCase() + '>');
                }

                // Recurse into children if the node has any
                for (const child of node.children) {
                    html = html.replace(child.outerHTML, getAllHTMLIncludingShadowRoots(child));
                }
                
                return html;
            }

            // Get the full page HTML including shadow DOM
            return getAllHTMLIncludingShadowRoots(document.documentElement);
        `);

        // Split the text into an array of lines
        let lines = complete_html.split('\n');

        // Filter out empty lines (trim whitespace to handle lines with spaces only)
        let filteredLines = lines.filter(line => line.trim() !== '');

        // Join the filtered lines back into a string
        const html = filteredLines.join('\n');

        fs.writeFileSync(`${folder}/complete_html.html`, html);


      
        const page_html = {
            url: currentUrl,
            html: html,
            }
        fs.writeFileSync(`${folder}/page_html.jsonl`, JSON.stringify(page_html, null, 2));
        

        const parents = await driver.executeScript(`
            function getTextFromShadowRoot(shadowRoot, visitedNodes, excludedTags, parents) {
                let text = '';
                shadowRoot.childNodes.forEach(child => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        if (child.textContent.trim()) {
                            if (!parents[child.parentNode.tagName.toLowerCase()]) {
                                parents[child.parentNode.tagName.toLowerCase()] = [];
                            }
                            parents[child.parentNode.tagName.toLowerCase()].push(child.textContent.trim());
                            text += child.textContent.trim() + '\\n';
                        }
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        // Recursively get text from shadow roots and elements
                        if (child.shadowRoot) {
                            text += getTextFromShadowRoot(child.shadowRoot);
                        } else {
                            text += getAllInnerText(child, visitedNodes, excludedTags, parents);
                        }
                    }
                });
                return parents;
            }
        
            function getAllInnerText(node, visitedNodes = new Set(), excludedTags = [], parents) {
                let textContent = '';
        
                if (node.nodeType === Node.ELEMENT_NODE &&
                    node.tagName.toLowerCase() !== 'script' &&
                    node.tagName.toLowerCase() !== 'style') {
        
                    // Skip processing if the tag is in the exclusion list
                    if (excludedTags.includes(node.tagName.toLowerCase())) {
                        return '';
                    }
        
                    // Prevent duplicate processing of the same element
                    if (visitedNodes.has(node)) {
                        return '';
                    }
                    visitedNodes.add(node);
        
                    if (node.shadowRoot) {
                        textContent += getTextFromShadowRoot(node.shadowRoot, visitedNodes, excludedTags, parents);
                    }
        
                    node.childNodes.forEach(childNode => {
                        textContent += getAllInnerText(childNode, visitedNodes, excludedTags, parents);
                    });
                }
        
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.trim()) {
                        if (!parents[node.parentNode.tagName.toLowerCase()]) {
                            parents[node.parentNode.tagName.toLowerCase()] = [];
                        }
                        parents[node.parentNode.tagName.toLowerCase()].push(node.textContent.trim());
                        textContent += node.textContent.trim() + '\\n';
                    }
                }
        
                return parents;
            }
            
            
            let parents = {};

            // Define which tags/components to exclude
            const excludedTags = ['one-nav-bar-menu-item', 'a', 'one-global-header']; // Add more tags as needed
        
            return getAllInnerText(document.body, new Set(), excludedTags, parents);
        `);


        fs.writeFileSync(`${folder}/parents.jsonl`, JSON.stringify(parents, null, 2));


        const markdown = await driver.executeScript(`
            function getTextFromShadowRoot(shadowRoot, visitedNodes, excludedTags) {
                let markdown = '';
                shadowRoot.childNodes.forEach(child => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        if (child.textContent.trim()) {
                            switch (child.parentNode.tagName.toLowerCase()) {
                                case 'h1':
                                    markdown += '\\n# ' + child.textContent.trim() + '\\n';
                                    break;
                                case 'h2':
                                    markdown += '\\n## ' + child.textContent.trim() + '\\n';
                                    break;
                                case 'h3':
                                    markdown += '\\n### ' + child.textContent.trim() + '\\n';
                                    break;
                                case 'p':
                                    markdown += child.textContent.trim() + '\\n';
                                    break;
                                case 'a':
                                    let href = child.parentNode.getAttribute('href');
                                    markdown += '[' + child.textContent.trim() + '](' + href + ')';
                                    break;
                                case 'ul':
                                    // Recursively handle list items
                                    child.childNodes.forEach(child => parseNode(child));
                                    break;
                                case 'li':
                                    markdown += '- ' + child.textContent.trim() + '\\n';
                                    break;
                                case 'strong':
                                    markdown += '**' + child.textContent.trim() + '**';
                                    break;
                                case 'em':
                                    markdown += '*' + child.textContent.trim() + '*';
                                    break;
                                case 'br':
                                    markdown += '\\n';  // Line break in markdown
                                    break;
                                default:
                                    markdown += child.textContent.trim() + ' ';
                                    break;
                            }
        
                        }
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        // Recursively get text from shadow roots and elements
                        if (child.tagName.toLowerCase() == 'br') {
                            markdown += '\\n';  // Line break in markdown
                        }
                        if (child.shadowRoot) {
                            markdown += getTextFromShadowRoot(child.shadowRoot, visitedNodes, excludedTags);
                        } else {
                            markdown += getAllInnerText(child, visitedNodes, excludedTags);
                        }
                    }
                });
                return markdown;
            }
        
            function getAllInnerText(node, visitedNodes = new Set(), excludedTags = []) {
                let markdown = '';
        
                if (node.nodeType === Node.ELEMENT_NODE &&
                    node.tagName.toLowerCase() !== 'script' &&
                    node.tagName.toLowerCase() !== 'style') {
        
                    // Skip processing if the tag is in the exclusion list
                    if (excludedTags.includes(node.tagName.toLowerCase())) {
                        return '';
                    }
        
                    // Prevent duplicate processing of the same element
                    if (visitedNodes.has(node)) {
                        return '';
                    }
                    visitedNodes.add(node);
        
                    if (node.shadowRoot) {
                        markdown += getTextFromShadowRoot(node.shadowRoot, visitedNodes, excludedTags);
                    }
                    
                    if (node.tagName.toLowerCase() == 'br') {
                        markdown += '\\n';  // Line break in markdown
                    }
    
                    node.childNodes.forEach(childNode => {
                        markdown += getAllInnerText(childNode, visitedNodes, excludedTags);
                    });
                }
        
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.trim()) {
                        switch (node.parentNode.tagName.toLowerCase()) {
                            case 'h1':
                                markdown += '\\n# ' + node.textContent.trim() + '\\n';
                                break;
                            case 'h2':
                                markdown += '\\n## ' + node.textContent.trim() + '\\n';
                                break;
                            case 'h3':
                                markdown += '\\n### ' + node.textContent.trim() + '\\n';
                                break;
                            case 'p':
                                markdown += node.textContent.trim() + '\\n';
                                break;
                            case 'a':
                                let href = node.parentNode.getAttribute('href');
                                markdown += '[' + node.textContent.trim() + '](' + href + ')';
                                break;
                            case 'ul':
                                // Recursively handle list items
                                node.childNodes.forEach(child => parseNode(child));
                                break;
                            case 'li':
                                markdown += '- ' + node.textContent.trim() + '\\n';
                                break;
                            case 'strong':
                                markdown += '**' + node.textContent.trim() + '**';
                                break;
                            case 'em':
                                markdown += '*' + node.textContent.trim() + '*';
                                break;
                            case 'br':
                                markdown += '\\n';  // Line break in markdown
                                break;
                            default:
                                markdown += node.textContent.trim() + ' ';
                                break;
                        }
                    }
                }
        
                return markdown;
            }
        
            // Define which tags/components to exclude
            const excludedTags = ['one-nav-bar-menu-item', 'a', 'one-global-header']; // Add more tags as needed
        
            return getAllInnerText(document.body, new Set(), excludedTags);
        `);
        

        fs.writeFileSync(`${folder}/markdown.md`, markdown);

        const markdown_josnl = {
            url: currentUrl,
            markdown: markdown,
        }

        fs.writeFileSync(`${folder}/markdown.jsonl`, JSON.stringify(markdown_josnl, null, 2));

        if (!fs.existsSync(`${folder}/images`)) {
            fs.mkdirSync(`${folder}/images`, { recursive: true });
          }
        else {
            fs.rmdirSync(`${folder}/images`, { recursive: true });
            fs.mkdirSync(`${folder}/images`, { recursive: true });
        }
        
        const images = extractImagesfromURL(await driver.getPageSource());



        // Print the extracted images
        console.log("Extracted Images:", images);


        // Download the images
        await Promise.all(images.map(async (imageUrl, index) => {
            console.log("Downloading extension:", imageUrl.split('.').pop());  
            let extension = imageUrl.split('.').pop() == 'svg' ? imageUrl.split('.').pop(): 'png';
            let image = new URL(imageUrl, currentUrl).toString();
            await downloadImage(image, `${folder}/images/${index}.${extension}`);
        }));

    }

        (async () => {
            for (const startUrl of urlsList) {
                let depth = -1;
                // Start exploration from the initial URL
                await exploreUrls(startUrl, startUrl, depth);
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
