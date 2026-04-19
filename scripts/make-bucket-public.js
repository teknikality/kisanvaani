require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

async function makeBucketPublic(bucketName) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const storage = new Storage({ credentials, projectId: credentials.project_id });

  await storage.bucket(bucketName).iam.setPolicy({
    bindings: [
      {
        role: 'roles/storage.objectViewer',
        members: ['allUsers'],
      },
    ],
  });

  console.log(`Bucket ${bucketName} is now publicly readable.`);
}

makeBucketPublic(process.env.GCS_BUCKET_NAME).catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});
