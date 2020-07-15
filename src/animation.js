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
                fillStyle: "#FFF200",
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


    Animation.startAnimation = function (body, attractors, attractionLevel, onend) {
        body.plugin.animation = {
            wayPoints: attractors,
            currentWayPointIndex: 0,
            attractionLevel: attractionLevel
        };

        Matter.Common.extend(body, {plugin: {proximity: {levels: [10]}}});

        Force.addAttraction(body, attractors[0], attractionLevel);

        //Save temperature to avoid slowing down other particles with the same temperature
        let savedTemperature = null;
        if (body.plugin.chemistry && body.plugin.chemistry.temperature) {
            savedTemperature = body.plugin.chemistry.temperature;
            body.plugin.chemistry.temperature = 0;
        }

        Matter.Events.on(body, "comeClose", function listener(event) {
            let bodyB = event.bodyB;

            let animation = body.plugin.animation;
            let target = animation.wayPoints[animation.currentWayPointIndex];
            if (bodyB==target) {
                Force.removeAttraction(body, target);
                animation.currentWayPointIndex += 1;
                if (animation.currentWayPointIndex < animation.wayPoints.length) {
                    let nextTarget = animation.wayPoints[animation.currentWayPointIndex];
                    Force.addAttraction(body, nextTarget, animation.attractionLevel);
                } else {
                    Matter.Events.off(body, "comeClose", listener);
                    delete body.plugin.animation;
                    //Restoring the temperature
                    if (savedTemperature) {
                        body.plugin.chemistry.temperature = savedTemperature;
                    }
                    onend(body);
                }
            }
        }); 
    };

    Animation.getAnimationAttractorList = function(engine, colorFirst, colorNext) {
        let a = new AttractorList(engine).zoneMapColor(colorFirst).getFirst();
        let attractors = new AttractorList(engine).zoneMapColor(colorNext).toArray();
        let pathAttractors = [a];
        let prevPosition = a.position;
        while (attractors.length>0) {
            let iMin = 0;
            let minDist = Infinity;
            for (let i=0; i<attractors.length; i++) {
                let dist = Matter.Vector.magnitude(Matter.Vector.sub(prevPosition, attractors[i].position));
                if (dist<minDist) {
                    minDist = dist;
                    iMin = i;
                }
            }
            prevPosition = attractors[iMin].position;
            pathAttractors.push(attractors[iMin]);
            attractors.splice(iMin, 1);
        }
        return pathAttractors;
    };


})();
