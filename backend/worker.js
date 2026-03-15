// worker.js
const { Worker, Queue } = require('bullmq');
const Redis = require('ioredis');

// Setup Redis Connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
   maxRetriesPerRequest: null
});

// Export the Queue so the API can push jobs to it
const pushQueue = new Queue('PushNotifications', { connection });

// Define the Worker that executes asynchronously when a job arrives
const worker = new Worker('PushNotifications', async job => {
  console.log(`[Worker] Processing Job ID: ${job.id}`);
  console.log(`[Worker] Payload Data:`, job.data);
  
  // Simulate pushing a Mobile Notification to an iOS/Android device
  // via Firebase Cloud Messaging or Apple APNs
  return new Promise((resolve) => {
    setTimeout(() => {
       console.log(`[Worker] Successfully pushed Geofence/NBO Notification to Anonymous User: ${job.data.anonymousId}`);
       resolve('Push sent');
    }, 2000);
  });
}, { connection });

worker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} completed successfully!`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed with error`, err);
});

module.exports = { pushQueue };
