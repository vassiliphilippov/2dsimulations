/**
* The `BodyList` module implements JQuery-like interface to work with group of bodies
*
* @class BodyList
*/

//Todo: implement closest
//Todo: Closer
//Todo: in rect, in zone
//Todo: outer 
//Todo: sticked and notsticked
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

    label(s) {
        return this.filter(body => {
            return body.label==s;
        });
    }

    setOptions(options) {
        for (let body of this.bodies) {
            Matter.Common.extend(body, options);
        }
        return this;
    }

    forEach(callback) {
        for (let body of this.bodies) {
            callback(body);
        }
        return this;
    }

    zoneMapColor(color) {
        let colors = Array.prototype.slice.call(arguments);
        return this.filter(body => {
            return colors.indexOf(body.zoneMapColor)!=-1;  
        });
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
//todo: Inherit ParticleList from BodyList
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

    formula(formula) {
        let formulas = Array.from(arguments);
        if (Array.isArray(formula)) {
            formulas = formula;
        }
        return this.filter(p => {
            return p.plugin.chemistry && (formulas.includes(p.plugin.chemistry.formula));  
        });
    }

    setChemistryOptions(chemistryOptions) {
        let options = {plugin: {chemistry: chemistryOptions}};
        return this.setOptions(options);
    }

    setTemperature(t) {
        return this.setChemistryOptions({temperature: t});
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

    stick() {
        return this.forEach(p => {
            Chemistry.stick(p);
        });
    }

    removeForce(color) {
        return this.forEach(p => {
            if (p.plugin.force && p.plugin.force.forces && p.plugin.force.forces[color]) {
                delete p.plugin.force.forces[color];
            }
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
};

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

};
