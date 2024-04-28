import Sharp from "sharp";
import { performance } from "node:perf_hooks";
import { Readable } from "node:stream";

const baseUrl = process.env.BASE_IMAGE_URL;

export const handler = awslambda.streamifyResponse(async (event, responseStream) => {
    try {
        console.debug("Event path", event.rawPath);
        const filename = event.rawPath.replace("/uploads/stream/", "");
        const width = event.queryStringParameters?.width;
        const height = event.queryStringParameters?.height;
        const fit = (event.queryStringParameters?.fit ?? "cover") as keyof Sharp.FitEnum;
        const format = (event.queryStringParameters?.format ?? "avif") as keyof Sharp.FormatEnum;

        performance.mark("start");
        console.debug("Performance", performance.now());
        console.debug("Processing image", filename, "params", width, height, fit, format);

        if (!filename) {
            throw new Error("missing image filename");
        }

        if (!baseUrl) {
            throw new Error("No baseUrl configured");
        }

        console.debug("Fetch image", `${process.env.BASE_IMAGE_URL}${filename}`);
        const response = await fetch(`${process.env.BASE_IMAGE_URL}${filename}`);

        if (!response.ok) {
            throw new Error("404 Not found");
        }

        performance.mark("fetch_image");
        const fetchImageTiming = performance.measure("fetch_image", "start", "fetch_image");
        console.debug("Fetch image stream", "timing", fetchImageTiming.duration);

        const stream = Readable.fromWeb(response.body as any);

        if (!(stream instanceof Readable)) {
            throw new Error("stream is not readable");
        }

        const transformer = Sharp();

        if (width && height) {
            transformer.resize(parseInt(width, 10), parseInt(height, 10), {
                fit,
            });
        }

        switch (format) {
            case "jpeg":
                transformer.jpeg({ quality: 80 }).toFormat(format);
                break;
            case "webp":
                transformer.webp({ quality: 80 }).toFormat(format);
                break;
            case "png":
                transformer.png({ quality: 80 }).toFormat(format);
                break;
            case "avif":
                transformer.avif({ quality: 80 }).toFormat(format);
                break;
            default:
                throw new Error(`Unsupported format ${format}`);
        }

        transformer.on("info", (image) => {
            console.log(`Image height is ${image.height}`);
        });

        responseStream.setContentType(`image/${format}`);

        stream.pipe(transformer).pipe(responseStream);
    } catch (err) {
        console.log(err);
        responseStream.setContentType("text/plain");
        responseStream.write("Error: " + (err as Error).message);
        responseStream.end();
    }
});
