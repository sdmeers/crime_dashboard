import requests
import pandas as pd
from collections import Counter

# --- 1. Fetch data from the API ---

# Define the location (e.g., around Alton town centre) and date
# For the full dashboard, you'd use the polygon for all of Hampshire.
lat = 51.1488
lng = -0.9713
date = "2025-04" # Note: Using a future date as an example for the current year.

# Construct the API request URL
url = f"https://data.police.uk/api/crimes-street/all-crime?lat={lat}&lng={lng}&date={date}"

try:
    response = requests.get(url)
    response.raise_for_status() # Raises an exception for bad status codes (4xx or 5xx)
    crimes = response.json()

    if crimes:
        # --- 2. Process the data with Pandas ---
        
        # Create a pandas DataFrame
        df = pd.DataFrame(crimes)

        # Extract the crime category name
        df['category_name'] = df['category']

        # --- 3. Perform a simple analysis ---

        # Count the occurrences of each crime category
        crime_counts = df['category_name'].value_counts()

        print(f"Crime breakdown for {date} near Alton:")
        print(crime_counts)

    else:
        print("No crime data found for the specified location and date.")

except requests.exceptions.HTTPError as http_err:
    print(f"HTTP error occurred: {http_err}")
except Exception as err:
    print(f"An other error occurred: {err}")