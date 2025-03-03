# URL to PDF Converter

A simple Node.js program to render a URL as PDF using [the ScreenshotOne API](https://screenshotone.com/).

## Prerequisites

-   Node.js
-   npm
-   [ScreenshotOne API](https://screenshotone.com/) access key

## Installation

1. Clone this repository or download the source code.

```bash
git clone https://github.com/screenshotone/examples.git
```

2. Navigate to the project directory.

```bash
cd examples/nodejs/url-to-pdf
```

3. Install the dependencies:

```bash
npm install
```

4. Create a `.env` file in the project root directory and add your ScreenshotOne API access key:

```
SCREENSHOTONE_ACCESS_KEY=your_access_key
```

You can get your API access key by signing up at [ScreenshotOne](https://screenshotone.com/).

## Usage

### Basic Usage

Run the program with a URL to convert it to PDF:

```bash
node index.js https://example.com
```

This will generate a PDF file named `output.pdf` in the project directory.

### Custom Output Path

You can specify a custom output path for the PDF file:

```bash
node index.js https://example.com /path/to/output.pdf
```

### Retry Mechanism

The application includes a built-in retry mechanism that will automatically retry failed requests up to 3 times with an exponential backoff delay between retries. This helps handle temporary network issues or API rate limits.

You can modify the retry parameters in the `main()` function in `index.js`:

```javascript
const maxRetries = 3; // Maximum number of retry attempts
const retryDelay = 2000; // Initial delay between retries in milliseconds
```

### Advanced Options

You can modify the `options` object in the `main()` function in `index.js` to customize the PDF generation. For a complete list of options, refer to the [ScreenshotOne API documentation](https://screenshotone.com/docs/options/).
