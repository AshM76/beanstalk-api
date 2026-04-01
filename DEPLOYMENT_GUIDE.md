# Beanstalk Deployment & Launch Guide

## Quick Start Deployment

### Prerequisites
- GCP Project with BigQuery, Cloud Run, Cloud Storage
- Node.js 16+
- Flutter SDK (for mobile)
- Angular CLI 12+ (for web)
- Git configured with SSH keys

---

## Backend (API) Deployment

### Step 1: Database Setup

```bash
# 1. Create BigQuery dataset
bq mk --dataset \
  --location=US \
  --description="Beanstalk production database" \
  beanstalk_prod

# 2. Run migrations in order
cd /Users/mehtafam/Downloads/api
for migration in migrations/*.sql; do
  bq query --use_legacy_sql=false < $migration
done

# 3. Verify tables
bq ls -t beanstalk_prod
```

### Step 2: Environment Configuration

```bash
# Create .env.production file
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=8080
BEANSTALK_SERVER_PORT=8080

# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_DATASET_ID=beanstalk_prod
GCP_BUCKET=beanstalk-prod
GCP_SERVICE_ACCOUNT_KEY=/path/to/service-account-key.json

# API Keys
SENDGRID_API_KEY=your-sendgrid-key
ALPACA_API_KEY=your-alpaca-key
ALPACA_SECRET_KEY=your-alpaca-secret

# Database
DATABASE_URL=bigquery://your-project-id/beanstalk_prod

# Auth
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret

# CORS
CORS_ORIGIN=https://beanstalk.example.com

# Email
ADMIN_EMAIL=admin@beanstalk.com
SUPPORT_EMAIL=support@beanstalk.com
EOF

chmod 600 .env.production
```

### Step 3: Build & Deploy

```bash
# Install dependencies
npm install --production

# Run tests
npm test

# Build
npm run build

# Deploy to Cloud Run
gcloud run deploy beanstalk-api \
  --source . \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 60 \
  --set-env-vars GCP_PROJECT_ID=your-project-id \
  --env-vars-file .env.production

# Get deployed URL
gcloud run services describe beanstalk-api --region us-central1

# Output example:
# Service URL: https://beanstalk-api-xxxxx.a.run.app
```

### Step 4: Verify Deployment

```bash
# Health check
curl https://beanstalk-api-xxxxx.a.run.app/health

# Test age verification endpoint
curl -X POST https://beanstalk-api-xxxxx.a.run.app/api/onboarding/age-verify/self-report \
  -H "Content-Type: application/json" \
  -d '{
    "date_of_birth": "2009-06-15"
  }'

# Expected Response:
# {
#   "verified": true,
#   "age_group": "high_school",
#   "age": 15
# }
```

---

## Mobile App (Flutter) Deployment

### Step 1: Update Configuration

```dart
// lib/src/config/api_config.dart
class ApiConfig {
  static const String baseUrl = 'https://beanstalk-api-xxxxx.a.run.app/api';
  static const String environment = 'production';
}
```

### Step 2: Build APK (Android)

```bash
cd /Users/mehtafam/Downloads/mobile

# Clean
flutter clean

# Get dependencies
flutter pub get

# Build APK for release
flutter build apk --release --target-platform android-arm64

# Output: build/app/outputs/flutter-app.apk

# Sign APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore ~/beanstalk-key.jks \
  build/app/outputs/flutter-app.apk beanstalk_key

# Verify
jarsigner -verify build/app/outputs/flutter-app.apk
```

### Step 3: Build iOS (macOS Required)

```bash
# Build for iOS
flutter build ios --release

# Output: build/ios/iphoneos/Runner.app

# Archive and upload to App Store
# (Requires Xcode and Apple Developer account)
```

### Step 4: Upload to App Stores

**Google Play Store:**
```bash
# Using fastlane
cd /Users/mehtafam/Downloads/mobile/android
fastlane supply init \
  --json_key ~/play-store-key.json \
  --package_name com.beanstalk.mobile

fastlane supply run \
  --apk build/outputs/flutter-app.apk \
  --metadata_path fastlane/metadata
```

**Apple App Store:**
```
Use Xcode or transporter to upload
Product → Archive → Distribute App
```

---

## Web Portal (Angular) Deployment

### Step 1: Update API Endpoint

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  baseUrl: 'https://beanstalk-api-xxxxx.a.run.app/api',
  apiKey: 'your-api-key'
};
```

### Step 2: Build for Production

```bash
cd /Users/mehtafam/Downloads/web

# Install dependencies
npm install --production

# Build
ng build --prod --aot --build-optimizer

# Output: dist/beanstalk-web/

# Verify bundle size
npm run bundle-report
```

### Step 3: Deploy to Google Cloud

```bash
# Deploy to Cloud Run
gcloud run deploy beanstalk-web \
  --source . \
  --region us-central1 \
  --memory 1Gi \
  --cpu 1

# Or deploy to App Engine
gcloud app deploy app.yaml

# Configure custom domain
gcloud run services update beanstalk-web \
  --region us-central1 \
  --set-domain beanstalk.example.com
```

### Step 4: Configure CDN & Caching

```bash
# Create Cloud Storage bucket
gsutil mb gs://beanstalk-web-cdn

# Upload build artifacts
gsutil -m cp -r dist/beanstalk-web/* gs://beanstalk-web-cdn/

# Set up Cloud CDN
gcloud compute backend-buckets create beanstalk-web-backend \
  --gcs-uri-prefix=gs://beanstalk-web-cdn \
  --enable-cdn
```

---

## Post-Deployment Configuration

### 1. Set Up Monitoring & Alerting

```bash
# Create monitoring dashboard
gcloud monitoring dashboards create --config-from-file=monitoring_dashboard.json

# Set up alerts
gcloud alpha monitoring policies create \
  --notification-channels=your-channel-id \
  --display-name="API Error Rate High" \
  --condition-display-name="Error rate > 1%" \
  --condition-threshold-value=1
```

### 2. Configure Logging

```bash
# View API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=beanstalk-api" \
  --limit 50 \
  --format json

# Set up log sink for long-term storage
gcloud logging sinks create beanstalk-logs-archive \
  gs://beanstalk-logs-archive/ \
  --log-filter='resource.type=cloud_run_revision'
```

### 3. Set Up Backups

```bash
# Schedule daily BigQuery exports
gcloud scheduler jobs create app-engine beanstalk-backup \
  --schedule="0 2 * * *" \
  --http-method=POST \
  --uri=https://cloudbuild.googleapis.com/v1/projects/YOUR_PROJECT/triggers/beanstalk-backup/run \
  --oidc-service-account-email=cloud-build@YOUR_PROJECT.iam.gserviceaccount.com

# Or manually export
bq extract --destination_format=NEWLINE_DELIMITED_JSON \
  beanstalk_prod.* \
  gs://beanstalk-backups/backup-$(date +%Y%m%d)/
```

---

## Launch Checklist

### 48 Hours Before Launch

- [ ] All tests passing (API, Mobile, Web)
- [ ] Load testing completed (1000 concurrent users)
- [ ] Security audit complete
- [ ] Database backups tested
- [ ] Disaster recovery plan documented
- [ ] Support team trained
- [ ] Documentation reviewed
- [ ] Monitoring dashboards created
- [ ] Alert thresholds configured
- [ ] On-call rotation scheduled

### 24 Hours Before Launch

- [ ] API deployed to production
- [ ] Database migrations verified
- [ ] Mobile app submitted to stores
- [ ] Web portal deployed
- [ ] DNS records updated
- [ ] SSL certificates verified
- [ ] CDN warmed up
- [ ] Support documentation finalized
- [ ] Admin accounts created
- [ ] Test user accounts ready

### Launch Day (T Minus 30 Minutes)

```bash
# Final health checks
curl -s https://beanstalk-api.example.com/health | jq .
curl -s https://beanstalk.example.com/health | jq .

# Check database connectivity
bq ls -t beanstalk_prod

# Verify monitoring dashboards
gcloud monitoring dashboards list

# Confirm alert emails work
gcloud logging write test-log "Launch health check" --severity=INFO
```

### Launch

1. **T-0:00** - Announce on social media, email
2. **T+0:15** - Monitor signup completion rate
3. **T+0:30** - Check API error rate
4. **T+1:00** - Verify age verification success rate
5. **T+2:00** - Check mobile app crashes
6. **T+4:00** - Review first day metrics

### Post-Launch Monitoring (First 48 Hours)

```bash
# API Metrics
gcloud monitoring time-series list --filter='metric.type:run.googleapis.com/request_count'
gcloud monitoring time-series list --filter='metric.type:run.googleapis.com/request_latencies'

# Error tracking
gcloud logging read "severity>=ERROR" --limit=10 --format=json

# Database performance
bq query --use_legacy_sql=false '
  SELECT
    creation_time,
    SUM(total_slot_ms) as total_slot_ms,
    COUNT(*) as query_count
  FROM `beanstalk_prod.region-us.INFORMATION_SCHEMA.JOBS_BY_CREATION_TIME`
  WHERE DATE(creation_time) = CURRENT_DATE()
  GROUP BY creation_time
'

# User signups
bq query --use_legacy_sql=false '
  SELECT
    DATE(user_account_created_at) as signup_date,
    COUNT(*) as signups,
    SUM(CASE WHEN user_age_verified THEN 1 ELSE 0 END) as verified
  FROM `beanstalk_prod.user`
  WHERE user_account_created_at >= TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL -48 HOUR)
  GROUP BY signup_date
  ORDER BY signup_date DESC
'
```

---

## Rollback Procedures

### If Critical Bug Found

```bash
# Option 1: Rollback to Previous Version
gcloud run deploy beanstalk-api \
  --region us-central1 \
  --image gcr.io/YOUR_PROJECT/beanstalk-api:previous-tag

# Option 2: Restore from Backup
bq cp -f beanstalk_prod_backup.* beanstalk_prod

# Option 3: Disable New Features
# Kill traffic to new endpoints via load balancer config
gcloud compute url-maps update beanstalk-api-lb \
  --default-service=beanstalk-api-v1-backend
```

### Mobile App Rollback

```bash
# Disable new version on Google Play
# In Google Play Console:
# 1. Release management → Production
# 2. Select latest release
# 3. Click "Pause release"
# 4. Re-publish previous version

# Or force update from API
POST /api/admin/force-app-update
{
  "min_version": "1.0.0",
  "latest_version": "1.0.0"
}
```

---

## Success Metrics (First 30 Days)

| Metric | Target | Critical |
|--------|--------|----------|
| API Uptime | > 99.9% | < 99% |
| Average Response Time | < 500ms | > 2s |
| Mobile App Crash Rate | < 0.1% | > 1% |
| Age Verification Success | > 95% | < 90% |
| User Signup Completion | > 80% | < 60% |
| Contest Participation | > 10% | < 5% |
| Zero Data Loss | 100% | Any loss |

---

## Support & Escalation

### Support Team Structure
```
Level 1: Chat/Email Support
  - Handle general questions
  - Troubleshoot common issues
  - Route to Level 2

Level 2: Engineering Support
  - Debug complex issues
  - Database queries
  - API investigation
  - Route to Level 3

Level 3: Emergency Response
  - Major outages
  - Data corruption
  - Security incidents
  - Production hotfixes
```

### On-Call Rotation (First Week)
```
US Pacific: 9 AM - 5 PM
US Eastern: 9 AM - 9 PM
Europe: 9 AM - 7 PM (1 person)
24x7 Emergency: 1 person
```

---

## Documentation Links

- [API Documentation](./API_DOCS.md)
- [Mobile App Guide](./MOBILE_GUIDE.md)
- [Web Portal Guide](./WEB_PORTAL_GUIDE.md)
- [Admin Procedures](./ADMIN_PROCEDURES.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

## Launch Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | _______ | _______ | _______ |
| Product Manager | _______ | _______ | _______ |
| DevOps Lead | _______ | _______ | _______ |
| Security Lead | _______ | _______ | _______ |
| Launch Manager | _______ | _______ | _______ |

**Launch Date: May 1, 2024**
**Launch Time: 9:00 AM PT**

---
