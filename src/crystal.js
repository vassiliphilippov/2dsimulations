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
                1: {formula: "Cu+2", position: {x: 140, y: 140}, angle: 0},
                2: {formula: "SO4-2", position: {x: 403, y: 403}, angle: 0}
            },
            elementaryCellSize: {x: 526, y: 526}
        }
    ];

    Crystal.init = function(engine) {
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
        let crystal = {
            info: crystalInfo,
            elements: [],
            position: {x: position.x, y: position.y},
            angle: angle,
            placePositions: []
        };
        return crystal;
    };

    Crystal._getPlace = function(crystal, placeId) {
        return crystal.info.places[placeId];
    };

    Crystal.placeIds = function(crystal) {
        return Object.keys(crystal.info.places);
    };

    Crystal.places = function(crystal) {
        return crystal.info.places;
    };

    Crystal.getPlacePosition = function(crystal, placeId, index) {
        let place = Crystal._getPlace(crystal, placeId);
        let inCrystalX = place.position.x + index.x * crystal.info.elementaryCellSize.x;
        let inCrystalY = place.position.y + index.y * crystal.info.elementaryCellSize.y;
        let inCrystalVector = Chemistry.spaceVectorToScreen({x: inCrystalX, y: inCrystalY});
        return Matter.Vector.add(crystal.position, Matter.Vector.rotate(inCrystalVector, crystal.angle));
    };

    Crystal.stickParticleToPlace = function(crystal, particle, placeId, index) {
        let dx = particle.bounds.max.x-particle.bounds.min.x;
        let dy = particle.bounds.max.y-particle.bounds.min.y;
        let vibrationRadius = Math.max(dx/2, dy/2);
        if (!particle.plugin.force) {
            particle.plugin.force = {}
        }
        if (particle.plugin.chemistry && particle.plugin.chemistry.brownianMotion) {
            delete particle.plugin.chemistry.brownianMotion;
        }
        
        let pp = {
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
    };

    Crystal.updatePlacePositions = function(crystal) {
        for (pp of crystal.placePositions) {
            let newPosition = Crystal.getPlacePosition(crystal, pp.placeId, pp.index);
            pp.position.x = newPosition.x;
            pp.position.y = newPosition.y;
        }
    };

//enumerateParticleTypes
//enumerateParticlePositions(formula, bounds)
//findClosestPosition(formula, position)
//enumerateBorderPositions(formula)
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

