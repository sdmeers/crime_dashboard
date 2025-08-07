
import folium
from folium.plugins import MarkerCluster
import webbrowser
import os
from branca.element import Element

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

    # --- JavaScript for Dynamic Data Fetching ---
    map_name = uk_map.get_name()
    marker_cluster_name = marker_cluster.get_name()

    # Use a template string with .format() to avoid f-string issues.
    # All JS curly braces are escaped by doubling them: {{ and }}.
    # The placeholders {map_name} and {marker_cluster_name} will be filled by .format().
    js_template = """
    <script>
        setTimeout(function() {{
            var map = {map_name};
            var crimeLayer = {marker_cluster_name};

            var info = L.control({{position: 'topright'}});
            info.onAdd = function (map) {{
                this._div = L.DomUtil.create('div', 'info');
                this._div.style.padding = '6px 8px';
                this._div.style.font = '14px/16px Arial, Helvetica, sans-serif';
                this._div.style.background = 'white';
                this._div.style.background = 'rgba(255,255,255,0.8)';
                this._div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
                this._div.style.borderRadius = '5px';
                this.update();
                return this._div;
            }};
            info.update = function (message) {{
                this._div.innerHTML = '<h4>UK Crime Data</h4>' + (message || 'Pan and zoom to explore');
            }};
            info.addTo(map);

            var ukBounds = L.latLngBounds([49.9, -10.5], [59.5, 2.0]);

            function fetchDataForBounds() {{
                var bounds = map.getBounds();
                crimeLayer.clearLayers();

                if (!ukBounds.intersects(bounds)) {{
                    info.update("No data for this region");
                    return;
                }}

                info.update("Loading data....");

                var poly = bounds.getNorthWest().lat + ',' + bounds.getNorthWest().lng + ':' +
                           bounds.getNorthEast().lat + ',' + bounds.getNorthEast().lng + ':' +
                           bounds.getSouthEast().lat + ',' + bounds.getSouthEast().lng + ':' +
                           bounds.getSouthWest().lat + ',' + bounds.getSouthWest().lng;

                var policeApiUrl = `https://data.police.uk/api/crimes-street/all-crime?poly=${{poly}}`;

                fetch(policeApiUrl)
                    .then(response => {{
                        if (response.status === 503 || response.status === 400) {{
                            info.update("Zoom in to see crime data");
                            return null;
                        }}
                        if (!response.ok) {{
                            throw new Error('Network response was not ok');
                        }}
                        return response.json();
                    }})
                    .then(data => {{
                        if (data) {{
                            if (data.length === 0) {{
                                info.update("No crime data found for this area.");
                            }} else if (data.length >= 10000) {{
                                info.update("Zoom in to see crime data");
                            }} else {{
                                info.update(`${{data.length}} crimes found`);
                                var markers = data.map(function(crime) {{
                                    var marker = L.marker([crime.location.latitude, crime.location.longitude]);
                                    marker.bindPopup(`<b>Crime type:</b> ${{crime.category}}<br><b>Month:</b> ${{crime.month}}`);
                                    return marker;
                                }});
                                crimeLayer.addLayers(markers);
                            }}
                        }}
                    }})
                    .catch(error => {{
                        console.error('Error fetching crime data:', error);
                        info.update("Could not load crime data.");
                    }});
            }}

            map.on('moveend', fetchDataForBounds);
            info.update('Pan or zoom the map to load crime data');

        }}, 500);
    </script>
    """;

    js_code = js_template.format(
        map_name=map_name,
        marker_cluster_name=marker_cluster_name
    )

    uk_map.get_root().html.add_child(Element(js_code))

    folium.LayerControl().add_to(uk_map)

    # --- Save and Open Dashboard ---
    output_file = 'interactive_crime_dashboard.html'
    uk_map.save(output_file)
    print(f"\nSuccess! Interactive dashboard has been saved to '{output_file}'")
    webbrowser.open(f"file://{os.path.realpath(output_file)}")

if __name__ == '__main__':
    create_interactive_dashboard()
