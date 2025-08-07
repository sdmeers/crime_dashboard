
console.log('map_script.js loaded');

// We wrap everything in a try...catch block to see any errors in the console.
try {
    // The setTimeout is used to ensure the map object is fully initialized before we try to modify it.
    setTimeout(function() {
        console.log('setTimeout callback executed');

        var map = ##MAP_NAME##;
        var crimeLayer = ##MARKER_CLUSTER_NAME##;

        if (!map) { console.error('Map object not found!'); return; }
        if (!crimeLayer) { console.error('MarkerCluster layer not found!'); return; }

        console.log('Map and layers initialized successfully');

        // --- Create Month Selector ---
        var monthSelector = L.control({position: 'topleft'});

        monthSelector.onAdd = function(map) {
            var div = L.DomUtil.create('div', 'info month-selector');
            div.innerHTML = '<h5>Select Month</h5><select id="month-select"></select>';
            div.style.backgroundColor = 'white';
            div.style.padding = '5px';
            div.style.border = '1px solid #ccc';

            var select = div.querySelector('#month-select');

            var today = new Date();
            for (var i = 0; i < 12; i++) {
                var d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                var month = ('0' + (d.getMonth() + 1)).slice(-2);
                var year = d.getFullYear();
                var option = document.createElement('option');
                option.value = `${year}-${month}`;
                option.text = `${year}-${month}`;
                select.appendChild(option);
            }
            
            select.addEventListener('change', fetchDataForBounds);
            L.DomEvent.disableClickPropagation(div);
            return div;
        };

        monthSelector.addTo(map);
        console.log('Month selector added to map.');

        var info = L.control({position: 'topright'});
        info.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info');
            this._div.style.padding = '6px 8px';
            this._div.style.font = '14px/16px Arial, Helvetica, sans-serif';
            this._div.style.background = 'white';
            this._div.style.background = 'rgba(255,255,255,0.8)';
            this._div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
            this._div.style.borderRadius = '5px';
            this.update();
            return this._div;
        };
        info.update = function (message) {
            this._div.innerHTML = '<h4>UK Crime Data</h4>' + (message || 'Pan and zoom to explore');
        };
        info.addTo(map);

        var ukBounds = L.latLngBounds([49.9, -10.5], [59.5, 2.0]);

        function fetchDataForBounds() {
            console.log('fetchDataForBounds triggered');
            var bounds = map.getBounds();
            crimeLayer.clearLayers();

            if (!ukBounds.intersects(bounds)) {
                info.update("No data for this region");
                console.log('Map view is outside UK bounds.');
                return;
            }

            info.update("Loading data....");

            var selectedMonth = document.getElementById('month-select').value;

            var poly = bounds.getNorthWest().lat + ',' + bounds.getNorthWest().lng + ':' +
                       bounds.getNorthEast().lat + ',' + bounds.getNorthEast().lng + ':' +
                       bounds.getSouthEast().lat + ',' + bounds.getSouthEast().lng + ':' +
                       bounds.getSouthWest().lat + ',' + bounds.getSouthWest().lng;

            var policeApiUrl = `https://data.police.uk/api/crimes-street/all-crime?poly=${poly}&date=${selectedMonth}`;
            console.log('Fetching data from:', policeApiUrl);

            fetch(policeApiUrl)
                .then(response => {
                    console.log('Received response from API:', response.status);
                    if (response.status === 503 || response.status === 400) {
                        info.update("Zoom in to see crime data");
                        return null;
                    }
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data) {
                        console.log(`Received ${data.length} crime records.`);
                        if (data.length === 0) {
                            info.update("No crime data found for this area.");
                        } else if (data.length >= 10000) {
                            info.update("Zoom in to see crime data");
                        } else {
                            info.update(`${data.length} crimes found`);
                            var markers = data.map(function(crime) {
                                var marker = L.marker([crime.location.latitude, crime.location.longitude]);
                                marker.bindPopup(`<b>Crime type:</b> ${crime.category}<br><b>Month:</b> ${crime.month}`);
                                return marker;
                            });
                            crimeLayer.addLayers(markers);
                            console.log('Updated map with markers.');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error fetching or processing crime data:', error);
                    info.update("Could not load crime data.");
                });
        }

        map.on('moveend', fetchDataForBounds);
        info.update('Pan or zoom the map to load crime data');
        console.log('Event listener for map moveend has been set.');

    }, 500);
} catch (e) {
    console.error('An error occurred in map_script.js:', e);
    alert('A critical error occurred. Please check the developer console.');
}
