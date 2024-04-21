import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class ApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.tags.setTag("app", id);
        this.tags.setTag("awsApplication", process.env.AWS_APPLICATION_ARN!);
        this.tags.setTag("AppManagerCFNStackKey", this.stackName);

        const bucket = new cdk.aws_s3.Bucket(this, `${id}-bucket`, {
            publicReadAccess: false,
            blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
            bucketName: process.env.S3_BUCKET_NAME,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        const apiHandler = new cdk.aws_lambda_nodejs.NodejsFunction(this, `${id}-lambda`, {
            entry: `./src/getImage.mts`,
            functionName: `${id}-api`,
            description: `Image API`,
            tracing: cdk.aws_lambda.Tracing.DISABLED,
            memorySize: 8192,
            timeout: cdk.Duration.seconds(30),
            runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
            architecture: cdk.aws_lambda.Architecture.ARM_64,
            handler: "handler",
            // adotInstrumentation: {
            //     execWrapper: cdk.aws_lambda.AdotLambdaExecWrapper.REGULAR_HANDLER,
            //     layerVersion: cdk.aws_lambda.AdotLayerVersion.fromJavaScriptSdkLayerVersion(cdk.aws_lambda.AdotLambdaLayerJavaScriptSdkVersion.LATEST),
            // },
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

        bucket.grantReadWrite(apiHandler);

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
            path: "/assets/images/{image}",
            methods: [cdk.aws_apigatewayv2.HttpMethod.GET],
            integration: new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration("get-image", apiHandler),
        });

        new cdk.aws_route53.ARecord(this, `${id}-route53-arecord`, {
            zone,
            target: cdk.aws_route53.RecordTarget.fromAlias(new cdk.aws_route53_targets.ApiGatewayv2DomainProperties(apiDomainName.regionalDomainName, apiDomainName.regionalHostedZoneId)),
            recordName: process.env.API_SUBDOMAIN!,
        });
    }
}
