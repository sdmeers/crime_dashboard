import pandas as pd
import folium
from folium.plugins import FastMarkerCluster
import requests
import json
import xml.etree.ElementTree as ET
import os
from typing import Optional, Tuple
import time

# --- Configuration ---
DATE = "2025-04"
KML_DIR = '/home/sdmeers/Code/crime_data/boundaries/'
OUTPUT_MAP_FILE = 'UK_crime_map_clustered.html'
CACHE_DIR = 'cached_data'   

# --- API Data Fetching ---

def get_api_data(endpoint, params):
    """A helper function to get data from the police API."""
    url = f"https://data.police.uk/api/{endpoint}"
    
    try:
        # The API expects polygon data as POST, not GET
        response = requests.post(url, data=params)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from {url}: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON from {url}. Response was: {response.text}")
        return None

def get_street_crimes(polygon, date, neighbourhood_name) -> Tuple[pd.DataFrame, bool]:
    """Fetches street crime data from the API for a given polygon and returns a DataFrame and whether it was fetched from API."""
    cache_file = os.path.join(CACHE_DIR, f"{neighbourhood_name}_{date}_street.pkl")
    if os.path.exists(cache_file):
        print(f"Loading street crimes for {neighbourhood_name} from cache...")
        return pd.read_pickle(cache_file), False  # False = not from API

    print(f"Fetching street crimes for {neighbourhood_name} from API...")
    params = {'poly': polygon, 'date': date}
    data = get_api_data('crimes-street/all-crime', params)
    if data:
        df = pd.DataFrame(data)
        df['Latitude'] = df['location'].apply(lambda loc: float(loc['latitude']))
        df['Longitude'] = df['location'].apply(lambda loc: float(loc['longitude']))
        df.rename(columns={'category': 'Crime type'}, inplace=True)
    else:
        df = pd.DataFrame()

    df.to_pickle(cache_file)
    return df, True  # True = from API

def get_stop_and_searches(polygon, date, neighbourhood_name) -> Tuple[pd.DataFrame, bool]:
    """Fetches stop and search data from the API for a given polygon and returns a DataFrame and whether it was fetched from API."""
    cache_file = os.path.join(CACHE_DIR, f"{neighbourhood_name}_{date}_stop_and_search.pkl")
    if os.path.exists(cache_file):
        print(f"Loading stop and searches for {neighbourhood_name} from cache...")
        return pd.read_pickle(cache_file), False  # False = not from API

    print(f"Fetching stop and searches for {neighbourhood_name} from API...")
    params = {'poly': polygon, 'date': date}
    data = get_api_data('stops-street', params)
    if data:
        df = pd.DataFrame(data)
        df['Latitude'] = df['location'].apply(lambda loc: float(loc['latitude']))
        df['Longitude'] = df['location'].apply(lambda loc: float(loc['longitude']))
        df.rename(columns={'type': 'Type', 'datetime': 'Date', 'gender': 'Gender',
                           'age_range': 'Age range', 'object_of_search': 'Object of search'},
                  inplace=True)
    else:
        df = pd.DataFrame()

    df.to_pickle(cache_file)
    return df, True  # True = from API

def get_polygon_from_kml(kml_file_path: str) -> Optional[str]:
    """
    Extract polygon coordinates from a KML file and format them for Police UK API.
    
    Args:
        kml_file_path (str): Path to the KML file
        
    Returns:
        str: Formatted coordinate string as "lat,lng:lat,lng:lat,lng"
        None: If no polygon is found or file cannot be parsed
        
    Example:
        >>> get_polygon_from_kml("my_area.kml")
        "52.268,0.543:52.794,0.238:52.130,0.478"
    """
    try:
        # Parse the KML file
        tree = ET.parse(kml_file_path)
        root = tree.getroot()
        
        # KML namespaces (supporting both 2.1 and 2.2)
        kml_ns_22 = {'kml': 'http://www.opengis.net/kml/2.2'}
        kml_ns_21 = {'kml': 'http://earth.google.com/kml/2.1'}
        
        # Find all Polygon elements (handles multiple namespaces and MultiGeometry)
        polygons = root.findall('.//kml:Polygon', kml_ns_22)
        if not polygons:
            polygons = root.findall('.//kml:Polygon', kml_ns_21)
        if not polygons:
            polygons = root.findall('.//kml:MultiGeometry/kml:Polygon', kml_ns_22)
        if not polygons:
            polygons = root.findall('.//kml:MultiGeometry/kml:Polygon', kml_ns_21)
        if not polygons:
            polygons = root.findall('.//Polygon')  # Without namespace as fallback
        
        if not polygons:
            print("No polygon found in KML file")
            return None
        
        # Get the first polygon (you can modify this to handle multiple polygons)
        polygon = polygons[0]
        
        # Find the outer boundary coordinates (try different namespaces)
        outer_boundary = polygon.find('.//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates', kml_ns_22)
        if outer_boundary is None:
            outer_boundary = polygon.find('.//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates', kml_ns_21)
        if outer_boundary is None:
            outer_boundary = polygon.find('.//outerBoundaryIs/LinearRing/coordinates')  # Without namespace
        
        if outer_boundary is None:
            print("No coordinates found in polygon")
            return None
        
        # Extract and parse coordinates
        coords_text = outer_boundary.text.strip()
        coord_pairs = []
        
        # Split coordinates and process each point
        for coord in coords_text.split():
            coord = coord.strip()
            if coord:
                # KML coordinates are in format: longitude,latitude,altitude (altitude optional)
                parts = coord.split(',')
                if len(parts) >= 2:
                    lng = float(parts[0])
                    lat = float(parts[1])
                    # Format as lat,lng for Police UK API
                    coord_pairs.append(f"{lat},{lng}")
        
        # Remove the last coordinate if it's the same as the first (polygon closure)
        if len(coord_pairs) > 1 and coord_pairs[0] == coord_pairs[-1]:
            coord_pairs = coord_pairs[:-1]
        
        # Join with colons as required by Police UK API
        return ':'.join(coord_pairs)
        
    except ET.ParseError as e:
        print(f"Error parsing KML file: {e}")
        return None
    except FileNotFoundError:
        print(f"KML file not found: {kml_file_path}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None
    
# --- Main Script ---

def create_interactive_map():
    """
    Fetches crime and stop-and-search data from the police.uk API for all neighbourhoods in the UK and generates
    an interactive HTML map using Folium.
    """
    print("Starting map generation for all of the UK...")

    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)

    all_street_crimes = []
    all_stop_and_searches = []

    # This list will hold tuples of (kml_file_path, police_force_name or None)
    processing_queue = []

    dir_contents = os.listdir(KML_DIR)
    if not dir_contents:
        print(f"KML directory is empty: {KML_DIR}")
        return

    print("Processing directory of police force subdirectories...")
    for police_force in [d for d in dir_contents if os.path.isdir(os.path.join(KML_DIR, d))]:
        police_force_dir = os.path.join(KML_DIR, police_force)
        for kml_file in [f for f in os.listdir(police_force_dir) if f.endswith('.kml')]:
            processing_queue.append((os.path.join(police_force_dir, kml_file), police_force))

    for kml_file_path, police_force in processing_queue:
        kml_file = os.path.basename(kml_file_path)
        if police_force:
            print(f"Processing {kml_file} in {police_force}...")
        else:
            print(f"Processing {kml_file}...")

        polygon = get_polygon_from_kml(kml_file_path)
        if not polygon:
            print(f"Could not extract polygon from {kml_file}. Skipping.")
            continue

        neighbourhood_name = os.path.splitext(kml_file)[0]
        api_calls_made = False

        street_crimes, from_api_street = get_street_crimes(polygon, DATE, neighbourhood_name)
        if not street_crimes.empty:
            all_street_crimes.append(street_crimes)
        if from_api_street:
            api_calls_made = True

        stop_and_searches, from_api_stop = get_stop_and_searches(polygon, DATE, neighbourhood_name)
        if not stop_and_searches.empty:
            all_stop_and_searches.append(stop_and_searches)
        if from_api_stop:
            api_calls_made = True

        # Only sleep if we made API calls (not cached data)
        if api_calls_made:
            time.sleep(0.1)

    if not all_street_crimes and not all_stop_and_searches:
        print("No data was returned from the API for any neighbourhood. Exiting.")
        return

    street_df = pd.concat(all_street_crimes, ignore_index=True) if all_street_crimes else pd.DataFrame()
    stop_search_df = pd.concat(all_stop_and_searches, ignore_index=True) if all_stop_and_searches else pd.DataFrame()

    if street_df.empty and stop_search_df.empty:
        print("No data was returned from the API. Exiting.")
        return

    if not street_df.empty:
        street_df.dropna(subset=['Latitude', 'Longitude'], inplace=True)
    if not stop_search_df.empty:
        stop_search_df.dropna(subset=['Latitude', 'Longitude'], inplace=True)
    print("Cleaned data by removing rows with missing location information.")

    # Center the map on the UK
    uk_map = folium.Map(location=[54.5, -2.5], zoom_start=6)
    print("Created base map centered on the UK.")

    if not street_df.empty:
        street_crime_layer = folium.plugins.MarkerCluster(name="Street Crimes").add_to(uk_map)
        print(f"Adding {len(street_df)} street crime incidents to the map...")
        for index, row in street_df.iterrows():
            popup_text = f"""
            <b>Crime type:</b> {row['Crime type']}<br>
            <b>Month:</b> {row['month']}<br>
            """
            folium.Marker(
                location=[row['Latitude'], row['Longitude']],
                popup=popup_text
            ).add_to(street_crime_layer)

    if not stop_search_df.empty:
        stop_search_layer = folium.plugins.MarkerCluster(name="Stop and Search").add_to(uk_map)
        print(f"Adding {len(stop_search_df)} stop and search incidents to the map...")
        for index, row in stop_search_df.iterrows():
            popup_text = f"""
            <b>Type:</b> {row['Type']}<br>
            <b>Date:</b> {row['Date']}<br>
            <b>Gender:</b> {row['Gender']}<br>
            <b>Age range:</b> {row['Age range']}<br>
            <b>Object of search:</b> {row['Object of search']}<br>
            """
            folium.Marker(
                location=[row['Latitude'], row['Longitude']],
                popup=popup_text
            ).add_to(stop_search_layer)

    folium.LayerControl().add_to(uk_map)
    print("Added layer control.")

    uk_map.save(OUTPUT_MAP_FILE)
    print(f"\nSuccess! Interactive map has been saved to '{OUTPUT_MAP_FILE}'")
    print("You can now open this file in a web browser to view the map.")

if __name__ == '__main__':
    create_interactive_map()