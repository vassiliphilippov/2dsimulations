/**
* The `Force` module [//todo: to be described].
*
* @class Force
*/

//Todo: move charge to force color
/*
{
  plugin: {
    force: {
      charge: 1,
      forces: 
        red: {
          type: gravity; 
        }
      }      
    } 
  }
*/

var Force = {};

(function() {

    //Types of forces
    Force.GRAVITY = "gravity";
    Force.ATTRACTION = "attraction";
    Force.ELECTROSTATIC = "electrostatic";
    Force.CONSTANT = "constant";

    Force.init = function(engine) {
        Matter.Events.on(engine, "beforeUpdate", (event) => {
            Force.applyForces(engine, event.source.world.bodies);
       });
    };

    Force.applyForces = function(engine, bodies) {
        for (let body of bodies) {
            if (body.plugin.force) {
                let force = Force.calculateTotalBodyForce(body, bodies);
                if (force) {
                    Matter.Body.applyForce(body, body.position, force);    
                }
            }
        }
    };

    Force.calculateTotalBodyForce = function(body, bodies) {
        let totalForce = {x: 0, y: 0};
        for (let body2 of bodies) {
            if (body!=body2) {
                let force = Force.calculateForceBetweenBodies(body, body2);
                if (force) {
                  totalForce = Matter.Vector.add(totalForce, force);
                }
            }
        }

        if (body.plugin.force.brownianMotion) {
            let v = body.plugin.force.brownianMotion;
            let force = {x: Matter.Common.random(-v, v), y: Matter.Common.random(-v, v)};
            totalForce = Matter.Vector.add(totalForce, force);
        }
        //Todo: add handling of constant forces
        return totalForce;
    };

    Force.calculateForceBetweenBodies = function(bodyA, bodyB) {
        let totalForce = {x: 0, y: 0};
        if (!bodyA.plugin.force || !bodyB.plugin.force) return totalForce;

        for (color in bodyA.plugin.force.forces) {
            let chargeA = Force.getCharge(bodyA, color);
            if  (color in bodyB.plugin.force.forces) {
                let chargeB = Force.getCharge(bodyB, color);
                let forceType = bodyA.plugin.force.forces[color].type;
                force = Force.calculateForce(forceType, bodyA, bodyB, chargeA, chargeB);
                if (force) {
                    totalForce = Matter.Vector.add(totalForce, force);
                }
            }
        }

        return totalForce;
    };

    Force.getCharge = function(body, color) {
         if (!body.plugin.force) {
             return null;
         } else {
             if (body.plugin.force.forces[color].charge) {
                 return body.plugin.force.forces[color].charge;
             } else {
                 return body.plugin.force.charge;
             }
         }
    };

    Force.calculateForce = function(forceType, bodyA, bodyB, chargeA, chargeB) {
        d = Matter.Vector.sub(bodyB.position, bodyA.position);
        if (forceType==Force.GRAVITY) {
            return Force.calculateForce_Gravity(bodyA, bodyB, d, chargeA, chargeB);
        }
        if (forceType==Force.ATTRACTION) {
            return Force.calculateForce_Attraction(bodyA, bodyB, d, chargeA, chargeB);
        }
        if (forceType==Force.ELECTROSTATIC) {
            return Force.calculateForce_Electrostatic(bodyA, bodyB, d, chargeA, chargeB);
        }
        //Todo: add more force types like directional gravity
    };

    Force.calculateForce_Gravity = function(bodyA, bodyB, d, chargeA, chargeB) {
        //todo: check if forceCoefficient is redefined in plugin
        if (!chargeA || !chargeB) {
            return {x: 0, y: 0};
        }
        let forceCoefficient = 1;
        let forceValue = forceCoefficient * chargeA * chargeB / Matter.Vector.magnitudeSquared(d);
        return Matter.Vector.mult(Matter.Vector.normalise(d), forceValue);
    };

    Force.calculateForce_Attraction = function(bodyA, bodyB, d, chargeA, chargeB) {
        //todo: check if forceCoefficient is redefined in plugin
        if (!chargeA || !chargeB) {
            return {x: 0, y: 0};
        }
        let forceCoefficient = 1;
        let forceValue = forceCoefficient * chargeA * chargeB;
        return Matter.Vector.mult(Matter.Vector.normalise(d), forceValue);
    };

    Force.calculateForce_Electrostatic = function(bodyA, bodyB, d, chargeA, chargeB) {
        //todo: check if forceCoefficient is redefined in plugin
        if (!chargeA || !chargeB) {
            return {x: 0, y: 0};
        }
        let forceCoefficient = 1;
        let forceValue = -forceCoefficient * chargeA * chargeB / Matter.Vector.magnitudeSquared(d);
        return Matter.Vector.mult(Matter.Vector.normalise(d), forceValue);
    };

    Force._attractionForceColor = function(body, attractor) {
        return "force-" + body.id + "-" + attractor.id;
    };

    Force.addAttraction = function(body, attractor, attractionLevel) {
        //Default attractionLevel value
        if (!attractionLevel) {
            attractionLevel = 0.001;
        }
        //We create a dedicated force type
        const forceColor = Force._attractionForceColor(body, attractor);
        if (!body.plugin.force) {
            body.plugin.force = {forces: {}};
        }
        if (!attractor.plugin.force) {
            attractor.plugin.force = {forces: {}};
        }
        body.plugin.force.forces[forceColor] = {type: Force.ATTRACTION};
        body.plugin.force.charge = attractionLevel;
        attractor.plugin.force.forces[forceColor] = {type: Force.ATTRACTION};
        attractor.plugin.force.charge = 1;
    };

    Force.removeAttraction = function(body, attractor) {
        const forceColor = Force._attractionForceColor(body, attractor);
        if (body.plugin.force && body.plugin.force.forces) {
            delete body.plugin.force.forces[forceColor];
        }
        if (attractor.plugin.force && attractor.plugin.force.forces) {
            delete attractor.plugin.force.forces[forceColor];
        }
    };
})();
