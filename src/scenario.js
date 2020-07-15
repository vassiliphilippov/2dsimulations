/**
* The `Scenario` module implements step by step scenarios
*
* @class Scenario
*/

class Scenario {
    constructor(engine, render) {
        this.engine = engine;
        this.render = render;
        this.steps = [];
        this.currentStepIndex = 0;
    }

    add(step) {
        this.steps.push(step);
        return this;
    }

    next(onend) {
        this.currentStepIndex += 1;
        if (this.currentStepIndex < this.steps.length) {
            let currentStep = this.steps[this.currentStepIndex];
            currentStep(() => {this.next(onend)});
        } else {
            if (onend) {
                onend();
            }
        }
    }

    run(onend) {
        if (this.steps.length<1) {
            console.log("Error. Cannot run a scenario with zero steps");
        } else {
            this.currentStepIndex = 0;
            let currentStep = this.steps[0];
            currentStep(() => {this.next(onend)});
        }
    }

    addAnimation(frames, onframe) {
        return this.add((onend) => {
            var tickCounter = 0;
            Matter.Events.on(render, "beforeRender", function listener(event) {
                if (tickCounter<=frames) {
                    onframe(tickCounter, tickCounter/frames);
                } else {
                    Matter.Events.off(render, "beforeRender", listener);
                    onend();
                }
                tickCounter += 1;
            });
        });
    }

    addAction(action) {
        return this.add(onend => {
            action();
            onend();
        });
    }

    addCondition(condition) {
        let conditionStepFunction = (onend) => {
            var callback =  (event) => {
                if (condition()) {
                    Matter.Events.off(render, "beforeRender", callback);
                    onend();
                }
            };
            Matter.Events.on(render, "beforeRender", callback);
        }
        return this.add(conditionStepFunction);
    }

    addOnEvent(object, eventNames, eventChecker, action) {
        return this.add(onend => {
            Matter.Events.on(object, eventNames, function listener(event) {
                if (eventChecker && eventChecker(event)) {            
                    Matter.Events.off(object, eventNames, listener);
                    action(event);
                    onend();
                }
            });
        });
    }

    addOnCollision(collisionString, eventChecker, action) {
        return this.addOnEvent(this.engine, "collision_"+collisionString, 
            (event) => {
                if (eventChecker) {
                    return eventChecker(event, event.particleA, event.particleB);
                } else {
                    return true;
                }
            }, 
            (event) => {
                action(event, event.particleA, event.particleB);
            });
    }

    addWait(frames) {
        return this.addAnimation(frames, (n, progress) => {});
    }

    addLookAtAnimation(objects, frames) {
        objects = Matter.Common.isArray(objects) ? objects : [objects];
        let initialBounds = null;
        let bounds = Scenario._getBounds(objects);
        let mv = (x1, x2, a) => (x1 + (x2-x1)*a*a);

        return this.addAnimation(frames, (n, progress) => {
            if (n==0) {
                initialBounds = Matter.Common.extend({}, this.render.bounds);
            }
            let curBounds = {
                min: { x: mv(initialBounds.min.x, bounds.min.x, progress), y: mv(initialBounds.min.y, bounds.min.y, progress) },
                max: { x: mv(initialBounds.max.x, bounds.max.x, progress), y: mv(initialBounds.max.y, bounds.max.y, progress) }
            };
            ChemistryRender.lookAt(render, curBounds);
        });        
    }

    addRemoveAnimation(frames, world, selector) {
        let bodyList = null;
        return this.addAnimation(frames, (n, progress) => {
            if (n==0) {
                bodyList = selector();
            } else if (n<frames) {
                bodyList.setOpacity(1-progress);
            } else {
                bodyList.remove(world);
            }
        });        
    }

    static _getBounds(objects) {
        // find bounds of all objects
        var bounds = {
            min: { x: Infinity, y: Infinity },
            max: { x: -Infinity, y: -Infinity }
        };

        for (var i = 0; i < objects.length; i += 1) {
            var object = objects[i],
                min = object.bounds ? object.bounds.min : (object.min || object.position || object),
                max = object.bounds ? object.bounds.max : (object.max || object.position || object);

            if (min && max) {
                if (min.x < bounds.min.x)
                    bounds.min.x = min.x;

                if (max.x > bounds.max.x)
                    bounds.max.x = max.x;

                if (min.y < bounds.min.y)
                    bounds.min.y = min.y;

                if (max.y > bounds.max.y)
                    bounds.max.y = max.y;
            }
        }
        return bounds;
    }


};
