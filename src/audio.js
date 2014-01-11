/**
 * Web Audio Tests
 * Simple library for convenience
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
    }
    
    // Creates a buffer from a file, callback is a function of the newly created buffer
    audio.bufferFromFile = function(file, callback) {
        var reader = new FileReader();
        reader.onload = function(e) {
            audio.context.decodeAudioData(e.target.result, function(buffer) {
                console.log("Sound loaded: "+file.name);
                callback(buffer);
            });
        }
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
        _eq.setBandFrequencies([200,164,191,677,1014,2858,6240,10000]);
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
    };
    
}(window));