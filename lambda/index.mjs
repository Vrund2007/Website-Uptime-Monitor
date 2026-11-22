import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const s3Client = new S3Client({});
const snsClient = new SNSClient({});

// Predefined websites to monitor (mix of healthy online and offline/error test endpoints)
const PREDEFINED_SITES = [
  "https://www.google.com",
  "https://httpbin.org/status/500",
  "https://offline-test-website.com"
];

async function checkSite(url) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Serverless-Website-Uptime-Monitor/1.0"
      }
    });
    const responseTime = Date.now() - startTime;
    const isOnline = response.status >= 200 && response.status < 400;

    return {
      url,
      status: isOnline ? "Online" : "Down",
      statusCode: response.status,
      responseTime,
      error: isOnline ? null : `HTTP ${response.status} ${response.statusText || 'Error'}`
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      url,
      status: "Down",
      statusCode: 0,
      responseTime,
      error: error.message || "Connection Failed"
    };
  }
}

export const handler = async (event) => {
  console.log("Starting uptime checks at", new Date().toISOString());

  // Check all predefined sites concurrently
  const checkPromises = PREDEFINED_SITES.map(url => checkSite(url));
  const results = await Promise.all(checkPromises);

  console.log("Check results:", JSON.stringify(results, null, 2));

  const payload = {
    lastUpdated: new Date().toISOString(),
    sites: results
  };

  const bucketName = process.env.BUCKET_NAME;
  const topicArn = process.env.SNS_TOPIC_ARN;

  // 1. Read previous status from S3 to track newly down websites
  let previousSites = [];
  if (bucketName) {
    try {
      const getRes = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: "status.json"
      }));
      const bodyStr = await getRes.Body.transformToString();
      const prevData = JSON.parse(bodyStr);
      previousSites = prevData.sites || [];
    } catch (e) {
      console.log("No previous status found or unable to read (first run).");
    }
  }

  // 2. Identify sites that are down
  const downSites = results.filter(site => site.status === "Down");
  
  // Alert if a site just transitioned to Down (or first detection)
  const newlyDownSites = downSites.filter(site => {
    const prev = previousSites.find(p => p.url === site.url);
    return !prev || prev.status !== "Down";
  });

  if (newlyDownSites.length > 0 && topicArn) {
    console.log(`Detected ${newlyDownSites.length} newly down site(s). Sending SNS alert...`);
    const siteDetails = newlyDownSites
      .map(s => `• ${s.url} - Status Code: ${s.statusCode || 'N/A'}, Reason: ${s.error || 'Connection Failed'}`)
      .join("\n");

    const message = `Website Uptime Alert!\n\n` +
      `Timestamp: ${payload.lastUpdated}\n\n` +
      `The following website(s) became UNAVAILABLE:\n` +
      `${siteDetails}\n\n` +
      `Please investigate immediately.\n\n` +
      `-- Serverless Website Uptime Monitor`;

    try {
      await snsClient.send(new PublishCommand({
        TopicArn: topicArn,
        Subject: `[ALERT] Website Down: ${newlyDownSites.map(s => s.url).join(", ")}`,
        Message: message
      }));
      console.log("SNS notification sent successfully.");
    } catch (snsError) {
      console.error("Failed to send SNS notification:", snsError);
    }
  }

  // 3. Upload new status to S3
  if (bucketName) {
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: "status.json",
        Body: JSON.stringify(payload, null, 2),
        ContentType: "application/json",
        CacheControl: "no-cache, no-store, must-revalidate"
      }));
      console.log(`Successfully saved status.json to bucket ${bucketName}`);
    } catch (s3Error) {
      console.error("Failed to write status.json to S3:", s3Error);
    }
  }

  // 4. Return JSON response for Function URL / HTTP callers
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(payload)
  };
};
