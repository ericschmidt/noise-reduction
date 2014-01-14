/**
 * Noise Reduction Tests
 * Simple audio library for convenience
 *
 * Eric Schmidt 2014
 */

(function(window) {
    "use strict";
    
    var audio = window.audio = {};
    
    // Initializes the audio context; call this when the page is ready
    audio.init = function() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            audio.context = new AudioContext();
            console.log("Audio context created");
        } catch(e) {
            console.warn("Audio API not supported");
        }
    };
    
    // Creates a buffer from a file, callback is a function of the newly created buffer
    audio.bufferFromFile = function(file, callback) {
        var reader = new FileReader();
        reader.onload = function(e) {
            audio.context.decodeAudioData(e.target.result, function(buffer) {
                console.log("Sound loaded: "+file.name);
                callback(buffer);
            });
        };
        reader.readAsArrayBuffer(file);
    };
    
    // An 8-band parametric EQ type for convenient application of filters
    audio.ParametricEQ = function() {
        var _this = this;
        // Create a pre-gain as the input
        _this.input = audio.context.createGain();
        // Create the bands; all are initially peaking filters
        _this.bands = [];
        for(var i=0; i<8; i++) {
            var filter = audio.context.createBiquadFilter();
            filter.type = "peaking";
            filter.frequency.value = 64*Math.pow(2,i);
            filter.Q.value = 1;
            _this.bands.push(filter);
            // Connect consecutive bands
            if(i>0) {
                _this.bands[i-1].connect(_this.bands[i]);
            }
        }
        // Connect the input to band 0, and set band 7 as output
        _this.input.connect(_this.bands[0]);
        _this.output = _this.bands[7];
        
        // Sets all band frequencies at once; freqs is a list
        _this.setBandFrequencies = function(freqs) {
            var min = Math.min(_this.bands.length, freqs.length);
            for(var i=0; i<min; i++) {
                _this.bands[i].frequency.value = freqs[i];
            }
        };
        
        // Sets all band types at once; types is a list
        _this.setBandTypes = function(types) {
            var min = Math.min(_this.bands.length, types.length);
            for(var i=0; i<min; i++) {
                _this.bands[i].type = types[i];
            }
        };
        
        // Sets all Q values at once; Qs is a list
        _this.setQValues = function(Qs) {
            var min = Math.min(_this.bands.length, Qs.length);
            for(var i=0; i<min; i++) {
                _this.bands[i].Q.value = Qs[i];
            }
        };
    };
    
    // A meter to measure the overall loudness of the audio
    audio.Meter = function() {
        var _this = this;
        // Create an analyser as the input
        _this.node = audio.context.createAnalyser();
        _this.node.fftSize = 512;
        
        // Measures the current loudness
        _this.getLevel = function() {
            // Read the frequency domain data into an array
            var freqData = new Uint8Array(_this.node.frequencyBinCount);
            _this.node.getByteFrequencyData(freqData);
            // Return the average level of the signal over all frequencies
            var total = 0;
            for(var i=0; i<freqData.length; i++) {
                total += parseFloat(freqData[i]);
            }
            return total/freqData.length;
        };
    };
    
    // A noise gate to manage levels
    // Eliminates sound below the threshold and amplifies sound above it
    audio.NoiseGate = function(threshold, target) {
        var _this = this;
        // Set the threshold and target levels
        _this.threshold = threshold;
        _this.target = target;
        // Create a level meter
        var _meter = new audio.Meter();
        // Set the input of the gate to be the meter node
        _this.input = _meter.node;
        // Create a gain as the output
        _this.output = audio.context.createGain();
        // Connect the meter node to the output
        _meter.node.connect(_this.output);
        
        // Controls the gain
        var _controlGain = function() {
            var level = _meter.getLevel();
            if(level < _this.threshold) {
                _this.output.gain.value = 0.2;
            } else {
                _this.output.gain.value = _this.target/level;
            }
        };
        
        // Set up the interval at which to control the gain
        var _int = setInterval(_controlGain, 10);
    };
    
    // A noise reduction module (combines a parametric EQ and a noise gate)
    // Default threshold is 1, default target is 10
    audio.NoiseReducer = function(threshold, target) {
        var _this = this;
        threshold = threshold || 1;
        target = target || 10;
        // Create a noise gate to process the sound first
        _this.gate = new audio.NoiseGate(threshold, target);
        // Create and configure the parametric EQ
        var _eq = new audio.ParametricEQ();
        _eq.setBandFrequencies([200,200,191,677,1014,2858,6240,10000]);
        _eq.setBandTypes(["highpass","peaking","notch","notch","notch","notch","lowpass","peaking"]);
        // Create a post-gain node
        var _gain = audio.context.createGain();
        // Connect the components: EQ -> noise gate -> gain
        _eq.output.connect(_this.gate.input);
        _this.gate.output.connect(_gain);
        // Set the input of this module to be the EQ input
        _this.input = _eq.input;
        // Set the output of this module to be the gain
        _this.output = _gain;
        
        // An internal boolean to store whether the module is bypassed or not
        var _bypassed = false;
        // Determines whether the module is active or not - argument is a boolean
        _this.bypass = function(isBypassed) {
            if(isBypassed && !_bypassed) {
                _this.input.disconnect(0);
                _this.input.connect(_this.output);
                _bypassed = true;
            } else if(!isBypassed && _bypassed) {
                _this.input.disconnect(0);
                _this.input.connect(_eq.bands[0]);
                _bypassed = false;
            }
        };
    };
    
    // A simple spectrum analyser (constructor takes canvas element on which to draw)
    audio.SpectrumAnalyser = function(canvas) {
        var _this = this;
        // Store the canvas to draw on (and its dimensions)
        var _canvas = canvas;
        var _width = _canvas.width;
        var _height = _canvas.height;
        // Create an analyser as the node
        _this.node = audio.context.createAnalyser();
        _this.node.fftSize = 2048;
        
        // Get frequency domain data and draw it on the canvas
        var _draw = function() {
            // Get the frequency domain data
            var freqData = new Uint8Array(_this.node.frequencyBinCount);
            _this.node.getByteFrequencyData(freqData);
            // Fill the canvas with black
            var ctx = _canvas.getContext("2d");
            ctx.fillStyle = "#000000";
            ctx.fillRect(0,0,_width,_height);
            // Using 200 discrete frequencies, calculate bar width
            var barWidth = _width/200;
            ctx.fillStyle = "#007700";
            for(var i=0; i<200; i++) {
                // Calculate the ith frequency on an exponential scale
                var freq = Math.pow(4, i/20);
                // Find which frequency bin it is stored in
                var bin = Math.round(freq/audio.context.sampleRate*_this.node.fftSize);
                // Get the level and scale it to fit in the canvas
                var level = freqData[bin]*_height/256;
                // Calculate x and y position of the rectangle to draw and draw it
                var x = i*barWidth;
                var y = _height - level;
                ctx.fillRect(x,y,barWidth,level);
            }
        };
        
        // Set up the interval at which to draw the spectrum
        var _int = setInterval(_draw, 50);
    };
    
}(window));