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
  let pitchChangeHandler = noop;

  // browser support
  // ===========================================================================
  let AudioContext = window.AudioContext || window.webkitAudioContext;
  let cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame;
  let requestAnimationFrame =	window.requestAnimationFrame || window.webkitRequestAnimationFrame;
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

  // audio and state letiables
  // ===========================================================================
  let audioCtx = null;
  let isPaused = true;
  let hasMicrophoneAccess = false;
  let lastPitch;
  let analyser;
  let mediaStreamSource;
  let animationFrame;

  // auto correlation constants and letiables
  // ===========================================================================
  let CORR_BUFFER_SIZE = 1024;
  let CORR_MAX_SAMPLES = Math.floor(CORR_BUFFER_SIZE / 2);
  let CORR_MIN_SAMPLES = 0;
  let corrBuffer = new Float32Array(CORR_BUFFER_SIZE);

  
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
    //volume = mediaStreamSource.createGainNode();
    console.log('volume: ',mediaStreamSource.context)//volume.gain.value);
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

let noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  let api = {
      noteNumberFromPitch: function noteFromPitch(frequency) {
        var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        return Math.round(noteNum) + 69;
      },
      frequencyFromNoteNumber: function frequencyFromNoteNumber(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
      },
      centsOffFromPitch: function centsOffFromPitch(frequency, note) {
        return Math.floor(1200 * Math.log(frequency / this.frequencyFromNoteNumber(note)) / Math.log(2));
      },
      noteFromPitch: function noteFromPitch(frequency) {
        return noteStrings[this.noteNumberFromPitch(frequency) % 12];
      }
  };
  
// register a listener to receive pitch info (in Hertz to 2 decimal points)
// only one listener at a time - multiple calls override the previous listener
// if a pitch cannot be detected, a value of -1 will be passed
microphonePitch.onPitchChange(function(pitch) {
  if(pitch!=-1 && pitch<1600){
    let note      = api.noteNumberFromPitch(pitch);
    let frequency = api.frequencyFromNoteNumber(note);
    let cents     = api.centsOffFromPitch(frequency,note);
    let text      = api.noteFromPitch(frequency);
    //console.log(note,frequency,cents,text);
    $('#note').text(frequency+' Hz');
    //document.getElementById('pitch').innerHTML = text+": "+pitch;
  }
});