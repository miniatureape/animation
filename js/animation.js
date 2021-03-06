var Identifier = new Class({

    _id: 0,
    omitted: [],

    initialize: function(omit){
        this.setOmissions(omit);
    },

    setOmissions: function(omit){
        // an omission is a hex string or integer
        // that shouldn't be used as an ID. You should
        // omit colors of things that are drawn in the osb
        // but not hittable, like the background color
        omit = omit || [];
        if(typeOf(omit) != 'array') omit = Array.from(omit);
        omit = omit.map(function(item){
            return this.cleanOmission(item);
        }, this);
        this.omitted = omit;
    },

    id: function(){
       // get the next, non-omitted id.
       while(this.omitted.contains( ++this._id )){}; 
       return this._id;
    },

    omit: function(omit){
        // add a string or in to the list of omitted.
        this.omitted.push(this.cleanOmmission(omit));
    },

    cleanOmission: function(item){
        // If the omitted item is a string, convert it 
        // to a integer
        if(typeOf(item) === 'string'){
            item = item.replace(/#/, '');
            item = parseInt(item,16);
        }
        return item;
    }
});


var Drawable = new Class({

    pos: {x: 0, y:0},
    acc: null,
    size: null,
    color: null,
    rot: 0,

    drawables: [],

    initialize: function(options){
        this.initProps();
    },

    draw: function(ctx, drawOffscreen){
        drawOffscreen = drawOffscreen || false;
        this.update();
        ctx.save();

        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rot);

        if(drawOffscreen){
            this.drawSelfOffscreen(ctx);
        }
        else{
            this.drawSelf(ctx);
        }

        this.drawOthers(ctx, drawOffscreen);

        ctx.restore();
    },

    initProps: function(){},

    update: function(){},

    drawSelf: function(ctx){},

    drawSelfOffscreen: function(ctx){},
    
    drawOthers: function(ctx, drawOffscreen){
        this.drawables.map(function(item, index){
            item.draw(ctx, drawOffscreen);
        }, this); 
    },

    add: function(drawable){
        this.drawables.push(drawable);
    }
});

var Interactive = new Class({
    Extends: Drawable,

    NUM_HEX_VALUES: 6,
    osColor: null,
    _id: null,

    setOsColor: function(id){
        var hex = id.toString(16);
        this.osColor = this.pad(hex);
    },

    setId: function(id){
        _id = id;
        this.setOsColor(id);
    },

    getId: function(){
        return _id;
    },

    pad: function(str){
        var diff = this.NUM_HEX_VALUES - str.length;
        while(diff > 0){
            str = '0' + str;
            diff = this.NUM_HEX_VALUES - str.length;
        }
        return str;
    },

    add: function(drawable){
        this.fireEvent('interactive:add', [this, drawable]);
        this.parent(drawable);
    },

    handleMouseClick: function(x, y){}
});

var Ball = new Class({
    Extends: Interactive,
    Implements: [Options, Events],

    initialize: function(options){
        this.initProps();
    },

    initProps: function(){
        this.pos = {x: 0, y:0};
        this.acc = {x: 0, y:0};
        this.size = {x: 10, y: 20};
        this.color = '#ccc';
    },

    drawSelf: function(ctx){
        ctx.fillStyle = this.color;
        ctx.fillRect(0, 0, this.size.x, this.size.y);
    },

    drawSelfOffscreen: function(ctx){
        ctx.fillStyle = this.osColor;
        ctx.fillRect(0, 0, this.size.x, this.size.y);
    },

    update: function(){
        this.pos.x += .4;
        this.pos.y += .2;
    },

    handleMouseClick: function(x, y){
        // x and y are based offset from canvas.
        this.color = '#0f0';
    }
});

var Animation = new Class({

    Extends: Interactive,
    Implements: [Options, Events],

    options:{
        frameRate: 60,
        noClear: false,
        osbBg: '#ff0000'
    },

    loop: null,
    canvas: null,
    ctx: null,

    initialize: function(canvas, options){
        this.setOptions(options);
        this.indentifier = this.initIdentifier(this.options.osbBg);
        this.canvas = document.id(canvas) || new Element('canvas');
        this.pos = this.cacheCoords(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.osb = this.initBuffer(this.canvas);
        this.initEvents(this.canvas);
    },

    initIdentifier: function(bg){
        // Create a new Identifier, omitting its background color
        // add handle any add events under the animation by
        // using the identifier to assign IDs
        
        var identifier = new Identifier(bg);
        this.addEvent('interactive:add', function(addedTo, added){
            console.log('added', added);
            added.setId( identifier.id() );
        });
        return identifier;
    },

    cacheCoords: function(canvas){
        return canvas.getCoordinates();
    },

    initBuffer: function(canvas){
        // clone the canvas and get a seperate context for
        // click testing.
        var osb = canvas.clone();

        osb.setStyle('background-color', this.options.osbBg);

        // TESTING
        // TODO REMOVE
        document.id('osbcontainer').grab(osb);

        return osb.getContext('2d');
    },

    initEvents: function(canvas){
        canvas.addEvent('click', this.click.bind(this));
        canvas.addEvent('mousemove', this.mouseover.bind(this));
    },

    click: function(evt){
       this.fireEvent('app:click');
       this.checkMouseHit(evt.event.offsetX, evt.event.offsetY);
    },

    checkMouseHit: function(x, y){
       this.draw(this.osb, true);
       var pixel = this.osb.getImageData(x, y, 1, 1);
       var color = this.getColorFromPixel(pixel.data);
       this.findDrawable(color, x, y);
    },

    getColorFromPixel: function(pixeldata){
        // we don't care about alpha
        var pixeldata = [pixeldata[0], pixeldata[1], pixeldata[2]];
        var color = pixeldata.rgbToHex();
        return color.replace(/#/, '');
    },

    findDrawable: function(color, x, y){
        this.drawables.each(function(drawable){
            if(drawable.osColor === color){
                drawable.handleMouseClick(x, y);
                console.log('found match', drawable);
            }
            this.findDrawable.apply(drawable);
        }.bind(this));
                  
    },

    mouseover: function(evt){
        this.cacheMousePos(evt);
    },

    cacheMousePos: function(evt){
        this.mousePos = {x: evt.event.offsetX, y: evt.event.offsetY};
    },

    start: function(frameRate){
        // As a convenience clear any previous loop.
        this.stop();

        // Create an interval that calls draw at preferred framerate.
        var frameRate = frameRate || this.options.frameRate
        var interval = 1000 / frameRate;
        this.loop = setInterval(this.draw.bind(this), interval, this.ctx); 
    },

    stop: function(){
        // Remove previous loop�The configuration section �standardEndpoints� cannot be read��.
        if(this.loop) removeInterval(this.loop);
    },

    clear: function(ctx){
        // paint the canvas with the background color to delete
        // any previous drawing.
        
        // If noClear option is set skip this.
        if(this.options.noClear) return;
        var canvas = ctx.canvas;
        var color = canvas.getStyle('background-color');

        ctx.save();
        ctx.fillStyle = color;  
        ctx.fillRect (0, 0, canvas.clientWidth, canvas.clientHeight);  
        ctx.restore();
    },

    draw: function(ctx, drawOffscreen){
        // Call draw on each of the canvasSprites and pass them the current
        // context.
        this.clear(ctx);
        this.parent(ctx, drawOffscreen);
    },

    toElement: function(){
        return this.canvas;
    }
});

window.addEvent('domready', function(){
    var a = new Animation('game');

    var b = new Ball();
    a.add(b);

    a.start();
});
