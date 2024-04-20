import { Context, APIGatewayProxyResult } from "aws-lambda";
import { S3Event } from "aws-lambda";

export const handler = async (event: S3Event, context: Context): Promise<APIGatewayProxyResult> => {
    try {
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
        const params = {
            Bucket: bucket,
            Key: key,
        };

        return {
            statusCode: 200,
            body: JSON.stringify({
                file: key,
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Server error",
            }),
        };
    }
};
