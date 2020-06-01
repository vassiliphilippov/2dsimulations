/**
* The `Force` module [//todo: to be described].
*
* @class Force
*/

var Proximity = {};

(function() {

    Proximity.init = function(engine) {
        Matter.Events.on(engine, "beforeUpdate", (event) => {
            Proximity.check(engine, event.source.world.bodies);
       });
    };

    //Todo: make on collision
    //Todo: check each pair only once not twice
    //Todo: for pair of chemistry particles make formula based events
    Proximity.check = function(engine, bodies) {
        for (bodyA of bodies) {
            if (bodyA.plugin.proximity && bodyA.plugin.proximity.levels) {
                if (!bodyA.plugin.proximity.levelFlags) {
                    bodyA.plugin.proximity.levelFlags = {};
                }
                //Alias
                let flags = bodyA.plugin.proximity.levelFlags; 
                for (bodyB of bodies) {
                    if (bodyA==bodyB) continue;
                    let d = Proximity.distanceBetweenBodies(bodyA, bodyB);
                    for (level of bodyA.plugin.proximity.levels) {
                        if (!(level in flags)) {
                            flags[level] = new Set();
                        }
                        if (d<level && !flags[level].has(bodyB)) {
                            event = {bodyA: bodyA, bodyB: bodyB, level: level, distance: d}
                            Matter.Events.trigger(bodyA, "comeClose", event);
                            Matter.Events.trigger(engine, "comeClose", event);
                            flags[level].add(bodyB);
                        }
                        if (d>level && flags[level].has(bodyB)) {
                            event = {bodyA: bodyA, bodyB: bodyB, level: level, distance: d}
                            Matter.Events.trigger(bodyA, "goAway", event);
                            Matter.Events.trigger(engine, "goAway", event);
                            flags[level].delete(bodyB);
                        }
                    }
                }
            }
        }
    };

    //Todo: rename to remove references to Chemistry
    Proximity._distanceBetweenAtoms = function(atomA, atomB) {
        if (!atomA.circleRadius || !atomB.circleRadius) {
            console.log("Error. Atoms without circleRadius property");
            return Matter.Vector.magnitude(Matter.Vector.sub(atomA.position, atomB.position));
        }
        return Matter.Vector.magnitude(Matter.Vector.sub(atomA.position, atomB.position)) - atomA.circleRadius - atomB.circleRadius;
    };

    Proximity.distanceBetweenParticles = function(pA, pB) {
        let minD = Infinity;
        for (let k = pA.parts.length > 1 ? 1 : 0; k < pA.parts.length; k++) {
            let partA = pA.parts[k];
            for (let i = pB.parts.length > 1 ? 1 : 0; i < pB.parts.length; i++) {
                let partB = pB.parts[i];
                let d = Proximity._distanceBetweenAtoms(partA, partB);
                if (d<minD) {
                    minD = d;
                }
            }
        }
        return minD;
    };

    Proximity.distanceToAtom = function(point, atom) {
        if (!atom.circleRadius) {
            console.log("Error. Atom without circleRadius property");
            return Matter.Vector.magnitude(Matter.Vector.sub(atom.position, point));
        }
        return Matter.Vector.magnitude(Matter.Vector.sub(atom.position, point)) - atom.circleRadius;
    };

    Proximity.distanceToParticle = function(point, particle) {
        let minD = Infinity;
        for (let k = particle.parts.length > 1 ? 1 : 0; k < particle.parts.length; k++) {
            let part = particle.parts[k];
            let d = Proximity.distanceToAtom(point, part);
            if (d<minD) {
                minD = d;
            }
        }
        return minD;
    };

    Proximity.distanceBetweenBodies = function(bodyA, bodyB) {
        //Todo: replace with distance between any circle bodies
        if (bodyA.plugin.chemistry && bodyA.plugin.chemistry.particle && bodyB.plugin.chemistry && bodyB.plugin.chemistry.particle) {
            return Proximity.distanceBetweenParticles(bodyA, bodyB);
        } else {
             //Todo: Implement distance to other types of bodies like rectangle
             return Matter.Vector.magnitude(Matter.Vector.sub(bodyA.position, bodyB.position));
        }
    };

})();
