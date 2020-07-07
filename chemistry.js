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
        latticeWithPrimitiveCell: 8,
        primitiveCell: 9
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
        temperature: null, //in Kelvins, could be null then temperature is not enforced   
        sticked: {
            position: {x: 100, y: 100},
            vibrationRadius: 20
        } //if not null them the particle is sticked
    };

    //Todo: convert parameters to hash
    Chemistry.createAndInitEngineAndRender = function(zoneMap, element, createMappedParticles, handleMouse, randomSeed) {
        let engine = Matter.Engine.create();

        if (randomSeed) {
            Matter.Common._seed = randomSeed;
            engine.world._seed = randomSeed;
        } else {
            Matter.Common._seed = 0;
            engine.world._seed = 0;
        }

        Matter.Events.on(engine, "beforeUpdate", (event) => {
            //Restore random seed for this engine from save
            Matter.Common._seed = engine.world._seed;
        });

        var render = ChemistryRender.create({element: element, engine: engine, options: {width: zoneMap.width, height: zoneMap.height, rotateAtomLabels: true}});
        if (createMappedParticles) {
            Matter.World.add(engine.world, Chemistry.createMappedBodies(zoneMap));
        }

        engine.world.gravity.y = 0;                                        
        Debug.init(engine);
        Profiler.init();
        Force.init(engine);
        Temperature.init(engine);
        Proximity.init(engine);
        Groups.init(engine, render);
        Transformation.init(engine);
        Chemistry.init(engine);

        if (handleMouse) {
            Chemistry.addMouseHandling(engine, render);
        }

        Matter.Events.on(engine, "afterUpdate", (event) => {
            //Save random seed for this engine to allow several engines to run simultaneously in fully deterministic mode
            engine.world._seed = Matter.Common._seed;
        });

        return [engine, render];        
    };

    Chemistry.addMouseHandling = function(engine, render) {
        // add mouse control
        var mouse = Matter.Mouse.create(render.canvas),
            mouseConstraint = Matter.MouseConstraint.create(engine, {
                mouse: mouse,
                constraint: {
                    stiffness: 0.2,
                    render: {
                        visible: false
                    }
                }
            });

        World.add(engine.world, mouseConstraint);

        // keep the mouse in sync with rendering
        render.mouse = mouse;
    };

    Chemistry.run = function(engine, render) {
        var runner = Matter.Runner.create();
        runner.isFixed = true; //We want to have a predictable reproducable behaviour
        TextureLoader.onAllTextureLoad(engine.world.bodies, () => {
            Matter.Runner.run(runner, engine);
            ChemistryRender.run(render);
        });
        return runner;
    };

    Chemistry.init = function(engine) {
        Matter.Events.on(engine, "collisionEnd", (event) => {
            Chemistry._onCollisions(engine, event.pairs);
        });
    };

    Chemistry._onCollisions = function(engine, pairs) {
        Profiler.begin("Chemistry._onCollisions");
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
        Profiler.end();
    };

    Chemistry.create = function(formula, x, y, angle, chemistryOptions, options) {
        let particleInfo = Chemistry._findParticleInfoByFormula(formula);
        if (particleInfo) {
            return Chemistry.createParticleByParticleInfo(particleInfo, x, y, angle, chemistryOptions, options);
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
        bodies.push(...Chemistry.createPrimitiveCellLattices(zoneMap, bodies));
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

    Chemistry.cloneParticle = function(p, dx, dy) {
       //Todo: position must be replaced with the first atom coordinates
        let pClone = Chemistry.create(p.plugin.chemistry.formula, p.position.x+dx, p.position.y+dy);
        if (p.plugin.force && p.plugin.force.sticked) {
            Chemistry.stick(pClone);
        }
        return pClone;
    };

    Chemistry.createPrimitiveCellLattices = function(zoneMap, bodies) {
        let rects = [];
        let primitiveCellRects = [];
        for (color in zoneMap.zones) {
            let zoneType = Chemistry._getZoneType(color)
            if (zoneType==Chemistry.zoneTypes.latticeWithPrimitiveCell) {
                rects.push(...zoneMap.zones[color]);
            }
            if (zoneType==Chemistry.zoneTypes.primitiveCell) {
                primitiveCellRects.push(...zoneMap.zones[color]);
            }
        }

        let particles = [];

        for (rect of rects) {
            for (cellRect of primitiveCellRects) {
                if (Matter.Bounds.overlaps(rect, cellRect)) {
                    let cellWidth = cellRect.max.x-cellRect.min.x;
                    let cellHeight = cellRect.max.y-cellRect.min.y;
                    let cellParticles = [];
                    for (p of bodies) {
                        if (Matter.Bounds.overlaps(p.bounds, cellRect)) {
                            cellParticles.push(p);
                        }
                    }
                    for (var dx=0; dx<rect.max.x-rect.min.x-cellWidth; dx+=cellWidth) {
                        for (var dy=0; dy<rect.max.y-rect.min.y-cellHeight; dy+=cellHeight) {
                            if (dx==0 && dy==0) continue; //Those particles are in created for the primitive cell
                            for (p of cellParticles) {
                                pClone = Chemistry.cloneParticle(p, dx, dy);
                                particles.push(pClone);
                            }
                        }
                    }
                }
            }
        }

        return particles;
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
                            let x = (rect.min.x+rect.max.x)/2;
                            let y = (rect.min.y+rect.max.y)/2;
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

    Chemistry.unstick = function(particle, brownianMotionOptions) {
        particle.frictionAir = 0;
        if (particle.plugin.force && particle.plugin.force.sticked) {
            delete particle.plugin.force.sticked;
        }
        if (brownianMotionOptions && particle.plugin.chemistry) {
            particle.plugin.chemistry.brownianMotion = brownianMotionOptions;
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
        let x = (rect.min.x+rect.max.x)/2;
        let y = (rect.min.y+rect.max.y)/2;
        let w = rect.max.x-rect.min.x;
        let h = rect.max.y-rect.min.y;
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
        let x = (rect.min.x + rect.max.x)/2;
        let y = (rect.min.y + rect.max.y)/2;
        //Todo: recheck these options
        //Todo: mark border marked as chemistry options in plugin data
        //Todo: change options like in createBorder
        let a = Matter.Bodies.circle(x, y, 20, {isStatic: true, frictionAir: 0, friction: 0, restitution: 1, frictionStatic: 0, render: {visible: false, fillStyle: "blue"}, collisionFilter: {mask: 0}});
        a.label = "attractor";
        a.plugin.force = {attractor: true, charge: 1, forces: {}};
        return a;
    };

    Chemistry.createParticleByParticleInfo = function(particleInfo, x, y, angle, chemistryOptions, options) {
        //Todo: use options
        if (!particleInfo.compound) {
            let atomSymbol = Chemistry._convertSingleIonFormulaToAtomSymbol(particleInfo.formula);
            let struct = {
                atom: atomSymbol,
            }
            return Chemistry.createParticleByStruct(particleInfo.formula, struct, x, y, angle, chemistryOptions, options);
        } else {
            if (particleInfo.formula in chemistryCompoundStructures) {
                let struct = chemistryCompoundStructures[particleInfo.formula];
                return Chemistry.createParticleByStruct(particleInfo.formula, struct, x, y, angle, chemistryOptions, options);
            } else {
                console.log("Error. Compound \"" + particleInfo.formula + "\" is not found in chemistryCompoundStructures");
                return null;
            }
        }
    };

    Chemistry.createParticleByStruct = function(formula, struct, x, y, angle, chemistryOptions, options) {
        //todo: think about passing type and charge
        if (!options) {
            options = {};
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

        var atoms = Chemistry._createParticleAtoms(struct, x, y, angle);

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
//        ball.render.sprite.texture = "na.png";
        Matter.Body.setMass(ball, atomInfo.mass);
        return ball;
    };

    //Maximum distance from the position of the particle to its edge, 
    //in other words it is radius of a minimum circle around the position that includes this particle
    //in screen coordinates
    Chemistry.particleRadius = function(particle) {
        let maxL = 0;
        for (let k = particle.parts.length > 1 ? 1 : 0; k < particle.parts.length; k++) {
            let part = particle.parts[k];
            let l = Matter.Vector.magnitude(Matter.Vector.sub(part.position, particle.position));
            if (part.circleRadius) {
                l += part.circleRadius;
            }
            if (l>maxL) {
                maxL = l;
            }
        }
        return maxL;
    };

    Chemistry._atomInfoBySymbol = function(atomSymbol) {
        for (atomInfo of periodicTable) {
            if (atomInfo.symbol==atomSymbol) {
                return atomInfo;
            }
        }
        return null;
    };

    //Todo: replace usage of Chemistry.spaceScale to convert functions everywere in the code

    //Convert distance in pixels to pm
    Chemistry.screenToSpace = function(screenDistance) {
        return screenDistance / Chemistry.spaceScale;
    };

    //Convert distance in pm to pixels
    Chemistry.spaceToScreen = function(spaceDistance) {
        return spaceDistance * Chemistry.spaceScale;
    };

    //Convert distance in pixels to pm
    Chemistry.screenVectorToSpace = function(screenVector) {
        return {x: Chemistry.screenToSpace(screenVector.x), y: Chemistry.screenToSpace(screenVector.y)};
    };

    //Convert distance in pm to pixels
    Chemistry.spaceVectorToScreen = function(spaceVector) {
        return {x: Chemistry.spaceToScreen(spaceVector.x), y: Chemistry.spaceToScreen(spaceVector.y)};
    };

})();
