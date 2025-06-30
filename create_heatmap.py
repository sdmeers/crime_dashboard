

import pandas as pd
import folium
from folium.plugins import HeatMap
import os
import glob

# --- Configuration ---
CACHE_DIR = 'cached_data'
OUTPUT_MAP_FILE = 'UK_crime_heatmap.html'

def create_heatmap():
    """
    Loads all cached crime data (not stop and search) and creates a heatmap overlay on a map of the UK.
    """
    print("Starting heatmap generation...")

    if not os.path.exists(CACHE_DIR):
        print(f"Cache directory not found: {CACHE_DIR}")
        return

    # Find all street crime pickle files
    cache_files = glob.glob(os.path.join(CACHE_DIR, '*_street.pkl'))

    if not cache_files:
        print("No cached street crime data found.")
        return

    all_crimes = []
    print(f"Loading data from {len(cache_files)} cached files...")
    for file in cache_files:
        try:
            df = pd.read_pickle(file)
            all_crimes.append(df)
        except Exception as e:
            print(f"Error loading {file}: {e}")

    if not all_crimes:
        print("No data could be loaded from cached files.")
        return

    crime_df = pd.concat(all_crimes, ignore_index=True)
    print(f"Loaded a total of {len(crime_df)} crime records.")

    # Drop rows with missing location data
    crime_df.dropna(subset=['Latitude', 'Longitude'], inplace=True)
    print("Cleaned data by removing rows with missing location information.")

    # Center the map on the UK
    uk_map = folium.Map(location=[54.5, -2.5], zoom_start=6)
    print("Created base map centered on the UK.")

    # Create a list of lat/lon pairs for the heatmap
    heat_data = [[row['Latitude'], row['Longitude']] for index, row in crime_df.iterrows()]

    # Add the heatmap layer with adjusted opacity
    HeatMap(heat_data, min_opacity=0.3).add_to(uk_map)
    print("Added heatmap layer to the map.")

    # Save the map
    uk_map.save(OUTPUT_MAP_FILE)
    print(f"\nSuccess! Interactive heatmap has been saved to '{OUTPUT_MAP_FILE}'")
    print("You can now open this file in a web browser to view the map.")

if __name__ == '__main__':
    create_heatmap()

