import os
import sys
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
import time
from PIL import Image
from io import BytesIO
import base64

# Load environment variables
load_dotenv()

SCREENSHOTONE_API_KEY = os.getenv("SCREENSHOTONE_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not SCREENSHOTONE_API_KEY or not OPENAI_API_KEY:
    print("Please set SCREENSHOTONE_API_KEY and OPENAI_API_KEY in .env file")
    sys.exit(1)

# Initialize OpenAI client, it will automatically use OPENAI_API_KEY from environment
client = OpenAI()

def get_screenshot_and_html(url):
    """Get screenshot and HTML content using ScreenshotOne API"""
    print(f"📸 Taking screenshot of {url}...")
    api_url = "https://api.screenshotone.com/take"
    params = {
        "access_key": SCREENSHOTONE_API_KEY,
        "url": url,
        "full_page": "true",
        "format": "jpg",
        "cache": "true",
        "response_type": "json",
        "metadata_content": "true",
    }

    start_time = time.time()
    response = requests.get(api_url, params=params)
    if response.status_code != 200:
        print(f"❌ Error getting screenshot: {response.text}")
        return None, None

    data = response.json()
    screenshot_url = data.get("cache_url")  # URL of the screenshot

    html_url = data.get("content", {}).get("url")

    # Get HTML content directly from the URL
    try:
        html_response = requests.get(html_url)
        html_content = html_response.text if html_response.status_code == 200 else None
    except Exception as e:
        print(f"❌ Error fetching HTML content: {e}")
        html_content = None

    duration = time.time() - start_time
    print(f"✅ Screenshot taken successfully ({duration:.2f}s)")

    if not screenshot_url:
        print("❌ No screenshot URL in response")
    if not html_content:
        print("❌ No HTML content fetched")

    return screenshot_url, html_content


def analyze_image(image_url, prompt):
    """Analyze image using OpenAI Vision API by splitting into chunks"""
    print("🔍 Analyzing screenshot with OpenAI Vision...")
    print(f"   Prompt: {prompt}")

    try:
        # Download image
        print("   Downloading image...")
        response = requests.get(image_url)
        if response.status_code != 200:
            print("❌ Failed to download image")
            return None
            
        # Open image and get dimensions
        image = Image.open(BytesIO(response.content))
        width, height = image.size
        chunk_height = 1000  # Height of each chunk in pixels
        
        results = []
        start_time = time.time()
        
        # Split and analyze each chunk
        for y in range(0, height, chunk_height):
            # Calculate chunk boundaries
            chunk_bottom = min(y + chunk_height, height)
            chunk = image.crop((0, y, width, chunk_bottom))
            
            # Save chunk to bytes
            chunk_bytes = BytesIO()
            chunk.save(chunk_bytes, format='JPEG')
            chunk_bytes.seek(0)
            
            print(f"   Analyzing chunk {y//chunk_height + 1} of {(height + chunk_height - 1)//chunk_height}...")
            
            # Analyze chunk with OpenAI Vision
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64.b64encode(chunk_bytes.getvalue()).decode()}"
                                }
                            },
                        ],
                    }
                ],
                max_tokens=300,
            )
            
            chunk_result = response.choices[0].message.content
            if chunk_result:
                results.append(chunk_result)
                
        duration = time.time() - start_time
        print(f"✅ Analysis completed successfully ({duration:.2f}s)")
        return "\n".join(results)

    except Exception as e:
        print(f"❌ Error analyzing image: {e}")
        return None


def get_internal_links(html_content, base_url):
    """Extract internal links from HTML content"""
    print("🔗 Extracting internal links...")
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        base_domain = urlparse(base_url).netloc
        internal_links = set()

        for link in soup.find_all("a", href=True):
            href = link["href"]
            absolute_url = urljoin(base_url, href)

            if urlparse(absolute_url).netloc == base_domain:
                internal_links.add(absolute_url)

        print(f"✅ Found {len(internal_links)} internal links")
        return internal_links
    except Exception as e:
        print(f"❌ Error extracting internal links: {e}")
        return set()


def main():
    if len(sys.argv) != 4:
        print("Usage: python vision_researcher.py <url> <prompt> <max_pages>")
        sys.exit(1)

    url = sys.argv[1]
    prompt = sys.argv[2]
    max_pages = int(sys.argv[3])

    print("\n🚀 Starting Vision Researcher")
    print(f"   Initial URL: {url}")
    print(f"   Max Pages: {max_pages}")
    print(f"   Prompt: {prompt}\n")

    visited_urls = set()
    pages_processed = 0
    start_time = time.time()

    while pages_processed < max_pages and url and url not in visited_urls:
        print(f"\n📄 Page {pages_processed + 1}/{max_pages}")
        print(f"🌐 Processing: {url}")
        visited_urls.add(url)

        # Get screenshot and HTML
        screenshot_url, html_content = get_screenshot_and_html(url)
        if not screenshot_url or not html_content:
            print("⏭️ Skipping page due to errors")
            continue

        print(f"🖼️ Screenshot available at: {screenshot_url}")

        # Analyze screenshot with OpenAI Vision
        vision_result = analyze_image(screenshot_url, prompt)
        if vision_result:
            print("\n📝 Analysis Result:")
            print("   " + vision_result.replace("\n", "\n   "))

        # Get internal links for next iteration
        internal_links = get_internal_links(html_content, url)
        pages_processed += 1

        # Get next unvisited URL
        next_urls = [link for link in internal_links if link not in visited_urls]
        url = next_urls[0] if next_urls else None

        if not url:
            print("\n🏁 No more unvisited internal links")
        elif pages_processed >= max_pages:
            print("\n🏁 Reached maximum number of pages")

    total_duration = time.time() - start_time
    print(f"\n✨ Vision Research completed")
    print(f"   Pages processed: {pages_processed}")
    print(f"   Total time: {total_duration:.2f}s")
    if pages_processed > 0:
        print(f"   Average time per page: {total_duration/pages_processed:.2f}s")
    else:
        print("   No pages were processed")


if __name__ == "__main__":
    main()
