import requests
import zipfile
import io
import pandas as pd
import json
import os
from collections import defaultdict

def get_latest_month():
    print("Fetching available dates...")
    r = requests.get("https://data.police.uk/api/crimes-street-dates")
    r.raise_for_status()
    data = r.json()
    return data[0]['date']

def download_and_process_month(month: str):
    url = f"https://policeuk-data.s3.amazonaws.com/archive/{month}.zip"
    print(f"Downloading bulk data for {month} from {url}...")
    
    from datetime import datetime
    from dateutil.relativedelta import relativedelta
    
    # Calculate the 12 month window
    latest_date = datetime.strptime(month, "%Y-%m")
    twelve_months = [(latest_date - relativedelta(months=i)).strftime("%Y-%m") for i in range(11, -1, -1)]
    print(f"Aggregating trend data for {len(twelve_months)} months: {twelve_months[0]} to {twelve_months[-1]}")
    
    # We download to a temporary file
    zip_path_persistent = f"{month}_bulk.zip"
    if not os.path.exists(zip_path_persistent):
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(zip_path_persistent, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
    
    print("Extracting and parsing CSVs...")
    
    # KPIs for the LATEST MONTH ONLY
    latest_total_crimes = 0
    latest_crime_types = defaultdict(int)
    latest_force_counts = defaultdict(int)
    latest_funnel_stages = {
        "Under Investigation (Active)": 0,
        "No Suspect Identified (Case Closed)": 0,
        "Prosecution Not Possible": 0,
        "Out-of-Court Resolution": 0,
        "Formal Court Action": 0
    }
    
    # Trend Data for the LAST 12 MONTHS
    # Structure: trends_data[month][crime_type] = count
    # 'Total' is also a key
    trends_data = {m: defaultdict(int) for m in twelve_months}
    
    def map_outcome(outcome_str: str) -> str:
        if not outcome_str or pd.isna(outcome_str):
            return None
        o = outcome_str.strip()
        if o in ['Under investigation', 'Status update unavailable']:
            return "Under Investigation (Active)"
        elif o == 'Investigation complete; no suspect identified':
            return "No Suspect Identified (Case Closed)"
        elif o in ['Unable to prosecute suspect', 'Formal action is not in the public interest', 'Further investigation is not in the public interest', 'Further action is not in the public interest', 'Action to be taken by another organisation']:
            return "Prosecution Not Possible"
        elif o in ['Local resolution', 'Offender given a caution', 'Offender given a penalty notice', 'Offender given a drugs possession warning']:
            return "Out-of-Court Resolution"
        else:
            return "Formal Court Action"

    with zipfile.ZipFile(zip_path_persistent, 'r') as z:
        # Get all street CSVs
        street_csvs = [f for f in z.namelist() if f.endswith('-street.csv')]
        
        total_files = len(street_csvs)
        for i, file in enumerate(street_csvs):
            if i % 50 == 0:
                print(f"Processing file {i+1}/{total_files}: {file}")
                
            # Filename format: '2024-04/2024-04-metropolitan-street.csv'
            parts = file.split('/')[-1].split('-')
            file_month = f"{parts[0]}-{parts[1]}"
            force_name = "-".join(parts[2:-1]).replace('-street.csv', '')
            
            # Skip if not in our 12 month window
            if file_month not in twelve_months:
                continue
                
            is_latest = (file_month == month)
            
            import csv
            import re
            with z.open(file) as f:
                text_stream = io.TextIOWrapper(f, encoding='utf-8')
                reader = csv.DictReader(text_stream)
                
                # Check headers
                has_crime_type = 'Crime type' in reader.fieldnames
                has_outcome = 'Last outcome category' in reader.fieldnames
                
                for row in reader:
                    trends_data[file_month]['Total'] += 1
                    trends_data[file_month][f"force:{force_name}"] += 1
                    
                    if has_crime_type:
                        c_type = row.get('Crime type')
                        if c_type:
                            c_type_formatted = re.sub(r'\b\w', lambda m: m.group(0).upper(), c_type.replace('-', ' '))
                            trends_data[file_month][c_type_formatted] += 1
                            
                    if is_latest:
                        latest_total_crimes += 1
                        latest_force_counts[force_name] += 1
                        
                        if has_crime_type and c_type:
                            latest_crime_types[c_type] += 1
                            
                        if has_outcome:
                            out = row.get('Last outcome category')
                            mapped = map_outcome(out)
                            if mapped:
                                latest_funnel_stages[mapped] += 1
                            
    # Prepare JSON output
    crime_types_list = [{"name": k, "count": v} for k, v in sorted(latest_crime_types.items(), key=lambda item: item[1], reverse=True)]
    
    outcomes_list = [
        {"name": "Under Investigation (Active)", "count": latest_funnel_stages["Under Investigation (Active)"]},
        {"name": "No Suspect Identified (Case Closed)", "count": latest_funnel_stages["No Suspect Identified (Case Closed)"]},
        {"name": "Prosecution Not Possible", "count": latest_funnel_stages["Prosecution Not Possible"]},
        {"name": "Out-of-Court Resolution", "count": latest_funnel_stages["Out-of-Court Resolution"]},
        {"name": "Formal Court Action", "count": latest_funnel_stages["Formal Court Action"]}
    ]
    
    # Load populations
    populations = {}
    if os.path.exists("populations.json"):
        with open("populations.json", "r") as f:
            populations = json.load(f)

    force_counts_list = []
    for k, v in sorted(latest_force_counts.items(), key=lambda item: item[1], reverse=True):
        rate = None
        if k in populations and k != 'city-of-london':
            rate = round((v / populations[k]) * 1000, 2)
            
        force_counts_list.append({
            "id": k,
            "name": k.replace('-', ' ').title(),
            "count": v,
            "rate_per_1000": rate
        })
    
    # Trends array
    trends_array = []
    for m in twelve_months:
        trend_obj = {"month": m}
        trend_obj.update(trends_data[m])
        trends_array.append(trend_obj)

    # Clean up zip
    if os.path.exists(zip_path_persistent):
        os.remove(zip_path_persistent)
    
    stats = {
        "month": month,
        "total_crimes": latest_total_crimes,
        "crime_types": crime_types_list,
        "outcomes": outcomes_list,
        "force_counts": force_counts_list,
        "trends": trends_array,
        "populations": populations
    }
    
    with open("stats.json", "w") as f:
        json.dump(stats, f, indent=2)
        
    print("Done! Saved to stats.json")

def upload_to_gcs(file_path: str, bucket_name: str, destination_blob_name: str):
    """Uploads a file to the bucket."""
    from google.cloud import storage
    
    print(f"Uploading {file_path} to gs://{bucket_name}/{destination_blob_name}...")
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)
    
    # Set cache control to a short duration or no-cache since this updates monthly
    blob.cache_control = "public, max-age=3600" 
    blob.upload_from_filename(file_path)

    print(f"File {file_path} uploaded to {destination_blob_name}.")

if __name__ == "__main__":
    latest = get_latest_month()
    download_and_process_month(latest)
    
    app_env = os.environ.get("APP_ENV", "local")
    gcs_bucket = os.environ.get("GCS_BUCKET_NAME")
    
    if app_env == "production" and gcs_bucket:
        upload_to_gcs("stats.json", gcs_bucket, "stats.json")
    elif app_env == "production" and not gcs_bucket:
        print("Warning: APP_ENV is production but GCS_BUCKET_NAME is not set. Skipping upload.")
    else:
        print("Running in local mode. Skipping GCS upload.")

