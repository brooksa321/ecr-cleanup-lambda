'use strict';
const AWS = require('aws-sdk');
const ecr = new AWS.ECR();

exports.handler = (event, context, callback) => {

  var repositoryNames = [];

  // Look up all of the repositories
  var request = ecr.describeRepositories({}, function(err, data) {

    // Grab the names and put them in an array
    data.repositories.forEach(function(repo) {
      repositoryNames.push(repo.repositoryName);
    });

    console.log('Found the following repositories', repositoryNames);

    repositoryNames.forEach(function (repositoryName) {

      // List the images available in each repository
      // Note: this lists a max of 100 at a time, but since we only keep the
      // latest 50 releases, eventually you'll get down to 50 with enough
      // passes of this lambda
      ecr.listImages({repositoryName: repositoryName}, function(err, data) {

        var allImageIds = data.imageIds;

        var batchParams = {
          repositoryName: repositoryName,
          imageIds: []
        };
        // Grab the image digest (sha256 hash) of each one in the repo
        data.imageIds.forEach(function (imageId) {
          batchParams.imageIds.push({imageDigest: imageId.imageDigest});
        });

        // Get more detailed data about each image
        ecr.batchGetImage(batchParams, function(err, data) {

          var imagesByTimestamp = {};
          var imagesToKeep = [];
          var imagesToDiscard = [];

          console.log('Found ' + data.images.length + ' images in repository ' + repositoryName);

          // Whittle down all of the data attached to each image to fetch the created date
          // You'd think this would be more straightforward or would be a first class field on the image
          // but sadly that's not the case
          data.images.forEach(function(image) {
            var manifest = JSON.parse(image.imageManifest);
            var imageDetails = JSON.parse(manifest.history[0].v1Compatibility);

            // Believe it or not, it's possible two images have the same timestamp, so we need to store an array
            if (!imagesByTimestamp[imageDetails.created]) {
              imagesByTimestamp[imageDetails.created] = [];
            }

            imagesByTimestamp[imageDetails.created].push({ digest: image.imageId.imageDigest, created: imageDetails.created, tag: image.imageId.imageTag || 'dangling' });
          });

          // Now that we have the images organized by timestamp, sort the timestamps
          var keys = Object.keys(imagesByTimestamp);
          keys.sort();

          while (keys.length > 0) {
            var timestamp = keys.pop();
            imagesByTimestamp[timestamp].forEach(function(image) {
              // As long as it's not a dangling image or marked as a pull request (PR) artifact
              if (imagesToKeep.length < 50 && image.tag !== 'dangling' && image.tag.indexOf('PR') === -1) {
                imagesToKeep.push(image);
              }
              else {
                // Otherwise we'll want to delete it
                imagesToDiscard.push(image);
              }
            });
          }

          console.log('[' + repositoryName + '] Keeping ' + imagesToKeep.length + ' images', imagesToKeep);
          console.log('[' + repositoryName + '] Discarding ' + imagesToDiscard.length + ' images', imagesToDiscard);

          if (imagesToDiscard.length) {
            var deleteParams = {
              repositoryName: repositoryName,
              imageIds: []
            };
            imagesToDiscard.forEach(function (image) {
              deleteParams.imageIds.push({imageDigest: image.digest});
            });

            ecr.batchDeleteImage(deleteParams, function(err, data) {
              if (err) console.log(err, err.stack);
              else console.log(data);
            });
          }
        });

      });

    });
  });

};
