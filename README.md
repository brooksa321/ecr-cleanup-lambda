# ecr-cleanup-lambda
A lambda for cleaning out dangling and irrelevant images from the AWS ECR

This JavaScript file can be uploaded into AWS Lambda and used to clean up your ECR repository.

A few things are worth calling out though:
1. Right now this is tuned for the organization I work at; you'll probably want to adjust some of the criteria before running it on your own repos (for example, the string `'PR'` might not be what you want to look for)
2. This assumes that images that are missing a tag are implicitly dangling images. Since AWS wraps the Docker APIs, this is a loose constraint, whereas the Docker API has a native identification of an image being considered dangling (i.e. this could change in later versions of ECS)
3. This script keeps the latest 50 images that my organization considers releases. The ECR API fetches 100 at a time, and we're not doing pagination since the assumption is that this runs often enough that there aren't more than 100 images in a single pass.
4. The `batchDeleteImage` call **DOES NOT** have a `dryRun` flag. If you're going to use this I _strongly urge you_ to comment out the call here and check the logging this will generated to make sure things look correct.
5. Since we're using timestamps at my organization, I had to dig into the metadata a bit to find the created date (it surprised me that this didn't appear to be a first class citizen). The `v1Compatibility` object seemed to be the only place I could find this info. If you're reading this and know of another, feel free to open an issue or a PR to fix it.
