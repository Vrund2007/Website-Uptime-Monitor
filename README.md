# Serverless Website Uptime Monitor

A minimalist, beginner-friendly Website Uptime Monitor built using **HTML, CSS, Vanilla JavaScript, and AWS Serverless services**.

---

## 🌐 Live Deployed Dashboard
👉 **Live Website URL:** [http://uptime-monitor-134911380977-syd.s3-website-ap-southeast-2.amazonaws.com](http://uptime-monitor-134911380977-syd.s3-website-ap-southeast-2.amazonaws.com)

👉 **Lambda Function URL (Live API Trigger):** [https://hvqyd3toj3obgotnsqtbvxz54e0cekrg.lambda-url.ap-southeast-2.on.aws/](https://hvqyd3toj3obgotnsqtbvxz54e0cekrg.lambda-url.ap-southeast-2.on.aws/)

---

## 🏗️ Architecture & AWS Services

```
                       ┌────────────────────────┐
                       │   Amazon EventBridge   │
                       │   (Every 5 Minutes)    │
                       └───────────┬────────────┘
                                   │ Triggers
                                   ▼
┌──────────────┐  "Check Now"  ┌──────────────┐  Uploads   ┌───────────────────┐
│              │ ────────────> │  AWS Lambda  │ ─────────> │     Amazon S3     │
│   Browser    │               │  (Node.js)   │  status    │  (Static Website  │
│  Dashboard   │ <──────────── └──────┬───────┘   .json    │   + status.json)  │
│              │  Fetches S3          │                    └─────────┬─────────┘
└──────────────┘  status.json         │ If Down                      │ Serves
       ▲                              ▼                              ▼
       └──────────────────────── Amazon SNS ─────────────────── User Browser
                                (Email Alert)
```

1. **Amazon S3 (`uptime-monitor-134911380977-syd`)**:
   - Hosts static frontend files: `index.html`, `style.css`, `app.js`.
   - Stores `status.json` with the latest uptime results.
2. **AWS Lambda (`website-uptime-checker`)**:
   - Node.js 20.x runtime using native `fetch()`.
   - Concurrently checks 3 predefined websites:
     - `https://www.google.com` (Healthy / Online - HTTP 200)
     - `https://httpbin.org/status/500` (Server Error / Down - HTTP 500)
     - `https://offline-test-website.com` (Connection Failed / Down - Network Unreachable)
   - Writes updated health results to S3 `status.json`.
   - Sends an SNS email alert if any website is down.
3. **Amazon EventBridge (`uptime-monitor-5min-trigger`)**:
   - Triggers the Lambda function on a schedule every 5 minutes (`rate(5 minutes)`).
4. **Amazon SNS (`website-uptime-alerts`)**:
   - Notifies the subscribed administrator email when a website goes down.
5. **Amazon CloudWatch (`/aws/lambda/website-uptime-checker`)**:
   - Stores Lambda execution logs, errors, and metrics.
6. **AWS IAM (`website-uptime-monitor-lambda-role`)**:
   - Grants permissions for CloudWatch Logs (`AWSLambdaBasicExecutionRole`), S3 `PutObject`, and SNS `Publish`.

---

## 📁 Project Structure

```
Website Uptime Monitor/
├── frontend/
│   ├── index.html     # Minimalist dashboard layout
│   ├── style.css      # Clean styling and responsive design
│   └── app.js         # Vanilla JS to fetch status & handle "Check Now"
├── lambda/
│   └── index.mjs      # Node.js 20 Lambda handler (S3 + SNS integration)
├── deploy.ps1         # Complete automated deployment script
└── README.md          # Documentation and configuration guide
```

---

## 🚀 Deployed Resources Details

| Service | Resource Name / Identifier | Region |
|---|---|---|
| **S3 Bucket (Website)** | `uptime-monitor-134911380977-syd` | `ap-southeast-2` |
| **Website Endpoint** | `http://uptime-monitor-134911380977-syd.s3-website-ap-southeast-2.amazonaws.com` | `ap-southeast-2` |
| **Lambda Function** | `website-uptime-checker` | `ap-southeast-2` |
| **Lambda Function URL** | `https://hvqyd3toj3obgotnsqtbvxz54e0cekrg.lambda-url.ap-southeast-2.on.aws/` | `ap-southeast-2` |
| **EventBridge Rule** | `uptime-monitor-5min-trigger` (`rate(5 minutes)`) | `ap-southeast-2` |
| **SNS Topic** | `arn:aws:sns:ap-southeast-2:134911380977:website-uptime-alerts` | `ap-southeast-2` |
| **SNS Subscription** | `vrundjotania20@gmail.com` *(Pending Confirmation email)* | `ap-southeast-2` |
| **IAM Execution Role** | `website-uptime-monitor-lambda-role` | Global |
| **CloudWatch Log Group**| `/aws/lambda/website-uptime-checker` | `ap-southeast-2` |

---

## 📬 Confirming SNS Email Subscription
AWS SNS has dispatched a verification email to `vrundjotania20@gmail.com`:
1. Open your inbox for `vrundjotania20@gmail.com`.
2. Look for the email with the subject: **AWS Notification - Subscription Confirmation**.
3. Click **Confirm subscription**.
4. Future alerts when any site goes down will automatically be delivered to your inbox.

---

## 🛠️ Step-by-Step Deployment Guide (How to Re-deploy)

If you ever wish to re-deploy or deploy to another AWS account, run the PowerShell command:

```powershell
.\deploy.ps1
```

Or execute these manual CLI commands:

### 1. Create S3 Bucket & Configure Static Hosting
```bash
aws s3api create-bucket --bucket <BUCKET_NAME> --region <REGION> --create-bucket-configuration LocationConstraint=<REGION>
aws s3api delete-public-access-block --bucket <BUCKET_NAME>
aws s3api put-bucket-website --bucket <BUCKET_NAME> --website-configuration '{"IndexDocument":{"Suffix":"index.html"}}'
```

### 2. Create SNS Topic & Subscription
```bash
aws sns create-topic --name website-uptime-alerts --region <REGION>
aws sns subscribe --topic-arn <TOPIC_ARN> --protocol email --notification-endpoint <YOUR_EMAIL> --region <REGION>
```

### 3. Create IAM Role
Attach `AWSLambdaBasicExecutionRole` and grant `s3:PutObject` on `<BUCKET_ARN>/*` and `sns:Publish` on `<TOPIC_ARN>`.

### 4. Deploy Lambda Function
```bash
Compress-Archive -Path lambda/index.mjs -DestinationPath function.zip -Force
aws lambda create-function \
  --function-name website-uptime-checker \
  --runtime nodejs20.x \
  --role <ROLE_ARN> \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --environment "Variables={BUCKET_NAME=<BUCKET_NAME>,SNS_TOPIC_ARN=<TOPIC_ARN>}"
```

### 5. Create EventBridge 5-Minute Schedule
```bash
aws events put-rule --name uptime-monitor-5min-trigger --schedule-expression "rate(5 minutes)" --state ENABLED
aws events put-targets --rule uptime-monitor-5min-trigger --targets "Id=1,Arn=<LAMBDA_ARN>"
aws lambda add-permission --function-name website-uptime-checker --statement-id EventBridgeInvoke --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn <RULE_ARN>
```

### 6. Upload Frontend
```bash
aws s3 cp frontend/index.html s3://<BUCKET_NAME>/index.html --content-type text/html
aws s3 cp frontend/style.css s3://<BUCKET_NAME>/style.css --content-type text/css
aws s3 cp frontend/app.js s3://<BUCKET_NAME>/app.js --content-type application/javascript
```

