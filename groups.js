/**
* The `Groups` module implements logic of visually grouping several particles. It could be used for electron gas in metals, bubbles for gas, etc.
*
* @class Groups
*/

var Groups = {};

(function() {
    Groups._clipperScale = 3; //Clipper.js works with integer coordinates, so all cooperinates should be scaled up first and then scalled down by this factor
    Groups.groupsOptions = {}; //Information about group properies
    /*
    Groups.groupsOptions = {
        Zn: {
            fillStyle: "#FF00FF",
            opacity: 0.5,
            offset: 10 //in screen coordinates not pm, if null then calculated based on particle radius
        }
    }    
    */
    Groups._clipperOffsetter = null; //We reuse the object between frames for optimization
    Groups._defaultGroupOptions = {
        fillStyle: "#A4BDF9",
        opacity: 1
    };

    Groups.init = function(engine, render) {
        Groups._clipperOffsetter = new ClipperLib.ClipperOffset();
        Groups._clipperOffsetter.MiterLimit = 2;
        Groups._clipperOffsetter.ArcTolerance = 0.25;
        Matter.Events.on(render, "afterParticlesRender", (event) => {
            Groups._drawGroups(engine, render);
       });
    };

    Groups.markGroup = function(world, groupName, bodies) {
        for (body of world.bodies) {
            if (body.plugin.groups && body.plugin.groups.groupName==groupName) {
                delete body.plugin.groups.groupName;
            }
        }
        for (body of bodies) {
            if (!body.plugin.groups) {
                body.plugin.groups = {};
            }
            body.plugin.groups.groupName = groupName;
        }
    };

    Groups.groupOptions = function(groupName, options) {
        Groups.groupsOptions[groupName] = options;
        if (!Groups.groupsOptions[groupName].fillStyle) {
            Groups.groupsOptions[groupName].fillStyle = Groups._defaultGroupOptions.fillStyle;
        }
        if (!Groups.groupsOptions[groupName].opacity) {
            Groups.groupsOptions[groupName].opacity = Groups._defaultGroupOptions.opacity;
        }
    }

    Groups._drawGroups = function(engine, render) {
        Profiler.begin("Groups._drawGroups");
        let bodies = engine.world.bodies;
        let groups = Groups._bodiesByGroup(bodies);
        for (let group in groups) {
            let bodiesInGroup = groups[group];
            Groups._drawGroup(render, group, bodiesInGroup);
        }
        Profiler.end();
    };

    Groups._bodiesByGroup = function(bodies) {
        groups = {};
        for (body of bodies) {
            if (body.plugin.groups && body.plugin.groups.groupName) {
                let groupName = body.plugin.groups.groupName;
                if (!(groupName in groups)) {
                    groups[groupName] = [];
                }
                groups[groupName].push(body);
            }
        }
        return groups;
    };

    Groups._drawGroup2 = function(render, group, bodies) {
        let offset = Groups._groupOffset(group, bodies);
        let c = render.context;

        //Save context settings
        let saveFillStyle = c.fillStyle;
        let saveGlobalAlpha = c.globalAlpha;

        c.fillStyle = Groups.groupsOptions[group].fillStyle;
        c.globalAlpha = Groups.groupsOptions[group].opacity;
        for (body of bodies) {
            if (!body.render.visible)
                continue;

            for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
                part = body.parts[k];
                if (part.circleRadius) {
                    c.beginPath();
                    c.arc(part.position.x, part.position.y, part.circleRadius+offset, 0, 2 * Math.PI);
                    c.fill();
                }
            }
        }

        //Restore context settings
        c.fillStyle = saveFillStyle;
        c.globalAlpha = saveGlobalAlpha;
    }

    Groups._drawGroup = function(render, group, bodies) {
        let offset = Groups._groupOffset(group, bodies);

        let paths = Groups._getBodiesPaths(bodies);
        ClipperLib.JS.ScaleUpPaths(paths, Groups._clipperScale);

        let offsetted_paths = new ClipperLib.Paths(); 
        Groups._clipperOffsetter.Clear();
        Groups._clipperOffsetter.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);

        Groups._clipperOffsetter.Execute(offsetted_paths, offset * Groups._clipperScale);
        ClipperLib.JS.ScaleDownPaths(offsetted_paths, Groups._clipperScale);

        let c = render.context;

        //Save context settings
        let saveFillStyle = c.fillStyle;
        let saveGlobalAlpha = c.globalAlpha;

        if (!(group in Groups.groupsOptions)) {
            console.log("Error. Group '" + group + "' not found in Groups.groupsOptions", Groups.groupsOptions);
        }
        c.globalAlpha = Groups.groupsOptions[group].opacity;
        c.fillStyle = Groups.groupsOptions[group].fillStyle;

        Groups._drawPaths(c, offsetted_paths);

        //Restore context settings
        c.fillStyle = saveFillStyle;
        c.globalAlpha = saveGlobalAlpha;
    };

    Groups._groupOffset = function(group, bodies) {
        if (Groups.groupsOptions[group] && Groups.groupsOptions[group].offset) {
            return Groups.groupsOptions[group].offset;
        } else {
            let maxRadius = -Infinity;
            for (body of bodies) {
                for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
                    part = body.parts[k];
                    if (part.circleRadius) {
                        if (part.circleRadius>maxRadius) {
                            maxRadius = part.circleRadius;
                        }
                    }
                }
            }
            return maxRadius*0.7;
        }
    };

    Groups._getBodiesPaths = function(bodies) {
        let paths = [];
        for (body of bodies) {
            paths.push(...Groups._getBodyPaths(body));
        }
        return paths;
    };

    Groups._getBodyPaths = function(body) {
        let paths = [];
        for (let k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
            part = body.parts[k];
            path = []
            for (let i=0; i<part.vertices.length; i++) {
                path.push({X: part.vertices[i].x, Y: part.vertices[i].y});
            }
            paths.push(path);
        }
        return paths;
    };

    Groups._drawPaths = function(c, paths) {
        paths.forEach(path => {
            Groups._drawPath(c, path);
        });
    };

    Groups._drawPath = function(c, path) {
        c.beginPath();
        c.moveTo(path[0].X, path[0].Y);
        for (let i=1; i<path.length; i++) {
            c.lineTo(path[i].X, path[i].Y);
        }
        c.closePath();
        c.fill();
    };
})();

