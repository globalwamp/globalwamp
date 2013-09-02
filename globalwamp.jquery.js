/**
 *
 * globalwamp. Plugin de jquery que carga una vista de mapa
 * descripta en json sobre un mapa de argenmap.
 * acepta 
 */
;(function($){

  function GlobalWAMP(el, options) {

    //Defaults:
    this.defaults = {
      source: '0AqdTbs1TYvZKdE10TFRsa1BISE50amVTeUVNUDVqNkE',
      editable:false,
      vistaInicial: {
        lat: -34,
        lng: -59,
        zoom: undefined,
        layer: undefined
      },
        //mapa de campos
        //yo le doy bola solo a title, layer, resource, resourcetype
        //zoom & description.
        // si en tu json, tenes otros campos, pasale un objeto .globalwamp({objeto})
        // con la propiedad  field_map y el mapeo del nombre de tus campos a estos.
        // Por default el mapa es un mapeo dummy.
      field_map : {

        title: "title",
        layer: "layer",
        resource: "resource",
        resourcetype: "resourcetype",
        zoom: "zoom",
        description: "description"
      },
      bar_class: '.bar',
      bar_title_class: '.title',
      bar_description_class: '.description'
    };

    //Extending options:
    this.opts = $.extend({}, this.defaults, options);

    //Privates:
    this.$el = $(el);
    this.entries = [];
    this.markers = [];
    this.wms = [];
    this.kml = [];
  }

  // Separate functionality from object creation
  GlobalWAMP.prototype = {

    init: function() {
      var _this = this;
      _this.$el.spin({width:5.5});
      $.when( _this.getDoc() ).done(function() {
          _this.magic();  
          _this.$el.spin(false);
      }).fail(function() {
        console.log('Invalid source');
        _this.$el.spin(false);
      });
    },


    //Busca el JSON de la Google Docs Spreadsheet
    getDoc: function() {
      var _this = this;
      var deferred = $.Deferred();

      var source = _this.opts.source;

      var valid_url = ($.url(source ,true).attr('host') !== '');
        /*
         * Si source no es una url válida con domain, 
         * asumo que es un id de google docs
         */
      if (! valid_url ) {
        _this.getGoogleDocsJSON(source, deferred);
      } else {
        _this.getJSON(source, deferred);
      }
      
      return deferred.promise();      
    },

    getJSON: function (source, deferred) {
      var _this = this;
      $.get(source, function(data){
        _this.entries = data;
        
        _this.entries = _this._mapFields();
        _this.parsePlainJSON(deferred);        
      });
    },

    getGoogleDocsJSON: function (google_docs_id, deferred) {
      var _this = this;
      if (google_docs_id) {
        _this.opts.google_dodcs_id = google_docs_id;
      }
      var url = "https://spreadsheets.google.com/feeds/list/{google_docs_id}/od6/public/values?alt=json";

      url = url.replace("{google_docs_id}", google_docs_id);
      if (!google_docs_id ) {
        return false;
      }
      $.get(url, function(data){
         _this.entries = data.feed.entry;
         //paso el dererred porque el cálculo quizás
         // es asincrónico porque el usuario puede usar
         // texto para geocodificar en el campo resource de la entry texto
         _this.GDocsJSON2PlainJSON();
         _this.parsePlainJSON(deferred);
      }).fail(function() {
        _this.alert('La hoja de cálculo no está publicada o no existe.');
      });
    },
    
    GDocsJSON2PlainJSON: function () {
      var _this = this;

      /*
       * El JSON de un google docs, tiene la propiedad $t
       * en cada campo que tiene el valor del resultado.
       * así que lo manejo como un caso especial
       */
      _this.opts.field_map = {
          title: "gsx$title.$t",
          layer: "gsx$layer.$t",
          resource: "gsx$resource.$t",
          resourcetype: "gsx$resourcetype.$t",
          zoom: "gsx$zoom.$t",
          description: "gsx$description.$t"
      };

      _this.entries = _this._mapFields(true);
    },

    parsePlainJSON: function(deferred) {
      var _this = this;

      var grupos = _this.entries.groupBy(function(item) {
        return item.resourcetype;
      });

      _this.wms = grupos.wms;
      _this.markers = grupos.marker;
      _this.kml = grupos.kml;

      if (grupos.center !== undefined) {
        _this.parseCoordenadas(grupos.center[0].resource, function(latlng) {
          _this.opts.vistaInicial.lat = latlng.lat;
          _this.opts.vistaInicial.lng = latlng.lng;

          if (grupos.center[0].zoom !== undefined) {
            _this.opts.vistaInicial.zoom = grupos.center[0].zoom;  
          }

          if (grupos.center[0].layer === 'satelite' ) {
            _this.opts.vistaInicial.layer = 'satellite';  
          }

          if (grupos.center[0].layer === 'globalwampbyn' ) {
            _this.$el.addClass('globalwamp_byn');
          }

          if (grupos.center[0].title ) {
            $(_this.opts.bar_class).show();
            $(_this.opts.bar_class + ' ' + _this.opts.bar_title_class).html(grupos.center[0].title);
          }          

          if (grupos.center[0].description ) {
            $(_this.opts.bar_class).show();
            $(_this.opts.bar_class + ' ' + _this.opts.bar_description_class).html(grupos.center[0].description);
          }          

          deferred.resolve();
          return deferred;    
        });
      } else {
        deferred.resolve();
      }
      
    },

    _mapFields: function(is_google_docs_json)
    {
      var _this = this;
      var field_map = _this.opts.field_map;
      var entries = [];

      entries = $.map(_this.entries, function(entry, i) {
        var mapped={};

        
        try {
          // Esto puede tirar error
          // si en la spreadsheet no están los encabezados
          mapped = magic_map(entry);
        } catch(e) {
          var url = 'https://docs.google.com/spreadsheet/pub?key={google_docs_id}&output=html';
          url = url.replace('{google_docs_id}', _this.opts.source);
          var msg = "Falta la línea de encabezados en la <a target='blank' href='{url}'>hoja de cálculo</a>";
          msg = msg.replace('{url}', url);
          _this.alert(msg);
        }
        return mapped;
      }); // fin del $.map
      
      function magic_map(entry)
      {
        var ret = {};
        $.each(field_map, function(name, real_name) {
          var tmp = entry;
          var partes = real_name.split('.');
          $(partes).each(function() {
            tmp = tmp[this];
          })
          ret[name] = tmp;

        });
        return ret;
      }

      return entries;
    },

    magic: function () {
      var _this = this;
      var map_options = {};

      var $mapa = _this.$el;
      if (_this.opts.vistaInicial.lat !== undefined) {
        map_options.center = [ _this.opts.vistaInicial.lat, _this.opts.vistaInicial.lng ];      
      }  

      if (_this.opts.vistaInicial.zoom !== undefined) {
        map_options.zoom = parseInt(_this.opts.vistaInicial.zoom);      
      }
      
      $mapa.leaflet(map_options);
      var overlayTileUrl = 'http://{s}.www.toolserver.org/tiles/bw-mapnik/{z}/{x}/{y}.png';
      $mapa.data().plugin_leaflet.layerControl.addBaseLayer(new L.TileLayer(overlayTileUrl), 'B&W');
      //$mapa.data().Lmap.addLayer(new L.TileLayer(overlayTileUrl));

      if (_this.opts.vistaInicial.layer !== undefined) {
        $mapa.capaBase( _this.opts.vistaInicial.layer );      
      }

      /*
      $(_this.wms).each(function(k,layer) {
        $mapa.agregarCapaWMS({
          nombre: layer.title,
          layer: layer.layer,
          url: layer.resrouce
        });
      });
      */
      $(_this.markers).each(function(k, marker) {
        _this.parseCoordenadas(marker.resource, function(latlng) {
          if (! latlng.lat ) {
            return;
          }
          var $contenido = $('<div />');
          $("<h3 />").html(marker.title).appendTo($contenido);
          $("<div />").html(marker.description).appendTo($contenido);

          var marker_opts = {
            title: marker.title,
            icon: i,
            lat: latlng.lat,
            lng: latlng.lng,
            html: $contenido.html(),
          };

          if (marker.layer) {
            var i = new L.icon( {
              iconUrl: marker.layer,
            });
            marker_opts.icon = i;
          }
          $mapa.addMarker(marker_opts);
        
        });

      });
      

      if (_this.opts.editable) {
        $mapa.data().Lmap.addControl(new L.Control.ViewCenter({$map: $mapa}));
        $mapa.data().Lmap.addControl( new L.Control.Search({
          layer: $mapa.data().plugin_leaflet.popupGroup,
          initial: false}) );
        $mapa.find('.bar').hide();
        $mapa.enableMarkerDragging();
      }
      
      $(_this.kml).each(function(k, kml) {
        $mapa.addKML({
          nombre: kml.title,
          url: 'http://mapa.ign.gob.ar/mapa/proxy/?url=' + encodeURIComponent(kml.resource)
        });
      });
      
    },

    alert: function (msg) {
      var _this = this;
      $(_this.opts.bar_class).fadeIn();
      $(_this.opts.bar_class + ' ' + _this.opts.bar_title_class).html("globalWAMP - Error en el mapa");
      $(_this.opts.bar_class + ' ' + _this.opts.bar_description_class).html(msg);
    },

    parseCoordenadas: function  (texto, callback, context) {
      var _this = this;
      var latlng = {
        lat: null,
        lng: null
      };

      if (_this.parseGeograficas(texto)) {
        var parsed = _this.parseGeograficas(texto);
        latlng.lat = parsed.lat.decimal;
        latlng.lng = parsed.lng.decimal;      
        callback(latlng);
      } else if ( _this.parseDMS(texto) ) {
        var parsed = _this.parseDMS(texto);
        latlng.lat = parsed.lat.decimal;
        latlng.lng = parsed.lng.decimal;      
        callback(latlng);        
      } else {
        _this.geoLocate(texto, function(latlng) {
          callback( latlng );
        });
      }
      
    },
    geoLocate: function( str, callback )
    {
      var _this = this,
        latlng = {
          lat:-34,
          lat:-59
        };
      $.getJSON('http://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + str, function(data) {
        if (! data.length) {
          return latlng;
        }
        if (callback) {
          callback({lat: data[0].lat , lng: data[0].lon});
        }
      });        
    },

    fitGeoLocateResult: function( d ) {
      var _this = this;
      var $mapa = _this.$el;
      s = d.boundingbox[0],
      w = d.boundingbox[2],
      n = d.boundingbox[1],
      e = d.boundingbox[3],
      southwest = new google.maps.LatLng(s,w),
      northeast = new google.maps.LatLng(n,w),
      boundingbox = new google.maps.LatLngBounds(southwest, northeast);

      $mapa.data().gmap.fitBounds( boundingbox);
    },

    parseDMS: function( pair ) {
      var tmpLat, tmpLng;
      
      var coord = {
        lat: {decimal:0, deg:0, min:0, sec:0},
        lng: {decimal:0, deg:0, min:0, sec:0}
      };
      // patrón que reconoce lat y longitud en grados, min, y segundos
      // con indicador de sentido de la latitud/longitud (S, N, O, E, o W)
      var pattern =  /[0-9]{1,3}[º°]{1}([0-9]{1,2}['′´]{1}){0,1}([0-9]{1,2}([.,]{1}[0-9]{1,}){0,1}["″¨]{1}){0,1}[sonew]{1}/gi;
      var matches = pair.match(pattern);
      
      // si no hay matches o se encuentra más de UN
      // PAR de coordenadas, no lo proceso como válido
      if (!matches || matches.length > 2 ) {
        return false;
      }
      
      for (var i=0; i<matches.length;i++) {
        var decimal,
          //traigo los grados
          deg = matches[i].match(/[0-9]{1,3}[º°]{1}/g),
          //traigo los minutos
          min = matches[i].match(/[0-9]{1,2}['′´]{1}/g),
          //traigo los segundos
          sec = matches[i].match(/[0-9]{1,2}([.,]{1}[0-9]{1,}){0,1}["″¨]{1}/g),
        
          // dec(linación)(fruta el nombre de la variable).
          // Esto marca si la coordenada parseada es latitud sur o norte
          // o longitud este u oeste.
          dec = matches[i].match(/[sonew]/gi);
        dec = dec[0].toLowerCase();
        
        // esto es porque quizás las coordenadas
        // no tienen min o seg
        deg = $.isArray(deg) ? deg[0] : '';
        min = $.isArray(min) ? min[0] : '';
        sec = $.isArray(sec) ? sec[0] : '';
        
        deg = parseFloat ( deg.replace(',', '.') ) || 0;
        min = parseFloat ( min.replace(',', '.') ) || 0;
        sec = parseFloat ( sec.replace(',', '.') ) || 0;
          
        decimal = deg+ (min/60) + (sec/3600);
          //si es latitud
        if (dec == "s" || dec == "n" ) {
          coord.lat.deg = deg;
          coord.lat.min = min;
          coord.lat.sec = sec;
          coord.lat.decimal = decimal
          // si es latitud negativa
          if ( dec == "s" ) {
            coord.lat.decimal *= -1;
          }
        }
          //si es longitud negativa
        if (dec == "o" || dec == "w" || dec == "e" ) {
          coord.lng.deg = deg;
          coord.lng.min = min;
          coord.lng.sec = sec;          
          coord.lng.decimal = decimal
          // si es latitud negativa
          if ( dec == "o" || dec == "w" ) {
            coord.lng.decimal *= -1;
          }
        }       
      }
      return coord;
    },

    /**
     * Parsea una cadena de texto en búsqueda
     * de coordenadas del tipo lat lng. Es decir
     * solo devuelve las coordenadas parseadas si la cadena contiene
     * un solo par de coordenadas o una sola coordenada.
     * 
     * -El separador decimal es el punto o la coma "." o "," 
     * -El signo "-" se interpreta como indicador de coordenadsa negativas
     * -Las coordenadas positivas no deben tener el signo "+" precedente.
     * Cadenas válidas
     *  32.12 65.32
     *  32,12 65,32
     *  -54.12 65,12 o -54,12 65.12 
     *  -55.23 o -55,23
     *  42.23
     *  
     *  @param string pair: la cadena de texto con el par de coordenadas
     *  en formato "lat lng"
     */
    parseGeograficas: function(pair) {
      var tmpLat, tmpLng;
      
      var coord = {
        lat: {decimal:0, deg:0, min:0, sec:0},
        lng: {decimal:0, deg:0, min:0, sec:0}
      };

      var pattern =  /-{0,1}[0-9]{1,3}([.,]{1}[0-9]{1,}){0,1}/g;
      
      var matches = pair.match(pattern);
      // si no hay matches o se encuentra más de UN
      // PAR de coordenadas, no lo proceso como válido
      if (!matches || matches.length > 2 ) {
        return false;
      }
      //reemplazo las comas por puntos para poder castear bien
      tmpLat = parseFloat ( matches[0].replace(',', '.') );
      // Latitud tiene que estar dentro del rango [-90,90]
      // De lo contrario, directamente devuelvo false
      // con longitud hago el mismo chequeo pero no devuelvo false
      // si 
      if (tmpLat > 90 || tmpLat < -90) {
        return false;
      }
      coord.lat.decimal = tmpLat;
      if ( matches.length > 1 ) {
        //reemplazo las comas por puntos para poder castear bien
        tmpLng = parseFloat ( matches[1].replace(',', '.') );
        // Longitud tiene que estar dentro del rango [-180,180]
        // De lo contrario, seteo lng en false;
        // No vuelvo porque la latitud tiene que estar bien si llegué
        // a este punto
        if (tmpLng > 180 || tmpLng < -180) {
          coord.lng.decimal = undefined;
        } else {
          coord.lng.decimal = tmpLng
        }
      }
      return coord;
    }

  };

  // The actual plugin
  $.fn.globalwamp = function(options) {
    if(this.length) {
      this.each(function() {
        var rev = new GlobalWAMP(this, options);
        rev.init();
        $(this).data('globalwamp', rev);
      });
    }
  };
})(jQuery);
