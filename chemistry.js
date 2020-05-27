/**
* The `Chemistry` module contains most of the chemistry specific logic of particle creation and simulation
*
* @class Chemistry
*/

//requires periodictable.json
//requires atomcolors.jsom
//requires chemistrycompoundstructures.js

var Chemistry = {};

(function() {
    //Todo: decide and describe how updating space scale affects already created particles
    //Todo: create particle by formula
    Chemistry.spaceScale = 0.3; //pixels per pm
    Chemistry.timeScale = 3e-15; //real seconds per rendering second

    Chemistry._invisibleBorderColorB = 2;
    Chemistry._borderColorB = 4;
    Chemistry._attractorColorB = 3;

    //Todo: move to comments
    Chemistry._defaultChemistryOptions = {
        particle: true,
        formula: "NotDefined",
        compound: false,
        type: "atom", //atom, ion, molecule, metal
        charge: 0,
        atomicMass: 1, //in AMU
        atomicRadius: 53, //in pm, only for non-compounds
        temperature: null, //in Kelvins, could be null then temperature is not enfourced   
        zoneMapColor: null //if the element was created by zomeMap then its color is there
    };

    //Todo: Move initializing of all other plugins here, set gravity to 0
    Chemistry.init = function(engine) {
        Events.on(engine, "collisionEnd", (event) => {
            Chemistry._onCollisions(event.pairs);
        });
    };

    Chemistry._onCollisions = function(pairs) {
        for (var pair of pairs) {
            bodyA = pair.bodyA.parent;
            bodyB = pair.bodyB.parent;
            if (bodyA.plugin.chemistry && bodyA.plugin.chemistry.formula && bodyB.plugin.chemistry && bodyB.plugin.chemistry.formula) {
                let formulaA = bodyA.plugin.chemistry.formula;
                let formulaB = bodyB.plugin.chemistry.formula;
                console.log("pair = ", formulaA, formulaB);
                if (formulaA < formulaB) {
                    Events.trigger(engine, 'collision_'+formulaA+'_'+formulaB, { particleA: bodyA, particleB: bodyB, pair: pair });
                    Events.trigger(engine, 'collision', { particleA: bodyA, particleB: bodyB, pair: pair });
                } else {
                    Events.trigger(engine, 'collision_'+formulaB+'_'+formulaA, { particleA: bodyB, particleB: bodyA, pair: pair });
                    Events.trigger(engine, 'collision', { particleA: bodyB, particleB: bodyA, pair: pair });
                }
            }
        }
    };

    Chemistry.create = function(formula, x, y, chemistryOptions, options) {
        let particleInfo = Chemistry._findParticleInfoByFormula(formula);
        if (particleInfo) {
            return Chemistry.createParticleByParticleInfo(particleInfo, x, y, chemistryOptions, options);
        } else {
            console.log("Error. Particle info database doesn't contain information about formula: ", formula);
            return null;
        }
    };

    Chemistry.createMappedBodies = function(zoneMap) {
        let bodies = [];
        bodies.push(...Chemistry.createMappedBorders(zoneMap));
        bodies.push(...Chemistry.createMappedAttractors(zoneMap));
        bodies.push(...Chemistry.createMappedParticles(zoneMap));
        return bodies;
    };

    Chemistry.createMappedBorders = function(zoneMap) {
        let borders = [];
        for (color in zoneMap.zones) {
            if (Chemistry._isBorderColor(color)) {
                for (rect of zoneMap.zones[color]) {
                    let b = Chemistry.createBorder(rect);
                    borders.push(b);
                }
            }
        }
        return borders;
    };

    Chemistry.createMappedAttractors = function(zoneMap) {
        let attractors = [];
        for (color in zoneMap.zones) {
            if (Chemistry._isAttractorColor(color)) {
                for (rect of zoneMap.zones[color]) {
                    let a = Chemistry.createAttractor(rect);
                    a.zoneMapColor = color;
                    attractors.push(a);
                }
            }
        }
        return attractors;
    };

    Chemistry.createMappedParticles = function(zoneMap) {
        let particles = [];
        for (color in zoneMap.zones) {
            let particleInfo = Chemistry._findParticleInfoByColor(color);
            if (particleInfo) {
                for (rect of zoneMap.zones[color]) {
                    let x = (rect.x1+rect.x2)/2;
                    let y = (rect.y1+rect.y2)/2;
                    let p = Chemistry.createParticleByParticleInfo(particleInfo, x, y);
                    if (p) {
                        particles.push(p);
                    }
                }
            }
        }
        return particles;
    };

    Chemistry._findParticleInfoByColor = function(color) {
        for (info of ChemistryParticleInfoDatabase) {
            if (info.color==color) {
                return info;
            }
        }
        return null;
    };

    Chemistry._findParticleInfoByFormula = function(formula) {
        for (info of ChemistryParticleInfoDatabase) {
            if (info.formula==formula) {
                return info;
            }
        }
        return null;
    };

    Chemistry._isBorderColor = function(color) {
        var rgb = color.split(",");
        var b = rgb[2];
        return b==Chemistry._borderColorB;
    };

    Chemistry._isAttractorColor = function(color) {
        var rgb = color.split(",");
        var b = rgb[2];
        return b==Chemistry._attractorColorB;
    };

    Chemistry._convertSingleIonFormulaToAtomSymbol = function(formula) {
        let atomSymbol = formula.replace(/[0-9\+\-]+/g, "");
        return atomSymbol;
    };

    Chemistry.createBorder = function(rect) {
        let x = (rect.x1+rect.x2)/2;
        let y = (rect.y1+rect.y2)/2;
        let w = rect.x2-rect.x1;
        let h = rect.y2-rect.y1;
        //Todo: recheck these options
        //Todo: mark border marked as chemistry options in plugin data
        return Matter.Bodies.rectangle(x, y, w, h, {label: "border", isStatic: true, frictionAir: 0, friction: 0, restitution: 1, frictionStatic: 0, render: {fillStyle: "green"} });
    };

    //Todo: move atractors to Force module
    Chemistry.createAttractor = function(rect) {
        let x = (rect.x1+rect.x2)/2;
        let y = (rect.y1+rect.y2)/2;
        //Todo: recheck these options
        //Todo: mark border marked as chemistry options in plugin data
        let a = Matter.Bodies.circle(x, y, 20, {isStatic: true, frictionAir: 0, friction: 0, restitution: 1, frictionStatic: 0, render: {visible: false, fillStyle: "blue"}, collisionFilter: {mask: 0}});
        a.plugin.force = {attractor: true, charge: 1, forces: {}};
        return a;
    };

    Chemistry.createParticleByParticleInfo = function(particleInfo, x, y, chemistryOptions, options) {
        if (!particleInfo.compound) {
            let atomSymbol = Chemistry._convertSingleIonFormulaToAtomSymbol(particleInfo.formula);
            let struct = {
                atom: atomSymbol,
            }
            return Chemistry.createParticleByStruct(particleInfo.formula, struct, x, y);
        } else {
            if (particleInfo.formula in chemistryCompoundStructures) {
                let struct = chemistryCompoundStructures[particleInfo.formula];
                return Chemistry.createParticleByStruct(particleInfo.formula, struct, x, y);
            } else {
                console.log("Error. Compound \"" + particleInfo.formula + "\" is not found in chemistryCompoundStructures");
                return null;
            }
        }
    };

    Chemistry.createParticleByStruct = function(formula, struct, x, y, chemistryOptions, options) {
        //todo: think about passing type and charge
        if (!options) {
            options = {}
        }

        let chemistryDefaults = {
            particle: true,
            formula: formula,
            compound: true,
            type: "molecule",
            charge: 0
        }

        let defaults = {
            frictionAir: 0, 
            friction: 0, 
            restitution: 1, 
            frictionStatic: 0,
            label: formula
        }

        var atoms = Chemistry._createParticleAtoms(struct, x, y, 0);

        let totalAtomicMass = 0;
        for (atom of atoms) {
            totalAtomicMass += atom.plugin.chemistry.atomicMass;
        }
        chemistryDefaults.atomicMass = totalAtomicMass;
        //atoms.reduce( (total, atom) => {return total + atom.plugin.chemistry.atomicMass;} );

        let options2 = Matter.Common.extend(defaults, options);
        //todo: move plugin chemistry options here
        let options3 = Matter.Common.extend(options2, {parts: atoms});
        var p = Matter.Body.create(options3);
        p.plugin.chemistry = Matter.Common.extend(chemistryDefaults, chemistryOptions);
        return p;
    };

    Chemistry._createParticleAtoms = function(struct, x, y, angle) {
        if (!angle) {
            angle = 0;
        }
        let atoms = [];
        let atom = Chemistry.createAtom(struct["atom"], x, y, struct["chemistryOptions"], struct["options"]);
        atoms.push(atom);
        if (struct["connections"]) {
            for (connection of struct["connections"]) {
                let l = connection["length"] * Chemistry.spaceScale;
                let a = (connection["angle"]+angle)*2*Math.PI/360;
                let dx = Math.cos(a)*l;
                let dy = Math.sin(a)*l;
                let atoms2 = Chemistry._createParticleAtoms(connection, x+dx, y+dy, connection["angle"]+angle);
                atoms.push(...atoms2);
            }
        }
        return atoms;
    };


    Chemistry.createAtom = function(atomSymbol, x, y, chemistryOptions, options) {                   
        let atomInfo = Chemistry._atomInfoBySymbol(atomSymbol);
        if (!atomInfo) {
            console.log("Error. Atom " + atomSymbol + " is not found in the periodic table info");
            return null;
        }

        let chemistryDefaults = {
            particle: true,
            formula: atomSymbol, 
            compound: false,
            type: "atom",
            charge: 0,
            atomicMass: atomInfo.mass,
            atomicRadius: atomInfo.atomicRadius   
        }

        let atomChemistryOptions = Matter.Common.extend(chemistryDefaults, chemistryOptions);

        let defaults = {
            frictionAir: 0, 
            friction: 0, 
            restitution: 1,                         
            frictionStatic: 0,
            label: atomChemistryOptions.formula,
            render: {
                fillStyle: "#" + atomRenderingColors[atomSymbol]
            }
        }

        let atomOptions = Matter.Common.extend(defaults, options);

        radius = atomChemistryOptions.atomicRadius * Chemistry.spaceScale; //so atom radius can be replaced by chemistryOptions

        let ball = Matter.Bodies.circle(x, y, radius, atomOptions);
        ball.plugin.chemistry = atomChemistryOptions;
        let density = atomInfo.mass/(radius*radius);
        Matter.Body.setDensity(ball, density);
        return ball;
    };

    Chemistry._atomInfoBySymbol = function(atomSymbol) {
        for (atomInfo of periodicTable) {
            if (atomInfo.symbol==atomSymbol) {
                return atomInfo;
            }
        }
        return null;
    };

})();
