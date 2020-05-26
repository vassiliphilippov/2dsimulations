/**
* The `Background` module implements functionality related to simulation backgrounds.
*
* @class Background
*/

var Background = {};

(function() {
    Background.createBackground = function(backgroundImageUrl, width, height, options) {
        let x = width/2;
        let y = height/2;
        let defaults = {
            label: "background",
            isStatic: true, 
            collisionFilter: {mask: 0}, 
            plugin: {
                background: {
                    isBackground: true
                }
            },  
            render: {
                sprite: {
                    texture: backgroundImageUrl
                }
            }
        };
        if (options) {
            defaults = Matter.Common.extend(defaults, options);
        }
        return Matter.Bodies.rectangle(x, y, width, height, defaults);
    };

    Background.setBackground = function(world, backgroundImageUrl, width, height, options) {
        //Todo: add functionality to make background always on the bottom
        //Todo: remove previous backgrounds
        Matter.World.add(world, Background.createBackground(backgroundImageUrl, width, height, options));
    };
})();
