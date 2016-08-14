"use strict";

/**
 * UI codes.
 *
 * D3 v4 and jquery are expected to be present.
 */


/**
 * Create a display.
 *
 * Variable number of white lights are displayed.
 *
 * @param parent Parent element
 * @param size Lights count
 */
function lightsDisplay(parent, size) {

    var component = $('<div>', { style : 'display: flex; margin-bottom: 20px;' } );
    var inner =  $('<div>', { style : 'background-color: black; padding: 10px; display: flex;' } ).appendTo(component);
    component.appendTo(parent);

    // Color gradient to use
    var grad = d3.scaleLinear().domain([0.0, 1.0]).range(['#602020', '#FFFBE8']).clamp(true);

    var ret = {
        /**
         * Number of lights.
         */
        size : size,

        /**
         * Set the number of lights.
         *
         * @param s Number
         */
        setSize : function(s) {
            var adding = ret.size < s;
            ret.size = s;

            var a = 32; // square size
            var m = 8; // Margin

            var l = []; for (var i = 0; i < ret.size; i++) { l.push(0.0); }

            var pw = $(parent).innerWidth();

            while (300 + s * (a + 2 * m) > pw) {
                a --;
                m = Math.round(a / 4);
            }
            var sel = d3.select(inner[0]).selectAll('div');
            if (adding) {
                // Cells might need to be smaller
                sel
                    .style('margin', m + 'px')
                    .style('width', a + 'px')
                    .style('height', a + 'px');
            }

            sel.data(l).enter()
                    .append('div')
                    .style('background-color', grad)
                    .style('margin', m + 'px')
                    .style('width', a + 'px')
                    .style('height', a + 'px');

            sel.data(l).exit()
                    .remove();

            if (!adding) {
                sel
                    .style('margin', m + 'px')
                    .style('width', a + 'px')
                    .style('height', a + 'px');
            }

            return ret;
        },

        /**
         * Set values.
         *
         * @param l Light values, a properly sized array of values between 0 and 1
         */
        set : function(l) {

            if (l.length !== ret.size) {
                throw new Error('Expected size ' + ret.size + ', got ' + l.length);
            }
            d3.select(inner[0]).selectAll('div').data(l).style('background-color', grad);
            return ret;
        }
    };

    ret.setSize(size);
    return ret;
}



/**
 * Canvas based display with scales.
 *
 * @param parent Parent element
 * @param w Main area (canvas) width in pixels
 * @param h Main area (canvas) height in pixels
 */
function scrollingCanvas(parent, w, h) {
    var component = $('<div>');

    var title = $('<h4>', { text : 'Scrolling canvas' }).appendTo(component);
    var chartdiv = $('<div>', { style : 'position: relative;' }).appendTo(component); // will use absolute positions for scales
    var canvas = ($('<canvas>', { width : w, height : h, style : 'display: block; background-color: black ;' }).appendTo(chartdiv))[0];
    component.appendTo(parent);

    // X axis when specified
    var xsvg;
    var xsvgg;
    var xscale;
    var xaxis;

    // Y axis when specified
    var ysvg;
    var ysvgg;
    var yscale;
    var yaxis;

    // Vertical canvas based scale when specified
    var cvscale;
    var cvscalectx;


    canvas.width=w;
    canvas.height=h;

    var ctx = canvas.getContext("2d");

    // Temporary canvas used for scrolling
    var tempCanvas = document.createElement("canvas");
    tempCanvas.width=w;
    tempCanvas.height=h;
    var tempCtx = tempCanvas.getContext("2d");

    // Component facade
    var ret = {
        /**
         * Main canvas width in pixels.
         */
        w : w,

        /**
         * Main canvas height in pixels
         */
        h : h,

        /**
         * Vertical scale underlay canvas 2D context.
         *
         * An 50px wide canvas positioned right to the main area, under the vertical scale.
         */
        cvscaleCtx : function() {
            if (!cvscalectx) {
                cvscale = ($('<canvas>', { width : 50, height : h, style : 'display: block; background-color: white ; position : absolute  ; top : 0px ; left : ' + w + 'px' }).prependTo(chartdiv))[0];
                cvscale.width=50;
                cvscale.height=h;
                cvscalectx = cvscale.getContext("2d");
            }
            return cvscalectx;
        },

        /**
         * X axis of the main scale.
         *
         * @param domain Domain of the scale
         * @param range Optional range in pixels
         */
        xaxis : function(domain, range) {
            if (!xsvg) {
                xsvg = d3.select(chartdiv[0]).append('svg')
                            .attr('width', w + 20)
                            .attr('height', 20)
                            .style('position', 'absolute')
                            .style('left', '-10px')
                            .style('top', h + 'px')
                            .classed('noaxispath', true);
                xscale = d3.scaleLinear();
                xaxis = d3.axisBottom().scale(xscale).tickFormat(si);
                xsvgg = xsvg.append('g');
            }
            var rangeToUse = range ? [10 + range[0], 10 + range[1]] : [10, w + 10];
            xscale.domain(domain).range(rangeToUse);
            xsvgg.transition().call(xaxis); // See https://gist.github.com/phoebebright/3098488
            return ret;
        },

        /**
         * Y axis of the main scale.
         *
         * @param domain Domain of the scale
         * @param range Optional range in pixels
         */
        yaxis : function(domain, range) {
            if (!ysvg) {
                ysvg = d3.select(chartdiv[0]).append('svg')
                        .attr('width', 100)
                        .attr('height', h + 20)

                        .style('position', 'absolute')
                        .style('left', w + 'px')
                        .style('top', '-10px')
                        .classed('noaxispath', true);
                yscale = d3.scaleLinear();
                yaxis = d3.axisRight().scale(yscale).tickFormat(si);
                ysvgg = ysvg.append('g');
            }
            var rangeToUse = range ? [10 + range[0], 10 + range[1]] : [10, h + 10];
            yscale.domain(domain).range(rangeToUse);
            ysvgg.transition().call(yaxis); // See https://gist.github.com/phoebebright/3098488
            return ret;
        },

        axisFromFftParams : function(axis, size, invert, samplerate, freqbincount, clip) {
            var domain;
            var range;
            if (freqbincount <= size) {
                // every bin fits to 1 px
                domain = [0, samplerate / 2];
                range = [0, Math.min(freqbincount, size)];

            } else if (clip) {
                // not all bin fits, but all are 1 px
                domain = [0, size * samplerate / (2 * freqbincount), samplerate / 2];
                range = [0, size];
            } else {
                // every bin goes but merged
                var n = 1;
                while (freqbincount > size * n) {
                    n *= 2;
                }
                // n bins are merged
                domain = [0, samplerate / 2];
                range = [0, freqbincount / n];

            }
            return axis(domain, invert ? [size -  range[0], size - range[1]] : range);
        },
        xaxisFromFftParams : function(samplerate, freqbincount, clip) {
            return ret.axisFromFftParams(ret.xaxis, w, false, samplerate, freqbincount, clip);
        },
        yaxisFromFftParams : function(samplerate, freqbincount, clip) {
            return ret.axisFromFftParams(ret.yaxis, h, true, samplerate, freqbincount, clip);
        },

        xaxisFromFps : function(fps) {
            return ret.xaxis([-w / fps, 0]);
        },
        getContext2d : function() {
            return ctx;
        },
        /**
         * Step the canvas 1 px left but dont clear right row.
         */
        step : function() {
            tempCtx.drawImage(canvas, 0, 0, w, h);
            // set translate on the canvas
            ctx.translate(-1, 0);
            // draw the copied image
            ctx.drawImage(tempCanvas, 0, 0, w, h, 0, 0, w, h);

            // reset the transformation matrix
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            return ret;
        },
        /**
         * Clear rightmost pixel column.
         */
        cline : function() {
            ctx.fillStyle = '#000000';
            ctx.fillRect(w - 1, 0, 1, h);

            return ret;
        },
        /**
         * Draw a bar value in the rightmost pixel column.
         *
         * @param p Value normalized to 0..1 range
         */
        bar : function(p) {
            ret.step();
            ret.cline();
            if (p >= 0.0 && p <= 1.0) {
                ctx.fillStyle = '#008800';
                ctx.fillRect(w - 1, h * (1 - p), 1, h * p);
            }

            return ret;
        },
        /**
         * Draw a bar value and a dot value in the righmost pixel column.
         *
         * @param p Bar value normalized to 0..1 range
         * @param d Dot value normalized to 0..1 range
         * @param d2 Dot value normalized to 0..1 range
         */
        barAndDot : function(p, d, d2) {
            ret.bar(p);
            if (d && d >= 0.0 && d <= 1.0) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(w - 1, h * (1 - d), 1, 1);
            }
            if (d2 && d2 >= 0.0 && d2 <= 1.0) {
                ctx.fillStyle = '#aaaaaa';
                ctx.fillRect(w - 1, h * (1 - d2), 1, 1);
            }
            return ret;
        },


        simpleSpectrum : function(frequencyData) {
            var s = Math.min(frequencyData.length, w);
            for (var i = 0; i < s; i++) {
                var y = h - Math.round(h *frequencyData[i] / 255);
                ctx.fillStyle = '#000000';
                ctx.fillRect(i, 0, 1, y -1);
                ctx.fillStyle = '#008800';
                ctx.fillRect(i, y, 1, h - y);
            }
        },

        /**
         * Draw byte frequency data (spectrum) in the rightmost pixel column.
         *
         * @param frequencyData Uint8Array spectrum
         * @param clip Clip highest bands or scale spectrum to fit in
         */
        byteFreqData : function(frequencyData, clip) {
            ret.step();
            if (clip || frequencyData.length <= h) {
                if (h > frequencyData.length) {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(w - 1, 0, 1, h - frequencyData.length + 1);
                }
                // iterate over the elements from the array
                for (var i = 0; i < frequencyData.length && i < h; i++) {
                    // draw each pixel with the specific color
                    var value = frequencyData[i];
                    ctx.fillStyle = grad[value];

                    // draw the line at the right side of the canvas
                    ctx.fillRect(w - 1, h - i, 1, 1);
                }
            } else {
                // collapse some bands
                var a = 1; // number of samples to collapse

                while (frequencyData.length > h * a) {
                    a *= 2;
                }

                var i = 0;
                while (i < h) {
                    var value = 0;
                    for (var j = 0; j < a; j++) {
                        value += frequencyData[i * a + j];
                    }
                    value /= a;

                    ctx.fillStyle = grad[Math.floor(value)];
                    ctx.fillRect(w - 1, h - i, 1, 1);

                    i++;
                }
            }

            return ret;
        },
        /**
         * Update title.
         */
        title : function(t) {
            title.text(t);
            return ret;
        }
    };
    return ret;

}
