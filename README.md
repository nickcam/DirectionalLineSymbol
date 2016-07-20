# DirectionalLineSymbol
ArcGIS javascript custom Line Symbol.

DirectionalLineSymbol inherits from SimpleLineSymbol. It displays directional symbols on the line that indicate the direction of the line.  It also adds the ability to animate the line itself using CSS animations for an SVG \<path\>.
I needed some arrow symobls on my lines (in a feature or graphics layer) to indicate direction but I just wanted to be able to do it in one place.

## Features

- Adds directional graphics to the map along a SimpleLineSymbol starting from start of the line to the end.
- Can be used for Polyline line symbols or as the outline of a Polygon SimpleFillSymbol.
- A few pre-configured symbols to use, or pass in a custom path 'd' attribute string to display any symbol you want.
- Set the amount of pixels in between each direction symbol to space them appropriately depending on the data.
- Just for fun animate the direction symbols appearing along the line.
- All logic contained in the DirectionalLineSymbol class, no need to create seperate renderers or add attributes to graphics (or use text symbols).
- Styled and animated lines defined by user in external CSS file.  (TODO: add configurable line animation settings into constructor.)

## Note
Normally symbol classes are really just used to define how a graphic will appear, but to actually draw the directional symbols along the line DirectionalLineSymbol
breaks that paradigm. I wanted something super simple to call from anywhere - ie: without having to 
create a symbol class and a renderer and possibly other stuff, so just wanted to do -
```
var s = new DirectionalLineSymbol(options);
```
...and all sorted. But to do that had to add graphic specific functions and event handlers for
graphics layers and the map (only once though) within DirectionalLineSymobl. So I can understand why this isn't in the actual api, but wanted a solution anyway.

Code is commented and the options explained in the constructor. How to use is in index.html which is the same as this example page:
http://directionallinesymbol.azurewebsites.net/

Add to, edit or find bugs, thanks!





