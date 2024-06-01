FROM public.ecr.aws/lambda/nodejs:20 as base

# FROM base as build

RUN corepack enable 
RUN corepack prepare pnpm@latest --activate
RUN corepack use pnpm@latest

# Copy function code
COPY dist/resizeImageFromUrl.mjs ${LAMBDA_TASK_ROOT}
RUN pnpm install sharp
RUN pnpm --config.platform=linux rebuild sharp

ENV NODE_ENV=production
ENV BASE_IMAGE_URL=https://blog.demo.jharris.nz/uploads/static

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "resizeImageFromUrl.handler" ]

# docker build --platform linux/arm64 -t docker-image:image-processor .
# docker run --platform linux/arm64 -p 9000:8080 docker-image:image-processor
# curl "http://localhost:9000/2015-03-31/functions/function/invocations" -d @test/lambda/request.json -o file.jpg
