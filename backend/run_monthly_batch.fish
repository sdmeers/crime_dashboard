#!/usr/bin/env fish

# Navigate to the backend directory where the python script and uv.lock live
cd /home/sdmeers/OneDrive/Steve/Code/crime_data/backend

# Set environment variables for production upload using fish syntax
set -x APP_ENV production
set -x GCS_BUCKET_NAME crime-dashboard-stats-data-sdm-1
set -x GOOGLE_APPLICATION_CREDENTIALS /home/sdmeers/laptop-uploader-key.json

# Cron jobs often have a minimal PATH. Using the absolute path to 'uv' ensures it runs smoothly.
/home/sdmeers/.local/bin/uv run batch_processor.py
