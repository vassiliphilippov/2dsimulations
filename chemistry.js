/**
* The `Chemistry` module contains most of the chemistry specific logic of particle creation and simulation
*
* @class Chemistry
*/

//requires periodictable.json
//requires atomcolors.jsom
//requires chemistrycompoundstructures.js

var Chemistry = {};

//Todo: think if we can use collision mask to make solid particles to don't interract with each other but with others
(function() {
    Chemistry.spaceScale = 0.25; //pixels per pm
    Chemistry.timeScale = 6e-15; //real seconds per rendering second

    Chemistry.zoneTypes = {
        waterMedium: 1,
        invisibleBorder: 2,
        attractor: 3,
        border: 4,
        particle: 5,
        stickedParticle: 6,
        latticeOfParticles: 7,
    };

    //Todo: move to comments
    //Todo: add brownian motion
    Chemistry._defaultChemistryOptions = {
        particle: true,
        formula: "NotDefined",
        compound: false,
        type: "atom", //atom, ion, molecule, metal
        charge: 0,
        atomicMass: 1, //in AMU
        atomicRadius: 53, //in pm, only for non-compounds
        temperature: null, //in Kelvins, could be null then temperature is not enfourced   
        sticked: {
            position: {x: 100, y: 100},
            vibrationRadius: 20
        } //if not null them the particle is sticked
    };

    Chemistry.createAndInitEngineAndRender = function(zoneMap, element, createMappedParticles) {
        let engine = Matter.Engine.create();
        var render = ChemistryRender.create({element: element, engine: engine, options: {width: zoneMap.width, height: zoneMap.height}});
        if (createMappedParticles) {
            Matter.World.add(engine.world, Chemistry.createMappedBodies(zoneMap));
        }

        engine.world.gravity.y = 0;                                        
        Debug.init(engine);
        Force.init(engine);
        Temperature.init(engine);
        Proximity.init(engine);
        Chemistry.init(engine);
        return [engine, render];        
    };

    Chemistry.run = function(engine, render) {
        TextureLoader.onAllTextureLoad(engine.world.bodies, () => {
            Matter.Engine.run(engine);
            ChemistryRender.run(render);
        });
    };

    Chemistry.init = function(engine) {
        Matter.Events.on(engine, "collisionEnd", (event) => {
            Chemistry._onCollisions(engine, event.pairs);
        });
    };

    Chemistry._onCollisions = function(engine, pairs) {
        for (var pair of pairs) {
            bodyA = pair.bodyA.parent;
            bodyB = pair.bodyB.parent;
            if (bodyA.plugin.chemistry && bodyA.plugin.chemistry.formula && bodyB.plugin.chemistry && bodyB.plugin.chemistry.formula) {
                let formulaA = bodyA.plugin.chemistry.formula;
                let formulaB = bodyB.plugin.chemistry.formula;
                if (formulaA < formulaB) {
                    Matter.Events.trigger(engine, 'collision_'+formulaA+'_'+formulaB, { particleA: bodyA, particleB: bodyB, pair: pair });
                    Matter.Events.trigger(engine, 'collision', { particleA: bodyA, particleB: bodyB, pair: pair });
                } else {
                    Matter.Events.trigger(engine, 'collision_'+formulaB+'_'+formulaA, { particleA: bodyB, particleB: bodyA, pair: pair });
                    Matter.Events.trigger(engine, 'collision', { particleA: bodyB, particleB: bodyA, pair: pair });
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
        bodies.push(...Chemistry.createWaterMediumParticles(zoneMap));
        bodies.push(...Chemistry.createMappedParticles(zoneMap));
        return bodies;
    };

    Chemistry.createMappedBorders = function(zoneMap) {
        let borders = [];
        for (color in zoneMap.zones) {
            let zoneType = Chemistry._getZoneType(color)
            if (zoneType==Chemistry.zoneTypes.border ||
                zoneType==Chemistry.zoneTypes.invisibleBorder) 
            {
                for (rect of zoneMap.zones[color]) {
                    let visible = zoneType==Chemistry.zoneTypes.border;
                    let b = Chemistry.createBorder(rect, visible);
                    b.zoneMapColor = color;
                    borders.push(b);
                }
            }
        }
        return borders;
    };

    Chemistry.createMappedAttractors = function(zoneMap) {
        let attractors = [];
        for (color in zoneMap.zones) {
            let zoneType = Chemistry._getZoneType(color)
            if (zoneType==Chemistry.zoneTypes.attractor) {
                for (rect of zoneMap.zones[color]) {
                    let a = Chemistry.createAttractor(rect);
                    a.zoneMapColor = color;
                    attractors.push(a);
                }
            }
        }
        return attractors;
    };

    Chemistry.createWaterMediumParticles = function(zoneMap) {
        const waterMediumDx = 240; //in pm
        const waterMediumDy = 200; //in pm
        let waterMolecules = [];
        for (color in zoneMap.zones) {
            let zoneType = Chemistry._getZoneType(color)
            if (zoneType==Chemistry.zoneTypes.waterMedium) {
                let rgb = color.split(",");
                ZoneMap.spawnLattice(zoneMap, rgb, waterMediumDx*Chemistry.spaceScale, waterMediumDy*Chemistry.spaceScale, (x, y) => {
                    let p = Chemistry.create("H2O", x, y);
                    p.zoneMapColor = color;
                    waterMolecules.push(p);
                });
            }
        }
        return waterMolecules;
    };

    Chemistry.createWaterMediumParticles = function(zoneMap) {
        const waterMediumDx = 240; //in pm
        const waterMediumDy = 200; //in pm
        let waterMolecules = [];
        for (color in zoneMap.zones) {
            let zoneType = Chemistry._getZoneType(color)
            if (zoneType==Chemistry.zoneTypes.waterMedium) {
                let rgb = color.split(",");
                ZoneMap.spawnLattice(zoneMap, rgb, waterMediumDx*Chemistry.spaceScale, waterMediumDy*Chemistry.spaceScale, (x, y) => {
                    let p = Chemistry.create("H2O", x, y);
                    p.zoneMapColor = color;
                    waterMolecules.push(p);
                });
            }
        }
        return waterMolecules;
    };

    Chemistry.createMappedParticles = function(zoneMap) {
        let particles = [];
        for (color in zoneMap.zones) {
            let zoneType = Chemistry._getZoneType(color)
            if (zoneType==Chemistry.zoneTypes.particle || 
                zoneType==Chemistry.zoneTypes.stickedParticle || 
                zoneType==Chemistry.zoneTypes.latticeOfParticles) 
            {
                let particleInfo = Chemistry._findParticleInfoByColor(color);
                if (particleInfo) {
                    if (zoneType==Chemistry.zoneTypes.latticeOfParticles) {
                        particles.push(...Chemistry._createLatticeOfParticles(zoneMap, color, particleInfo));
                    } else {
                        for (rect of zoneMap.zones[color]) {
                            let x = (rect.x1+rect.x2)/2;
                            let y = (rect.y1+rect.y2)/2;
                            let p = Chemistry.createParticleByParticleInfo(particleInfo, x, y);
                            if (p) {
                                p.zoneMapColor = color;
                                if (zoneType==Chemistry.zoneTypes.stickedParticle) {
                                    Chemistry.stick(p);
                                }
                                particles.push(p);
                            }
                        }
                    }
                }
            }
        }
        return particles;
    };

    Chemistry._createLatticeOfParticles = function(zoneMap, color, particleInfo) {
        //Create a virtual particle to get one particle size
        let vp = Chemistry.createParticleByParticleInfo(particleInfo, 0, 0);
        let width = vp.bounds.max.x-vp.bounds.min.x;
        let height = vp.bounds.max.y-vp.bounds.min.y;
        delete vp;

        let padding = 0.2; //percentage of free space between particles in the lattice
        let particles = [];
        let rgb = color.split(",");
        ZoneMap.spawnLattice(zoneMap, rgb, width*(1+padding), height*(1+padding), (x, y) => {
            let p = Chemistry.createParticleByParticleInfo(particleInfo, x, y);
            Chemistry.stick(p);
            p.zoneMapColor = color;
            particles.push(p);
        });
        return particles;
    };

    Chemistry.stick = function(particle) {
        let dx = particle.bounds.max.x-particle.bounds.min.x;
        let dy = particle.bounds.max.y-particle.bounds.min.y;
        let vibrationRadius = Math.max(dx/2, dy/2);
        if (!particle.plugin.force) {
            particle.plugin.force = {}
        }
        if (particle.plugin.chemistry && particle.plugin.chemistry.brownianMotion) {
            delete particle.plugin.chemistry.brownianMotion;
        }
        particle.frictionAir = 0.5;
        particle.plugin.force.sticked = {
            stickPosition: {x: particle.position.x, y: particle.position.y},
            vibrationRadius: vibrationRadius/4
        }
    }

    Chemistry._findParticleInfoByColor = function(color) {
        let rgb = color.split(",");
        for (info of ChemistryParticleInfoDatabase) {
            let particleRgb = info.color.split(",");
            if (rgb[0]==particleRgb[0] && rgb[1]==particleRgb[1]) {
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

    Chemistry._getZoneType = function(color) {
        let rgb = color.split(",");
        return rgb[2];
    };

    Chemistry._convertSingleIonFormulaToAtomSymbol = function(formula) {
        let atomSymbol = formula.replace(/[0-9\+\-]+/g, "");
        return atomSymbol;
    };

    Chemistry.createBorder = function(rect, visible) {
        let x = (rect.x1+rect.x2)/2;
        let y = (rect.y1+rect.y2)/2;
        let w = rect.x2-rect.x1;
        let h = rect.y2-rect.y1;
        //Todo: recheck these options
        //Todo: mark border marked as chemistry options in plugin data
        let options = {
            label: "border", 
            isStatic: true, 
            frictionAir: 0, 
            friction: 0, 
            restitution: 1, 
            frictionStatic: 0, 
            render: {
                fillStyle: "green",
                visible: visible
            } 
        };
        return Matter.Bodies.rectangle(x, y, w, h, options);
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
        Matter.Body.setMass(ball, atomInfo.mass);
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
