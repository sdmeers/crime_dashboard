import pandas as pd
import folium
from folium.plugins import MarkerCluster
import requests
import json

# --- Configuration ---
# API details for Alton, Hampshire
LATITUDE = 51.150719
LONGITUDE = -0.973177
DATE = "2025-04"
RADIUS_MILES = 1.0 # The API likely uses metric, so we may need to adjust this.

# Output file for the map
OUTPUT_MAP_FILE = 'alton_crime_map.html'

# --- API Data Fetching ---

def get_api_data(endpoint, params):
    """A helper function to get data from the police API."""
    url = f"https://data.police.uk/api/{endpoint}"
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from {url}: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON from {url}. Response was: {response.text}")
        return None


def get_street_crimes(lat, lng, date):
    """Fetches street crime data from the API and returns a DataFrame."""
    params = {'lat': lat, 'lng': lng, 'date': date}
    data = get_api_data('crimes-street/all-crime', params)
    if data:
        df = pd.DataFrame(data)
        # The API returns location as a dictionary, so we need to extract lat/lng
        df['Latitude'] = df['location'].apply(lambda loc: float(loc['latitude']))
        df['Longitude'] = df['location'].apply(lambda loc: float(loc['longitude']))
        df.rename(columns={'category': 'Crime type'}, inplace=True)
        return df
    return pd.DataFrame()


def get_stop_and_searches(lat, lng, date):
    """Fetches stop and search data from the API and returns a DataFrame."""
    params = {'lat': lat, 'lng': lng, 'date': date}
    data = get_api_data('stops-street', params)
    if data:
        df = pd.DataFrame(data)
        df['Latitude'] = df['location'].apply(lambda loc: float(loc['latitude']))
        df['Longitude'] = df['location'].apply(lambda loc: float(loc['longitude']))
        df.rename(columns={'type': 'Type', 'datetime': 'Date', 'gender': 'Gender',
                           'age_range': 'Age range', 'object_of_search': 'Object of search'},
                  inplace=True)
        return df
    return pd.DataFrame()


# --- Main Script ---

def create_interactive_map():
    """
    Fetches crime and stop-and-search data from the police.uk API and generates
    an interactive HTML map using Folium.
    """
    print("Starting map generation...")

    # Load the datasets from the API
    print("Fetching data from the police.uk API...")
    street_df = get_street_crimes(LATITUDE, LONGITUDE, DATE)
    stop_search_df = get_stop_and_searches(LATITUDE, LONGITUDE, DATE)

    if street_df.empty and stop_search_df.empty:
        print("No data was returned from the API. Exiting.")
        return

    # --- Data Cleaning ---
    # The API data should be clean, but we'll keep the checks just in case.
    street_df.dropna(subset=['Latitude', 'Longitude'], inplace=True)
    stop_search_df.dropna(subset=['Latitude', 'Longitude'], inplace=True)
    print("Cleaned data by removing rows with missing location information.")

    # --- Map Creation ---
    # Initialize the map, centered on our area of interest.
    alton_map = folium.Map(location=[LATITUDE, LONGITUDE], zoom_start=14)
    print("Created base map centered on Alton.")

    # --- Add Street Crime Data to the Map ---
    if not street_df.empty:
        street_crime_layer = MarkerCluster(name="Street Crimes").add_to(alton_map)
        print(f"Adding {len(street_df)} street crime incidents to the map...")
        for index, row in street_df.iterrows():
            popup_html = f"""
            <b>Street Crime</b><br>
            <b>Type:</b> {row.get('Crime type', 'N/A')}<br>
            <b>Month:</b> {row.get('month', 'N/A')}
            """
            folium.Marker(
                location=[row['Latitude'], row['Longitude']],
                popup=folium.Popup(popup_html, max_width=300),
                icon=folium.Icon(color='blue', icon='info-sign')
            ).add_to(street_crime_layer)

    # --- Add Stop and Search Data to the Map ---
    if not stop_search_df.empty:
        stop_search_layer = MarkerCluster(name="Stop and Search").add_to(alton_map)
        print(f"Adding {len(stop_search_df)} stop and search incidents to the map...")
        for index, row in stop_search_df.iterrows():
            popup_html = f"""
            <b>Stop and Search</b><br>
            <b>Type:</b> {row.get('Type', 'N/A')}<br>
            <b>Date:</b> {row.get('Date', 'N/A')}<br>
            <b>Gender:</b> {row.get('Gender', 'N/A')}<br>
            <b>Age:</b> {row.get('Age range', 'N/A')}<br>
            <b>Object of search:</b> {row.get('Object of search', 'N/A')}
            """
            folium.Marker(
                location=[row['Latitude'], row['Longitude']],
                popup=folium.Popup(popup_html, max_width=300),
                icon=folium.Icon(color='red', icon='user')
            ).add_to(stop_search_layer)

    # --- Final Touches ---
    folium.LayerControl().add_to(alton_map)
    print("Added layer control.")

    # Save the map to an HTML file
    alton_map.save(OUTPUT_MAP_FILE)
    print(f"\nSuccess! Interactive map has been saved to '{OUTPUT_MAP_FILE}'")
    print("You can now open this file in a web browser to view the map.")


if __name__ == '__main__':
    create_interactive_map()