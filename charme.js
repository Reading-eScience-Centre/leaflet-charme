var MINI = require('minified');
var _ = MINI._,
    $ = MINI.$,
    $$ = MINI.$$,
    EE = MINI.EE,
    HTML = MINI.HTML;

var drawnThing;
var formThing;
var map;

var popupform;

document.addEventListener('DOMContentLoaded', function () {
    // Set up maps
    var layer1 = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>',
        maxZoom: 18
    });

    map = L.map('map', {
        layers: [layer1],
        center: [55, -3.5],
        zoom: 6
    });

    var featureGroup = new L.FeatureGroup();
    map.addLayer(featureGroup);
    // Set the title to show on the polygon button
    L.drawLocal.draw.toolbar.buttons.polygon = 'Comment on a general region of data';
    L.drawLocal.draw.toolbar.buttons.rectangle = 'Comment on a rectangular region of data';
    L.drawLocal.draw.toolbar.buttons.marker = 'Comment on data at a point';

    var drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            polyline: false,
            circle: false,
            marker: true,
            polygon: true
        }
    });
    map.addControl(drawControl);


    //Custom functions upon 'edit'
    map.on('draw:created', function (e) {
        var tempMarker = featureGroup.addLayer(e.layer);
        var popupContent = '<form id="form">' +
            'Name:<br>' +
            '<input type="text" id="name" name="name"><br>' +
            'Email:<br>' +
            '<input type="text" id="email" name="email"><br>' +
            'Author URI:<br>' +
            '<input type="text" id="authoruri" name="authoruri"><br>' +
            'Comment:<br>' +
            '<textarea id="comment" name="comment" cols="35" rows="5" wrap="soft" form="form"></textarea>' +
            '<input id="submit" type="submit" value="Submit">' +
            '</form>';

        popupform = $('#form');
        tempMarker.bindPopup(popupContent, {
            keepInView: true,
            closeButton: false
        }).openPopup();

        var datasetUri = 'http://dataset/uri';
        var datasetVar = 'selectedVar';
        var endpointUrl = 'http://192.168.56.102/';
        var token = 'd4b0cf754c6bfe5208182325d96c1d5dec5964ba';

        $('#submit').on('click', function () {
            var name = $$("#name").value;
            var email = $$("#email").value;
            var authorUri = $$("#authoruri").value;
            var comment = $$("#comment").value;
            var location = getLocationString(e.layer);
            var ttl = getTurtle(name, email, authorUri, datasetUri, datasetVar, location, comment);

            var headers = {
                'Content-Type': 'text/turtle',
                'Authorization': 'Token ' + token,
            };
            $.request('post', endpointUrl + 'insert/annotation', ttl, {
                'headers': headers
            }).error(function () {
                console.log('Problem creating annotation');
            });
            featureGroup.removeLayer(e.layer);
        });

    });
});
var form;

function toggleAnnotations() {
    console.log("Fetching annotations");
    var params = {
        'query': getQuery(map),
        'format': 'GeoJSON'
    };
    var headers = {
        'Accept': 'application/json'
    }
    console.log(getQuery(map));
    form = generateForm(params);
    $.request('get', 'http://192.168.56.102:8080/strabonendpoint/Query', params, {
        'headers': headers
    }).then(function (resp) {
        console.log(resp);
        L.geoJson($.parseJSON(resp), {
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.text) {
                    layer.bindPopup(feature.properties.text + '\n' + feature.properties.name);
                }
            }
        }).addTo(map);
    });
}

function generateForm(path, params) {
    var form = document.createElement('form');
    for (var key in params) {
        if (params.hasOwnProperty(key)) {
            var hiddenField = document.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", params[key]);

            form.appendChild(hiddenField);
        }
    }

    document.body.appendChild(form);
    return form;
}

function getQuery(mapObj) {
    var bounds = map.getBounds();
    var maxx = bounds._northEast['lng'];
    var maxy = bounds._northEast['lat'];
    var minx = bounds._southWest['lng'];
    var miny = bounds._southWest['lat'];

    var query = 'PREFIX charme: <http://purl.org/voc/charme#> ' +
        'PREFIX oa: <http://www.w3.org/ns/oa#> ' +
        'PREFIX geo: <http://www.opengis.net/ont/geosparql#> ' +
        'PREFIX geof: <http://www.opengis.net/def/function/geosparql/> ' +
        'PREFIX cnt: <http://www.w3.org/2011/content#> ' +
        'PREFIX foaf: <http://xmlns.com/foaf/0.1/> ' +
        'SELECT ?text ?name ?wkt ' +
        'WHERE { ' +
        '    ?anno oa:hasBody ?body . ' +
        '    ?anno oa:annotatedBy ?authorUri . ' +
        '    ?authorUri foaf:name ?name . ' +
        '    ?body cnt:chars ?text . ' +
        '    ?anno oa:hasTarget ?target . ' +
        '    ?target oa:hasSelector ?selector . ' +
        '    ?selector charme:hasSpatialExtent ?sp . ' +
        '    ?sp geo:hasGeometry ?geometry . ' +
        '    ?geometry geo:asWKT ?wkt . ' +
        '    FILTER(geof:sfIntersects(?wkt, "POLYGON((' +
        minx + ' ' + miny + ',' +
        minx + ' ' + maxy + ',' +
        maxx + ' ' + maxy + ',' +
        maxx + ' ' + miny + ',' +
        minx + ' ' + miny +
        '))"^^geo:wktLiteral)) ' +
        '} ' +
        'LIMIT 100';
    return query;
}

function getLocationString(layer) {
    if (layer instanceof L.Marker) {
        return 'POINT (' + layer._latlng['lng'] + ' ' + layer._latlng['lat'] + ')'
    } else if (layer instanceof L.Polyline) {
        // Reverse order of points to ensure they are anti-clockwise
        var poly = 'POLYGON ((';
        for (var i = layer._latlngs.length - 1; i >= 0; i--) {
            // Be careful here - may need to reverse the order for Strabon
            var latlng = layer._latlngs[i];
            poly = poly + latlng['lng'] + ' ' + latlng['lat'] + ', ';
        }
        poly = poly + layer._latlngs[layer._latlngs.length - 1]['lng'] + ' ' + layer._latlngs[0]['lat'] + '))';
        return poly;
    }
}

function getTurtle(name, email, authorUri, datasetUri, datasetVar, location, comment) {
    var dateTime = new Date();
    var ttl = '@prefix chnode: <http://localhost/> .' +
        '@prefix charme: <http://purl.org/voc/charme#> .' +
        '@prefix oa: <http://www.w3.org/ns/oa#> .' +
        '@prefix foaf: <http://xmlns.com/foaf/0.1/> .' +
        '@prefix prov: <http://www.w3.org/ns/prov#> .' +
        '@prefix xsd: <http://www.w3.org/2001/XML-Schema#> .' +
        '@prefix geo: <http://www.opengis.net/ont/geosparql#> .' +
        '@prefix cnt: <http://www.w3.org/2011/content#> .' +
        '@prefix dc: <http://purl.org/dc/elements/1.1/> .' +
        '@prefix dctypes: <http://purl.org/dc/dcmitype/> .' +
        '<chnode:annoID> a oa:Annotation ;' +
        '    oa:annotatedAt "' + dateTime.toISOString() + '" ;' +
        '    oa:annotatedBy <' + authorUri + '> ;' +
        '    oa:hasTarget <chnode:targetID> ;' +
        '    oa:hasBody <chnode:bodyID> ;' +
        '    oa:motivatedBy oa:linking .' +
        '<' + authorUri + '> a foaf:Person ;' +
        '    foaf:mbox <mailto:' + email + '> ;' +
        '    foaf:name "' + name + '" .' +
        '<chnode:targetID> a charme:DatasetSubset ;' +
        '    oa:hasSource <' + datasetUri + '> ;' +
        '    oa:hasSelector <chnode:subsetSelectorID> .' +
        '<' + datasetUri + '> a charme:dataset .' +
        '<chnode:subsetSelectorID> a charme:SubsetSelector ;' +
        '    charme:hasVariable <chnode:variableID-01> ;' +
        '    charme:hasSpatialExtent <chnode:spatialExtentID-01> .' +
        '<chnode:bodyID> a cnt:ContentAsText, dctypes:Text ;' +
        '    cnt:chars "' + comment + '" ;' +
        '    dc:format "text/plain" .    ' +
        '<chnode:variableID-01> a charme:Variable ;' +
        '    charme:hasInternalName "' + datasetVar + '" .' +
        '<chnode:spatialExtentID-01> a charme:SpatialExtent ;' +
        '    geo:hasGeometry <chnode:geometryID-01> .' +
        '<chnode:geometryID-01> a geo:Geometry ;' +
        '    geo:asWKT "' + location + '"^^geo:wktLiteral .';
    return ttl;
}