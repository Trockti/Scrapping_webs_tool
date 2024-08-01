from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from urllib.parse import urljoin, urlparse
import time

input = input("Por favor, introduzca las URL's de las que desea extraer los datos: ")
print(input)
urls_list = input.split(" ")
print(urls_list)
# Clear the file content before starting
with open("RAG_TXT.txt", 'w') as file:
    file.write("")

# Setup Chrome options
chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--ignore-certificate-errors")
chrome_options.add_argument("--disable-web-security")
chrome_options.add_argument("--allow-running-insecure-content")
chrome_options.add_experimental_option(
    "prefs", {"profile.managed_default_content_settings.images": 2}
)

# Initialize the WebDriver
driver = webdriver.Chrome(options=chrome_options)

# Set of visited URLs to avoid loops
visited_urls = set()

def get_fresh_anchors():
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
    return driver.find_elements(By.TAG_NAME, 'a')

def explore_urls(base_url, current_url):
    # If the URL is already visited, skip it
    if current_url in visited_urls:
        return
    
    # Add the current URL to the set of visited URLs
    visited_urls.add(current_url)
    with open("RAG_TXT.txt", 'a') as file:
        file.write(current_url + '\n')

    # Open the current URL
    driver.get(current_url)

    # Extract all anchor tags
    anchors = get_fresh_anchors()
    
    # Extract and visit new URLs
    for anchor in anchors:
        try:
            href = anchor.get_attribute('href')
            if href:
                full_url = urljoin(current_url, href)
                # Check if the URL is within the same domain
                if urlparse(full_url).netloc == urlparse(base_url).netloc:
                    explore_urls(base_url, full_url)
        except Exception as e:
            print(f"Exception occurred while processing {anchor}: {e}")
            with open("RAG_TXT.txt", 'a') as file:
                if current_url not in visited_urls:
                    visited_urls.add(current_url)
                    file.write(current_url + '\n')
            # Refresh the list of anchors in case of an exception
            anchors = get_fresh_anchors()

for start_url in urls_list:
    # Start exploration from the initial URL
    explore_urls(start_url, start_url)

# Print all visited URLs
for url in visited_urls:
    print(url)

# Close the driver
driver.quit()
