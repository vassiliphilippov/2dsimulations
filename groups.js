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
            Groups._drawGroups(engine, render, event.stage);
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

    Groups._drawGroups = function(engine, render, stage) {
        Profiler.begin("Groups._drawGroups");
        let bodies = engine.world.bodies;
        let groups = Groups._bodiesByGroup(bodies);
        for (let group in groups) {
            let bodiesInGroup = groups[group];
            Groups._drawGroup(render, stage, group, bodiesInGroup);
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

    Groups._drawGroup = function(render, stage, group, bodies) {
        let offset = Groups._groupOffset(group, bodies);

        let paths = Groups._getBodiesPaths(bodies);
        ClipperLib.JS.ScaleUpPaths(paths, Groups._clipperScale);

        let offsetted_paths = new ClipperLib.Paths(); 
        Groups._clipperOffsetter.Clear();
        Groups._clipperOffsetter.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);

        Groups._clipperOffsetter.Execute(offsetted_paths, offset * Groups._clipperScale);
        ClipperLib.JS.ScaleDownPaths(offsetted_paths, Groups._clipperScale);

        var graphics = new PIXI.Graphics();
        if (!(group in Groups.groupsOptions)) {
            console.log("Error. Group '" + group + "' not found in Groups.groupsOptions", Groups.groupsOptions);
        }
        graphics.alpha = Groups.groupsOptions[group].opacity;
        let groupColor = Groups.groupsOptions[group].fillStyle;
        graphics.beginFill(Matter.Common.colorToNumber(groupColor));

        Groups._drawPaths(render, graphics, offsetted_paths);
        stage.addChild(graphics); 
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

    Groups._drawPaths = function(render, graphics, paths) {
        paths.forEach(path => {
            Groups._drawPath(render, graphics, path);
        });
    };

    Groups._drawPath = function(render, graphics, path) {
        let _up = ChemistryRender.scaleUp;
        graphics.moveTo(_up(path[0].X), _up(path[0].Y));
        for (let i=1; i<path.length; i++) {
            graphics.lineTo(_up(path[i].X), _up(path[i].Y));
        }
        graphics.endFill();
    };
})();

