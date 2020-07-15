/**
* The `Matter.Render` module is a simple HTML5 canvas based renderer for visualising instances of `Matter.Engine`.
* It is intended for development and debugging purposes, but may also be suitable for simple games.
* It includes a number of drawing options including wireframe, vector with support for sprites and viewports.
*
* @class Render
*/

var ChemistryRender = {};

//Todo: move all calculations to a worker: https://developers.google.com/web/updates/2018/08/offscreen-canvas  
//Todo: cash (reuse) graphics for non-particle bodies, not to create separate objects each time
//Todo: move atom specific drawing to atomdrawing
(function() {

    ChemistryRender.qualityScaleUp = 5; //We render all textures in higher resolution for better quality. This parameter defines this upscaling coefficient
    ChemistryRender.TextureResolution = 1; //The resolution / device pixel ratio of the texture being generated for the generateTexture method
    ChemistryRender.AtomPadding = 3; //Padding around atom in the textures (needed for antialiasing), it make the texture bigger than needed

    //Atom drawing parameters
    ChemistryRender.AtomEdgeWidth = 2; 
    ChemistryRender.AtomFlareOpacity = 0.3;
    ChemistryRender.AtomFlareColor = 0xFFFFFF;
    ChemistryRender.AtomFontWeight = 'normal'; 
    ChemistryRender.AtomFontFamily = 'Verdana'; 

    _up = ChemistryRender.scaleUp = function(x) {
        return x * ChemistryRender.qualityScaleUp;
    };

    var _requestAnimationFrame,
        _cancelAnimationFrame;

    if (typeof window !== 'undefined') {
        _requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame
                                      || window.mozRequestAnimationFrame || window.msRequestAnimationFrame
                                      || function(callback){ window.setTimeout(function() { callback(Matter.Common.now()); }, 1000 / 60); };

        _cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame
                                      || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;
    }

    ChemistryRender.create = function(options) {
        var defaults = {
            controller: ChemistryRender,
            engine: null,
            element: null,
            canvas: null,
            mouse: null,
            frameRequestId: null,
            options: {
                width: 800,
                height: 600,
                pixelRatio: 1,
                background: '#18181d',
                wireframeBackground: '#0f0f13',
                hasBounds: !!options.bounds,
                enabled: true,
                wireframes: false,
                showSleeping: true,
                showDebug: false,
                showBroadphase: false,
                showBounds: false,
                showVelocity: false,
                showCollisions: false,
                showSeparations: false,
                showAxes: false,
                showPositions: false,
                showAngleIndicator: false,
                showIds: false,
                showShadows: false,
                showVertexNumbers: false,
                showConvexHulls: false,
                showInternalEdges: false,
                showMousePosition: false
            }
        };

        var render = Matter.Common.extend(defaults, options);


        render.pixiApp = new PIXI.Application({width: render.options.width, height: render.options.height, resolution: window.devicePixelRatio || 1});
        render.pixiStage = render.pixiApp.stage;//new PIXI.Container();
        render.pixiRenderer = render.pixiApp.renderer;//new PIXI.autoDetectRenderer(render.options.width, render.options.height);

        //Special optimization for atoms as we have a lot of them. They are divided into two sprites one that is rotated and another one that is not (for 3D effects)
        render.atomRotatableSprites = {};
        render.atomNonRotatableSprites = {};
        render.atomRotatableTexturesCache = {};
        render.atomNonRotatableTexturesCache = {};
        render.texturesCache = {};
        render.spriteBasedBodySprites = {};

        document.body.appendChild(render.pixiRenderer.view);
        render.pixiRenderer.view.oncontextmenu = function() { return false; };
        render.pixiRenderer.view.onselectstart = function() { return false; };

        render.mouse = options.mouse;
        render.engine = options.engine;
        render.canvas = render.pixiRenderer.view;
        render.textures = {};

        render.bounds = render.bounds || {
            min: {
                x: 0,
                y: 0
            },
            max: {
                x: render.canvas.width,
                y: render.canvas.height
            }
        };

        if (Matter.Common.isElement(render.element)) {
            render.element.appendChild(render.canvas);
        } else if (!render.canvas.parentNode) {
            Matter.Common.log('ChemistryRender.create: options.element was undefined, render.canvas was created but not appended', 'warn');
        }


        return render;
    };

    /**
     * Continuously updates the render canvas on the `requestAnimationFrame` event.
     * @method run
     * @param {render} render
     */
    ChemistryRender.run = function(render) {
        (function loop(time){
            render.frameRequestId = _requestAnimationFrame(loop);
            ChemistryRender.world(render);
        })();
    };

    /**
     * Ends execution of `ChemistryRender.run` on the given `render`, by canceling the animation frame request event loop.
     * @method stop
     * @param {render} render
     */
    ChemistryRender.stop = function(render) {
        _cancelAnimationFrame(render.frameRequestId);
    };

    /**
     * Positions and sizes the viewport around the given object bounds.
     * Objects must have at least one of the following properties:
     * - `object.bounds`
     * - `object.position`
     * - `object.min` and `object.max`
     * - `object.x` and `object.y`
     * @method lookAt
     * @param {render} render
     * @param {object[]} objects
     * @param {vector} [padding]
     * @param {bool} [center=true]
     */
    ChemistryRender.lookAt = function(render, objects, padding, center) {
        center = typeof center !== 'undefined' ? center : true;
        objects = Matter.Common.isArray(objects) ? objects : [objects];
        padding = padding || {
            x: 0,
            y: 0
        };

        // find bounds of all objects
        var bounds = {
            min: { x: Infinity, y: Infinity },
            max: { x: -Infinity, y: -Infinity }
        };

        for (var i = 0; i < objects.length; i += 1) {
            var object = objects[i],
                min = object.bounds ? object.bounds.min : (object.min || object.position || object),
                max = object.bounds ? object.bounds.max : (object.max || object.position || object);

            if (min && max) {
                if (min.x < bounds.min.x)
                    bounds.min.x = min.x;

                if (max.x > bounds.max.x)
                    bounds.max.x = max.x;

                if (min.y < bounds.min.y)
                    bounds.min.y = min.y;

                if (max.y > bounds.max.y)
                    bounds.max.y = max.y;
            }
        }

        // find ratios
        var width = (bounds.max.x - bounds.min.x) + 2 * padding.x,
            height = (bounds.max.y - bounds.min.y) + 2 * padding.y,
            viewHeight = render.canvas.height,
            viewWidth = render.canvas.width,
            outerRatio = viewWidth / viewHeight,
            innerRatio = width / height,
            scaleX = 1,
            scaleY = 1;

        // find scale factor
        if (innerRatio > outerRatio) {
            scaleY = innerRatio / outerRatio;
        } else {
            scaleX = outerRatio / innerRatio;
        }

        // enable bounds
        render.options.hasBounds = true;

        // position and size
        render.bounds.min.x = bounds.min.x;
        render.bounds.max.x = bounds.min.x + width * scaleX;
        render.bounds.min.y = bounds.min.y;
        render.bounds.max.y = bounds.min.y + height * scaleY;

        // center
        if (center) {
            render.bounds.min.x += width * 0.5 - (width * scaleX) * 0.5;
            render.bounds.max.x += width * 0.5 - (width * scaleX) * 0.5;
            render.bounds.min.y += height * 0.5 - (height * scaleY) * 0.5;
            render.bounds.max.y += height * 0.5 - (height * scaleY) * 0.5;
        }

        // padding
        render.bounds.min.x -= padding.x;
        render.bounds.max.x -= padding.x;
        render.bounds.min.y -= padding.y;
        render.bounds.max.y -= padding.y;

        // update mouse
        if (render.mouse) {
            Matter.Mouse.setScale(render.mouse, {
                x: (render.bounds.max.x - render.bounds.min.x) / render.canvas.width,
                y: (render.bounds.max.y - render.bounds.min.y) / render.canvas.height
            });

            Matter.Mouse.setOffset(render.mouse, render.bounds.min);
        }
    };

    /**
     * Applies viewport transforms based on `render.bounds` to a render context.
     * @method startViewTransform
     * @param {render} render
     */
    ChemistryRender.startViewTransform = function(render) {
        var boundsWidth = render.bounds.max.x - render.bounds.min.x,
            boundsHeight = render.bounds.max.y - render.bounds.min.y,
            boundsScaleX = boundsWidth / render.options.width,
            boundsScaleY = boundsHeight / render.options.height;

        render.pixiStage.scale.set(1 / boundsScaleX / ChemistryRender.qualityScaleUp, 1 / boundsScaleY / ChemistryRender.qualityScaleUp);
        render.pixiStage.position.set(-render.bounds.min.x * (1 / boundsScaleX), -render.bounds.min.y * (1 / boundsScaleY));
    };

    /**
     * Renders the given `engine`'s `Matter.World` object.
     * This is the entry point for all rendering and should be called every time the scene changes.
     * @method world
     * @param {render} render
     */
    ChemistryRender.world = function(render) {
        Profiler.begin("ChemistryRender.world");

        let allBodies = Matter.Composite.allBodies(render.engine.world);
        let bodies = [];

        var event = {
            render: render,
            timestamp: render.engine.timing.timestamp
        };

        Profiler.begin("beforeRender");
        Matter.Events.trigger(render, 'beforeRender', event);
        Profiler.end();

        Profiler.begin("pre bodies");
        bodies = allBodies;
        Profiler.end(); 

        ChemistryRender.startViewTransform(render);

        //Create a generic Graphics for all custom drawing on top
        render.overlayGraphics = new PIXI.Graphics();

        //Remove all children from Pixi, they will be recreated again
        Profiler.begin("removeChildren");
        render.pixiStage.removeChildren(0);
        Profiler.end();

        Profiler.begin("background");
        ChemistryRender.bodies(render, ChemistryRender.selectBackgroundBodies(bodies));
        Profiler.end(); 

        Profiler.begin("e:afterBackgroundRender");
        Matter.Events.trigger(render, 'afterBackgroundRender', event);
        Profiler.end();

        //Draw all non-background bodies
        ChemistryRender.bodies(render, ChemistryRender.selectNonBackgroundBodies(bodies));

        Profiler.begin("afterParticlesRender");
        event.graphics = render.overlayGraphics;
        event.stage = render.pixiStage;
        Matter.Events.trigger(render, 'afterParticlesRender', event);
        Profiler.end();

        //Draw the custom overlay Graphics
        render.pixiStage.addChild(render.overlayGraphics);

        Profiler.begin("pixiRendering");
        render.pixiRenderer.render(render.pixiStage);
        Profiler.end();

        Profiler.begin("afterRender");
        Matter.Events.trigger(render, 'afterRender', event);
        Profiler.end();

        Profiler.end();
    };

    ChemistryRender.selectBackgroundBodies = function(bodies) {
        return bodies.filter(body => (body.plugin && body.plugin.background && body.plugin.background.isBackground));
    };

    ChemistryRender.selectNonBackgroundBodies = function(bodies) {
        return bodies.filter(body => (!body.plugin || !body.plugin.background || !body.plugin.background.isBackground));
    };

    ChemistryRender.bodies = function(render, bodies) {
        Profiler.begin("bodies");

        for (i = 0; i < bodies.length; i++) {
            body = bodies[i];

            if (!body.render.visible)
                continue;

            if (body.plugin.chemistry && body.plugin.chemistry.particle) {
                ChemistryRender.drawParticle(render, body);
            } else {
                ChemistryRender.drawBody(render, body);
            }

        }
        Profiler.end();
    };

    ChemistryRender.drawBody = function(render, body) {
        for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
            part = body.parts[k];

            if (!part.render.visible)
                continue;

            ChemistryRender.drawPart(render, part);
        }
    };

    ChemistryRender.drawParticle = function(render, particle) {
        for (let k = particle.parts.length > 1 ? 1 : 0; k < particle.parts.length; k++) {
            part = particle.parts[k];

            if (!part.render.visible)
                continue;

            ChemistryRender.drawAtom(render, part);
        }

        var event = {
            render: render,
            particle: particle,
            graphics: render.overlayGraphics
        };
        Matter.Events.trigger(render, 'afterParticleDraw', event);
    };

    ChemistryRender._getSpriteBasedBodyKey = function(body) {
        return body.id + ":" + part.render.sprite.texture;
    };

    ChemistryRender.drawPart = function(render, part) {
        if (part.render.sprite && part.render.sprite.texture) {
            ChemistryRender.drawSpriteBasedPart(render, part);
        } else {
            ChemistryRender.drawGeometryPart(render, part);
        }
    };

    ChemistryRender.drawSpriteBasedPart = function(render, part) {
        let sprite = render.spriteBasedBodySprites[ChemistryRender._getSpriteBasedBodyKey(part)];
        if (!sprite) {
            let texture = null;
            if (part.render.sprite.texture in render.texturesCache) {
                texture = render.texturesCache[part.render.sprite.texture];
            } else {
                texture = PIXI.Texture.from(part.render.sprite.texture); 
                render.texturesCache[part.render.sprite.texture] = texture;
            }
        
            sprite = new PIXI.Sprite(texture);
            sprite.anchor.x = 0.5;
            sprite.anchor.y = 0.5;
            sprite.scale.set(ChemistryRender.qualityScaleUp, ChemistryRender.qualityScaleUp);
            render.spriteBasedBodySprites[ChemistryRender._getSpriteBasedBodyKey(part)] = sprite;
        }

        sprite.position.x = _up(part.position.x);
        sprite.position.y = _up(part.position.y);
        sprite.rotation = part.angle;
        sprite.alpha  = part.render.opacity;
        render.pixiStage.addChild(sprite);
    }

    ChemistryRender.drawGeometryPart = function(render, part) {
        let graphics = new PIXI.Graphics();
        if (part.render.lineWidth) {
            graphics.lineStyle(_up(part.render.lineWidth), Matter.Common.colorToNumber(part.render.strokeStyle), 1);
        } else {
            graphics.lineStyle(0);
        }

        graphics.beginFill(Matter.Common.colorToNumber(part.render.fillStyle), 1);

        if (part.circleRadius) {
            graphics.drawCircle(_up(part.position.x), _up(part.position.y), _up(part.circleRadius));
        } else {
            graphics.moveTo(_up(part.vertices[0].x), _up(part.vertices[0].y));

            for (var j = 1; j < part.vertices.length; j++) {
                if (!part.vertices[j - 1].isInternal) {
                    graphics.lineTo(_up(part.vertices[j].x), _up(part.vertices[j].y));
                } else {
                    graphics.moveTo(_up(part.vertices[j].x), _up(part.vertices[j].y));
                }

                if (part.vertices[j].isInternal) {
                    graphics.moveTo(_up(part.vertices[(j + 1) % part.vertices.length].x), _up(part.vertices[(j + 1) % part.vertices.length].y));
                }
            }
      
            graphics.lineTo(_up(part.vertices[0].x), _up(part.vertices[0].y));
            graphics.closePath();
        }

        graphics.endFill();
        graphics.alpha  = part.render.opacity;
        render.pixiStage.addChild(graphics); 
    }

    ChemistryRender.drawAtom = function(render, atom) {
        Profiler.begin("drawAtom");

        let particle = atom.parent;
        let radius = atom.circleRadius;
        let labelText = ChemistryRender._getAtomDisplayText(atom);

        //Drawing of each atom is divided into two parts: rotatable and non-rotatable sprite

        //First we draw rotatable sprite
        let atomSprite1 = render.atomRotatableSprites[ChemistryRender._getAtomKey(atom)];

        if (!atomSprite1) {
            atomSprite1 = ChemistryRender.createAtomRotatableSprite(render, labelText, atom.position, radius, particle.angle, atom.render.fillStyle);
            render.atomRotatableSprites[ChemistryRender._getAtomKey(atom)] = atomSprite1;
        }

        atomSprite1.position.x = _up(atom.position.x);
        atomSprite1.position.y = _up(atom.position.y);
        atomSprite1.rotation  = particle.angle;
        atomSprite1.alpha  = atom.render.opacity;
        render.pixiStage.addChild(atomSprite1);

        //Second we draw non-rotatable sprite
        let atomSprite2 = render.atomNonRotatableSprites[ChemistryRender._getAtomKey(atom)];

        if (!atomSprite2) {
            atomSprite2 = ChemistryRender.createAtomNonRotatableSprite(render, labelText, atom.position, radius, particle.angle, atom.render.fillStyle);
            render.atomNonRotatableSprites[ChemistryRender._getAtomKey(atom)] = atomSprite2;
        }

        atomSprite2.position.x = _up(atom.position.x);
        atomSprite2.position.y = _up(atom.position.y);
        atomSprite2.alpha  = atom.render.opacity;
        render.pixiStage.addChild(atomSprite2);

        Profiler.end();
    };

    ChemistryRender._getAtomDisplayText = function(atom) {
        let particle = atom.parent;
        let singleAtomParticle = (particle.parts.length == 2);
        if (singleAtomParticle) {
            return particle.plugin.chemistry.formula;
        } else {
            return atom.plugin.chemistry.formula;
        }
    };

    ChemistryRender._getAtomKey = function(atom) {
        return atom.id + ":" + ChemistryRender._getAtomDisplayText(atom) + ":" + atom.circleRadius + ":" + atom.render.fillStyle;
    };

    ChemistryRender.createAtomRotatableSprite = function(render, formula, position, radius, angle, color) {
        var texture = ChemistryRender.getAtomRotatableTexture(render, formula, radius,  0, color);

        var sprite = new PIXI.Sprite(texture);
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;

        return sprite;
    };

    ChemistryRender.createAtomNonRotatableSprite = function(render, formula, position, radius, angle, color) {
        var texture = ChemistryRender.getAtomNonRotatableTexture(render, formula, radius,  0, color);

        var sprite = new PIXI.Sprite(texture);
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;

        return sprite;
    };


    ChemistryRender.getAtomRotatableTexture = function(render, formula, radius, angle, color) {
        let textureKey = formula + ":" + radius + ":" + angle + ":" + color;
        let texture = render.atomRotatableTexturesCache[textureKey];
        if (!texture) {
            let padding = ChemistryRender.AtomPadding;
            var graphics = new PIXI.Graphics();
            ChemistryRender.drawAtomIntoGraphics(graphics, formula, radius, padding, color);  

            texture = render.pixiRenderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, ChemistryRender.TextureResolution, new PIXI.Rectangle(0, 0, _up(2*radius+2*padding), _up(2*radius+2*padding)));
            render.atomRotatableTexturesCache[textureKey] = texture;
        }
        return texture;
    };

    ChemistryRender.getAtomNonRotatableTexture = function(render, formula, radius, angle, color) {
        let textureKey = formula + ":" + radius + ":" + angle + ":" + color;
        let texture = render.atomNonRotatableTexturesCache[textureKey];
        if (!texture) {
            let padding = ChemistryRender.AtomPadding;
            let edgeWidth = ChemistryRender.AtomEdgeWidth;
            var graphics = new PIXI.Graphics();

            graphics.beginFill(ChemistryRender.AtomFlareColor, ChemistryRender.AtomFlareOpacity);
            graphics.drawCircle(_up(padding+radius+(radius-edgeWidth/2)/(2*Math.SQRT2)), _up(padding+radius-(radius-edgeWidth/2)/(2*Math.SQRT2)), _up((radius-edgeWidth/2)/2));
            graphics.endFill();

            texture = render.pixiRenderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, ChemistryRender.TextureResolution, new PIXI.Rectangle(0, 0, _up(2*radius+2*padding), _up(2*radius+2*padding)));
            render.atomNonRotatableTexturesCache[textureKey] = texture;
        }
        return texture;
    };

    ChemistryRender.drawAtomIntoGraphics = function(graphics, formula, radius, padding, color) {
        let colorInt = Matter.Common.colorToNumber(color);
        let edgeColorInt = Matter.Common.colorToNumber(AtomDrawer._getEdgeColor(color));
        let textColor = AtomDrawer._getLabelTextColor(color);
        let textSize = ChemistryRender._getLabelFont(radius);
        let edgeWidth = ChemistryRender.AtomEdgeWidth;

        graphics.lineStyle(_up(edgeWidth), edgeColorInt);
        graphics.beginFill(colorInt);
        graphics.drawCircle(_up(padding+radius), _up(padding+radius), _up(radius));
        graphics.endFill();

        const style = new PIXI.TextStyle({
            align: 'center',
            fontFamily: ChemistryRender.AtomFontFamily,
            fontSize: _up(textSize),
            fontWeight: ChemistryRender.AtomFontWeight,
            fill: textColor
        });

        const text = new PIXI.Text(AtomDrawer._useSubscript(formula), style);
        text.anchor.set(0.5, 0.5);
        text.x = _up(radius+padding);
        text.y = _up(radius+padding);
        graphics.addChild(text);
    };


    ChemistryRender._getLabelFont = function(radius) {
       if (radius<20) {
           return Math.floor(radius*0.8);
       } else {
           return Math.floor(radius*0.7);
       }
    };
})();
