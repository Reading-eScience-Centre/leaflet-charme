var wmsLayer;

document.addEventListener('DOMContentLoaded', function () {
    // Set up map
    var layer1 = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>',
        maxZoom: 18
    });
    var map = L.map('map', {
        layers: [layer1],
        center: [40, 0],
        zoom: 3
    });

    // Define the URL of the CHARMe node to use
    var charmeUrl = 'http://192.168.56.102/';
    // Define the client ID which has been registered on the CHARMe node.
    // The Client on the CHARMe node must have a redirect URL which leads back to this page
    var charmeClientId = 'e6c205f28f25a9f11b71';

    // Create the CHARMe annotator with the given CHARMe node, client ID, and map object
    var annotator = new CharmeAnnotator(charmeUrl, charmeClientId, map);

    // Set the function to call after a successful login
    annotator.on('login', function (userdetails) {
        document.getElementById('greeting').innerHTML = 'Logged in as user ' + userdetails['username'] + '(' + userdetails['first_name'] + ' ' + userdetails['last_name'] + ')';

        document.getElementById('loginButton').disabled = true;
        document.getElementById('logoutButton').disabled = false;
    });

    // Set the function to call after a logout
    annotator.on('logout', function () {
        document.getElementById('greeting').innerHTML = 'Please login to add annotations';
        document.getElementById('loginButton').disabled = false;
        document.getElementById('logoutButton').disabled = true;
    });

    // Bind the toggleAnnotations() function to the button, and change the button label
    document.getElementById('toggleAnnotationsButton').addEventListener('click', function () {
        annotator.toggleAnnotations();
        if (annotator.isAnnotationsOn()) {
            document.getElementById('toggleAnnotationsButton').innerHTML = 'Hide annotations';
        } else {
            document.getElementById('toggleAnnotationsButton').innerHTML = 'Show annotations';
        }
    });

    // Bind the login function to the correct button
    document.getElementById('loginButton').addEventListener('click', function () {
        annotator.charmeLogin();
    });

    // Bind the logout function to the correct button
    document.getElementById('logoutButton').addEventListener('click', function () {
        annotator.charmeLogout();
    });

    // Set up the buttons to select datasets.
    var ncwmsServer = 'http://192.168.56.102:8080/ncWMS2/wms';
    document.getElementById('sstButton').addEventListener('click', function () {
        selectDataset(ncwmsServer + '/cci', 'analysed_sst', annotator, map);
        document.getElementById('sstButton').disabled = true;
        document.getElementById('sstErrorButton').disabled = false;
        document.getElementById('landCoverButton').disabled = false;
    });
    document.getElementById('sstErrorButton').addEventListener('click', function () {
        selectDataset(ncwmsServer + '/cci', 'analysis_error', annotator, map);
        document.getElementById('sstButton').disabled = false;
        document.getElementById('sstErrorButton').disabled = true;
        document.getElementById('landCoverButton').disabled = false;
    });
    document.getElementById('landCoverButton').addEventListener('click', function () {
        selectDataset(ncwmsServer + '/lc', 'land_cover', annotator, map);
        document.getElementById('sstButton').disabled = false;
        document.getElementById('sstErrorButton').disabled = false;
        document.getElementById('landCoverButton').disabled = true;
    });

});

function selectDataset(datasetUri, variable, annotator, map) {
    annotator.setDatasetDetails(datasetUri, variable);

    if (wmsLayer != undefined) {
        map.removeLayer(wmsLayer);
    }
    wmsLayer = L.tileLayer.wms(datasetUri, {
        layers: variable,
        transparent: true,
        format: 'image/png',
        styles: 'default/default',
        bgcolor: 'transparent'
    });
    wmsLayer.addTo(map);

    if (annotator.isAnnotationsOn()) {
        // If we're viewing annotations, toggle them off/on to get
        // correct ones for current DS
        annotator.toggleAnnotations();
        annotator.toggleAnnotations();
    }
}