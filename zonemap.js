/**
* The `ZoneMap` module helps to describe initial configuration of particles via a map picture
*
* @class ZoneMap
*/

var ZoneMap = {};

(function() {
    ZoneMap.load = function(url, onload) {
        let imageElement = new Image();
        imageElement.onload = function () {
            let canvas = document.createElement('canvas');
            canvas.width = imageElement.width;
            canvas.height = imageElement.height;
            canvas.getContext('2d').drawImage(imageElement, 0, 0, imageElement.width, imageElement.height);
            let image = canvas.getContext('2d').getImageData(0, 0, imageElement.width, imageElement.height); 
            zonemap = ZoneMap._parse(image);
            onload(zonemap);
        }
        //todo: handle error case when image was not found
        //todo: check if we need to delete the image and/or the canvas in the end
        imageElement.src = url;
    };

    ZoneMap.isPointColor = function(zonemap, x, y, color) {
        x = Math.floor(x);
        y = Math.floor(y);
        let i = (x+y*zonemap.width)*4;
        return zonemap.imageData[i]==color[0] && zonemap.imageData[i+1]==color[1] && zonemap.imageData[i+2]==color[2];
    };

    ZoneMap.isZoneFound = function(zonemap, color) {
        return (color in zonemap.zones);
    };
 
    ZoneMap.spawnLattice = function(zonemap, color, dx, dy, onspawn) {
        if (!ZoneMap.isZoneFound(zonemap, color)) {
            console.log("Nothing is spawned, color not found: ", color);
            console.log(zonemap);
            return;
        }
        let rects = zonemap.zones[color];
        for (rect of rects) {
            for (x=rect.x1+dx/2; x<rect.x2-dx/2; x+=dx) {
                for (y=rect.y1+dy/2; y<rect.y2-dy/2; y+=dy) {
                    if (ZoneMap.isPointColor(zonemap, x, y, color)) {
                        onspawn(x, y);
                    }
                }
            }
        }
    };

    ZoneMap.spawnRandom = function(zonemap, color, amount, onspawn) {
        if (!ZoneMap.isZoneFound(zonemap, color)) {
            console.log("Nothing is spawned, color not found: ", color);
            console.log(zonemap);
            return;
        }
        for (let i=0; i<amount; i++) {
            p = ZoneMap.getRandomPosition(zonemap, color);
            onspawn(p.x, p.y);
        }
    };

    ZoneMap.spawnSeries = function(zonemap, color, onspawn) {
        if (!ZoneMap.isZoneFound(zonemap, color)) {
            console.log("Nothing is spawned, color not found: ", color);
            console.log(zonemap);
            return;
        }
        let rects = zonemap.zones[color];
        for (rect of rects) {
            let cx = (rect.x1+rect.x2)/2;
            let cy = (rect.y1+rect.y2)/2;
            let width = rect.x2-rect.x1;
            let height = rect.y2-rect.y1;
            onspawn(cx, cy, width, height, rect);
        }
    };

    ZoneMap.getBounds = function(zonemap, color) {
        if (!ZoneMap.isZoneFound(zonemap, color)) {
            console.log("Error. getBounds failed, color not found: ", color);
            console.log(zonemap);
            return null;
        }
        var bounds = {
            min: { x: Infinity, y: Infinity },
            max: { x: -Infinity, y: -Infinity }
        };

        let rects = zonemap.zones[color];
        for (rect of rects) {
            if (rect.x1 < bounds.min.x)
                bounds.min.x = rect.x1;

            if (rect.x2 > bounds.max.x)
                bounds.max.x = rect.x2;

            if (rect.y1 < bounds.min.y)
                bounds.min.y = rect.y1;

            if (rect.y2 > bounds.max.y)
                bounds.max.y = rect.y2;
        }
        return bounds;
    };

    ZoneMap.getRandomPosition = function(zonemap, color) {
        if (!ZoneMap.isZoneFound(zonemap, color)) {
            console.log("getRandomPosition failed, color not found: ", color);
            console.log(zonemap);
            return null;
        }
        let rects = zonemap.zones[color];
        let totalArea = 0;
        for (rect of rects) {
            let area = (rect.x2-rect.x1)*(rect.y2-rect.y1);
            totalArea += area;
        }
        let randIndex = Matter.Common.random(0, totalArea);
        for (rect of rects) {
            let area = (rect.x2-rect.x1)*(rect.y2-rect.y1);
            if (randIndex<=area) {
                let x = Math.floor(Matter.Common.random(rect.x1, rect.x2));
                let y = Math.floor(Matter.Common.random(rect.y1, rect.y2));
                if (ZoneMap.isPointColor(zonemap, x, y, color)) {
                    return {x: x, y: y};
                } else {
                    //if we fail we try again
                    //todo: avoid inifity look here
                    return ZoneMap.getRandomPosition(zonemap, color);
                }
            } else {
                randIndex -= area;
            }
        }
    };


    ZoneMap._parse = function(image) {
        let width = image.width;
        let height = image.height;
        let checked = Array(width*height).fill(false);
        let zones = {}
        for (var y=0; y<height; y++) {
            for (var x=0; x<width; x++) {
                if (!checked[y*width+x]) {
                    let rgb = ZoneMap._getPointColor(image, x, y);
                    rect = ZoneMap._findSameColorConnected(image, checked, x, y);
                    if (!zones[rgb]) zones[rgb] = [];
                    zones[rgb].push(rect);
                }
            }
        }
        return {imageData: image.data, width: width, height: height, zones: zones};
    };

    ZoneMap._findSameColorConnected = function(image, checked, startX, startY) {
        let width = image.width;
        let height = image.height;
        let color = ZoneMap._getPointColor(image, startX, startY);
        let minX = startX;
        let maxX = startX;
        let minY = startY;
        let maxY = startY;
        let indexesToCheck = new _Stack(); 
        indexesToCheck.push(startX+startY*width);
        while (indexesToCheck.hasMoreElements()) {
            let i = indexesToCheck.pop();         

            //if out of the borders then skip
            let x = i % width;
            let y = Math.floor(i/width);
            if (x<0 || y<0 || x>=width || y>=height) continue;

            //if this point was already checked then skip it
            if (checked[i]) continue;

            //if not the same color then skip
            let c = ZoneMap._getPointColor(image, x, y);
            if (color[0]!=c[0] || color[1]!=c[1] || color[2]!=c[2]) continue;

            //update the boundary rect
            if (x<minX) minX=x;
            if (x>maxX) maxX=x;
            if (y<minY) minY=y;
            if (y>maxY) maxY=y;

            //mark this point as checed
            checked[i] = true;

            //and check all the neighbours
            indexesToCheck.push((x+1) + (y)*width);
            indexesToCheck.push((x-1) + (y)*width);
            indexesToCheck.push((x) + (y+1)*width);
            indexesToCheck.push((x) + (y-1)*width);
        } 
        return {x1:minX, y1:minY, x2:maxX, y2:maxY};
    };

    ZoneMap._getPointColor = function(image, x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        let i = (x+y*image.width)*4;
        return [image.data[i], image.data[i+1], image.data[i+2]];
    };

    class _Stack {
        constructor(){
            this.data = [];
            this.top = 0;
        }
        push(element) {
            this.data[this.top] = element;
            this.top = this.top + 1;
        }
        pop() {
            this.top = this.top -1;
            return this.data.pop(); 
        }
        hasMoreElements() {
            return this.top !== 0;
        }
    };

})();
