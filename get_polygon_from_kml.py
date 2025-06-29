import xml.etree.ElementTree as ET
from typing import Optional

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
        
        # KML namespace
        kml_ns = {'kml': 'http://www.opengis.net/kml/2.2'}
        
        # Find all Polygon elements (handles both with and without namespace)
        polygons = root.findall('.//kml:Polygon', kml_ns)
        if not polygons:
            # Try without namespace in case it's not declared properly
            polygons = root.findall('.//Polygon')
        
        if not polygons:
            print("No polygon found in KML file")
            return None
        
        # Get the first polygon (you can modify this to handle multiple polygons)
        polygon = polygons[0]
        
        # Find the outer boundary coordinates
        outer_boundary = polygon.find('.//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates', kml_ns)
        if outer_boundary is None:
            # Try without namespace
            outer_boundary = polygon.find('.//outerBoundaryIs/LinearRing/coordinates')
        
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


# Example usage and test function
def test_function():
    """
    Test the function with a sample KML content
    """
    # Create a sample KML file for testing
    sample_kml = '''<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
            <Placemark>
                <name>Test Polygon</name>
                <Polygon>
                    <outerBoundaryIs>
                        <LinearRing>
                            <coordinates>
                                0.543,52.268,0
                                0.238,52.794,0
                                0.478,52.130,0
                                0.543,52.268,0
                            </coordinates>
                        </LinearRing>
                    </outerBoundaryIs>
                </Polygon>
            </Placemark>
        </Document>
    </kml>'''
    
    # Write sample KML to a temporary file
    with open('test_polygon.kml', 'w') as f:
        f.write(sample_kml)
    
    # Test the function
    result = get_polygon_from_kml('test_polygon.kml')
    print(f"Result: {result}")
    
    # Clean up
    import os
    os.remove('test_polygon.kml')

if __name__ == "__main__":
    test_function()