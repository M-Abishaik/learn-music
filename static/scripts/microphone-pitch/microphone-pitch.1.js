(function(microphonePitch) {
  'use strict';

  // utilities
  // ===========================================================================
  function isFunction(f) {
    return typeof f === 'function';
  }

  function noop() {}

  // event handler
  // ===========================================================================
  var pitchChangeHandler = noop;

  // browser support
  // ===========================================================================
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  var cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame;
  var requestAnimationFrame =	window.requestAnimationFrame || window.webkitRequestAnimationFrame;
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

  // audio and state variables
  // ===========================================================================
  var audioCtx = null;
  var isPaused = true;
  var hasMicrophoneAccess = false;
  var lastPitch;
  var analyser;
  var mediaStreamSource;
  var animationFrame;

  // auto correlation constants and variables
  // ===========================================================================
  var CORR_BUFFER_SIZE = 1024;
  var CORR_MAX_SAMPLES = Math.floor(CORR_BUFFER_SIZE / 2);
  var CORR_MIN_SAMPLES = 0;
  var corrBuffer = new Float32Array(CORR_BUFFER_SIZE);

  
  // auto correlation algorithm
  // ===========================================================================
  function autoCorrelate() {
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rootMeanSquare = 0;
    let foundGoodCorrelation = false;
    let correlations = new Array(CORR_MAX_SAMPLES);
    let sampleRate = audioCtx.sampleRate;

    for (let i = 0; i < CORR_BUFFER_SIZE; i++) {
      let val = corrBuffer[i];
      rootMeanSquare += val * val;
    }

    rootMeanSquare = Math.sqrt(rootMeanSquare / CORR_BUFFER_SIZE);

    if (rootMeanSquare < 0.01) {
      return -1;
    }

    let lastCorrelation = 1;

    for (let offset = CORR_MIN_SAMPLES; offset < CORR_MAX_SAMPLES; offset++) {
      let correlation = 0;

      for (let i = 0; i < CORR_MAX_SAMPLES; i++) {
        correlation += Math.abs(corrBuffer[i] - corrBuffer[i + offset]);
      }

      correlation = 1 - (correlation / CORR_MAX_SAMPLES);
      correlations[offset] = correlation;

      if ((correlation > 0.9) && (correlation > lastCorrelation)) {
        foundGoodCorrelation = true;
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }
      } else if (foundGoodCorrelation) {
        let shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
        return sampleRate / (bestOffset + (8 * shift));
      }

      lastCorrelation = correlation;
    }

    if (bestCorrelation > 0.01) {
      return sampleRate / bestOffset;
    }

    return -1;
  }

  // stream processing
  // ===========================================================================
  function processStream(stream) {
    mediaStreamSource = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect(analyser);
    updatePitch();
  }
  
  
  // event handler setters
  // ===========================================================================
  microphonePitch.onPitchChange = function(handler) {
    if (isFunction(handler)) {
      pitchChangeHandler = handler;
    } else {
      throw 'onPitchChange expects a function as a handler';
    }
  };
  

  // start and pause functions
  // ===========================================================================
  microphonePitch.start = function(callback) {
    if(!audioCtx){
        audioCtx = new AudioContext();
        microphonePitch.start(callback);
    }
    if (!isPaused) {
      return; // already running
    }
    if (hasMicrophoneAccess) {
      animationFrame = requestAnimationFrame(updatePitch);
      isPaused = false;
      return;
    }
    navigator.getUserMedia({
      'audio': {
        'mandatory': {
          'googEchoCancellation': 'false',
          'googAutoGainControl': 'false',
          'googNoiseSuppression': 'false',
          'googHighpassFilter': 'false',
        },
        'optional': [],
      }
    }, function(stream) {
      isPaused = false;
      hasMicrophoneAccess = true;
      callback(false); // no error occurred
      processStream(stream);
    }, callback);
  };

  microphonePitch.pause = function() {
    if (isPaused) {
      return; // not running, so nothing to do
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    pitchChangeHandler(-1);
    isPaused = true;
  };

  

  function updatePitch() {
    analyser.getFloatTimeDomainData(corrBuffer);
    let roundedPitch = autoCorrelate();
    roundedPitch = roundedPitch === -1 ? -1 : roundedPitch.toFixed(2);
    if (roundedPitch !== lastPitch) {
      pitchChangeHandler(roundedPitch);
      lastPitch = roundedPitch;
    }

    animationFrame = requestAnimationFrame(updatePitch);
  }

  

  

  // Allow direct use in browser or through something like Browserify
})(typeof exports === 'undefined' ? this.microphonePitch = {} : exports);

