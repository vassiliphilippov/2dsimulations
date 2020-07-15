/**
* The `AtomDrawer` module incapsulates functions related to drawing an atom to a canvas.
*
* @class AtomDrawer
*/

var AtomDrawer = {};

//Todo: potential speed optimization: cash colors
(function() {
    AtomDrawer.drawAtom = function(context, position, angle, radius, color, formula) {
        Profiler.begin("AtomDrawer.drawAtom");
//    ChemistryRender.drawAtom = function(render, atom, radius, particle, singleAtomParticle, context) {
        let c = context;

        //Draw main filled circle
        Profiler.begin("circle");
        c.beginPath();
        c.arc(position.x, position.y, radius, 0, 2 * Math.PI);
        c.fillStyle = color;
        c.fill();
        Profiler.end();

        let edgeWidth = 2;

        //Draw flare
/*        Profiler.begin("flare");
        c.beginPath();
        c.arc(position.x+(radius-edgeWidth/2)/(2*Math.SQRT2), position.y-(radius-edgeWidth/2)/(2*Math.SQRT2), (radius-edgeWidth/2)/2, 0, 2 * Math.PI);
        c.fillStyle = AtomDrawer._getFlareColor(color);
        c.fill();                
        Profiler.end();
*/
        //Draw edge
        Profiler.begin("edge");
        c.lineWidth = edgeWidth;
        c.beginPath();
        c.arc(position.x, position.y, radius, 0, 2 * Math.PI);
        c.strokeStyle = AtomDrawer._getEdgeColor(color);
        c.stroke();
        Profiler.end();

              
        //Draw text  
        Profiler.begin("draw text");
        c.translate(position.x, position.y);
        c.rotate(angle); //Comment if it is not needed to rotate atom labels
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = AtomDrawer._getLabelFont(radius);
        c.fillStyle = AtomDrawer._getLabelTextColor(color);
        c.fillText(AtomDrawer._useSubscript(formula), 0, 0);

        //revert transformation
        c.rotate(-angle);
        c.translate(-position.x, -position.y);
        Profiler.end();

        Profiler.end();
    };

    AtomDrawer._getLabelFont = function(radius) {
       let fontSize = 10;
       if (radius<10) fontSize = 8;
       if (radius<8) fontSize = 6;
       if (radius<7) fontSize = 5;
       if (radius>15) fontSize = 15;
       return fontSize + "px Verdana";
    };

    AtomDrawer._getLabelTextColor = function(fillColor) {
        if (fillColor.substring(0,1) == '#') {
            fillColor = fillColor.substring(1);                           
        }

        var rgb = {};

        // Grab each pair (channel) of hex values and parse them to ints using hexadecimal decoding 
        rgb.r = parseInt(fillColor.substring(0,2),16);
        rgb.g = parseInt(fillColor.substring(2,4),16);
        rgb.b = parseInt(fillColor.substring(4),16);

        let lightnessThreshold = 0.7; //If average lightless more than treshold we use black
        if (rgb.r + rgb.g + rgb.b > 255*3*lightnessThreshold) {
            return "#000000";   
        } else {
            return "#FFFFFF";   
        };
    };

    /**
     * Converts an RGB color value to HSL. Conversion formula
     * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
     * Assumes r, g, and b are contained in the set [0, 255] and
     * returns h, s, and l in the set [0, 1].
     *
     * @param   {number}  r       The red color value
     * @param   {number}  g       The green color value
     * @param   {number}  b       The blue color value
     * @return  {Array}           The HSL representation
     */
    AtomDrawer._rgbToHsl = function(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max == min){
            h = s = 0; // achromatic
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h, s, l];
    }

    /**
     * Converts an HSL color value to RGB. Conversion formula
     * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
     * Assumes h, s, and l are contained in the set [0, 1] and
     * returns r, g, and b in the set [0, 255].
     *
     * @param   {number}  h       The hue
     * @param   {number}  s       The saturation
     * @param   {number}  l       The lightness
     * @return  {Array}           The RGB representation
     */
    AtomDrawer._hslToRgb = function(h, s, l) {
        var r, g, b;

        if (s == 0) {
            r = g = b = l; // achromatic
        } else {
            let hue2rgb = function hue2rgb(p, q, t){
                if(t < 0) t += 1;
                if(t > 1) t -= 1;
                if(t < 1/6) return p + (q - p) * 6 * t;
                if(t < 1/2) return q;
                if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            }

            let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            let p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    AtomDrawer._rgbToHex = function(r,g,b) {
        r = r.toString(16);
        g = g.toString(16);
        b = b.toString(16);

        if (r.length == 1)
            r = "0" + r;
        if (g.length == 1)
            g = "0" + g;
        if (b.length == 1)
            b = "0" + b;

      return "#" + r + g + b;
    }

    AtomDrawer._HexToRgb = function(hex) {
        if (hex.substring(0,1) == '#') {
            hex = hex.substring(1);                           
        }

        // Grab each pair (channel) of hex values and parse them to ints using hexadecimal decoding 
        let r = parseInt(hex.substring(0,2),16);
        let g = parseInt(hex.substring(2,4),16);
        let b = parseInt(hex.substring(4),16);

        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
            console.log("Error. Cannot convert color '" + hex + "' to RGB");
        }

        return [r, g, b]
    }

    AtomDrawer._getEdgeColor = function(fillColor) {
        [r, g, b] = AtomDrawer._HexToRgb(fillColor);
        r = Math.floor(r*0.7);
        g = Math.floor(g*0.7);
        b = Math.floor(b*0.7);
        return AtomDrawer._rgbToHex(r, g, b);
    };

    AtomDrawer._getFlareColor = function(fillColor) {
        [r, g, b] = AtomDrawer._HexToRgb(fillColor);
        r = Math.floor(255-(255-r)*0.7);
        g = Math.floor(255-(255-g)*0.7);
        b = Math.floor(255-(255-b)*0.7);
        return AtomDrawer._rgbToHex(r, g, b);
    };

    AtomDrawer._useSubscript = function(s) {
        //Full table: https://stackoverflow.com/questions/17908593/how-to-find-the-unicode-of-the-subscript-alphabet
        return s.replace("+2", "\u00B2\u207A").
                 replace("+", "\u207A").
                 replace("-", "\u207B").
                 replace("1", "\u00B9").
                 replace("2", "\u00B2").
                 replace("3", "\u00B3").
                 replace("4", "\u2074");
    };

})();
                