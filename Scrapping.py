from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import requests  # Import the requests module to check URL status
import time

initial_urls = input("Por favor, introduzca las URL's de las que desea extraer los datos: ")
try:
    wanted_depth = int(input("Por favor, introduzca la profundidad de la búsqueda: "))
except ValueError:
    print("El valor ingresado no es un número válido.")
    wanted_depth = 1  # Default to 1 if invalid depth is provided

urls_list = initial_urls.split(" ")
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


def get_anchors_from_soup(soup):
    return soup.find_all('a')

def is_url_valid(url):
    try:
        response = requests.head(url, allow_redirects=True)
        return response.status_code != 404
    except requests.RequestException as e:
        print(f"Request exception for URL {url}: {e}")
        return False

def explore_urls(base_url, current_url, depth, wanted_depth):
    depth += 1
    
    if current_url in visited_urls or "#" in urlparse(current_url).fragment:
        return

    # Add the current URL to the set of visited URLs
    visited_urls.add(current_url)
    
    # Check if the URL is valid (not 404)
    if is_url_valid(current_url):
        with open("RAG_TXT.txt", 'a') as file:
            file.write(current_url + '\n')
    if depth >= wanted_depth:
        return

    # Open the current URL
    driver.get(current_url)
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))

    # Extract the page source and create a BeautifulSoup object
    page_source = driver.page_source
    soup = BeautifulSoup(page_source, 'html.parser')

    # Extract all anchor tags
    anchors = get_anchors_from_soup(soup)
    
    # Extract and visit new URLs
    for anchor in anchors:
        try:
            href = anchor.get('href')
            if href:
                full_url = urljoin(current_url, href)
                # Check if the URL is within the same domain and doesn't contain a hash fragment
                if urlparse(full_url).netloc == urlparse(base_url).netloc and not urlparse(full_url).fragment:
                    explore_urls(base_url, full_url, depth, wanted_depth)
        except Exception as e:
            print(f"Exception occurred while processing {anchor}: {e}")

for start_url in urls_list:
    depth = -1
    # Start exploration from the initial URL
    explore_urls(start_url, start_url, depth, wanted_depth)

# Print all visited URLs
for url in visited_urls:
    print(url)

# Close the driver
driver.quit()
