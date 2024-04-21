import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import Sharp from "sharp";
import { Readable } from "stream";

const client = new S3Client();
const bucket = process.env.S3_BUCKET_NAME;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
        const filename = event.pathParameters?.image;
        const width = event.queryStringParameters?.width;
        const height = event.queryStringParameters?.height;
        const fit = (event.queryStringParameters?.fit ?? "cover") as keyof Sharp.FitEnum;
        const format = (event.queryStringParameters?.format ?? "avif") as keyof Sharp.FormatEnum;

        console.debug("Processing image", filename, "params", width, height, fit, format);

        if (!filename) {
            throw new Error("missing image filename");
        }

        if (!bucket) {
            throw new Error("No bucket configured");
        }

        const response = await client.send(
            new GetObjectCommand({
                Bucket: bucket,
                Key: filename,
            })
        );

        console.debug("Got image from S3", response.ContentType);

        const stream = response.Body;

        if (!(stream instanceof Readable)) {
            throw new Error("stream is not readable");
        }

        const content_buffer = Buffer.concat(await stream.toArray());

        console.debug("Read image from stream", content_buffer.length);

        const sharpInstance = Sharp(content_buffer, { sequentialRead: true });

        console.debug("Sharp instance created from buffer");

        if (width && height) {
            sharpInstance.resize(parseInt(width, 10), parseInt(height, 10), {
                fit,
            });
        }

        console.debug("Resized image", width, height, fit, format);

        let resizedImageBuffer: Buffer;

        switch (format) {
            case "jpeg":
            case "jpg":
                resizedImageBuffer = await sharpInstance.jpeg({ quality: 80 }).toFormat(format).toBuffer();
                break;
            case "webp":
                resizedImageBuffer = await sharpInstance.webp({ quality: 80 }).toFormat(format).toBuffer();
                break;
            case "png":
                resizedImageBuffer = await sharpInstance.png({ quality: 80 }).toFormat(format).toBuffer();
                break;
            case "avif":
                resizedImageBuffer = await sharpInstance.avif({ quality: 80 }).toFormat(format).toBuffer();
                break;
            default:
                throw new Error(`Unsupported format ${format}`);
        }

        console.debug("Resized image", resizedImageBuffer.length);

        return {
            statusCode: 200,
            isBase64Encoded: true,
            headers: {
                "Content-Type": "image/avif",
                "Content-Length": resizedImageBuffer.byteLength.toString(),
                "Cache-Control": "public, max-age=3600, immutable",
            },
            body: resizedImageBuffer.toString("base64"),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: (err as Error).message,
            }),
        };
    }
};
