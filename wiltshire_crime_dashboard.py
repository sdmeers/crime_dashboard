

import pandas as pd
import folium
from folium.plugins import FastMarkerCluster, HeatMap
import requests
import json
import xml.etree.ElementTree as ET
import os
from typing import Optional, Tuple
import time
import webbrowser
import base64
from io import BytesIO
import matplotlib.pyplot as plt

# --- Configuration ---
DATES = ["2025-01", "2025-02", "2025-03", "2025-04"]
KML_DIR = '/home/sdmeers/Code/crime_data/boundaries/wiltshire/'
OUTPUT_DASHBOARD_FILE = 'wiltshire_crime_dashboard.html'
CACHE_DIR = 'cached_data'

# --- API Data Fetching ---

def get_api_data(endpoint, params):
    """A helper function to get data from the police API."""
    url = f"https://data.police.uk/api/{endpoint}"
    try:
        response = requests.post(url, data=params)
        response.raise_for_status()
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
        return pd.read_pickle(cache_file), False
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
    return df, True

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
    """Extract polygon coordinates from a KML file and format them for Police UK API."""
    try:
        tree = ET.parse(kml_file_path)
        root = tree.getroot()
        kml_ns_22 = {'kml': 'http://www.opengis.net/kml/2.2'}
        kml_ns_21 = {'kml': 'http://earth.google.com/kml/2.1'}
        polygons = root.findall('.//kml:Polygon', kml_ns_22)
        if not polygons:
            polygons = root.findall('.//kml:Polygon', kml_ns_21)
        if not polygons:
            polygons = root.findall('.//kml:MultiGeometry/kml:Polygon', kml_ns_22)
        if not polygons:
            polygons = root.findall('.//kml:MultiGeometry/kml:Polygon', kml_ns_21)
        if not polygons:
            polygons = root.findall('.//Polygon')
        if not polygons:
            print("No polygon found in KML file")
            return None
        polygon = polygons[0]
        outer_boundary = polygon.find('.//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates', kml_ns_22)
        if outer_boundary is None:
            outer_boundary = polygon.find('.//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates', kml_ns_21)
        if outer_boundary is None:
            outer_boundary = polygon.find('.//outerBoundaryIs/LinearRing/coordinates')
        if outer_boundary is None:
            print("No coordinates found in polygon")
            return None
        coords_text = outer_boundary.text.strip()
        coord_pairs = []
        for coord in coords_text.split():
            coord = coord.strip()
            if coord:
                parts = coord.split(',')
                if len(parts) >= 2:
                    lng = float(parts[0])
                    lat = float(parts[1])
                    coord_pairs.append(f"{lat},{lng}")
        if len(coord_pairs) > 1 and coord_pairs[0] == coord_pairs[-1]:
            coord_pairs = coord_pairs[:-1]
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

def create_dashboard():
    """Creates and displays a crime dashboard for Wiltshire."""
    print("Starting dashboard generation for Wiltshire...")
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)

    all_street_crimes = []
    all_stop_and_searches = []

    for date in DATES:
        print(f"Fetching data for {date}...")
        for kml_file in os.listdir(KML_DIR):
            if not kml_file.endswith('.kml'):
                continue

            kml_file_path = os.path.join(KML_DIR, kml_file)
            neighbourhood_name = os.path.splitext(kml_file)[0]
            print(f"Processing {neighbourhood_name}...")

            polygon = get_polygon_from_kml(kml_file_path)
            if not polygon:
                print(f"Could not extract polygon from {kml_file}. Skipping.")
                continue

            street_crimes, from_api_street = get_street_crimes(polygon, date, neighbourhood_name)
            if not street_crimes.empty:
                all_street_crimes.append(street_crimes)

            stop_and_searches, from_api_stop = get_stop_and_searches(polygon, date, neighbourhood_name)
            if not stop_and_searches.empty:
                all_stop_and_searches.append(stop_and_searches)

            if from_api_street or from_api_stop:
                time.sleep(0.1)

    if not all_street_crimes and not all_stop_and_searches:
        print("No data was returned from the API for any neighbourhood. Exiting.")
        return

    street_df = pd.concat(all_street_crimes, ignore_index=True) if all_street_crimes else pd.DataFrame()
    stop_search_df = pd.concat(all_stop_and_searches, ignore_index=True) if all_stop_and_searches else pd.DataFrame()

    if not street_df.empty:
        street_df.dropna(subset=['Latitude', 'Longitude'], inplace=True)
    if not stop_search_df.empty:
        stop_search_df.dropna(subset=['Latitude', 'Longitude'], inplace=True)
    print("Cleaned data by removing rows with missing location information.")

    # --- Create Map ---
    wiltshire_map = folium.Map(location=[51.068787, -1.794472], zoom_start=10)
    print("Created base map centered on Salisbury.")

    # Create a list of lat/lon pairs for the heatmap
    heat_data = [[row['Latitude'], row['Longitude']] for index, row in street_df.iterrows()]

    # Add the heatmap layer with adjusted opacity
    HeatMap(heat_data, min_opacity=0.3, name="Crime Heatmap").add_to(wiltshire_map)
    print("Added heatmap layer to the map.")

    if not street_df.empty:
        street_crime_layer = folium.plugins.MarkerCluster(name="Street Crimes").add_to(wiltshire_map)
        print(f"Adding {len(street_df)} street crime incidents to the map...")
        for index, row in street_df.iterrows():
            popup_text = f"<b>Crime type:</b> {row['Crime type']}<br><b>Month:</b> {row['month']}<br>"
            folium.Marker(location=[row['Latitude'], row['Longitude']], popup=popup_text).add_to(street_crime_layer)
    if not stop_search_df.empty:
        stop_search_layer = folium.plugins.MarkerCluster(name="Stop and Search").add_to(wiltshire_map)
        print(f"Adding {len(stop_search_df)} stop and search incidents to the map...")
        for index, row in stop_search_df.iterrows():
            popup_text = f"<b>Type:</b> {row['Type']}<br><b>Date:</b> {row['Date']}<br><b>Gender:</b> {row['Gender']}<br><b>Age range:</b> {row['Age range']}<br><b>Object of search:</b> {row['Object of search']}<br>"
            folium.Marker(location=[row['Latitude'], row['Longitude']], popup=popup_text).add_to(stop_search_layer)
    folium.LayerControl().add_to(wiltshire_map)
    map_html = wiltshire_map._repr_html_()

    # --- Analytics ---
    total_crimes = len(street_df)
    crime_type_breakdown = street_df['Crime type'].value_counts().to_frame().to_html()
    total_stop_and_searches = len(stop_search_df)
    stop_and_search_reason_breakdown = stop_search_df['Object of search'].value_counts().to_frame().to_html()


    # Monthly trend graph
    street_df['month'] = pd.to_datetime(street_df['month'])
    monthly_counts = street_df.resample('ME', on='month').size()
    plt.figure(figsize=(10, 5))
    monthly_counts.plot(kind='bar')
    plt.title('Crimes per Month')
    plt.xlabel('Month')
    plt.ylabel('Number of Crimes')
    plt.tight_layout()
    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    image_png = buffer.getvalue()
    buffer.close()
    plt.close()
    graph_b64 = base64.b64encode(image_png).decode('utf-8')


    # --- HTML Dashboard ---
    html_content = f'''
    <html>
    <head>
        <title>Wiltshire Crime Dashboard</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet">
        <style>
            body {{
                font-family: 'Roboto', sans-serif;
                margin: 0;
                background-color: #f0f2f5;
                color: #333;
            }}
            .container {{
                display: flex;
                flex-direction: row;
                height: 100vh;
            }}
            .map-container {{
                flex: 3;
                height: 100%;
                border-right: 1px solid #ddd;
            }}
            .sidebar {{
                flex: 1;
                padding: 25px;
                background-color: #ffffff;
                overflow-y: auto;
                box-shadow: 2px 0 5px rgba(0,0,0,0.1);
            }}
            h2 {{
                border-bottom: 2px solid #007bff;
                padding-bottom: 10px;
                color: #007bff;
                font-weight: 700;
                margin-top: 0;
            }}
            h3 {{
                color: #555;
                font-weight: 400;
                margin-top: 20px;
            }}
            p {{
                font-size: 24px;
                font-weight: 300;
                color: #007bff;
                margin: 5px 0 15px 0;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }}
            th, td {{
                padding: 10px;
                border: 1px solid #ddd;
                text-align: left;
            }}
            th {{
                background-color: #f7f7f7;
                font-weight: 700;
            }}
            img {{
                max-width: 100%;
                border-radius: 5px;
                margin-top: 10px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="map-container">
                {map_html}
            </div>
            <div class="sidebar">
                <h2>Wiltshire Crime Analytics (Jan 2025 - April 2025)</h2>
                <h3>Total Crimes Recorded</h3>
                <p>{total_crimes}</p>
                <h3>Crime Type Breakdown</h3>
                {crime_type_breakdown}
                <h3>Total Stop and Searches</h3>
                <p>{total_stop_and_searches}</p>
                <h3>Stop and Search Reason Breakdown</h3>
                {stop_and_search_reason_breakdown}
                <h3>Crimes per Month</h3>
                <img src="data:image/png;base64,{graph_b64}" alt="Crimes per month graph">
            </div>
        </div>
    </body>
    </html>
    '''

    with open(OUTPUT_DASHBOARD_FILE, 'w') as f:
        f.write(html_content)

    print(f"\nSuccess! Interactive dashboard has been saved to '{OUTPUT_DASHBOARD_FILE}'")
    webbrowser.open(OUTPUT_DASHBOARD_FILE)

if __name__ == '__main__':
    create_dashboard()

