/**
 * Web Audio Tests
 * main.js
 */

(function() {
    "use strict";
    
    // The sound source buffer
    var sourceBuffer;
    // The currently playing source node
    var sourceNode;
    // The noise reducer unit
    var reducer;
    // The level meter
    var meter;
    // The master gain
    var gain;
    
    // Create the audio graph, with the given source node
    // useReducer is a boolean determining whether to use the reducer
    function createAudioGraph(source, useReducer) {
        console.log("Creating audio graph");
        
        // Initialize the meter
        meter = new audio.Meter();
        
        // Create the master gain
        gain = audio.context.createGain();
        
        if(useReducer) {
            // Create noise reducer
            reducer = new audio.NoiseReducer();
            // Connect source -> reducer -> gain -> meter -> output
            source.connect(reducer.input);
            reducer.output.connect(gain);
            gain.connect(meter.node);
            meter.node.connect(audio.context.destination);
        } else {
            // Connect source -> gain -> meter -> output
            source.connect(gain);
            gain.connect(meter.node);
            meter.node.connect(audio.context.destination);
        }
    }
    
    // Play the audio
    function play() {
        // Create source node, create audio graph, and play the source
        var source = audio.context.createBufferSource();
        source.buffer = sourceBuffer;
        var useReducer = document.getElementById("inp_useReducer").checked;
        createAudioGraph(source, useReducer);
        source.start(0);
        sourceNode = source;
        getLevel();
    }
    
    // Measures & displays the level of the audio
    function getLevel() {
        document.getElementById("level").innerHTML = meter.getLevel();
        requestAnimationFrame(getLevel);
    }
    
    // Stops the currently playing source node
    function stop() {
        sourceNode.stop(0);
        sourceNode.disconnect(0);
    }
    
    // EVENT HANDLERS
    // Handles loading a file
    function onFileChosen(e) {
        // Set the source buffer to be that of the chosen file
        var file = e.target.files[0];
        audio.bufferFromFile(file, function(buffer) { sourceBuffer = buffer });
    }
    
    // Changes the gain when the slider is moved
    function onGainChanged(e) {
        gain.gain.value = parseFloat(e.target.value)/10;
    }
    
    // Changes the reducer's noise threshold when the slider is moved
    function onThresholdChanged(e) {
        reducer.gate.threshold = parseFloat(e.target.value)/10;
    }
    
    // Initialization function
    function init() {
        // Initialize the audio tools
        audio.init();
        
        // Add event handlers
        document.getElementById("inp_file").addEventListener("change", onFileChosen);
        document.getElementById("btn_play").addEventListener("click", play);
        document.getElementById("btn_stop").addEventListener("click", stop);
        document.getElementById("inp_gain").addEventListener("change", onGainChanged);
        document.getElementById("inp_threshold").addEventListener("change", onThresholdChanged);
    }
    
    // Run init when the page is loaded
    $(document).ready(init);
    
}());