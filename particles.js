/**
* The `BodyList` module implements JQuery-like interface to work with group of bodies
*
* @class BodyList
*/

class BodyList {
    //Todo: replace engine with World
    constructor(engine) {
        this.bodies = [];
        for (let body of engine.world.bodies) {
            this.bodies.push(body);
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
        return this.filter(body => {
            return body.zoneMapColor==color;  
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

    first() {
        if (this.bodies.length>0) {
            return this.bodies[0];
        } else {
            null;
        }
    };

    get(k) {
        return this.bodies[k];
    };

    toArray() {
        return this.bodies;
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
        return this.filter(p => {
            return p.plugin.chemistry && (p.plugin.chemistry.formula==formula);  
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
};
