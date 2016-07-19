define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/query",
  "dojo/dom",
  "dojo/dom-construct",
  "dojo/dom-style",
  "dojox/gfx",

  "esri/geometry/screenUtils",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/PictureMarkerSymbol",
  "esri/graphic",
  "esri/geometry/Point",
  "esri/geometry/ScreenPoint",

  "dojo/dom-attr",

  "dojo/_base/fx",
  "dojo/fx",
  "dojox/gfx/fx",
  "dojo/on"
], function (
  declare, lang, array, query, dom, domConstruct, domStyle, gfx,
  screenUtils, SimpleLineSymbol, SimpleMarkerSymbol, PictureMarkerSymbol, Graphic, Point, ScreenPoint,
  domAttr,
  fx, coreFx, shapeFx, on
) {
    return declare([SimpleLineSymbol], {
        constructor: function (options) {
            /* options description:
                Same options as a SimpleLineSymbol - the extra options described below:
                
                directionSymbol (string or SimpleMarkerSymbol or PictureMarkerSymbol): default null.  If not specified, no arraows will be drawn.
                                 This can be one of four things
                                 1) a string that is one of the pre-defined paths, 'arrow1', 'arrow2', 'arrow3' or 'arrow4'
                                 2) a string that represents a path attribute value to apply to the graphic. Should point to the left <-- and the angle calcs will take care of positioning.
                                 3) A PictureMarkerSymbol. The picture should be pointed to the left <-- and the angle cals will position it.
                                 4) A SimpleMarker Symbol. Could be a standard one or one with a custom path. If a custom path, could just pass the path as a string as in option 2. Also position pointing left.
                
                directionSize (number): default 12. The size of the direction symbol.
                directionColor (esri/Color): default 'color of SimpleLineSymbol - this.color'. The color of the direction symbol. Will default to whatever this.color is - ie: the color of the SimpleLineSymbol.
                directionPixelBuffer (number) : default 40. This is the gap in pixels between each direction symbol. If the length of a line segment is less than this amount no direction symbol will be drawn on that segment,
                animationRepeat (number): default undefined. If set the direction symbol will animate displying along the line. The value sets how many time to repeat the whole animation. Use Infinity to go forever. Can also just be set when calling animateDirection() after instantiation.
                animationDuration (number): default 350. Only used if animationRepeat is set. This is the amount of milliseconds each invidual animation will take to complete. Lower values mean quicker animations.
                animateLine (boolean): default is false.  Must specify in order to animate line.
                lineAnimationDuration (number): default is 450.  Number of milliseconds anuimation will take to complete.  Lower values mean quicker animations.
            */

            this.inherited(arguments);

            this.setStyle(options.style);
            this.setColor(options.color);
            this.setWidth(options.width);

            this.directionSymbols = {
                arrow1: "m0.5,50.5c0,0 99.5,-41 99.5,-41c0,0 0.5,81.5 0.5,81.5c0,0 -100,-40.5 -100,-40.5z",
                arrow2: "M1,50l99.5,-50c0,0 -40,49.5 -40,49.5c0,0 39.5,50 39.5,50c0,0 -99,-49.5 -99,-49.5z",
                arrow3: "m0.5,50.5l90,-50l9,9.5l-79.5,40.5l80,39.5l-10,10.5l-89.5,-50z",
                arrow4: "m55.4605,51.5754l43.0685,-48.2908l-43.3797,48.2908l43.8197,44.8899l-43.5085,-44.8899zm-6.0505,42.3899l-0.44,-88.1807l-43.37967,45.7908l43.81967,42.3899z"
            };

            this.directionColor = options.directionColor || this.color; //a color for the direction symbol, default to the line color

            this.directionSize = options.directionSize || 12;
            this.directionPixelBuffer = options.directionPixelBuffer || 40; //number, default 40. the amount of pixels in between each symbol on the line. If a segment of the lines length is less than this pixel length a symbol won't be added to that segment.
            this.animationRepeat = options.animationRepeat; //number : default undefined: the animation repeat to apply. If set will start animating straight away.
            this.animationDuration = options.animationDuration || 350; //number default 350. The milliseconds to fade in when animating

            this.directionSymbol = options.directionSymbol || null;

            this.graphics = [];

            this.drawGraphicDirection = this._drawDirection;
            this.type = "DirectionalLineSymbol";

            this.useDirectionGraphic = this.directionSymbol == null ? false : true;
            this.animateLine = options.animateLine || false;
        },


        getStroke: function () {
            //Use getStroke to init the direction graphics

            if(this.useDirectionGraphic){
                //Get the graphic, walk the call stack up. Do it slightly differently depending on whether it's a polyline or polygon, (SimpleLineSymbol or SimpleFillSymbol)
                var graphic = arguments.callee.caller.arguments.length > 0 ? arguments.callee.caller.arguments[4] : arguments.callee.caller.caller.arguments[4];
                if(graphic && (graphic.dlsSymbolGroup == null || graphic.dlsSymbolGroup == undefined)){
                    this.graphics.push(graphic);

                    //create a group for this graphics direction symbols
                    var layer = graphic.getLayer();
                    var map = layer.getMap();

                    graphic.dlsSymbolGroup = layer._div.createGroup();

                    //draw the direction symbols for the first time
                    this._drawDirection(graphic, layer, map);

                    //add graphic remove event to the layer if it doesn't already exist
                    if (!layer.dlsGraphicRemove) {
                        layer.dlsGraphicRemove = layer.on("graphic-remove", function (e) {
                            if (e.graphic.dlsSymbolGroup) {
                                //remove all direction symbols if the graphic has any and destroy the group node
                                dojo.query(".dls-symbol", e.graphic.dlsSymbolGroup.rawNode).forEach(dojo.destroy);
                                dojo.destroy(e.graphic.dlsSymbolGroup.rawNode);
                                e.graphic.dlsSymbolGroup = null;
                            }
                        });
                    }

                    //add a graphic draw event if the layer of this graphic is the map.graphics layer. This is so the draw toolbar will refresh with symbols when drawing
                    if (!map.graphics.dlsGraphicDraw) {
                        map.graphics.dlsGraphicDraw = map.graphics.on("graphic-draw", function (e) {
                            if (e.graphic.dlsSymbolGroup) {
                                var g = e.graphic;
                                var sym = g.symbol.type === "DirectionalLineSymbol" ? g.symbol : g.symbol.outline && g.symbol.outline.type === "DirectionalLineSymbol" ? g.symbol.outline : null;
                                if (sym) {
                                    sym.drawGraphicDirection(g, this, this.getMap());
                                }
                            }
                        });
                    }

                    if (!map.dlsExtChanged) {
                        map.dlsExtChanged = map.on("extent-change", function (e) {
                            //loop the map graphics layer looking for directional line symnbols
                            for (var i = 0, len = this.graphics.graphics.length; i < len; i++) {
                                var g = this.graphics.graphics[i];
                                if (!g.symbol) continue;

                                if (g.attributes && g.attributes.isDirectionalGraphic) {
                                    layer.remove(g);
                                    j--;
                                    jLen--;
                                    continue;
                                }

                                var sym = g.symbol.type === "DirectionalLineSymbol" ? g.symbol : g.symbol.outline && g.symbol.outline.type === "DirectionalLineSymbol" ? g.symbol.outline : null;
                                if (sym) {
                                    sym.drawGraphicDirection(g, layer, this);
                                }

                            }

                            //loop any other graphics layers looking for directional line symnbols
                            for (var i = 0, len = this.graphicsLayerIds.length; i < len; i++) {
                                var layer = this.getLayer(this.graphicsLayerIds[i]);
                                if (!layer.dlsGraphicRemove) continue; //skip this layer if it doesn't have the remove event, ie: has no directional line symbols in it.
                                for (var j = 0, jLen = layer.graphics.length; j < jLen; j++) {
                                    var g = layer.graphics[j];
                                    if (!g.symbol) continue;

                                    if (g.attributes && g.attributes.isDirectionalGraphic) {
                                        layer.remove(g);
                                        j--;
                                        jLen--;
                                        continue;
                                    }

                                    var sym = g.symbol.type === "DirectionalLineSymbol" ? g.symbol : g.symbol.outline && g.symbol.outline.type === "DirectionalLineSymbol" ? g.symbol.outline : null;
                                    if (sym) {
                                        sym.drawGraphicDirection(g, layer, this);
                                    }
                                }
                            }
                        });
                    }
                }
            }
            if(this.animateLine){
                var svgNode = arguments.callee.caller.arguments.length > 0 ? arguments.callee.caller.arguments[0].rawNode : arguments.callee.caller.caller.arguments[0].rawNode;
                if(svgNode.tagName == "path" && array.indexOf(svgNode.classList, "dls-line") == -1){
                    // Note: this only adds the class, CSS must be applied 
                    svgNode.classList.add("dls-line");
                }
            }
            return this.inherited(arguments);
        },

        _drawDirection: function (graphic, graphicsLayer, map) {

            if (!graphic.dlsSymbolGroup) {
                return;
            }

            var group = graphic.dlsSymbolGroup;
            var geometry = graphic.geometry;

            //match geometry to map spatial reference
            if (geometry.spatialReference.wkid !== map.spatialReference.wkid) {
                if (!esri.geometry.canProject(geometry, map)) {
                    console.error("Can't project geometry wkid - " + geometry.spatialReference.wkid + " to map wkid " + map.spatialReference.wkid);
                }
                else {
                    geometry = esri.geometry.project(geometry, map);
                }
            }

            graphic.directions = [];
            dojo.query(".dls-symbol", graphic.dlsSymbolGroup.rawNode).forEach(dojo.destroy);

            //use a screen geometry to calculate and create symbols.
            var screenGeo = screenUtils.toScreenGeometry(map.extent, map.width, map.height, geometry);
            var screenExtent = screenUtils.toScreenGeometry(map.extent, map.width, map.height, map.extent);

            var layerTrans = graphicsLayer._div.getTransform(); //get any transform the graphics layer group may have as if one exist use it to offset the direction symbol points
            var outerArray = geometry.type === "polyline" ? screenGeo.paths : screenGeo.rings;
            if (!outerArray) {
                console.error("Can't apply DirectionalLineSymbol to geometry " + geometry.type);
                return;
            }

            for (var i = 0, iLen = outerArray.length; i < iLen; i++) {
                var line = outerArray[i];
                for (var j = 0, jLen = line.length - 1; j < jLen; j++) {
                    if (j === line.length) {
                        continue;
                    }

                    var pt1 = line[j];
                    var pt2 = line[j + 1];

                    //get the angle of the segment to rotate the symbol. The -180 relates to the fact that each path should point directly left as a starting direction.
                    var angle = ((180 / Math.PI) * Math.atan2(pt2[1] - pt1[1], pt2[0] - pt1[0])) - 180;
                    var directionPoints = this._getDirectionPoints(pt1, pt2, screenExtent);

                    //add a symbol shape for each direction point
                    for (var x = 0, xLen = directionPoints.length; x < xLen; x++) {

                        var sym;
                        //get the symbol. If it's not a string (ie: one of the pre-canned symbols) it should be a SimpleMarkerSymbol or PictureMarkerSymbol.

                        if (this.directionSymbol.type === "simplemarkersymbol" || this.directionSymbol.type === "picturemarkersymbol") {
                            sym = lang.clone(this.directionSymbol);
                        }
                        else if (typeof this.directionSymbol === "string") {
                            //if directionSymbol is a string, set the path of a simple marker symbol to the one the predefined paths if it is set to one of those, or set the path to the string. 
                            sym = new SimpleMarkerSymbol();
                            sym.setSize(this.directionSize)
                                    .setPath(this.directionSymbols[this.directionSymbol] ? this.directionSymbols[this.directionSymbol] : this.directionSymbol)
                                    .setOutline(null)
                                    .setColor(this.directionColor)
                        }
                        else {
                            console.error("directionSymbol must be set to one of the pre-defined strings {'arrow1', 'arrow2', 'arrow3', 'arrow4'}, or a SimpleMarkerSymbol or PictureMarkerSymbol.");
                        }


                        sym.setAngle(angle);
                        var g = new Graphic();
                        g.setSymbol(sym);
                        g.attributes = { isDirectionalGraphic: true };
                        var sp = new ScreenPoint(directionPoints[x][0], directionPoints[x][1]);
                        var mp = map.toMap(sp);
                        g.geometry = mp;
                        graphicsLayer.add(g);

                        var s = g.getShape();
                        group.add(s);
                        g.attr("class", "dls-symbol");
                        graphic.directions.push(g);
                        if (!graphic.visible) g.hide();

                        g.origJson = g.toJson();
                        g.toJson = this.directionGraphicToJson;


                    }
                }
            }

            if (graphic.dlsAnimationRepeat && (graphic.dlsAnimationRepeat > 1 || graphic.dlsAnimationRepeat === Infinity)) {
                this._animateGraphic(graphic, graphic.dlsAnimationRepeat);
            }

        },

        _getDirectionPoints: function (pt1, pt2, screenExtent) {
            var points = [];

            //set an extent that contains the max and mins of the two points
            var xmin = pt1[0] < pt2[0] ? pt1[0] : pt2[0],
                xmax = pt1[0] > pt2[0] ? pt1[0] : pt2[0],
                ymin = pt1[1] < pt2[1] ? pt1[1] : pt2[1],
                ymax = pt1[1] > pt2[1] ? pt1[1] : pt2[1];

            var exmin = screenExtent.xmin < screenExtent.xmax ? screenExtent.xmin : screenExtent.xmax,
                exmax = screenExtent.xmin > screenExtent.xmax ? screenExtent.xmin : screenExtent.xmax,
                eymin = screenExtent.ymin < screenExtent.ymax ? screenExtent.ymin : screenExtent.ymax,
                eymax = screenExtent.ymin > screenExtent.ymax ? screenExtent.ymin : screenExtent.ymax;

            //get the vector of the two points
            var vector = [pt2[0] - pt1[0], pt2[1] - pt1[1]];

            //get the length of the segment
            var length = Math.sqrt((vector[0] * vector[0]) + (vector[1] * vector[1]));
            if (length < this.directionPixelBuffer) {
                return points; //not long enough to bother so return early
            }

            //normalize the vector by dividing by length, then multiply by the desired buffer length to spread out the symbols by that much
            vector[0] = (vector[0] / length) * this.directionPixelBuffer;
            vector[1] = (vector[1] / length) * this.directionPixelBuffer;

            //create a temp point that starts at the beginning and adds the calculated vector
            var tp = [pt1[0] + vector[0], pt1[1] + vector[1]];

            //loop while the temp point is in the extent calculated earlier. This will add multiple direction symbols until no more are needed.
            while (tp[0] >= xmin && tp[0] <= xmax && tp[1] >= ymin && tp[1] <= ymax) {
                //todo - might need to swap the max and mins if one is greater then the other

                //only add the point if it's in the visible extent
                if (tp[0] >= exmin && tp[0] <= exmax && tp[1] >= eymin && tp[1] <= eymax) {
                    points.push([tp[0], tp[1]]); //add the point to display a symbol
                }

                tp = [tp[0] + vector[0], tp[1] + vector[1]]; //add the vector values to the temp point values again
            }

            return points;
        },

        get: function (property) {
            if (this[property]) {
                return this[property];
            }
            return null;
        },

        setDirectionSymbol: function (symbol) {
            this.directionSymbol = symbol;
            this._drawDirection();
        },

        animateDirection: function (repeat, duration) {

            if (repeat) {
                var rpt = parseInt(repeat);
                if (isNaN(rpt)) {
                    rpt = Infinity;
                }
                this.animationRepeat = rpt;
            }

            if (!this.animationRepeat || this.animationRepeat < 1) {
                this.stopAnimation();
                return;
            }

            if (duration) this.animationDuration = duration;

            this.animationChain = null;
            if (this.animationEnd) {
                this.animationEnd.remove();
            }

            //Sets up an animation chain where direction symbols are removed then faded in one at a time in order. Could add different types of animations here instead.
            var dur = this.animationDuration;
            for (var i = 0, len = this.graphics.length; i < len; i++) {
                var g = this.graphics[i];
                if (!g.dlsSymbolGroup) continue;
                this._animateGraphic(g, this.animationRepeat);
            }
        },

        _animateGraphic: function (g, repeat) {
            var anims = [];
            var dur = this.animationDuration;

            if (g.dlsAnimationChain) {
                g.dlsAnimationChain.stop();
            }

            //Just does a fade-in in order of each direction symbol - could be changed to do some other animation
            dojo.query(".dls-symbol", g.dlsSymbolGroup.rawNode).forEach(function (path) {
                fx.fadeOut({ node: path, duration: 10 }).play();
                var fi = fx.fadeIn({
                    node: path,
                    duration: dur
                });
                anims.push(fi);
            });

            g.dlsAnimationRepeat = repeat;
            g.dlsAnimationChain = coreFx.chain(anims);
            g.dlsAnimationEnd = on(g.dlsAnimationChain, "End", lang.hitch(this, function () {
                if (!isNaN(repeat) && repeat > 1) {
                    repeat--;
                    this._animateGraphic(g, repeat);
                }
                else if (repeat === Infinity) {
                    this._animateGraphic(g, repeat);
                }
            }));

            try {
                g.dlsAnimationChain.play();
            } catch (err) {
                //TODO: Possibly fix this. Swallow any play exception here - will occur when zooming and paths are zoomed out of screen, doens't affect other functions or the new animation.
            }
        },

        stopAnimation: function () {

            for (var i = 0, len = this.graphics.length; i < len; i++) {
                var g = this.graphics[i];
                if (g.dlsSymbolGroup) {
                    dojo.query(".dls-symbol", g.dlsSymbolGroup.rawNode).forEach(function (path) {
                        fx.fadeIn({ node: path, duration: 10 }).play();
                    });

                    g.dlsAnimationRepeat = 0;
                    if (g.dlsAnimationChain) g.dlsAnimationChain.stop();
                    if (g.dlsAnimationEnd) g.dlsAnimationEnd.remove();

                }
            }
        },

        toJson: function () {
            var json = this.inherited(arguments);
            var rgba = this.color.toRgba();
            rgba[3] = rgba[3] * 255;
            json.color = rgba;
            return json;
        },


        /*        
         Override the directional graphics toJson method so that we can fix the angle when printing.
         Doing this as when printed using a print task the angles of the directional symbols is incorrect.
         Symbol and json values for angles are different for the same value (see here https://developers.arcgis.com/javascript/jsapi/esri.symbols.jsonutils-amd.html#getshapedescriptors)

         But for the print task to print them correctly the json seems to need to be the same as the graphic symbol, but only the first time though, other times it will print fine.

        */
        directionGraphicToJson: function () {
            if (this.jsonUpdated || !this.origJson.symbol || !this.origJson.symbol.angle) return this.origJson;
            this.origJson.symbol.angle = this.origJson.symbol.angle * -1;
            this.jsonUpdated = true;
            return this.origJson;
        },

    });
});

