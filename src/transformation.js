/**
* The `Transformation` module [//todo: to be described].
*
* @class Transformation
*/

var Transformation = {};

//Todo: implement decomposition, when there is no particleB
(function() {

    Transformation.possibleTransformations = [];
    Transformation.angularFriction = 0.5; //Todo: make them time space scalable
    Transformation.angularAccelerationCoefficient = 0.01; //Todo: make them time space scalable
    Transformation.maximumInteractionDistance = 200; //pm
    Transformation.angleTrashhold = 10; //degrees
                     
    Transformation.init = function(engine) {
        Matter.Events.on(engine, "beforeUpdate", (event) => {
            Transformation.applyAngularAccelerations(engine, event.source.world.bodies);
        });

        Matter.Events.on(engine, "collisionStart", (event) => {
            Transformation.onCollisionStart(engine, event);
        });
    };

    Transformation.applyAngularAccelerations = function(engine, bodies) {
        Profiler.begin("Transformation.applyAngularAccelerations");
        for (let body of bodies) {
            if (body.plugin.chemistry && body.plugin.chemistry.particle) {
                let angularAcceleration  = Transformation.calculateAngluarAcceleration(body, bodies);
                if (angularAcceleration) {
                    Profiler.begin("setAngularVelocity");
                    Matter.Body.setAngularVelocity(body, body.angularVelocity+angularAcceleration);                         
                    Profiler.end();
                }
            }
        }
        Profiler.end();
    };

    Transformation.calculateAngluarAcceleration = function(particle, bodies) {
        Profiler.begin("Transformation.calculateAngluarAcceleration");
        //Todo: performance optimization needed, it is too slow
        let formula = particle.plugin.chemistry.formula;
        let totalAngluarAcceleration = null;
    
        //We enumerate all bodies
        for (let body of bodies) {
            //Find it is a particle
            if (body.plugin.chemistry && body.plugin.chemistry.particle) {
                let particleB = body;
                let formulaB = particleB.plugin.chemistry.formula;
                for (tr of Transformation.possibleTransformations) {
                    //If there could be transformation between those two particles (we assume only one transformation between two types is possible)
                    if ( (tr.A==formula && tr.B==formulaB) || (tr.B==formula && tr.A==formulaB) ) {
                        let screenDist = Matter.Vector.magnitude(Matter.Vector.sub(particle.position, particleB.position)) - Chemistry.particleRadius(particle) - Chemistry.particleRadius(particleB);
                        let spaceDist = Chemistry.screenToSpace(screenDist);
                        //If the particles are close enough
                        if (spaceDist<Transformation.maximumInteractionDistance) {
                            //If prefered angle for particleA specified
                            let angluarAcceleration = 0;
                            if (tr.A==formula && tr.A_angle) {
                                angluarAcceleration = Transformation.calculateAngluarAccelerationForTwoParticles(tr.A_angle, particle, particleB, spaceDist);
                            }
                            if (tr.B==formula && tr.B_angle) {
                                angluarAcceleration = Transformation.calculateAngluarAccelerationForTwoParticles(tr.B_angle, particle, particleB, spaceDist);
                            }
                            if (angluarAcceleration!=0) {
                                if (!totalAngluarAcceleration) totalAngluarAcceleration=0;
                                totalAngluarAcceleration += angluarAcceleration;
                            }
                        }
                    }
                }
            }
        }
        //If there was interaction then we apply angular friction
        if (totalAngluarAcceleration) {
            totalAngluarAcceleration -= particle.angularVelocity * Transformation.angularFriction;
        }

        Profiler.end();
        return totalAngluarAcceleration;
    };

    Transformation.calculateAngluarAccelerationForTwoParticles = function(angle, particle, particleB, spaceDist) {
        let angleToAnotherParticle = Matter.Vector.angle(particle.position, particleB.position);
        let bestCollisionAngle = angle*Math.PI/180;
        let curAngle = bestCollisionAngle + particle.angle;
        let delta = curAngle-angleToAnotherParticle;
        let deltaNormalized = Transformation.getNormalizedAngle(delta);

        let closenessIncrease = (Transformation.maximumInteractionDistance/spaceDist)**2;
        if (closenessIncrease>10) closenessIncrease = 10;
        return -deltaNormalized * Transformation.angularAccelerationCoefficient * closenessIncrease;
    };

    Transformation.onCollisionStart = function(engine, event) {
        for (var pair of event.pairs) {
            bodyA = pair.bodyA.parent;
            bodyB = pair.bodyB.parent;
            let transformation = Transformation.canTransformNow(bodyA, bodyB);

            //Try two particles in different order
            if (!transformation) {
                transformation = Transformation.canTransformNow(bodyB, bodyA);
                if (transformation) {
                    [bodyA, bodyB] = [bodyB, bodyA];
                }
            }

            if (transformation) {
                Matter.Events.trigger(engine, 'beforeTransformation', {bodyA: bodyA, bodyB: bodyB, transformation: transformation});
                result = Transformation.createTransformationParticle(transformation, bodyA, bodyB);
                Matter.World.add(engine.world, result);
                Matter.Composite.remove(engine.world, bodyA);
                Matter.Composite.remove(engine.world, bodyB);
                Matter.Events.trigger(engine, 'afterTransformation', {bodyA: bodyA, bodyB: bodyB, transformation: transformation, result: result});
            }
        }
    };


    Transformation.getResultPosition = function(transformation, AB, particleA, particleB) {
        let particle = particleA;
        let positionName = "ResA_position";
        let angleName = "ResA_angle";
        if (AB=="B") {
            particle = particleB;
            positionName = "ResB_position";
            angleName = "ResB_angle";
        }

        let position = particle.position;
        let angle = particle.angle;

        //If position is defined
        if (transformation[positionName]) {
            let relParticle = (transformation[positionName].rel=="A") ? particleA : particleB;
            let displacement = Matter.Vector.rotate(Chemistry.spaceVectorToScreen(transformation[positionName].v), relParticle.angle);
            position = Matter.Vector.add(relParticle.position, displacement);
        }

        //If angle is defined
        if (transformation[angleName]) {
            let relParticle = (transformation[angleName].rel=="A") ? particleA : particleB;
            angle = relParticle.angle + transformation[angleName].angle*Math.PI/180;
        }

        return [position, angle];
    }

    Transformation.createTransformationParticle = function(transformation, particleA, particleB) {
        let res = [];

        if (transformation.ResA) {
            [position, angle] = Transformation.getResultPosition(transformation, "A", particleA, particleB);
            let pResultA = Chemistry.create(transformation.ResA, position.x, position.y, angle);
            res.push(pResultA);
        
            //Copy position, angle and speed
            Matter.Body.setPosition(pResultA, position); 
            Matter.Body.setAngle(pResultA, angle); 
            Matter.Body.setVelocity(pResultA, particleA.velocity); 
            Matter.Body.setAngularVelocity(pResultA, particleA.angularVelocity); 

            //Copy temperature
            if (particleA.plugin.chemistry && particleA.plugin.chemistry.temperature) {
                pResultA.plugin.chemistry.temperature = particleA.plugin.chemistry.temperature;
            }

            //Copy brownian motion settings
            if (particleA.plugin.chemistry && particleA.plugin.chemistry.brownianMotion) {
                pResultA.plugin.chemistry.brownianMotion = {};
                Matter.Common.extend(pResultA.plugin.chemistry.brownianMotion, particleA.plugin.chemistry.brownianMotion);
            }
        }

        if (transformation.ResB) {
            [position, angle] = Transformation.getResultPosition(transformation, "B", particleA, particleB);
            let pResultB = Chemistry.create(transformation.ResB, position.x, position.y, angle);
            res.push(pResultB);

            //Copy position, angle and speed
            Matter.Body.setPosition(pResultB, position); 
            Matter.Body.setAngle(pResultB, angle); 
            Matter.Body.setVelocity(pResultB, particleB.velocity); 
            Matter.Body.setAngularVelocity(pResultB, particleB.angularVelocity); 

            //Copy temperature
            if (particleB.plugin.chemistry && particleB.plugin.chemistry.temperature) {
                pResultB.plugin.chemistry.temperature = particleB.plugin.chemistry.temperature;
            }

            //Copy brownian motion settings
            if (particleB.plugin.chemistry && particleB.plugin.chemistry.brownianMotion) {
                pResultB.plugin.chemistry.brownianMotion = {};
                Matter.Common.extend(pResultB.plugin.chemistry.brownianMotion, particleB.plugin.chemistry.brownianMotion);
            }
        }

        return res;
    };

    //Checks if two colliding particles can transform. 
    //If yes, then returns the corresponding transformation, otherwise return null
    Transformation.canTransformNow = function(bodyA, bodyB) {
        if (bodyA.plugin.chemistry && bodyA.plugin.chemistry.particle && bodyB.plugin.chemistry && bodyB.plugin.chemistry.particle) {
            let formulaA = bodyA.plugin.chemistry.formula;
            let formulaB = bodyB.plugin.chemistry.formula;
            for (tr of Transformation.possibleTransformations) {
                //If there could be transformation between those two particles 
                if (tr.A==formulaA && tr.B==formulaB) {
                    //Then we check if angle is OK (if needed)
                    if (tr.A_angle) {
                        let angleToAnotherParticle = Matter.Vector.angle(bodyA.position, bodyB.position);
                        let minAngle = (tr.A_angle-Transformation.angleTrashhold)*Math.PI/180 + bodyA.angle;
                        let maxAngle = (tr.A_angle+Transformation.angleTrashhold)*Math.PI/180 + bodyA.angle;
                        if (Transformation.isAngleBetween(minAngle, maxAngle, angleToAnotherParticle)) {
                            return tr;
                        }
                    } else {
                        return tr;
                    }
                }
            }
        }
        return null;
    };


    Transformation.getNormalizedAngle = function(angle) {
        if (angle<0) {
            let enough2PI = ( Math.floor((-angle) / (2*Math.PI)) + 1 ) * (2*Math.PI);
            angle += enough2PI;
        }

        return (angle+Math.PI) % (2*Math.PI) - Math.PI;
    };

    Transformation.isAngleBetween = function(start, end, mid) {
        let delta = mid-start;
        if (delta<0) {
            let enough2PI = ( Math.floor((-delta) / (2*Math.PI)) + 1 ) * (2*Math.PI);
            delta += enough2PI;
        }
        delta = delta % (2*Math.PI);
        return (delta < (end-start));
    };

})();
                