import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

type Props = cdk.StackProps & {
    ApiFunctionURL: cdk.aws_lambda.FunctionUrl;
    uploadsBucket: cdk.aws_s3.Bucket;
    oai: cdk.aws_cloudfront.OriginAccessIdentity;
};

export class WebStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: Props) {
        super(scope, id, props);

        this.tags.setTag("app", id);
        this.tags.setTag("awsApplication", process.env.AWS_APPLICATION_ARN!);
        this.tags.setTag("AppManagerCFNStackKey", this.stackName);

        const s3Bucket = new cdk.aws_s3.Bucket(this, `${id}-s3-bucket`, {
            bucketName: process.env.WEB_DOMAIN,
            blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const originAccessIdentity = new cdk.aws_cloudfront.OriginAccessIdentity(this, `${id}-oai`, {
            comment: `OAI ${process.env.WEB_DOMAIN}`,
        });

        s3Bucket.grantRead(originAccessIdentity);

        const zone = cdk.aws_route53.HostedZone.fromHostedZoneAttributes(this, `${id}-domain-zone`, {
            hostedZoneId: process.env.ROUTE53_HOSTED_ZONE_ID!,
            zoneName: process.env.ROOT_DOMAIN!,
        });

        const apiStreamingOrigin = new cdk.aws_cloudfront_origins.FunctionUrlOrigin(props.ApiFunctionURL);

        const certificate = cdk.aws_certificatemanager.Certificate.fromCertificateArn(this, `${id}-certificate`, process.env.CERTIFICATE_ARN!);

        const distribution = new cdk.aws_cloudfront.Distribution(this, `${id}-cloudfront`, {
            comment: `CDN for ${process.env.WEB_DOMAIN}`,
            enableLogging: true,
            defaultBehavior: {
                origin: new cdk.aws_cloudfront_origins.S3Origin(s3Bucket, {
                    originAccessIdentity,
                    originShieldEnabled: true,
                    originShieldRegion: process.env.AWS_REGION,
                }),
                functionAssociations: [
                    {
                        eventType: cdk.aws_cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function: new cdk.aws_cloudfront.Function(this, `${id}-cloudfront-viewer-request`, {
                            code: cdk.aws_cloudfront.FunctionCode.fromFile({
                                filePath: "./iac/cloudfront-functions/viewer-request.js",
                            }),
                        }),
                    },
                ],
                allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: new cdk.aws_cloudfront.CachePolicy(this, `${id}-default-cache`, {
                    comment: `Web Cache policy ${process.env.WEB_DOMAIN}`,
                    cookieBehavior: cdk.aws_cloudfront.CacheCookieBehavior.none(),
                    headerBehavior: cdk.aws_cloudfront.CacheHeaderBehavior.none(),
                    queryStringBehavior: cdk.aws_cloudfront.CacheQueryStringBehavior.none(),
                    defaultTtl: cdk.Duration.minutes(5),
                    minTtl: cdk.Duration.minutes(1),
                    maxTtl: cdk.Duration.days(30),
                    enableAcceptEncodingBrotli: true,
                    enableAcceptEncodingGzip: true,
                }),
            },
            additionalBehaviors: {
                "/uploads/static/*": {
                    origin: new cdk.aws_cloudfront_origins.S3Origin(props.uploadsBucket, {
                        originAccessIdentity: props.oai,
                        originShieldEnabled: true,
                        originShieldRegion: process.env.AWS_REGION,
                    }),
                    allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: new cdk.aws_cloudfront.CachePolicy(this, `${id}-uploads-static-assets-cache`, {
                        cookieBehavior: cdk.aws_cloudfront.CacheCookieBehavior.none(),
                        headerBehavior: cdk.aws_cloudfront.CacheHeaderBehavior.none(),
                        queryStringBehavior: cdk.aws_cloudfront.CacheQueryStringBehavior.none(),
                        comment: `Static assets cache policy`,
                        defaultTtl: cdk.Duration.days(30),
                        minTtl: cdk.Duration.days(15),
                        maxTtl: cdk.Duration.days(365),
                        enableAcceptEncodingBrotli: true,
                        enableAcceptEncodingGzip: true,
                    }),
                },
                "/uploads/resize/*": {
                    origin: new cdk.aws_cloudfront_origins.HttpOrigin(process.env.API_DOMAIN!),
                    allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    cachePolicy: new cdk.aws_cloudfront.CachePolicy(this, `${id}-uploads-resize-image-cache`, {
                        cookieBehavior: cdk.aws_cloudfront.CacheCookieBehavior.none(),
                        headerBehavior: cdk.aws_cloudfront.CacheHeaderBehavior.none(),
                        queryStringBehavior: cdk.aws_cloudfront.CacheQueryStringBehavior.allowList("width", "height", "fit", "format"),
                        comment: `S3 image cache policy ${process.env.WEB_DOMAIN}`,
                        defaultTtl: cdk.Duration.days(30),
                        minTtl: cdk.Duration.days(15),
                        maxTtl: cdk.Duration.days(365),
                        enableAcceptEncodingBrotli: true,
                        enableAcceptEncodingGzip: true,
                    }),
                },
                "/uploads/stream/*": {
                    origin: apiStreamingOrigin,
                    allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    originRequestPolicy: cdk.aws_cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                    viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    cachePolicy: new cdk.aws_cloudfront.CachePolicy(this, `${id}-uploads-streaming-image-cache`, {
                        cookieBehavior: cdk.aws_cloudfront.CacheCookieBehavior.none(),
                        headerBehavior: cdk.aws_cloudfront.CacheHeaderBehavior.none(),
                        queryStringBehavior: cdk.aws_cloudfront.CacheQueryStringBehavior.allowList("width", "height", "fit", "format"),
                        comment: `Streaming image cache policy ${process.env.WEB_DOMAIN}`,
                        defaultTtl: cdk.Duration.days(30),
                        minTtl: cdk.Duration.days(15),
                        maxTtl: cdk.Duration.days(365),
                        enableAcceptEncodingBrotli: true,
                        enableAcceptEncodingGzip: true,
                    }),
                },
                "/assets/*": {
                    origin: new cdk.aws_cloudfront_origins.S3Origin(s3Bucket, {
                        originAccessIdentity: originAccessIdentity,
                        originShieldEnabled: true,
                        originShieldRegion: process.env.AWS_REGION,
                    }),
                    allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: new cdk.aws_cloudfront.CachePolicy(this, `${id}-assets-cache`, {
                        cookieBehavior: cdk.aws_cloudfront.CacheCookieBehavior.none(),
                        headerBehavior: cdk.aws_cloudfront.CacheHeaderBehavior.none(),
                        queryStringBehavior: cdk.aws_cloudfront.CacheQueryStringBehavior.none(),
                        comment: `Assets Cache policy ${process.env.WEB_DOMAIN}`,
                        defaultTtl: cdk.Duration.days(30),
                        minTtl: cdk.Duration.days(15),
                        maxTtl: cdk.Duration.days(365),
                        enableAcceptEncodingBrotli: true,
                        enableAcceptEncodingGzip: true,
                    }),
                },
            },
            certificate,
            defaultRootObject: "index.html",
            minimumProtocolVersion: cdk.aws_cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            domainNames: [process.env.WEB_DOMAIN!],
            priceClass: cdk.aws_cloudfront.PriceClass.PRICE_CLASS_ALL,
            httpVersion: cdk.aws_cloudfront.HttpVersion.HTTP2_AND_3,
        });

        new cdk.aws_s3_deployment.BucketDeployment(this, `${id}-s3bucket-deployment`, {
            sources: [cdk.aws_s3_deployment.Source.asset("../dist")],
            destinationBucket: s3Bucket,
            distribution,
            distributionPaths: ["/*"],
            prune: true,
        });

        new cdk.aws_route53.ARecord(this, `${id}-route53-arecord`, {
            zone,
            target: cdk.aws_route53.RecordTarget.fromAlias(new cdk.aws_route53_targets.CloudFrontTarget(distribution)),
            recordName: process.env.WEB_DOMAIN,
        });
    }
}
