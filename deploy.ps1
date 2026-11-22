# Deploy script for Serverless Website Uptime Monitor
$region = "ap-southeast-2"
$bucketName = "uptime-monitor-134911380977-syd"
$email = "vrundjotania20@gmail.com"
$functionName = "website-uptime-checker"
$roleName = "website-uptime-monitor-lambda-role"
$ruleName = "uptime-monitor-5min-trigger"
$topicName = "website-uptime-alerts"

Write-Host "=== Deploying Serverless Website Uptime Monitor ===" -ForegroundColor Cyan

# 1. Zip Lambda code
$zipPath = "$env:TEMP\uptime-lambda.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$PSScriptRoot\lambda\index.mjs" -DestinationPath $zipPath -Force
Write-Host "1. Packaged Lambda code into $zipPath"

# 2. Update Lambda code
Write-Host "2. Updating Lambda code in AWS..."
aws lambda update-function-code --function-name $functionName --zip-file "fileb://$zipPath" --region $region

# 3. Upload frontend files to S3
Write-Host "3. Uploading frontend assets to S3 bucket $bucketName..."
aws s3 cp "$PSScriptRoot\frontend\index.html" "s3://$bucketName/index.html" --content-type "text/html" --cache-control "no-cache"
aws s3 cp "$PSScriptRoot\frontend\style.css" "s3://$bucketName/style.css" --content-type "text/css" --cache-control "no-cache"
aws s3 cp "$PSScriptRoot\frontend\app.js" "s3://$bucketName/app.js" --content-type "application/javascript" --cache-control "no-cache"

# 4. Trigger test run
Write-Host "4. Triggering test run..."
aws lambda invoke --function-name $functionName --region $region "$env:TEMP\lambda_out.json" | Out-Null

$websiteUrl = "http://$bucketName.s3-website-$region.amazonaws.com"
Write-Host "`n Deployment complete!" -ForegroundColor Green
Write-Host "Live Website URL: $websiteUrl" -ForegroundColor Yellow

