import GeoJSON from 'ol/format/GeoJSON.js';
import Map from 'ol/Map.js';
import Overlay from 'ol/Overlay.js';
import Interaction from 'ol/interaction.js';
import { Coordinate } from 'ol/coordinate';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import View from 'ol/View.js';
import TileLayer from "ol/layer/Tile.js";
import OSM from "ol/source/OSM.js";
import {DragBox, Select} from 'ol/interaction.js';
import {Fill, Stroke, Style} from 'ol/style.js';
import {getWidth} from 'ol/extent.js';
import {platformModifierKeyOnly} from 'ol/events/condition.js';
import {
  Attribution,
  ScaleLine,
  OverviewMap,
  ZoomToExtent,
  defaults as defaultControls,
} from "ol/control";

const vectorSource = new VectorSource({
  url: 'https://raw.githubusercontent.com/AnniProvietti/AnniProvietti.github.io/main/estados.geojson',
  format: new GeoJSON(),
});

const style = new Style({
  fill: new Fill({
    color: 'rgba(128, 128, 0, 0.2)',
  }),
});


//Botão de controle
let zoomToExtentControl = new ZoomToExtent({
  extent: [-11409874, -41280857, 11409874, 41280857],
});


//Adiciona a escala do mapa

function scaleControl() {
  let control = new ScaleLine({
    units: "metric",
    bar: true,
    steps: 5,
    text: true,
    minWidth: 200,
  });
  return control;
};

//overview
const overviewMapControl = new OverviewMap({
  // see in overviewmap-custom.html to see the custom CSS used
  className: 'ol-overviewmap ol-custom-overviewmap',
  layers: [
    new TileLayer({
      source: new OSM(),
    })
  ],
  collapseLabel: '\u00BB',
  label: '\u00AB',
  collapsed: false
});

//create map geojson  
const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    new VectorLayer({
      source: vectorSource,
      // background: '#00008B',
      style: function (feature) {
        const color = feature.get('COLOR_BIO') || 'rgba(128, 128, 0, 0.2)';
        style.getFill().setColor(color);
        return style;
      },
    }),
  ],
  target: 'map',
  view: new View({
    center: [-6000000, -1100000],
    zoom: 4,
    constrainRotation: 16,
  }),
  controls: defaultControls({
    attributionOptions: { collapsible: true },
  }).extend([overviewMapControl,zoomToExtentControl,scaleControl()]),
});

const selectedStyle = new Style({
  fill: new Fill({
    color: 'rgba(238, 232, 170, 0.6)',
  }),
  stroke: new Stroke({
    color: 'rgba(238, 232, 170, 0.7)',
    width: 2,
  }),
});


// a normal select interaction to handle click
const select = new Select({
  style: function (feature) {
    const color = feature.get('COLOR_BIO') || '#EEE8AA';
    selectedStyle.getStroke().setColor(color);
    return selectedStyle;
  },
});
map.addInteraction(select);

const selectedFeatures = select.getFeatures();

// a DragBox interaction used to select features by drawing boxes
const dragBox = new DragBox({
  condition: platformModifierKeyOnly,
});

map.addInteraction(dragBox);

dragBox.on('boxend', function () {
  const boxExtent = dragBox.getGeometry().getExtent();

  // if the extent crosses the antimeridian process each world separately
  const worldExtent = map.getView().getProjection().getExtent();
  const worldWidth = getWidth(worldExtent);
  const startWorld = Math.floor((boxExtent[0] - worldExtent[0]) / worldWidth);
  const endWorld = Math.floor((boxExtent[2] - worldExtent[0]) / worldWidth);

  for (let world = startWorld; world <= endWorld; ++world) {
    const left = Math.max(boxExtent[0] - world * worldWidth, worldExtent[0]);
    const right = Math.min(boxExtent[2] - world * worldWidth, worldExtent[2]);
    const extent = [left, boxExtent[1], right, boxExtent[3]];

    const boxFeatures = vectorSource
      .getFeaturesInExtent(extent)
      .filter(
        (feature) =>
          !selectedFeatures.getArray().includes(feature) &&
          feature.getGeometry().intersectsExtent(extent)
      );

    // features that intersect the box geometry are added to the
    // collection of selected features

    // if the view is not obliquely rotated the box geometry and
    // its extent are equalivalent so intersecting features can
    // be added directly to the collection
    const rotation = map.getView().getRotation();
    const oblique = rotation % (Math.PI / 2) !== 0;

    // when the view is obliquely rotated the box extent will
    // exceed its geometry so both the box and the candidate
    // feature geometries are rotated around a common anchor
    // to confirm that, with the box geometry aligned with its
    // extent, the geometries intersect
    if (oblique) {
      const anchor = [0, 0];
      const geometry = dragBox.getGeometry().clone();
      geometry.translate(-world * worldWidth, 0);
      geometry.rotate(-rotation, anchor);
      const extent = geometry.getExtent();
      boxFeatures.forEach(function (feature) {
        const geometry = feature.getGeometry().clone();
        geometry.rotate(-rotation, anchor);
        if (geometry.intersectsExtent(extent)) {
          selectedFeatures.push(feature);
        }
      });
    } else {
      selectedFeatures.extend(boxFeatures);
    }
  }
});

// clear selection when drawing a new box and when clicking on the map
dragBox.on('boxstart', function () {
  selectedFeatures.clear();
});

const infoBox = document.getElementById('info');

selectedFeatures.on(['add', 'remove'], function () {
  const names = selectedFeatures.getArray().map((feature) => {
    return feature.get('name');
  });
  if (names.length > 0) {
    infoBox.innerHTML = names.join(', ');
    content.innerHTML = names.join(',');
  } else {
    infoBox.innerHTML = 'Selecione um Estado ou destaque uma área';
  }
});

// Adicona Overlay 
var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var closer = document.getElementById('popup-closer');

var overlay = new Overlay({
    element: container,
    autoPan: {
      animation: {
          duration: 1
      },     
  }
 });
map.addOverlay(overlay);

closer.click = function() {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

map.on(['click'], function (event) {
    if (map.hasFeatureAtPixel(event.pixel) === true) {
      const coordinate = event.coordinate;
      const names = selectedFeatures.getArray().map((feature) => {
          return feature.get('name');
        });
        if (names.values != 0) {
          // content.innerHTML = names.join(',');
          overlay.setPosition(coordinate);
          overlay.setPositioning('top-right');
        } else {
          overlay.setPosition(coordinate);
          overlay.setPositioning('top-right');

        };
         
    } else {
        overlay.setPosition(undefined);
        closer.blur();
        return false;
    }
  });





