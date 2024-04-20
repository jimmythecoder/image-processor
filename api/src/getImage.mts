import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import Sharp from "sharp";
import { Readable } from "stream";

const client = new S3Client();
const bucket = process.env.S3_BUCKET_NAME;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
        const filename = event.pathParameters?.image;

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

        const stream = response.Body;

        if (!(stream instanceof Readable)) {
            throw new Error("stream is not readable");
        }

        const content_buffer = Buffer.concat(await stream.toArray());

        const instance = await Sharp(content_buffer).resize(100, 100, {
            fit: "cover",
        });

        const resizedImageBuffer = await instance.avif({ quality: 80 }).toFormat("avif").toBuffer();

        return {
            statusCode: 200,
            isBase64Encoded: true,
            headers: {
                "Content-Type": "image/avif",
                "Content-Length": resizedImageBuffer.byteLength.toString(),
                // "Content-Disposition": `attachment; filename="sharky.avif`,
            },
            body: resizedImageBuffer.toString("base64"),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Something went wrong.",
            }),
        };
    }
};
