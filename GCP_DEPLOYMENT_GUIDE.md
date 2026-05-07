# GCP Architecture & Deployment Guide

This document outlines the architecture, design decisions, and management commands for the UK Crime Dashboard, which has been deployed to Google Cloud Platform (GCP) using a strict "Zero-to-Low Cost" strategy.

## 1. Architecture & Design Strategy

The application uses a hybrid cloud architecture designed to leverage GCP's Always Free tier while keeping heavy data processing on local hardware.

### Key Components
*   **Local Batch Processing (Fedora):**
    *   **Why:** Processing gigabytes of raw Police.uk CSV data in the cloud requires significant memory and compute time, which incurs costs.
    *   **How:** A local `systemd` timer runs `batch_processor.py` on the 28th of every month. It downloads the data, processes it locally, and pushes a lightweight `stats.json` summary to Google Cloud Storage.
*   **Backend (FastAPI on Cloud Run):**
    *   **Why:** Serverless compute that scales to zero when not in use. The free tier provides 2 million requests per month.
    *   **How:** The API handles on-the-fly requests for geographical areas. It uses an environment-based factory (`FirestoreCache`) to store Police.uk API responses persistently across ephemeral Cloud Run instances.
*   **Database (Firestore Native):**
    *   **Why:** Free tier includes 50,000 reads and 20,000 writes per day. 
    *   **How:** Replaces the local SQLite database. It caches API responses. A Time-To-Live (TTL) index automatically cleans up expired cache documents (`expires_at` field) to prevent storage bloat.
*   **Storage (Google Cloud Storage):**
    *   **Why:** Highly available storage for the static `stats.json` file. Free tier includes 5GB.
    *   **How:** The frontend fetches the pre-computed stats directly from a public GCS bucket, entirely bypassing the FastAPI backend to save Cloud Run invocations and reduce latency.
*   **Frontend (React/Vite on Firebase Hosting):**
    *   **Why:** Free global CDN, custom domains, and automatic SSL. Free tier includes 10GB storage and 360MB/day transfer.

---

## 2. Deployment Details

*   **GCP Project ID:** `mvp-demos-sdm-1`
*   **Frontend URL (Firebase):** [https://mvp-demos-sdm-1.web.app](https://mvp-demos-sdm-1.web.app)
*   **Backend API URL (Cloud Run):** `https://crime-dashboard-backend-1045084761448.europe-west2.run.app`
*   **Public Storage Bucket:** `crime-dashboard-stats-data-sdm-1`
*   **Service Account (for Local Uploads):** `laptop-uploader@mvp-demos-sdm-1.iam.gserviceaccount.com`
*   **Local Credential File:** `~/.config/crime-data/key.json`

---

## 3. Local Batch Automation (systemd)

Your local laptop automatically runs the monthly batch processor. Since it's a laptop, we use `systemd` timers (with `Persistent=true`) instead of `cron`, ensuring the script runs as soon as you boot up if you missed the 3:00 AM / 10:00 AM schedule.

*   **Timer Configuration:** `~/.config/systemd/user/crime-data-batch.timer`
*   **Service Configuration:** `~/.config/systemd/user/crime-data-batch.service`
*   **Execution Script:** `backend/run_monthly_batch.fish`
*   **Schedule:** 28th of every month at 10:00 AM.

**Management Commands:**
```bash
# Check timer status and next run time
systemctl --user status crime-data-batch.timer

# View logs of past runs
journalctl --user -u crime-data-batch.service
```

---

## 4. Day-to-Day Management Commands

Ensure you are logged in and targeting the correct project before running these:
```bash
gcloud config set project mvp-demos-sdm-1
firebase use mvp-demos-sdm-1
```

### Deploying Frontend Updates
If you change the React code in `frontend/src`:
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### Deploying Backend Updates
If you change the FastAPI code in `backend/`:
```bash
cd backend
gcloud run deploy crime-dashboard-backend \
  --source . \
  --region europe-west2 \
  --allow-unauthenticated \
  --max-instances 2 \
  --memory 256Mi \
  --set-env-vars="APP_ENV=production,PUBLIC_STATS_URL=https://storage.googleapis.com/crime-dashboard-stats-data-sdm-1/stats.json,FIREBASE_HOSTING_URL=https://mvp-demos-sdm-1.web.app"
```

### Viewing Logs
```bash
# View Cloud Run backend logs
gcloud run services logs tail crime-dashboard-backend --region europe-west2
```

---

## 5. Cost Management: Artifact Registry Cleanup

**CRITICAL:** Every time you deploy the backend, GCP builds a Docker image and stores it in Artifact Registry. The free tier limits Artifact Registry storage to **500MB**. If you deploy frequently, you will exceed this limit and incur a few cents of storage fees.

You should periodically delete old image versions:

```bash
# List all repositories
gcloud artifacts repositories list --location=europe-west2

# List images in the Cloud Run source deploy repository
gcloud artifacts docker images list europe-west2-docker.pkg.dev/mvp-demos-sdm-1/cloud-run-source-deploy/crime-dashboard-backend

# Delete an old image (replace the digest with the actual hash)
gcloud artifacts docker images delete europe-west2-docker.pkg.dev/mvp-demos-sdm-1/cloud-run-source-deploy/crime-dashboard-backend@sha256:YOUR_OLD_IMAGE_HASH_HERE --delete-tags
```

---

## 6. Teardown / Project Deletion

If you want to completely remove the application and stop any potential future billing, the easiest and safest method is to delete the entire GCP project. This will permanently destroy the Cloud Run service, Firestore database, Cloud Storage buckets, and Firebase Hosting.

```bash
# SHUT DOWN EVERYTHING
gcloud projects delete mvp-demos-sdm-1
```
*Note: Project deletion takes up to 30 days to fully purge from Google's systems, but all billing and serving stops immediately.*

You can also disable the local timer to prevent it from failing while trying to upload:
```bash
systemctl --user disable --now crime-data-batch.timer
```