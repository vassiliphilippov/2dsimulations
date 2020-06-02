/**
* The `Temperature` module implements logic of temperature related particle movements.
*
* @class Temperature
*/

//todo: add option to disable temperature movement

//todo: prevent super fast particles
var Temperature = {};

(function() {

    Temperature._ramdomEnergyChunk = 0.1;
    Temperature._maxEneryToTemperatureRatio = 3;
    Temperature.kBoltzmannConstant = 1.38e-23;
    Temperature.pmInMeter = 1e12;
    Temperature.daltonMass = 1.66054e-27;

    Temperature.init = function(engine) {
        Matter.Events.on(engine, "afterUpdate", (event) => {
            Temperature.UpdateAllSpeedsToTheirTemperature(engine, event.source.world.bodies);
       });
    };

    Temperature.UpdateAllSpeedsToTheirTemperature = function(engine, bodies) {
        var temperatures = {}
        for (let body of bodies) {
            if (body.plugin.chemistry && (body.plugin.chemistry.temperature!==undefined)) {
                let t = body.plugin.chemistry.temperature;
                if (!(t in temperatures)) {
                    temperatures[t] = []
                }
                temperatures[t].push(body);
            }
        }
        for (t in temperatures) {
            Temperature._UpdateAllSpeedsToGivenTemperature(engine, temperatures[t], t);
        }
    };

    Temperature._UpdateAllSpeedsToGivenTemperature = function(engine, particles, temperature) {
        //We update only speed not rotation and hope that average rotation energy will update automatically through many collisions
        if (particles.length==0) return;
        let totalKineticEnergy = 0;
        for (const p of particles) {
            let kE = Temperature._kineticEnergy(p);
            totalKineticEnergy += kE;
        }
        let averageKineticEnergy = totalKineticEnergy/particles.length;

        let expectedKineticEnergy = Temperature.kBoltzmannConstant * temperature;
        let kineticEnergyMultiplier = expectedKineticEnergy/averageKineticEnergy;
        //todo: replace all let and var with const where appropriate
        for (const p of particles) {
            Temperature._UpdateParticleSpeed(p, expectedKineticEnergy, kineticEnergyMultiplier);
        }
    };

    Temperature._UpdateParticleSpeed = function(p, expectedKineticEnergy, globalKineticEnergyMultiplier) {
        let kE = Temperature._kineticEnergy(p);
        let randomKineticEnergyAddition = Matter.Common.random(-expectedKineticEnergy*Temperature._ramdomEnergyChunk, expectedKineticEnergy*Temperature._ramdomEnergyChunk);
        let newKE = randomKineticEnergyAddition;
        if (isFinite(globalKineticEnergyMultiplier)) {
            newKE += kE*globalKineticEnergyMultiplier;
        }
        if (newKE<0) {
            newKE = expectedKineticEnergy*Temperature._ramdomEnergyChunk;
        }
        if (newKE>expectedKineticEnergy*Temperature._maxEneryToTemperatureRatio) {
            newKE = expectedKineticEnergy*Temperature._maxEneryToTemperatureRatio;
        }
        let newSpeed = Temperature._speedByKineticEnergy(p, newKE);
        if (p.speed!=0) {
            let newVelocity = Matter.Vector.mult(p.velocity, newSpeed/p.speed);
            Body.setVelocity(p, newVelocity);
        } else {
            //If speed was 0 then we need to choose a random direction
            let randomAngle = Matter.Common.random(0, 2*Math.PI);
            Matter.Body.setVelocity(p, {x: newSpeed*Math.cos(randomAngle), y: newSpeed*Math.sin(randomAngle)});
        }
        Temperature._BrownianMotion(p, expectedKineticEnergy);
    };

    Temperature._BrownianMotion = function(particle, expectedKineticEnergy) {
        if (particle.plugin.chemistry && particle.plugin.chemistry.brownianMotion) {
            let probability = Temperature._BrownianMotionProbabilityOfCollision(particle);
            if (Matter.Common.random(0, 1)<probability) {
                let randomAngle = Matter.Common.random(0, 2*Math.PI);
                let forceValue = Temperature._collisionForceByKineticEnergy(expectedKineticEnergy, Temperature._BrownianMotionAtomicMass(particle));
                Matter.Body.applyForce(particle, particle.position, {x: forceValue*Math.cos(randomAngle), y: forceValue*Math.sin(randomAngle)});    
            }
        }
    };

    Temperature._BrownianMotionProbabilityOfCollision = function(particle) {
        let medium = particle.plugin.chemistry.brownianMotion.medium;
        let meanFreePath = 10; //pm, default distance if no settings defines

        if (!medium) {
            medium = "water"; //Default medium
        }
        if (medium=="water") {
            meanFreePath = 10; //pm
        }
        if (medium=="air") {
            meanFreePath = 100; //pm
        }
        if (particle.plugin.chemistry.brownianMotion.meanFreePath) {
            meanFreePath = particle.plugin.chemistry.brownianMotion.meanFreePath;
        }
        let frameDuration = 1; //It seems that one tick is always one second
        let averageMovementDuringOneFrame = particle.speed * frameDuration / Chemistry.spaceScale;
        return averageMovementDuringOneFrame/meanFreePath; 
    };

    Temperature._BrownianMotionAtomicMass = function(particle) {
        if (particle.plugin.chemistry.brownianMotion.atomicMass) {
            return particle.plugin.chemistry.brownianMotion.atomicMass;
        }
        let medium = particle.plugin.chemistry.brownianMotion.medium;
        if (medium=="water") {
            return 18;
        }
        if (medium=="air") {
            return 29;
        }
        return 18; //default is atomicMass of water if nothing else is defined
    };

    Temperature._kineticEnergy = function(particle) {
        if (!particle.plugin.chemistry && !particle.plugin.chemistry.atomicMass) {
            Debug.log("Error. atomMass property is not defined for particle ", particle);
            return 0;
        }

        if (!particle.speed) {
            return 0;
        } else {
            let worldSpeed = particle.speed / (Temperature.pmInMeter * Chemistry.timeScale*Chemistry.spaceScale); //in m/s
            let worldMass = particle.plugin.chemistry.atomicMass * Temperature.daltonMass; // in kg
            return worldMass * worldSpeed * worldSpeed / 2;
        }
    };

    Temperature._speedByKineticEnergy = function(particle, kE) {
        if (!particle.plugin.chemistry && !particle.plugin.chemistry.atomicMass) {
            Debug.log("Error. atomicMass property is not defined for particle ", particle);
            return 0;
        }

        let atomicMass = particle.plugin.chemistry.atomicMass;
        let worldMass = atomicMass * Temperature.daltonMass; // in kg
        let worldSpeed = Math.sqrt(2 * kE / worldMass); //in m/s
        let screenSpeed = worldSpeed * Temperature.pmInMeter * Chemistry.timeScale * Chemistry.spaceScale; //in pixels per rendering second
        return screenSpeed;
    };

    Temperature._collisionForceByKineticEnergy = function(kE, atomicMass) {
        let worldMass = atomicMass * Temperature.daltonMass; // in kg
        let worldSpeed = Math.sqrt(2 * kE / worldMass); //in m/s
        let screenSpeed = worldSpeed * Temperature.pmInMeter * Chemistry.timeScale * Chemistry.spaceScale; //in pixels per rendering second
        let magicCoefficient = 0.0035975; //I found this coefficient through experiments by finding which force we need to apply to a body with mass of 1 and speed of 1 to stop it
        let force = magicCoefficient * atomicMass * screenSpeed;
        return force;
    };
})();
