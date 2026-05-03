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
    
    # We download to a temporary file
    zip_path = f"{month}_bulk.zip"
    if not os.path.exists(zip_path):
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(zip_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
    
    print("Extracting and parsing CSVs...")
    
    # We will aggregate data
    total_crimes = 0
    crime_types = defaultdict(int)
    outcomes = defaultdict(int)
    force_counts = defaultdict(int)
    
    with zipfile.ZipFile(zip_path, 'r') as z:
        # Get all street CSVs
        street_csvs = [f for f in z.namelist() if f.endswith('-street.csv')]
        
        for file in street_csvs:
            # e.g., '2024-04/2024-04-metropolitan-street.csv'
            # Extract force name from filename
            parts = file.split('/')[-1].split('-')
            # '2024', '04', 'metropolitan', 'street.csv'
            force_name = "-".join(parts[2:-1]).replace('-street.csv', '')
            
            with z.open(file) as f:
                df = pd.read_csv(f, usecols=['Crime type', 'Last outcome category'])
                
                total_crimes += len(df)
                force_counts[force_name] += len(df)
                
                # Aggregate crime types
                if 'Crime type' in df.columns:
                    type_counts = df['Crime type'].value_counts()
                    for c_type, count in type_counts.items():
                        crime_types[c_type] += int(count)
                
                # Aggregate outcomes
                if 'Last outcome category' in df.columns:
                    outcome_counts = df['Last outcome category'].value_counts()
                    for out, count in outcome_counts.items():
                        if pd.notna(out):
                            outcomes[out] += int(count)
                            
    # Clean up zip
    os.remove(zip_path)
    
    # Prepare JSON output
    # Convert dictionaries to sorted lists for easy frontend parsing
    crime_types_list = [{"name": k, "count": v} for k, v in sorted(crime_types.items(), key=lambda item: item[1], reverse=True)]
    outcomes_list = [{"name": k, "count": v} for k, v in sorted(outcomes.items(), key=lambda item: item[1], reverse=True)]
    force_counts_list = [{"name": k.replace('-', ' ').title(), "count": v} for k, v in sorted(force_counts.items(), key=lambda item: item[1], reverse=True)]
    
    stats = {
        "month": month,
        "total_crimes": total_crimes,
        "crime_types": crime_types_list,
        "outcomes": outcomes_list,
        "force_counts": force_counts_list
    }
    
    with open("stats.json", "w") as f:
        json.dump(stats, f, indent=2)
        
    print("Done! Saved to stats.json")

if __name__ == "__main__":
    latest = get_latest_month()
    download_and_process_month(latest)
