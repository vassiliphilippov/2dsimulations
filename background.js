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
        //Todo: remove previous backgrounds
        let background = Background.createBackground(backgroundImageUrl, width, height, options);
        Matter.Events.trigger(world, 'beforeAdd', { object: background });
        world.bodies.unshift(background);
        Matter.Composite.setModified(world, true, true, false);
        Matter.Events.trigger(world, 'afterAdd', { object: background });
    };
})();
