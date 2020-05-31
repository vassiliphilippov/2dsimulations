/**
* The `TextureLoader` module allows running code only after all body textures are loaded.
*
* @class TextureLoader
*/

var TextureLoader = {};

(function() {

    TextureLoader.onAllTextureLoad = function(bodies, onload) {
        let textures = new Set();
        for (let i = 0; i < bodies.length; i++) {
            body = bodies[i];
            for (let k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
                part = body.parts[k];
                if (part.render.sprite && part.render.sprite.texture) {
                    textures.add(part.render.sprite.texture);
                }
            }
        }
        if (textures.size==0) {
            onload();
        } else {
            let loaded = 0;
            textures.forEach(url => {
                let imageElement = new Image();
                imageElement.onload = () => {
                    loaded += 1;
                    if (loaded>=textures.size) {
                        onload();
                    }
                }
                imageElement.src = url;
            });
        }
    };

})();
