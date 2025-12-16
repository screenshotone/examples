import { Client, TakeOptions, APIError } from "screenshotone-api-sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const urls = ["https://example.com", "https://screenshotone.com"];

const config = {
    // get your API keys from https://dash.screenshotone.com/access/
    keys: {
        apiKey: "<your access key>",
        secretKey: "<your secret key>",
    },
    // check out our guide on how to use proxies:
    // https://screenshotone.com/docs/guides/how-to-use-proxies/
    proxies: [
        // "http://user:pass@proxy1.example.com:8080",
        // "http://user:pass@proxy2.example.com:8080",
    ],
    // directory to save the screenshots
    outputDirectory: "./screenshots",
    maxRetries: 3,
    options: {
        format: "png",
        viewportWidth: 1280,
        viewportHeight: 800,
    },
} as {
    keys: {
        apiKey: string;
        secretKey: string;
    };
    proxies: string[];
    outputDirectory?: string;
    maxRetries: number;
    options: any;
};

interface Usage {
    total: number;
    available: number;
    used: number;
    concurrency: {
        limit: number;
        remaining: number;
        reset: number;
    };
}

interface ScreenshotResult {
    url: string;
    success: boolean;
    filePath?: string;
    error?: string;
}

async function fetchUsage(): Promise<Usage> {
    const response = await fetch(
        `https://api.screenshotone.com/usage?access_key=${config.keys.apiKey}`
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch usage: ${response.status} ${response.statusText}`
        );
    }

    return response.json() as Promise<Usage>;
}

interface ExtendedAPIError {
    errorCode?: string;
    returnedStatusCode?: number;
}

function isRetryableError(error: unknown): boolean {
    if (!(error instanceof APIError)) {
        return false;
    }

    const apiError = error as ExtendedAPIError;
    const retryableErrorCodes = ["host_returned_error", "network_error"];

    if (!retryableErrorCodes.includes(apiError.errorCode || "")) {
        return false;
    }

    if (apiError.errorCode === "host_returned_error") {
        const retryableStatusCodes = [401, 403, 429, 503];
        if (apiError.returnedStatusCode) {
            return retryableStatusCodes.includes(apiError.returnedStatusCode);
        }
        return true;
    }

    return true;
}

function getFilenameFromUrl(url: string): string {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, "_");
    const path = urlObj.pathname.replace(/\//g, "_").replace(/^_/, "");
    const filename = path ? `${hostname}${path}` : hostname;
    return `${filename}.${config.options.format}`;
}

async function takeScreenshotWithRetry(
    client: Client,
    url: string
): Promise<ScreenshotResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        const useProxy = attempt > 0 && config.proxies.length > 0;
        const proxyIndex = (attempt - 1) % config.proxies.length;
        const proxy = useProxy ? config.proxies[proxyIndex] : undefined;

        try {
            const options = TakeOptions.url(url)
                .format(config.options.format)
                .viewportWidth(config.options.viewportWidth)
                .viewportHeight(config.options.viewportHeight);

            if (proxy) {
                options.proxy(proxy);
                console.log(
                    `Retry ${attempt}/${config.maxRetries} for ${url} with proxy`
                );
            }

            const blob = await client.take(options);
            const buffer = Buffer.from(await blob.arrayBuffer());

            if (config.outputDirectory) {
                const filename = getFilenameFromUrl(url);
                const filePath = path.join(config.outputDirectory, filename);

                await fs.writeFile(filePath, buffer);

                return {
                    url,
                    success: true,
                    filePath,
                };
            }

            return {
                url,
                success: true,
            };
        } catch (error) {
            lastError = error;

            if (!isRetryableError(error)) {
                break;
            }

            if (attempt === config.maxRetries) {
                break;
            }

            if (config.proxies.length === 0) {
                console.log(
                    `Error for ${url} but no proxies configured for retry`
                );
                break;
            }
        }
    }

    const errorMessage =
        lastError instanceof Error ? lastError.message : String(lastError);
    return {
        url,
        success: false,
        error: errorMessage,
    };
}

async function processUrls(urls: string[]): Promise<ScreenshotResult[]> {
    const client = new Client(config.keys.apiKey, config.keys.secretKey);
    const results: ScreenshotResult[] = [];

    if (config.outputDirectory) {
        await fs.mkdir(config.outputDirectory, { recursive: true });
    }

    const usage = await fetchUsage();
    console.log(
        `Usage: ${usage.used}/${usage.total}, Available: ${usage.available}`
    );
    console.log(
        `Concurrency limit: ${usage.concurrency.limit}, Remaining: ${usage.concurrency.remaining}`
    );

    const concurrencyLimit = Math.min(
        usage.concurrency.remaining,
        usage.concurrency.limit
    );

    if (concurrencyLimit === 0) {
        const resetTime = new Date(usage.concurrency.reset / 1_000_000);
        console.log(
            `Concurrency limit reached. Resets at ${resetTime.toISOString()}`
        );
        return results;
    }

    const queue = [...urls];

    async function processNext(): Promise<void> {
        if (queue.length === 0) {
            return;
        }

        const url = queue.shift()!;
        console.log(`Processing: ${url}`);

        const result = await takeScreenshotWithRetry(client, url);
        results.push(result);

        if (result.success) {
            console.log(`Success: ${url} -> ${result.filePath}`);
        } else {
            console.log(`Failed: ${url} - ${result.error}`);
        }
    }

    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(concurrencyLimit, urls.length); i++) {
        workers.push(
            (async () => {
                while (queue.length > 0) {
                    await processNext();
                }
            })()
        );
    }

    await Promise.all(workers);

    return results;
}

async function main() {
    console.log(`Starting bulk screenshot for ${urls.length} URLs`);
    if (config.outputDirectory) {
        console.log(`Output directory: ${config.outputDirectory}`);
    } else {
        console.log(
            `No output directory specified, screenshots will not be saved`
        );
    }

    const results = await processUrls(urls);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`\nCompleted: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
        console.log("\nFailed URLs:");
        results
            .filter((r) => !r.success)
            .forEach((r) => console.log(`  ${r.url}: ${r.error}`));
    }
}

main().catch(console.error);
