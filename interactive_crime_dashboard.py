import folium
from folium.plugins import MarkerCluster
import webbrowser
import os

def create_interactive_dashboard():
    """
    Creates and displays an interactive crime dashboard for the UK.
    The map dynamically fetches data from the police API based on the visible bounds.
    """
    print("Generating interactive crime dashboard...")

    # --- Create Map ---
    uk_map = folium.Map(location=[54.5, -2.5], zoom_start=6)
    print("Created base map centered on the UK.")

    marker_cluster = MarkerCluster(name="Crimes").add_to(uk_map)
    folium.LayerControl().add_to(uk_map)

    # --- Save the initial map ---
    output_file = 'interactive_crime_dashboard.html'
    uk_map.save(output_file)
    print(f"Initial map saved to '{output_file}'")

    # --- Post-process the HTML to inject our script ---
    # Read the generated HTML
    with open(output_file, 'r') as f:
        html_content = f.read()

    # Read the JavaScript file
    with open('map_script.js', 'r') as f:
        js_code = f.read()
    
    # Replace placeholders with folium variable names
    map_name = uk_map.get_name()
    marker_cluster_name = marker_cluster.get_name()
    js_code = js_code.replace('##MAP_NAME##', map_name)
    js_code = js_code.replace('##MARKER_CLUSTER_NAME##', marker_cluster_name)

    # Create the script tag
    script_tag = f'<script>{js_code}</script>'

    # Inject the script tag into the HTML head
    html_content = html_content.replace('</head>', f'{script_tag}\n</head>')

    # Write the modified HTML back to the file
    with open(output_file, 'w') as f:
        f.write(html_content)
    print("JavaScript injected into the HTML file.")

    # --- Open Dashboard ---
    print(f"\nSuccess! Interactive dashboard has been saved to '{output_file}'")
    webbrowser.open(f"file://{os.path.realpath(output_file)}")

if __name__ == '__main__':
    create_interactive_dashboard()