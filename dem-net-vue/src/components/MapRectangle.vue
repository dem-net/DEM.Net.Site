<template>
<section> 
      <link rel="stylesheet" href="https://unpkg.com/leaflet-geosearch@2.6.0/assets/css/leaflet.css">         
      <div style="width: 90%;height: 100%; background-color:#eee; position:relative;">
        <l-map ref="map" id="map" :zoom="zoom"
            :center="center"
            :max-zoom="maxZoom"
            :options='{ zoomControl: true }'>
          <l-tile-layer :url="url" :attribution="attribution"></l-tile-layer>
          <!-- IMPORTANT PART HERE -->
          <v-geosearch :options="geosearchOptions" ></v-geosearch>
          <!-- /IMPORTANT PART HERE -->
        </l-map>
      </div>
    </section>
</template>


<script>
import { LMap, LTileLayer } from "vue2-leaflet";
import 'leaflet-draw';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import VGeosearch from 'vue2-leaflet-geosearch';

export default {
  name: 'MapLine',
  components: {
    LMap, LTileLayer, VGeosearch
  },

  mounted() {
    this.$nextTick(() => {
      const map = this.$refs.map.mapObject;
      this.editableLayers = new window.L.FeatureGroup().addTo(map);

      this.drawControl = new window.L.Control.Draw({
        draw: {
          polyline: false,
          polygon: false,
          rectangle: true,
          circle: false,
          marker: false
        },
        edit: {
             featureGroup: this.editableLayers
         }
      });

      map.addControl(this.drawControl);

      map.on(window.L.Draw.Event.CREATED, (e) => {
        
        // hack from https://github.com/Leaflet/Leaflet.draw/issues/869 to enable editing
        const layer = e.layer;
        layer.options.editing = { };
        layer.editing.enable();

        this.setBbox(layer._bounds._northEast, layer._bounds._southWest);
        
        this.editableLayers.addLayer(layer);
        this.layers.push(layer);

      });

      map.on('draw:editresize', (e) => {
        var bounds = e.layer._bounds;
        if (bounds != null){
         this.setBbox(bounds._northEast, bounds._southWest);
        }
      });
      map.on('draw:editmove', (e) => {
        var bounds = e.layer._bounds;
        if (bounds != null){
         this.setBbox(bounds._northEast, bounds._southWest);
        }
      });

    });
  },

  data(){
    return {
      geosearchOptions: { // Important part Here
        provider: new OpenStreetMapProvider(),
        autoClose: true,
        retainZoomLevel: false,
        style: 'bar'
      },
      zoom: 6,
      maxZoom: 16,
      editableLayers: null,
      drawControl: null,
      layers: [],
      center: [45.75583, 3.61778],
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
      // url: 'https://maps.heigit.org/openmapsurfer/tiles/roads/webmercator/{z}/{x}/{y}.png',
      // attribution: 'Imagery from <a href="http://giscience.uni-hd.de/">GIScience Research Group @ University of Heidelberg</a> | Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    };
  },
  methods: {
   setBbox(ne,sw) {
     this.$emit("bboxSelected",sw.lng+','+ne.lng+','+sw.lat+','+ne.lat);
   }
  },
};

</script>

<style scoped>

#map {
  width: 100%;
  height: 450px;
  margin: 0;
}
</style>