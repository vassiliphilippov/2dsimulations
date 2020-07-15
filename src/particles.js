/**
* The `BodyList` module implements JQuery-like interface to work with group of bodies
*
* @class BodyList
*/

//Todo: outer 
class BodyList {
    //Todo: replace engine with World
    constructor(engine) {
        this.bodies = [];
        if (engine) {
            for (let body of engine.world.bodies) {
                this.bodies.push(body);
            }
        }
    }

    static create(bodies) {
        let list = new BodyList(null);
        list.bodies = bodies;
        return list;
    }

    filter(selector) {
        let res = [];
        for (let body of this.bodies) {
            if (selector(body)) {
                res.push(body);
            }
        }
        this.bodies = res;
        return this;
    }

    forEach(callback) {
        for (let body of this.bodies) {
            callback(body);
        }
        return this;
    }

    sort(compareFunction) {
        this.bodies.sort(compareFunction);
        return this;
    }

    setOptions(options) {
        for (let body of this.bodies) {
            Matter.Common.extend(body, options);
        }
        return this;
    }

    label(s) {
        return this.filter(body => {
            return body.label==s;
        });
    }

    zoneMapColor(color) {
        let colors = Array.prototype.slice.call(arguments);
        return this.filter(body => {
            return colors.indexOf(body.zoneMapColor)!=-1;  
        });
    }

    inBounds(bounds) {
        return this.filter(body => {
             return Matter.Bounds.overlaps(body.bounds, bounds);
        });
    }

    outsideBounds(bound) {
        return this.filter(body => {
             return !Matter.Bounds.overlaps(body.bounds, render.bounds);
        });
    }

    visible(render) {
        if (render.options.hasBounds) {
            return this.inBounds(render.bounds);
        } else {
            //Return all particles if render hasBounds is false
            return this;
        }
    }

    nonvisible(render) {
        if (render.options.hasBounds) {
            return this.outsideBounds(render.bounds);
        } else {
            //Return all particles if render hasBounds is false
            return this;
        }
    }

    hide() {
        return this.setOptions({
            render: {
                visible: false
            }
        })
    };

    show() {
        return this.setOptions({
            render: {
                visible: true
            }
        })
    };

    remove(world) {
        return this.forEach(body => {
            Matter.Composite.remove(world, body);
        })
    };

    log() {
        return this.forEach(body => {
            console.log(body);
        })
    };

    setOpacity(opacity) {
        return this.forEach(body => {
            for (let k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
                let part = body.parts[k];
                part.render.opacity = opacity;
            }
        })
    };

    first() {
        return this.firsts(1);
    };

    firsts(k) {
        this.bodies.length = Math.min(k, this.bodies.length); 
        return this;
    };
 
    slice(start, end) {
        this.bodies = this.bodies.slice(start, end); 
        return this;
    };

    reverse() {
        this.bodies.reverse(); 
        return this;
    };

    shuffle() {
        this.bodies = Matter.Common.shuffle(this.bodies);
        return this;
    };

    random(n) {
        if (!n) {
            n = 1;
        }
        this.bodies = Matter.Common.shuffle(this.bodies);
        this.bodies.length = Math.min(n, this.bodies.length); 
        return this;
    };
 
    //The following methods return a particular element not a list
    getFirst() {
        if (this.bodies.length>0) {
            return this.bodies[0];
        } else {
            null;
        }
    };

    getRandom() {
        if (this.bodies.length>0) {
            return Matter.Common.choose(this.bodies);
        } else {
            null;
        }
    };

    get(k) {
        return this.bodies[k];
    };

    //Other methods
    toArray() {
        return this.bodies;
    };

    length() {
        return this.bodies.length;
    };
};

class AttractorList extends BodyList {
    constructor(engine) {
        super(engine);
        let attractors = [];
        for (let body of this.bodies) {
            if (body.plugin && body.plugin.force && body.plugin.force.attractor) {
                attractors.push(body);
            }
        }
        this.bodies = attractors;
    }
};

//todo: Integrate particle list into Chemistry
class ParticleList extends BodyList {
    constructor(engine) {
        super(engine);
        let particles = [];
        for (let body of this.bodies) {
            if (body.plugin && body.plugin.chemistry && body.plugin.chemistry.particle) {
                particles.push(body);
            }
        }
        this.bodies = particles;
    }

    static create(particles) {
        let list = new ParticleList(null);
        list.bodies = particles;
        return list;
    }

    formula(formula) {
        let formulas = Array.from(arguments);
        if (Array.isArray(formula)) {
            formulas = formula;
        }
        return this.filter(p => {
            return p.plugin.chemistry && (formulas.includes(p.plugin.chemistry.formula));  
        });
    }

    setFormula(formula) {
        return this.setChemistryOptions({formula: formula});
    }

    setChemistryOptions(chemistryOptions) {
        let options = {plugin: {chemistry: chemistryOptions}};
        return this.setOptions(options);
    }

    setTemperature(t) {
        return this.setChemistryOptions({temperature: t});
    }

    removeTemperature() {
        return this.forEach(p => {
            if (p.plugin.chemistry && p.plugin.chemistry.temperature) {
                delete p.plugin.chemistry.temperature;
            };
        })
    }

    setColor(color) {
        this.atoms().setColor(color);
        return this;
    }

    setForce(color, charge, forceType) {
        return this.forEach(p => {
            if (!p.plugin.force) {
                p.plugin.force = {forces: {}}
            }
            if (!p.plugin.force.forces) {
                p.plugin.force.forces = {}
            }
            p.plugin.force.forces[color] = {charge: charge, type: forceType};
        });
    }

    setConstantForce(direction, magnitude) {
        return this.forEach(p => {
            if (!p.plugin.force) {
                p.plugin.force = {forces: {}}
            }
            p.plugin.force.constant = {direction: direction, magnitude: magnitude};
        });
    }

    removeForce(color) {
        return this.forEach(p => {
            if (p.plugin.force && p.plugin.force.forces && p.plugin.force.forces[color]) {
                delete p.plugin.force.forces[color];
            }
        });
    }

    removeConstantForce() {
        return this.forEach(p => {
            if (p.plugin.force && p.plugin.force.constant) {
                delete p.plugin.force.constant;
            }
        });
    }

    stick() {
        return this.forEach(p => {
            Chemistry.stick(p);
        });
    }

    unstick(brownianMotionOptions) {
        return this.forEach(p => {
            Chemistry.unstick(p, brownianMotionOptions);
        });
    }

    sticked() {
        return this.filter(p => {
            return p.plugin.force && p.plugin.force.sticked;  
        });
    }

    unsticked() {
        return this.filter(p => {
            return !p.plugin.force || !p.plugin.force.sticked;  
        });
    }

    addAttraction(attractor, attractionLevel) {
        return this.forEach(p => {
            Force.addAttraction(p, attractor, attractionLevel);
        });
    }

    removeAttraction(attractor) {
        return this.forEach(p => {
            Force.removeAttraction(p, attractor);
        });
    }
  
    atoms() {
        return new AtomList(this.bodies);
    }

    static _numberOfCloseParticles(p) {
        let width = p.bounds.max.x - p.bounds.min.x;
        let height = p.bounds.max.y - p.bounds.min.y; 
        let extendedBound = {
            min: {x: p.bounds.min.x-width/2, y: p.bounds.min.y-height/2},
            max: {x: p.bounds.max.x+width/2, y: p.bounds.max.y+height/2}
        };
        return new ParticleList(engine).inBounds(extendedBound).length()-1;    
   }

   sortByNumberOfCloseParticles() {
       return this.sort((a,b) => {return ParticleList._numberOfCloseParticles(a)-ParticleList._numberOfCloseParticles(b);});
   }

   //Todo: replace with sortByDistanceTo that can take both point, body and particle
   sortByDistanceToParticle(particle) {
       return this.sort((a,b) => {return Proximity.distanceBetweenParticles(particle,a)-Proximity.distanceBetweenParticles(particle,b);});
   }

   sortByDistanceToPoint(point) {
       return this.sort((a,b) => {return Proximity.distanceToParticle(point,a)-Proximity.distanceToParticle(point,b);});
   }

   //object can be either a point or a particle
   closest(object, n) {
       if (!n) n=1;
       if (object.plugin && object.plugin.chemistry && object.plugin.chemistry.particle) {
           return this.sortByNumberOfCloseParticles(object).firsts(n);
       } else if (object.position) {
           return this.sortByDistanceToPoint(object.position).firsts(n);
       } else {          
           return this.sortByDistanceToPoint(object).firsts(n);
       }
   }
}

class AtomList extends BodyList {
    constructor(particles) {
        super();
        let atoms = [];
        for (let particle of particles) {
            for (let k = particle.parts.length > 1 ? 1 : 0; k < particle.parts.length; k++) {
                atom = particle.parts[k];
                atoms.push(atom);
            }
        }
        this.bodies = atoms;
    }

    formula(formula) {
        let formulas = Array.from(arguments);
        if (Array.isArray(formula)) {
            formulas = formula;
        }
        return this.filter(a => {
            return a.plugin.chemistry && (formulas.includes(a.plugin.chemistry.formula));  
        });
    }

    setColor(color) {
        this.setOptions({render: {fillStyle: color}});
    }
};
