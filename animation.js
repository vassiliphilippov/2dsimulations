/**
* The `Animation` module allows running simple animations like self disappearing objects.
*
* @class Animation
*/

var Animation = {};

(function() {

    Animation.highlight = function(engine, render, position, frames) {
        let options = {
            label: "highlighter",
            isStatic: true, 
            render: {
                visible: true, 
                fillStyle: "yellow",
                opacity: 0.3
            },
            collisionFilter: {
                mask: 0
            }
        }

        let highlighter = Matter.Bodies.circle(position.x, position.y, 40, options);
        Matter.World.add(engine.world, highlighter);

        let counter = 0;
        Matter.Events.on(render, "beforeRender", function listener(event) {
            counter += 1;
            if (counter>=frames/2) {
                //After 50% of frames passed we start to fade away the highlighter
                highlighter.render.opacity = 0.3 * ( 1 - (counter-frames/2) / (frames/2) );
            }
            if (counter>=frames) {
                Matter.Composite.remove(engine.world, highlighter);
                Matter.Events.off(render, "beforeRender", listener);
            }
        });
    };


    Animation.pause = function(runner, render, frames) {
        runner.enabled = false;

        let counter = 0;
        Matter.Events.on(render, "beforeRender", function listener(event) {
            counter += 1;
            if (counter>=frames) {
                runner.enabled = true;
                Matter.Events.off(render, "beforeRender", listener);
            }
        });
    };


})();
