# Google Slides Scrolling Screenshots

It is a demonstration application that uses [ScreenshotOne API—the best screenshot API](https://screenshotone.com) to render [scrolling screenshots of Google Slides presentations](https://screenshotone.com/scrolling-screenshots/).

Check out more examples in the [ScreenshotOne examples](https://github.com/screenshotone/examples) repository.

## How it works

You provide a Google Slides public presentation URL via the CLI argument and the application will:

1. Download the presentation as HTML.
2. Request the ScreenshotOne API to render scrolling screenshots of the presentation.
3. Save the resulting video to the specified file.

The code was written with the help of [Cursor](https://www.cursor.com/) as specified in the [instructions](./instructions.md).

## How to build and run

1. Clone the repository:

```bash
git clone https://github.com/screenshotone/examples.git
```

2. Navigate to the `examples/nodejs/google-slides-scrolling-screenshots` directory:

```bash
cd examples/nodejs/google-slides-scrolling-screenshots
```

3. Install the dependencies:

```bash
npm install
```

4. Create a `.env` file and set the following environment variables:

```bash
SCREENSHOTONE_ACCESS_KEY=your_screenshotone_access_key
```

5. Build the TypeScript code:

```bash
npm run build
```

6. Run the application:

```bash
npm start -- <url> <output file>
```

For example, to render scrolling screenshots of a Google Slides presentation:

```bash
npm start -- "https://docs.google.com/presentation/d/1fsaM1LaLUEzNn9pTPRdY0XBz1WxaFcWBD2WY50SrqwY/edit?usp=sharing" "google-slides-scrolling-screenshot.mp4"
```

Alternatively, you can use the development script that builds and runs in one command:

```bash
npm run dev -- <url> <output file>
```

The results will be saved to the specified output file:

[The results of the rendering.](./google-slides-scrolling-screenshot.mp4)
