/**
* The `Crystal` module implements crystal lattice related functionality 
*
* @class Crystal
*/

var Crystal = {};

(function() {
    Crystal.crystalInfos = [
        {
            formula: "CuSO4",
            places : {
                1: {formula: "Cu+2", position: {x: 140, y: 140}, angle: 0, charge: 2},
                2: {formula: "SO4-2", position: {x: 403, y: 403}, angle: 0, charge: -2}
            },
            elementaryCellSize: {x: 526, y: 526}
        }
    ];

    Crystal.init = function(engine) {
        Matter.Events.on(engine, "beforeUpdate", (event) => {
            Crystal.applyForcesAndCheck(engine, engine.world);
        });
    };

    Crystal.isCrystal = function(composite) {
        return composite.plugin.crystal && composite.plugin.crystal.isCrystal;
    };

    Crystal.forEachCrystal = function(world, callback) {
        for (composite of world.composites) {
            if (Crystal.isCrystal(composite)) {
                callback(composite);
            }
        }
    };

    Crystal.applyForcesAndCheck = function(engine, world) {
        let allBorderPositionsByFromula = {};

        Crystal.forEachCrystal(world, crystal => {
            Crystal.forEachBorderPosition(crystal, null, (placeId, index, position) => {
                let formula = crystal.plugin.crystal.info.places[placeId].formula;
                if (!(formula in allBorderPositionsByFromula)) {
                    allBorderPositionsByFromula[formula] = [];
                }
                allBorderPositionsByFromula[formula].push({
                    crystal: crystal,
                    placeId: placeId,
                    index: {x: index.x, y: index.y},
                    position: position
                });
            });
        });

        Chemistry.forEachParticle(world, particle => {
            let formula = particle.plugin.chemistry.formula;
            if (formula in allBorderPositionsByFromula) {
                let crystalPositions = allBorderPositionsByFromula[formula];
                for (pos of crystalPositions) {
                    let spaceDist = Chemistry.spaceDist(particle.position, pos.position);
                    if (spaceDist<50) {
                        Matter.Composite.remove(world, particle);
                        Crystal.stickParticleToPlace(pos.crystal, particle, pos.placeId, pos.index);
                    } else if (spaceDist<150) {
                        let v = Matter.Vector.sub(pos.position, particle.position);
                        let force = Matter.Vector.mult(v, 0.01);
                        console.log("Apply force", v);
                        Matter.Body.applyForce(particle, particle.position, force);    
                    }
                }
            }
        });
    };

    Crystal._findCrystalInfo = function(formula) {
        for (info of Crystal.crystalInfos) {
            if (info.formula==formula) {
                return info;
            }
        } 
        return null;
    };

    Crystal.create = function(formula, position, angle) {
        let info = Crystal._findCrystalInfo(formula);
        if (info) {
            return Crystal._createCrystalByCrystalInfo(info, position, angle);
        } else {
            return null;
        }
    };

    Crystal._createCrystalByCrystalInfo = function(crystalInfo, position, angle) {
        let crystal = Matter.Composite.create();

        //Todo: make width and height constants
        //Todo: make options better and inheritable
        let base = Matter.Bodies.rectangle(position.x, position.y, 1600, 1600, {collisionFilter: {mask: 0}, density: 0.0001, render: {visible: false}, plugin: {crystal: {isBase: true}}});

        crystal.plugin.crystal = {
            info: crystalInfo,
            base: base,
            isCrystal: true,
            elements: [],
            placePositions: []
        };

        Matter.Composite.add(crystal, base);
        return crystal;
    };

    Crystal._getPlace = function(crystal, placeId) {
        return crystal.plugin.crystal.info.places[placeId];
    };

    Crystal.placeIds = function(crystal, formula) {
        let places = crystal.plugin.crystal.info.places;
        if (!formula || formula=="") {
            return Object.keys(places);
        } else {
            return Object.keys(places).filter(placeId => (places[placeId].formula==formula));
        }
    };

    Crystal.places = function(crystal) {
        return crystal.plugin.crystal.info.places;
    };

    Crystal.getInCrystalPlacePosition = function(crystal, placeId, index) {
        let place = Crystal._getPlace(crystal, placeId);
        let inCrystalX = place.position.x + index.x * crystal.plugin.crystal.info.elementaryCellSize.x;
        let inCrystalY = place.position.y + index.y * crystal.plugin.crystal.info.elementaryCellSize.y;
        let inCrystalPosition = Chemistry.spaceVectorToScreen({x: inCrystalX, y: inCrystalY});
        return inCrystalPosition;
    };

    Crystal.getPlacePosition = function(crystal, placeId, index) {
        let inCrystalPosition = Crystal.getInCrystalPlacePosition(crystal, placeId, index);
        return Matter.Vector.add(crystal.plugin.crystal.base.position, Matter.Vector.rotate(inCrystalPosition, crystal.plugin.crystal.base.angle));
    };

    Crystal.stickParticleToPlace = function(crystal, particle, placeId, index) {
        //Todo: check if this position is already occupied
/*        let dx = particle.bounds.max.x-particle.bounds.min.x;
        let dy = particle.bounds.max.y-particle.bounds.min.y;
        let vibrationRadius = Math.max(dx/2, dy/2);
        if (!particle.plugin.force) {
            particle.plugin.force = {}
        }
*/
        if (particle.plugin.chemistry && particle.plugin.chemistry.brownianMotion) {
            delete particle.plugin.chemistry.brownianMotion;
        }

        let inCrystalPosition = Crystal.getInCrystalPlacePosition(crystal, placeId, index);
        let position = Crystal.getPlacePosition(crystal, placeId, index);

        particle.plugin.crystal = {
            isCrystalParticle: true,
            crystal: crystal,
            placeId: placeId,
            index: index
        };
        
        //Todo: replace +-10 with something based in particle size
        var constraint1 = Matter.Constraint.create({
            bodyA: crystal.plugin.crystal.base,
            bodyB: particle,
            pointA: {x: inCrystalPosition.x-10, y: inCrystalPosition.y},
            pointB: {x: -10, y:0},
            stiffness: 0.1,
            damping: 0.1,
            length: 0
        });

        var constraint2 = Matter.Constraint.create({
            bodyA: crystal.plugin.crystal.base,
            bodyB: particle,
            pointA: {x: inCrystalPosition.x+10, y: inCrystalPosition.y},
            pointB: {x: 10, y:0},
            stiffness: 0.1,
            damping: 0.1,
            length: 0
        });

        Matter.Composite.add(crystal, [particle, constraint1, constraint2]);


/*        let pp = {
            placeId: placeId,
            index: {x: index.x, y: index.y},
            position: Crystal.getPlacePosition(crystal, placeId, index)
        }
        crystal.placePositions.push(pp);

        particle.frictionAir = 0.5;
        particle.plugin.force.sticked = {
            stickPosition: pp.position,
            vibrationRadius: vibrationRadius/4
        }
*/
    };

    Crystal.forEachParticle = function(crystal, callback) {
        for (body of crystal.bodies) {
            if (body.plugin.crystal && body.plugin.crystal.isCrystalParticle) {
                callback(body);
            }
        }
    };

    Crystal._getPlaceKey = function(placeId, index) {
        return placeId + ":" + index.x + ":" + index.y;
    };

    Crystal.forEachVacantPlace = function(crystal, formula, bounds, callback) {
        let occupiedPlaces = {}
        Crystal.forEachParticle(crystal, p => {
            occupiedPlaces[Crystal._getPlaceKey(p.plugin.crystal.placeId, p.plugin.crystal.index)] = true;
        });

        let placeIds = Crystal.placeIds(crystal, formula);
        for (ix=bounds.min.x; ix<=bounds.max.x; ix++) {
            for (iy=bounds.min.y; iy<=bounds.max.y; iy++) {
                let index = {x: ix, y:iy};
                for (placeId of placeIds) {
                    if (!occupiedPlaces[Crystal._getPlaceKey(placeId, index)]) {
                        let position = Crystal.getPlacePosition(crystal, placeId, index);
                        callback(placeId, index, position);
                    }
                }
            }
        }
    }

    Crystal._getIndexBounds = function(crystal) {
        let bounds = {
            min: {x: Infinity, y: Infinity},
            max: {x: -Infinity, y: -Infinity}
        };
 
        Crystal.forEachParticle(crystal, p => {
            let index = p.plugin.crystal.index;
            if (index.x > bounds.max.x) bounds.max.x = index.x;
            if (index.x < bounds.min.x) bounds.min.x = index.x;
            if (index.y > bounds.max.y) bounds.max.y = index.y;
            if (index.y < bounds.min.y) bounds.min.y = index.y;
        });

        return bounds;
    };

    Crystal._getCharge = function(formula) {
        let plusIndex = formula.indexOf("+");
        if (plusIndex>-1) {
            let chargeStr = formula.slice(plusIndex+1);
            if (chargeStr.length>0) {
                return parseInt(chargeStr);
            } else {
                return 1;
            }
        }

        let minusIndex = formula.indexOf("-");
        if (minusIndex>-1) {
            let chargeStr = formula.slice(minusIndex+1);
            if (chargeStr.length>0) {
                return -parseInt(chargeStr);
            } else {
                return -1;
            }
        }

        return 0;
    };

    Crystal._getCrystalInfo = function(crystal) {
        return crystal.plugin.crystal.info;
    }

    Crystal._isOppositeCharge = function(charge1, charge2) {
        return (charge1>0 && charge2<0) || (charge1<0 && charge2>0) || (charge1==0) || (charge2==0);
    }

    Crystal.distanceToCrystal = function(crystal, position, charge) {
        let crystalInfo = Crystal._getCrystalInfo(crystal);
        let minDistance = Infinity;
        Crystal.forEachParticle(crystal, p => {
            let place = crystalInfo.places[p.plugin.crystal.placeId];
            let particleCharge = place.charge;
            if (charge==null || Crystal._isOppositeCharge(particleCharge, charge)) {
                let dist = Proximity.distanceToParticle(position, p);
                if (dist<minDistance) {
                    minDistance = dist;
                }
            }
        });
        return minDistance;
    };

    Crystal.forEachBorderPosition = function(crystal, formula, callback) {
        let charge = formula ? Crystal._getCharge(formula) : 0;

        let indexBounds = Crystal._getIndexBounds(crystal);
        indexBounds.min.x -= 1;
        indexBounds.min.y -= 1;
        indexBounds.max.x += 1;
        indexBounds.max.y += 1;

        let candidates = [];
        Crystal.forEachVacantPlace(crystal, formula, indexBounds, (placeId, index, position) => {
            let dist = Crystal.distanceToCrystal(crystal, position, charge);
            candidates.push({placeId: placeId, index: {x:index.x, y:index.y}, position: position, distance: dist});
        }); 

        candidates.sort((a, b) => (a.distance-b.distance));

        let minD = candidates[0].distance;
        for (c of candidates) {
            if (c.distance<minD*2) {
                callback(c.placeId, c.index, c.position);
            }
        }
    };
})();




var example_crystal = {
    element: [
        {
            placeId: 1,
            index: {x: 1, y:0},
            particle: {}
        }
    ]
}

