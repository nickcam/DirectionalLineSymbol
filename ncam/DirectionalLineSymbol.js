define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/query",
  "dojo/dom",
  "dojo/dom-construct",
  "dojo/dom-style",
  "dojox/gfx",
  "esri/geometry/screenUtils",
  "esri/symbols/SimpleLineSymbol",
  "dojo/_base/fx",
  "dojo/fx",
  "dojox/gfx/fx",
  "dojo/on"
], function (
  declare, lang, query, dom, domConstruct, domStyle, gfx, screenUtils, SimpleLineSymbol, fx, coreFx, shapeFx, on
) {
    return declare([SimpleLineSymbol], {
        constructor: function (options) {
            /* options description:
                Same options as a SimpleLineSymbol - the extra options described below:
                
                directionColor (dojo.Color): default 'color of SimpleLineSymbol - this.color'. The color of the direction symbol. Will default to whatever this.color is - ie: the color of the SimpleLineSymbol.
                directionFillColor (dojo.Color):  default 'color of SimpleLineSymbol - this.color'. The color of the fill of the direction symbol if it has an area to fill. Will default to whatever this.color is - ie: the color of the SimpleLineSymbol.
                directionScale (number): default 1. The scale to apply to the direction symbols that will affect their size. 1 = original size of path, 0.5 = 50% of size, 2 = 200%
                directionStyle (string): default 'arrow1'. The definition of the path to apply. It can be one of the prefilled direction symbols, 'arrow1', 'arrow2', 'arrow3' or 'doublePointer'. Or you can pass in any path string. any custom path should point to the direct left '<--' so the angle settings will work.
                directionPixelBuffer (number) : default 40. This is the gap in pixels between each direction symbol. If the length of a line segment is less than this amount no direction symbol will be drawn on that segment,
                animationRepeat (number): default undefined. If set the direction symbol will animate displying along the line. The value sets how many time to repeat the whole animation. Use Infinity to go forever. Can also just be set when calling animateDirection() after instantiation.
                animationDuration (number): default 350. Only used if animationRepeat is set. This is the amount of milliseconds each invidual animation will take to complete. Lower values mean quicker animations.
            */

            this.inherited(arguments);
            this.style = options.style;
            this.color = options.color;
            this.width = options.width;

            this.directionSymbols = {
                arrow1: "M 0,0 -0.05076273,-5.3788072 -12.5,0 0.07550633,5 Z",
                arrow2: "M 0.0,0.0 L -2.2072895,0.016013256 L 8.7185884,-4.0017078 C 6.9730900,-1.6296469 6.9831476,1.6157441 8.7185878,4.0337352 z",
                arrow3: "M 0.0,0.0 L 5.0,-5.0 L -12.5,0.0 L 5.0,5.0 L 0.0,0.0 z",
                doublePointer: "M 1.678221,0.39284204 13.844722,-7.2154034 1.590332,0.39284204 13.969015,7.46527 Z m -14,0 L -0.15527772,-7.2154034 -12.409668,0.39284204 -0.03098494,7.46527 Z"

            };

            this.directionColor = options.directionColor || this.color; //a color for the direction symbol, default to the line color
            this.directionFillColor = options.directionFillColor || this.directionColor; //a color for the fill. default to color of direction symbol.
            this.directionScale = options.directionScale || 1; //default 1. The scale of the direction graphic. 1 = 100%. 0.5 = 50%, 2 = 200%.
            this.directionStyle = options.directionStyle || "arrow1";
            this.directionPixelBuffer = options.directionPixelBuffer || 40; //number, default 40. the amount of pixels in between each symbol on the line. If a segment of the lines length is less than this pixel length a symbol won't be added to that segment.
            this.animationRepeat = options.animationRepeat; //number : default undefined: the animation repeat to apply. If set will start animating straight away.
            this.animationDuration = options.animationDuration || 350; //number default 350. The milliseconds to fade in when animating

            this.graphics = [];

            this.drawGraphicDirection = this._drawDirection;
            this.type = "DirectionalLineSymbol";
        },

        getStroke: function () {
            //Use getStroke to init the direction graphics

            //Get the graphic, walk the call stack up. Do it slightly differently depending on whether it's a polyline or polygon, (SimpleLineSymbol or SimpleFillSymbol)
            var graphic = arguments.callee.caller.arguments.length > 0 ? arguments.callee.caller.arguments[4] : arguments.callee.caller.caller.arguments[4];
            if (!graphic) {
                return this.inherited(arguments); //couldn't find a graphic
            }

            if (graphic.dlsSymbolGroup) {
                return this.inherited(arguments); //this graphic already has a dlsSymbolGroup property so nothing to init.
            }

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
                        //remove all direction symbols if the graphic has any
                        dojo.query(".dls-symbol", e.graphic.dlsSymbolGroup.rawNode).forEach(dojo.destroy);
                        e.graphic.dlsSymbolGroup = null;
                    }
                });
            }

            //add a graphic draw event if the layer of this graphic is the map.graphics layer. This is so the draw toolbar will refresh will symbols when drawing
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

            var map = layer.getMap();
            if (!map.dlsExtChanged) {
                map.dlsExtChanged = map.on("extent-change", function (e) {
                    //loop the map graphics layer looking for directional line symnbols
                    for (var i = 0, len = this.graphics.graphics.length; i < len; i++) {
                        var g = this.graphics.graphics[i];
                        if (!g.symbol) continue;
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
                            var sym = g.symbol.type === "DirectionalLineSymbol" ? g.symbol : g.symbol.outline && g.symbol.outline.type === "DirectionalLineSymbol" ? g.symbol.outline : null;
                            if (sym) {
                                sym.drawGraphicDirection(g, layer, this);
                            }
                        }
                    }
                });
            }
            return this.inherited(arguments);
        },

        _drawDirection: function (graphic, graphicsLayer, map) {

            //set some variables based on current options
            this.directionStroke = { color: this.directionColor, style: "solid", width: "1" };
            if (this.directionStyle && this.directionSymbols[this.directionStyle]) {
                this.directionStyle = this.directionSymbols[this.directionStyle];
            }

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
                    if (j == line.length) {
                        continue;
                    }

                    var pt1 = line[j];
                    var pt2 = line[j + 1];

                    //get the angle of the segment to rotate the symbol. The -180 relates to the fact that each path should point directly left as a starting direction.
                    var angle = ((180 / Math.PI) * Math.atan2(pt2[1] - pt1[1], pt2[0] - pt1[0])) - 180;
                    var directionPoints = this._getDirectionPoints(pt1, pt2, screenExtent);

                    //add a symbol shape for each direction point
                    for (var x = 0, xLen = directionPoints.length; x < xLen; x++) {

                        var path = group.createPath();
                        path.setStroke(this.directionStroke)
                             .setShape(this.directionStyle);

                        if (this.directionFillColor) {
                            path.setFill(this.directionFillColor);
                        }

                        var tx = directionPoints[x][0];
                        var ty = directionPoints[x][1];
                        if (layerTrans) {
                            tx -= layerTrans.dx;
                            ty -= layerTrans.dy;
                        }

                        path.applyTransform(gfx.matrix.translate(tx, ty))
                            .applyTransform(gfx.matrix.rotateg(angle));

                        if (this.directionScale !== 1) {
                            path.applyTransform(gfx.matrix.scale(this.directionScale));
                        }

                        path.rawNode.setAttribute("class", "dls-symbol");
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

        setDirectionStyle: function (style) {
            this.directionStyle = style;
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
                //TODO: Fix this. Swallow any play exception here - will occur when zooming and paths are zoomed out of screen, doens't affect other functions or the new animation.
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
        }
    });
});

