# Image processor

A modern implementation of an image processor using the fast Sharp library. Built on AWS using Lambda, Streams, Cloudfront CDN caching. 

Can configure an upstream URL as source or a simple S3 bucket, the service will securely fetch the original image, resize and save to modern image formats such as AVIF and stream the result back to the client with HTTP cache where Cloudfront will then store a copy. No need to save multiple versions into your bucket since the CDN will do that for you and for free. 

Written in TypeScript and AWS CDK for infrastructure. Easy to read, clean maintainable code can be deployed to AWS in minutes with zero cost. 

Up to 10x faster than ImageMagick counterparts, super efficient use of streams allowing large images to be resized, 100% serverless and scalable for high availability and demanding workloads. Perfect to support modern web format images with multiple source sets. 

Recommended to use in conjunction with HTML5 Picture element and or img srcsets to deliver the most appropriate format and optimized clients for your clients. 
