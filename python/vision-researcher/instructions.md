1. Write a simple Python script that satisfies [README.md](./README.md) instructions.
2. Install all required libraries and update [requirements.txt](./requirements.txt) if needed.
3. Use [ScreenshotOne API](https://screenshotone.com/) with response type JSON and request metadata content to get the screenshot and the page HTML in one request.
4. Split the resulting screenshots into parts and send requests to OpenAI Vision API with the given questions and print answers.
5. Parse HTML, find the given number of internal pages to navigate, and repeat the same process for them.
