/*
 *
 * jQuery Boilerplate
 * ------------------
 * https://github.com/jquery-boilerplate/boilerplate/
 */
// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ( $, window, document, undefined ) {

    // undefined is used here as the undefined global variable in ECMAScript 3 is
    // mutable (ie. it can be changed by someone else). undefined isn't really being
    // passed in so we can ensure the value of it is truly undefined. In ES5, undefined
    // can no longer be modified.

    // window and document are passed through as local variable rather than global
    // as this (slightly) quickens the resolution process and can be more efficiently
    // minified (especially when both are regularly referenced in your plugin).

    // Create the defaults once
    var pluginName = "leaflet",
        defaults = {
        propertyName: "value",
        center: [-34, -59],
        zoom:4
    };

    // The actual plugin constructor
    function Leaflet ( element, options ) {
        this.element = element;
        this.$el = $(element);
        // jQuery has an extend method which merges the contents of two or
        // more objects, storing the result in the first object. The first object
        // is generally empty as we don't want to alter the default options for
        // future instances of the plugin
        this.settings = $.extend( {}, defaults, options );
        this._defaults = defaults;
        this._name = pluginName;
        this.Lmap = undefined;
        this.popupGroup = null;
    }

    Leaflet.prototype = {
        init: function () {
          var _this = this;
            // Place initialization logic here
            // You already have access to the DOM element and
            // the options via the instance, e.g. this.element
            // and this.settings
            // you can add more functions like the one below and
            // call them like so: this.yourOtherFunction(this.element, this.settings).
            if ( typeof L === "undefined") {
              _this._cargarJS(function() {
                _this.initLeafletMap();
              });
            } else {
              _this.initLeafletMap();              
            }
        },
        _cargarJS: function( callback )
        {
          jQuery('head').append('<link href="http://cdn.leafletjs.com/leaflet-0.6.2/leaflet.css" rel="stylesheet" type="text/css" />');
          jQuery('head').append('<!--[if lte IE 8]>' + "\n" 
              +'<link rel="stylesheet" href="http://cdn.leafletjs.com/leaflet-0.6.2/leaflet.ie.css" />' + "\n" 
              + '<![endif]-->');

          $.getScript('http://cdn.leafletjs.com/leaflet-0.6.2/leaflet.js', callback);
        },
        initializeKmlPlugin: function()
        {
          /*
          KML Layer plugin by Pavel Shramov
          https://github.com/shramov/leaflet-plugins
          */
          /*global L: true */

          L.KML = L.FeatureGroup.extend({
            options: {
              async: true
            },

            initialize: function(kml, options) {
              L.Util.setOptions(this, options);
              this._kml = kml;
              this._layers = {};

              if (kml) {
                this.addKML(kml, options, this.options.async);
              }
            },

            loadXML: function(url, cb, options, async) {
              if (async == undefined) async = this.options.async;
              if (options == undefined) options = this.options;

              var req = new window.XMLHttpRequest();
              req.open('GET', url, async);
              try {
                req.overrideMimeType('text/xml'); // unsupported by IE
              } catch(e) {}
              req.onreadystatechange = function() {
                if (req.readyState != 4) return;
                if(req.status == 200) cb(req.responseXML, options);
              };
              req.send(null);
            },

            addKML: function(url, options, async) {
              var _this = this;
              var cb = function(gpx, options) { _this._addKML(gpx, options) };
              this.loadXML(url, cb, options, async);
            },

            _addKML: function(xml, options) {
              var layers = L.KML.parseKML(xml);
              if (!layers || !layers.length) return;
              for (var i = 0; i < layers.length; i++)
              {
                this.fire('addlayer', {
                  layer: layers[i]
                });
                this.addLayer(layers[i]);
              }
              this.latLngs = L.KML.getLatLngs(xml);
              this.fire("loaded");
            },

            latLngs: []
          });

          L.Util.extend(L.KML, {

            parseKML: function (xml) {
              var style = this.parseStyle(xml);
              var el = xml.getElementsByTagName("Folder");
              var layers = [], l;
              for (var i = 0; i < el.length; i++) {
                if (!this._check_folder(el[i])) { continue; }
                l = this.parseFolder(el[i], style);
                if (l) { layers.push(l); }
              }
              el = xml.getElementsByTagName('Placemark');
              for (var j = 0; j < el.length; j++) {
                if (!this._check_folder(el[j])) { continue; }
                l = this.parsePlacemark(el[j], xml, style);
                if (l) { layers.push(l); }
              }
              return layers;
            },

            // Return false if e's first parent Folder is not [folder]
            // - returns true if no parent Folders
            _check_folder: function (e, folder) {
              e = e.parentElement;
              while (e && e.tagName !== "Folder")
              {
                e = e.parentElement;
              }
              return !e || e === folder;
            },

            parseStyle: function (xml) {
              var style = {};
              var sl = xml.getElementsByTagName("Style");

              //for (var i = 0; i < sl.length; i++) {
              var attributes = {color: true, width: true, Icon: true, href: true,
                        hotSpot: true};

              function _parse(xml) {
                var options = {};
                for (var i = 0; i < xml.childNodes.length; i++) {
                  var e = xml.childNodes[i];
                  var key = e.tagName;
                  if (!attributes[key]) { continue; }
                  if (key === 'hotSpot')
                  {
                    for (var j = 0; j < e.attributes.length; j++) {
                      options[e.attributes[j].name] = e.attributes[j].nodeValue;
                    }
                  } else {
                    var value = e.childNodes[0].nodeValue;
                    if (key === 'color') {
                      options.opacity = parseInt(value.substring(0, 2), 16) / 255.0;
                      options.color = "#" + value.substring(2, 8);
                    } else if (key === 'width') {
                      options.weight = value;
                    } else if (key === 'Icon') {
                      ioptions = _parse(e);
                      if (ioptions.href) { options.href = ioptions.href; }
                    } else if (key === 'href') {
                      options.href = value;
                    }
                  }
                }
                return options;
              }

              for (var i = 0; i < sl.length; i++) {
                var e = sl[i], el;
                var options = {}, poptions = {}, ioptions = {};
                el = e.getElementsByTagName("LineStyle");
                if (el && el[0]) { options = _parse(el[0]); }
                el = e.getElementsByTagName("PolyStyle");
                if (el && el[0]) { poptions = _parse(el[0]); }
                if (poptions.color) { options.fillColor = poptions.color; }
                if (poptions.opacity) { options.fillOpacity = poptions.opacity; }
                el = e.getElementsByTagName("IconStyle");
                if (el && el[0]) { ioptions = _parse(el[0]); }
                if (ioptions.href) {
                  // save anchor info until the image is loaded
                  options.icon = new L.KMLIcon({
                    iconUrl: ioptions.href,
                    shadowUrl: null,
                    iconAnchorRef: {x: ioptions.x, y: ioptions.y},
                    iconAnchorType: {x: ioptions.xunits, y: ioptions.yunits}
                  });
                }
                style['#' + e.getAttribute('id')] = options;
              }
              return style;
            },

            parseFolder: function (xml, style) {
              var el, layers = [], l;
              el = xml.getElementsByTagName('Folder');
              for (var i = 0; i < el.length; i++) {
                if (!this._check_folder(el[i], xml)) { continue; }
                l = this.parseFolder(el[i], style);
                if (l) { layers.push(l); }
              }
              el = xml.getElementsByTagName('Placemark');
              for (var j = 0; j < el.length; j++) {
                if (!this._check_folder(el[j], xml)) { continue; }
                l = this.parsePlacemark(el[j], xml, style);
                if (l) { layers.push(l); }
              }
              if (!layers.length) { return; }
              if (layers.length === 1) { return layers[0]; }
              return new L.FeatureGroup(layers);
            },

            parsePlacemark: function (place, xml, style) {
              var i, j, el, options = {};
              el = place.getElementsByTagName('styleUrl');
              for (i = 0; i < el.length; i++) {
                var url = el[i].childNodes[0].nodeValue;
                for (var a in style[url])
                {
                  // for jshint
                  if (true)
                  {
                    options[a] = style[url][a];
                  }
                }
              }
              var layers = [];

              var parse = ['LineString', 'Polygon', 'Point'];
              for (j in parse) {
                // for jshint
                if (true)
                {
                  var tag = parse[j];
                  el = place.getElementsByTagName(tag);
                  for (i = 0; i < el.length; i++) {
                    var l = this["parse" + tag](el[i], xml, options);
                    if (l) { layers.push(l); }
                  }
                }
              }

              if (!layers.length) {
                return;
              }
              var layer = layers[0];
              if (layers.length > 1) {
                layer = new L.FeatureGroup(layers);
              }

              var name, descr = "";
              el = place.getElementsByTagName('name');
              if (el.length) {
                name = el[0].childNodes[0].nodeValue;
              }
              el = place.getElementsByTagName('description');
              for (i = 0; i < el.length; i++) {
                for (j = 0; j < el[i].childNodes.length; j++) {
                  descr = descr + el[i].childNodes[j].nodeValue;
                }
              }

              if (name) {
                layer.bindPopup("<h2>" + name + "</h2>" + descr);
              }

              return layer;
            },

            parseCoords: function (xml) {
              var el = xml.getElementsByTagName('coordinates');
              return this._read_coords(el[0]);
            },

            parseLineString: function (line, xml, options) {
              var coords = this.parseCoords(line);
              if (!coords.length) { return; }
              return new L.Polyline(coords, options);
            },

            parsePoint: function (line, xml, options) {
              var el = line.getElementsByTagName('coordinates');
              if (!el.length) {
                return;
              }
              var ll = el[0].childNodes[0].nodeValue.split(',');
              return new L.KMLMarker(new L.LatLng(ll[1], ll[0]), options);
            },

            parsePolygon: function (line, xml, options) {
              var el, polys = [], inner = [], i, coords;
              el = line.getElementsByTagName('outerBoundaryIs');
              for (i = 0; i < el.length; i++) {
                coords = this.parseCoords(el[i]);
                if (coords) {
                  polys.push(coords);
                }
              }
              el = line.getElementsByTagName('innerBoundaryIs');
              for (i = 0; i < el.length; i++) {
                coords = this.parseCoords(el[i]);
                if (coords) {
                  inner.push(coords);
                }
              }
              if (!polys.length) {
                return;
              }
              if (options.fillColor) {
                options.fill = true;
              }
              if (polys.length === 1) {
                return new L.Polygon(polys.concat(inner), options);
              }
              return new L.MultiPolygon(polys, options);
            },

            getLatLngs: function (xml) {
              var el = xml.getElementsByTagName('coordinates');
              var coords = [];
              for (var j = 0; j < el.length; j++) {
                // text might span many childnodes
                coords = coords.concat(this._read_coords(el[j]));
              }
              return coords;
            },

            _read_coords: function (el) {
              var text = "", coords = [], i;
              for (i = 0; i < el.childNodes.length; i++) {
                text = text + el.childNodes[i].nodeValue;
              }
              text = text.split(/[\s\n]+/);
              for (i = 0; i < text.length; i++) {
                var ll = text[i].split(',');
                if (ll.length < 2) {
                  continue;
                }
                coords.push(new L.LatLng(ll[1], ll[0]));
              }
              return coords;
            }

          });

          L.KMLIcon = L.Icon.extend({

            createIcon: function () {
              var img = this._createIcon('icon');
              img.onload = function () {
                var i = new Image();
                i.src = this.src;
                this.style.width = i.width + 'px';
                this.style.height = i.height + 'px';

                if (this.anchorType.x === 'UNITS_FRACTION' || this.anchorType.x === 'fraction') {
                  img.style.marginLeft = (-this.anchor.x * i.width) + 'px';
                }
                if (this.anchorType.y === 'UNITS_FRACTION' || this.anchorType.x === 'fraction') {
                  img.style.marginTop  = (-(1 - this.anchor.y) * i.height) + 'px';
                }
                this.style.display = "";
              };
              return img;
            },

            _setIconStyles: function (img, name) {
              L.Icon.prototype._setIconStyles.apply(this, [img, name])
              // save anchor information to the image
              img.anchor = this.options.iconAnchorRef;
              img.anchorType = this.options.iconAnchorType;
            }
          });


          L.KMLMarker = L.Marker.extend({
            options: {
              icon: new L.KMLIcon.Default()
            }
          });
        },
        initLeafletMap: function()
        {
          var _this = this;
          _this.initializeKmlPlugin();
          _this.Lmap = L.map( _this.element, _this.settings);
          _this.$el.data('Lmap', _this.Lmap);
          //Lanzo evento de jQUery ready cuando esté listo Leaflet
          //Se dispara cuando termina de cargar o inmediatamente si ya está cargado
          _this.whenReady(function() {
            _this.$el.trigger('ready', _this.Lmap);
          });
          L.control.scale().addTo(_this.Lmap);
          _this.layerControl = L.control.layers({
            "OpenStreetMap": _this.addOSMLayer()
          }).addTo(_this.Lmap);
          _this.Lmap.attributionControl.setPrefix('');
          
        },
        whenReady:function( callback, context )
        {
          var _this = this;
          if (_this.Lmap === undefined) {
            _this.$el.on('ready', function() {
              _this.Lmap.whenReady(callback, context);
            });
          } else {
            _this.Lmap.whenReady(callback, context);
          }
        },
        addOSMLayer: function()
        {
          var _this = this;
          var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
          var osmAttrib='© OpenStreetMap contributors';
          var osm = new L.TileLayer(osmUrl, {attribution:  osmAttrib});
          _this.Lmap.addLayer(osm);
          return osm;
        },
        geoLocate: function( str, callback )
        {
          var _this = this;
          function go() {
            _this.Lmap.setCenter();
          }
          $.getJSON('http://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + str, function(data) {
            _this.fitGeoLocateResult(data[0]);
          }, _this);

        },
        fitGeoLocateResult: function( d ) {
            var _this = this,
              s = d.boundingbox[0],
              w = d.boundingbox[2],
              n = d.boundingbox[1],
              e = d.boundingbox[3],
              southwest = new L.LatLng(s,w),
              northeast = new L.LatLng(n,w),
              boundingbox = new L.LatLngBounds(southwest, northeast);
            _this.Lmap.fitBounds( boundingbox);
        },
        zoom: function(level) {
          this.Lmap.setZoom(level);
        },
        center: function(latLng) {
          this.Lmap.panTo(latLng);
        },
        addMarker: function (options) {
          var _this = this;
          var defaults = {
            lat:0,
            lng:0,
            html:null,
            title:null,
            icon:null
          };
          var o = $.extend({},options);
          var ll = new L.LatLng(o.lat,o.lng);
          if(this.popupGroup == null) {
            this.popupGroup = new L.FeatureGroup().addTo(this.Lmap);
          }
          var m = new L.Marker(ll,o).addTo(this.popupGroup);
          // var popup = L.popup()
          //   .setLatLng(latlng)
          //   .setContent('<p>Hello world!<br />This is a nice popup.</p>')
          //   .openOn(map);
          if(o.hasOwnProperty('html') && o.html) {
            var urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
            if(urlPattern.test(o.html))
            {
              var html = '<iframe src="'+o.html+'"></iframe>'
              m.bindPopup(html);
            }else{
              m.bindPopup(o.html);
            }
          }
        },
        enableMarkerDragging: function() {
          this.popupGroup.eachLayer(function(e){
            e.dragging.enable();
          });
        },
        disableMarkerDragging: function() {
          this.popupGroup.eachLayer(function(e){
            e.dragging.disable();
          });
        },
        addKML: function(options) {
          var o = $.extend({},options);
          if(!o.hasOwnProperty('url') || typeof(o.url) !== "string") return;
          var _this = this;
          var proxyUrl = "http://crossproxy.aws.af.cm?u=" + encodeURIComponent(o.url);
          var k = new L.KML(proxyUrl, {async: true});
          var _this = this;
          this.Lmap.addLayer(k);
        }
    };

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[ pluginName ] = function ( options ) {
        return this.each(function() {
            if ( !$.data( this, "plugin_" + pluginName )  ) {
              $.data( this, "plugin_" + pluginName, new Leaflet( this, options ) );
              $.data( this, "plugin_" + pluginName ).init();                
            }
        });
    };

    $.fn[ 'geolocate' ] = function ( options ) {
        return this.each(function() {
            if (  $.data( this, "plugin_" + pluginName) === undefined ) {
                throw "You need to call $().leaflet() at least once on this selector.";
            } else {
              $(this).data().plugin_leaflet.whenReady(function() {
                this.geoLocate( options );
              }, $(this).data().plugin_leaflet);
              
            }
        });
    };
    $.fn[ 'center' ] = function(lat,lon)
    {
      if(!$.isNumeric(lat) || !$.isNumeric(lon)) return;
      var ll = new L.LatLng(lat,lon);
      return this.each(function(){
        var $this = $(this);
        var a = $this.data('plugin_leaflet');
        if(!a) return;
        a.center(ll);
      });
    }
    $.fn[ 'zoom' ] = function(zoomLevel)
    {
      return this.each(function(){
        var $this = $(this);
        var a = $this.data('plugin_leaflet');
        if (!a) return;
        a.zoom(parseInt(zoomLevel));
      });
    }
    $.fn[ 'addMarker' ] = function(opciones)
    {
      return this.each(function(){
        var o = $.extend({},opciones);
        var $this = $(this);
        var a = $this.data('plugin_leaflet');
        if(!a) return;
        a.addMarker(o);
      });
    };
    $.fn[ 'addKML' ] = function(options)
    {
      return this.each(function(){
        var o = $.extend({},options);
        var $this = $(this);
        var a = $this.data('plugin_leaflet');
        if(!a) return;
        a.addKML(o);
      });
    };
    $.fn[ 'enableMarkerDragging' ] = function()
    {
      return this.each(function(){
        var $this = $(this);
        var a = $this.data('plugin_leaflet');
        if(!a) return;
        a.enableMarkerDragging();
      });
    }
    $.fn[ 'disableMarkerDragging' ] = function()
    {
      return this.each(function(){
        var $this = $(this);
        var a = $this.data('plugin_leaflet');
        if(!a) return;
        a.disableMarkerDragging();
      });
    }

})( jQuery, window, document ); 
