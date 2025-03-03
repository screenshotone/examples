const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ScreenshotOne API credentials
const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;

if (!accessKey) {
    console.error(
        "Error: ScreenshotOne API access key is missing. Please check your .env file."
    );
    process.exit(1);
}

// Sleep function for retries
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to convert URL to PDF with retries
async function urlToPdf(
    url,
    outputPath,
    options = {},
    maxRetries = 3,
    retryDelay = 2000
) {
    let retries = 0;

    while (retries <= maxRetries) {
        try {
            // Default options for PDF generation
            const defaultOptions = {
                url,
                access_key: accessKey,
                format: "pdf",
                pdf_fit_one_page: "true",
                full_page: "true",
                wait_until: "networkidle0",
                pdf_print_background: "true",
            };

            // Merge default options with custom options
            const mergedOptions = { ...defaultOptions, ...options };

            // Build query string
            const queryString = new URLSearchParams(mergedOptions).toString();

            // ScreenshotOne API endpoint
            const apiUrl = `https://api.screenshotone.com/take?${queryString}`;

            console.log(
                `Generating PDF for ${url}... (Attempt ${retries + 1}/${
                    maxRetries + 1
                })`
            );

            // Make request to ScreenshotOne API
            const response = await axios({
                method: "get",
                url: apiUrl,
                responseType: "stream",
                timeout: 30000, // 30 seconds timeout
            });

            // Create write stream for output file
            const writer = fs.createWriteStream(outputPath);

            // Pipe response data to file
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on("finish", () => {
                    console.log(`PDF saved to ${outputPath}`);
                    resolve(outputPath);
                });
                writer.on("error", reject);
            });
        } catch (error) {
            retries++;

            if (retries > maxRetries) {
                console.error(
                    `Error generating PDF after ${maxRetries + 1} attempts:`,
                    error.message
                );
                if (error.response) {
                    console.error(
                        "API response status:",
                        error.response.status
                    );
                }
                throw new Error(
                    `Failed to generate PDF after ${maxRetries + 1} attempts: ${
                        error.message
                    }`
                );
            }

            console.warn(
                `Attempt ${retries}/${
                    maxRetries + 1
                } failed. Retrying in ${retryDelay}ms...`
            );
            console.error("Error:", error.message);

            // Wait before retrying
            await sleep(retryDelay);

            // Increase retry delay for next attempt (exponential backoff)
            retryDelay *= 1.5;
        }
    }
}

// Example usage
async function main() {
    const url = process.argv[2] || "https://www.example.com";
    const outputPath = process.argv[3] || path.join(__dirname, "output.pdf");

    try {
        // Additional options (optional)
        const options = {
            // Add any custom options here
            // delay: 2000,
            // device_scale_factor: 1,
            // block_ads: 'true',
            // pdf_print_background: 'true',
            // pdf_fit_one_page: 'true',
        };

        // Set retry parameters
        const maxRetries = 3; // Maximum number of retry attempts
        const retryDelay = 2000; // Initial delay between retries in milliseconds

        await urlToPdf(url, outputPath, options, maxRetries, retryDelay);
        console.log("PDF generation completed successfully!");
    } catch (error) {
        console.error("PDF generation failed:", error.message);
        process.exit(1);
    }
}

// Run the main function
main();
