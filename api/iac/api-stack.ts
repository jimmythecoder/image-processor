import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class ApiStack extends cdk.Stack {
    public ApiFunctionURL: cdk.aws_lambda.FunctionUrl;
    public ApiFunction: cdk.aws_lambda_nodejs.NodejsFunction;
    public bucket: cdk.aws_s3.Bucket;
    public oai: cdk.aws_cloudfront.OriginAccessIdentity;

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        this.tags.setTag("app", id);
        this.tags.setTag("awsApplication", process.env.AWS_APPLICATION_ARN!);
        this.tags.setTag("AppManagerCFNStackKey", this.stackName);

        this.bucket = new cdk.aws_s3.Bucket(this, `${id}-bucket`, {
            publicReadAccess: false,
            blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
            bucketName: process.env.S3_BUCKET_NAME,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        this.oai = new cdk.aws_cloudfront.OriginAccessIdentity(this, `${id}-oai`, {
            comment: `OAI ${process.env.WEB_DOMAIN}`,
        });

        this.bucket.grantRead(this.oai);

        const s3ApiHandler = new cdk.aws_lambda_nodejs.NodejsFunction(this, `${id}-s3-api-lambda`, {
            entry: `./src/resizeImageFromS3Bucket.mts`,
            functionName: `${id}-resize-image-s3-bucket`,
            description: `Image API`,
            tracing: cdk.aws_lambda.Tracing.DISABLED,
            memorySize: 8192,
            timeout: cdk.Duration.seconds(30),
            runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
            architecture: cdk.aws_lambda.Architecture.ARM_64,
            handler: "handler",
            bundling: {
                platform: "node",
                format: cdk.aws_lambda_nodejs.OutputFormat.ESM,
                target: "esnext",
                banner: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
                minify: true,
                externalModules: ["aws-sdk", "@aws-sdk/client-ssm", "sharp"],
                nodeModules: ["sharp"],
                command: ["pnpm --config.platform=linux rebuild sharp"],
            },
            environment: {
                NODE_ENV: "production",
                S3_BUCKET_NAME: process.env.S3_BUCKET_NAME!,
            },
        });

        const streamingApiHandler = new cdk.aws_lambda_nodejs.NodejsFunction(this, `${id}-streaming-api-lambda`, {
            entry: `./src/resizeImageFromUrl.mts`,
            functionName: `${id}-resize-image-from-url`,
            description: `Image API`,
            tracing: cdk.aws_lambda.Tracing.DISABLED,
            memorySize: 8192,
            timeout: cdk.Duration.seconds(30),
            runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
            architecture: cdk.aws_lambda.Architecture.ARM_64,
            handler: "handler",
            bundling: {
                platform: "node",
                format: cdk.aws_lambda_nodejs.OutputFormat.ESM,
                target: "esnext",
                banner: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
                minify: true,
                externalModules: ["aws-sdk", "@aws-sdk/client-ssm", "sharp"],
                nodeModules: ["sharp"],
                command: ["pnpm --config.platform=linux rebuild sharp"],
            },
            environment: {
                NODE_ENV: "production",
                BASE_IMAGE_URL: process.env.BASE_IMAGE_URL!,
            },
        });

        this.ApiFunction = streamingApiHandler;
        this.ApiFunctionURL = streamingApiHandler.addFunctionUrl({
            authType: cdk.aws_lambda.FunctionUrlAuthType.NONE,
            invokeMode: cdk.aws_lambda.InvokeMode.RESPONSE_STREAM,
        });

        this.bucket.grantReadWrite(s3ApiHandler);

        const apiGateway = new cdk.aws_apigatewayv2.HttpApi(this, `${id}-api`, {
            apiName: `${id}-api`,
            description: `Image API`,
            createDefaultStage: false,
        });

        const zone = cdk.aws_route53.HostedZone.fromHostedZoneAttributes(this, `${id}-domain-zone`, {
            hostedZoneId: process.env.ROUTE53_HOSTED_ZONE_ID!,
            zoneName: process.env.ROOT_DOMAIN!,
        });

        const apiCertificate = new cdk.aws_certificatemanager.Certificate(this, `${id}-certificate`, {
            domainName: process.env.ROOT_DOMAIN!,
            subjectAlternativeNames: [process.env.API_DOMAIN!],
            validation: cdk.aws_certificatemanager.CertificateValidation.fromDns(zone),
        });

        const apiDomainName = new cdk.aws_apigatewayv2.DomainName(this, `${id}-domain-name`, {
            domainName: process.env.API_DOMAIN!,
            certificate: apiCertificate,
        });

        apiGateway.addStage("default", {
            autoDeploy: true,
            domainMapping: {
                domainName: apiDomainName,
            },
            throttle: {
                rateLimit: 3,
                burstLimit: 10,
            },
        });

        apiGateway.addRoutes({
            path: "/uploads/resize/{image}",
            methods: [cdk.aws_apigatewayv2.HttpMethod.GET],
            integration: new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration("get-image", s3ApiHandler),
        });

        new cdk.aws_route53.ARecord(this, `${id}-route53-arecord`, {
            zone,
            target: cdk.aws_route53.RecordTarget.fromAlias(new cdk.aws_route53_targets.ApiGatewayv2DomainProperties(apiDomainName.regionalDomainName, apiDomainName.regionalHostedZoneId)),
            recordName: process.env.API_SUBDOMAIN!,
        });
    }
}
