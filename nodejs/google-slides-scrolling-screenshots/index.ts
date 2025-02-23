import axios from "axios";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config();

const SCREENSHOTONE_ACCESS_KEY = process.env.SCREENSHOTONE_ACCESS_KEY;

if (!SCREENSHOTONE_ACCESS_KEY) {
    console.error(
        "Error: SCREENSHOTONE_ACCESS_KEY environment variable is not set. Please add your API key to the .env file."
    );
    process.exit(1);
}

async function captureScrollingScreenshot(
    url: string,
    outputPath: string
): Promise<void> {
    try {
        // validate URL
        const presentationUrl = new URL(url);
        if (!presentationUrl.hostname.includes("docs.google.com")) {
            throw new Error(
                "Invalid URL: Must be a Google Slides presentation URL"
            );
        }

        // Extract presentation ID from the Google Slides URL
        const match = presentationUrl.pathname.match(
            /presentation\/d\/([\w-]+)/
        );
        if (!match) {
            throw new Error("Invalid Google Slides URL format");
        }

        const presentationId = match[1];
        const exportUrl = `https://docs.google.com/presentation/d/${presentationId}/export/html`;
        url = exportUrl;

        console.log(`Downloading Google Slides presentation from: ${url}`);
        const response = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000, // increase timeout to 60 seconds
        });
        const html = response.data;

        if (typeof html !== "string") {
            throw new Error(
                "Failed to get HTML content from Google Slides: Response data is not a string"
            );
        }

        console.log("Successfully downloaded presentation HTML");
        console.log("Preparing to capture scrolling screenshot...");

        // Prepare ScreenshotOne API parameters
        const params: Record<string, string> = {
            html: html,
            access_key: SCREENSHOTONE_ACCESS_KEY as string,
            format: "mp4",
            scenario: "scroll",
            delay: "2", // wait for 2 seconds before starting to scroll
        };

        const apiUrl = `https://api.screenshotone.com/animate`;
        console.log("Making request to ScreenshotOne API...");

        // Make request to ScreenshotOne API
        const screenshotResponse = await axios({
            method: "post",
            url: apiUrl,
            data: params,
            headers: {
                'Content-Type': 'application/json'
            },
            responseType: "stream",
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000, // increase timeout to 60 seconds
        });
        // Ensure the output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        if (screenshotResponse.status !== 200) {
            throw new Error(
                `Failed to capture scrolling screenshot: HTTP status is ${screenshotResponse.status}`
            );
        }

        // Save the video file
        const writer = fs.createWriteStream(outputPath);
        screenshotResponse.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => {
                console.log(
                    `Successfully saved scrolling screenshot to: ${outputPath}`
                );
                resolve();
            });
            writer.on("error", (err) => {
                console.error(`Error writing to file: ${err.message}`);
                reject(err);
            });
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("API Error Details:");
            if (error.response) {
                console.error(`Status: ${error.response.status}`);
                console.error(`Status Text: ${error.response.statusText}`);
                console.error("Response Data:", error.response.data);
                console.error("Headers:", error.response.headers);
            } else if (error.request) {
                console.error("No response received from the server");
                console.error("Request Details:", error.request);
            } else {
                console.error("Error Message:", error.message);
            }
            console.error("Config:", error.config);
        } else if (error instanceof Error) {
            console.error("Error:", error.message);
        } else {
            console.error("An unknown error occurred:", error);
        }
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length !== 2) {
        console.error(
            "Usage: npx ts-node index.ts <google-slides-url> <output-file>"
        );
        process.exit(1);
    }

    const [url, outputFile] = args;

    try {
        await captureScrollingScreenshot(url, outputFile);
    } catch (error) {
        console.error("Failed to capture scrolling screenshot");
        process.exit(1);
    }
}

main();
