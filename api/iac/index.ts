#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "./api-stack";
import { WebStack } from "./web-stack";
import * as dotenv from "dotenv";

dotenv.config();

const app = new cdk.App();

new ApiStack(app, "image-processor", {
    env: { account: process.env.AWS_ACCOUNT_ID, region: process.env.AWS_REGION },
});

new WebStack(app, "demo-blog", {
    env: { account: process.env.AWS_ACCOUNT_ID, region: process.env.AWS_REGION },
});
