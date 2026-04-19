require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

async function disableUniformBucketLevelAccess(bucketName) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const storage = new Storage({ credentials, projectId: credentials.project_id });

  await storage.bucket(bucketName).setMetadata({
    iamConfiguration: { uniformBucketLevelAccess: { enabled: false } },
  });

  console.log(`Uniform bucket-level access was disabled for ${bucketName}.`);
}

disableUniformBucketLevelAccess(process.env.GCS_BUCKET_NAME).catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});
