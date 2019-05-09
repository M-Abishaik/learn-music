(function(musicPlayer) {
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
  let cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame;;
  let requestAnimationFrame =	window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

  // console.log(AudioContext,cancelAnimationFrame,requestAnimationFrame);
  // audio and state letiables
  // ===========================================================================
  let audioCtx = null;
  let isPaused = true;
  let hasMicrophoneAccess = false;
  let lastPitch;
  let analyser;
  let mediaStreamSource;
  let animationFrame;

  let carnaticLesson = null;
  let westernLesson  = null;

  let freqTable;
  let music_notes=[];
  let unique_notes=[];
  let timer = null;

  let music_play_note=null;
  let carnatic_music_notes=null;

  let repetation=3;
  let tmp_repeatation=0;
  let left_node_mistake=0;
  let right_node_mistake=0;
  let swarasCount=0;
  let swaraIndex=0;
  let currentIndex=0;
  let PrevIndex=null;
  let _shruti=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  let endSwaraFlag;

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
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect(analyser);
    updatePitch();
  }
  

  // event handler setters
  // ===========================================================================
  musicPlayer.onPitchChange = function(handler) {
    if (isFunction(handler)) {
      pitchChangeHandler = handler;
    } else {
      throw 'onPitchChange expects a function as a handler';
    }
  };
  
  // start and pause functions
  // ===========================================================================
  musicPlayer.start = function(callback) {
    if(!audioCtx){
        audioCtx = new AudioContext();
        musicPlayer.start(callback);
        
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

  musicPlayer.pause = function(index) {
    if (isPaused) {
      return; // not running, so nothing to do
    }
    audioCtx.suspend().then(function(){
      setTimeout(()=>{updateGaugeScale(0);},300)
      console.log('listening stopped');
    });
    pitchChangeHandler(-1);
    isPaused = true;
    musicPlayer.PlayLesson(index);
  };

  musicPlayer.playBack = function(){
    // fetch index from noteIndex
    let index = $("#noteIndex").val();
    if(index!=='NULL'){
        
        if (isPaused) {
          return; // not running, so nothing to do
        }
        audioCtx.suspend().then(function(){
          setTimeout(()=>{updateGaugeScale(0);},300)
          console.log('listening stopped');
        });
        pitchChangeHandler(-1);
        isPaused = true;
        

      index = parseInt(index);
      left_node_mistake=0;
      right_node_mistake=0;
      tmp_repeatation=0;
      $('#repeat').text(tmp_repeatation);
      musicPlayer.PlayLesson(index);
    }
    console.log('Index: ',index);
  }

  musicPlayer.fetchLesson = async function() {
    let raga=$("#ragas").val();
    let lesson_name=$('#lesson_name').val();
    let shruti=$('#SHRUTI').val();
		let scale =$('#SCALE').val();
    let response  =await fetch(
        "/getLesson",
        {
          method: 'post',
          body:JSON.stringify({
            lesson_name: lesson_name,
            raga: raga,
            shruti: shruti,
            scale: scale
          }),
          headers:{
            "Content-Type": "application/json"
          },
        }
      );
    response = await response.json();
    return response;
  }

  musicPlayer.startApplication =async function(){
    let lesson = await musicPlayer.fetchLesson()
    $.getJSON('./static/scripts/notes.json', function (data) {
      freqTable = data['440'];
    });
    carnaticLesson = lesson['carnatic_lesson'];
    westernLesson  = lesson['western_lesson'];
    $(".box").show();
    $('#micButton').attr("disabled", true);
    $("#SCALE").attr("disabled", true);
    $("#SHRUTI").attr("disabled", true);
    $("#ragas").attr("disabled", true);
    $('#micButton').hide();
    $('#playBack').show();
    musicPlayer.PlayLesson(0);
    musicPlayer.start(()=>{
      console.log('autio listening initalized');
    });
    audioCtx.suspend().then(()=>{
      console.log('listening ready');
    });
  }

  
  //start playing onces notes are fetched from server
  musicPlayer.PlayLesson =function(index){

      $('#playBack').attr("disabled", true);
      // console.log(index);
      if(index >= carnaticLesson.length){
        $('._start').text('Start');
				$(".box").hide();
				$('#congrats').show();
				return;
				
      }
      else{
        $('._play').show();
			  $('._listen').hide();
        let notes = carnaticLesson[index];
        console.log('Notes',notes);
        $('#notes').text(notes);
        musicPlayer.playnotes(notes,index);

        // Store Index in noteIndex
        $("#noteIndex").val(index);
        // PlayLesson
      }
      
  }



  //playes notes;
  musicPlayer.playnotes = async function(notes,index){
    notes = notes.split(' ');
    let i=0;
    let  url=$('#base_addr').val()+'/static/Audio/B/'+notes[i]+'.wav';
    $('#play_note').text(notes[i]);
    console.log('playing note: ',notes[i]);
    let audio=new Audio(url);
    audio.play();
    audio.onended=function(){
        i++;
        console.log(i,notes);
        if(i<notes.length){
          $('#play_note').text(notes[i]);
          console.log('playing note: ',notes[i]);
          url=$('#base_addr').val()+'/static/Audio/B/'+notes[i]+'.wav';
          audio.src = url;
          audio.play();
          
        }
        else{
          $('#playBack').attr("disabled", false);
          musicPlayer.listen(index);
        }
    };
    
  }

  musicPlayer.listen = async function(index){
    $('._play').hide();
    $('._listen').show();
    audioCtx.resume().then(()=>{
      console.log('listening started');
      isPaused = false;
    });
    currentIndex=index;
    music_play_note      = westernLesson[index].split(' ');
    carnatic_music_notes = carnaticLesson[index].split(' ');
    swarasCount=carnatic_music_notes.length;
    swaraIndex=0;
    timer = setInterval(function(){ musicPlayer.checkPitchs() }, 1500);
    $('#nextnote').text(carnatic_music_notes[swaraIndex]+' ('+music_play_note[swaraIndex]+')');
  }


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
  
  // register a listener to receive pitch info (in Hertz to 2 decimal points)
  // only one listener at a time - multiple calls override the previous listener
  // if a pitch cannot be detected, a value of -1 will be passed
  musicPlayer.onPitchChange(function(pitch) {
    if(pitch!=-1 && pitch<1600){
      let note      = api.noteFromPitch(pitch);
      // $('#frequency').text(pitch);
      $('#note').text(note);
      music_notes.push(note);
      let requiredSwaraFreq=12*parseInt(music_play_note[swaraIndex].slice(-1))+_shruti.indexOf(music_play_note[swaraIndex].slice(0,-1));
          requiredSwaraFreq=freqTable[requiredSwaraFreq]['frequency'];
      let swarapercent=pitch/requiredSwaraFreq*50;
      updateGaugeScale(swarapercent);      
    }
    else{
      updateGaugeScale(0);
    }
    

  });

  musicPlayer.checkPitchs = function(){
    let end=0;
    //  console.log('called',music_notes.length);
    if(music_notes.length>45){
      let tmp_notes = music_notes;
      music_notes   = [];
      let tmp = tmp_notes[0];
      let count=1;
      let notesequence=[];
      let refinednotesequence=[];
      let flag=0;
      let tmp_len    = unique_notes.length;
      
      console.log('tmp_len',tmp_len)
      //ignore noice in stream
      for(let i=1;i<tmp_notes.length;i++){
        if(tmp!=tmp_notes[i]){
          if(count>10) //ignore noice
            notesequence.push([tmp,count]);
          tmp=tmp_notes[i];
          count=1;
        }
        else
          count++;
      }
      if(count>10)
        notesequence.push([tmp,count]);
      //  console.log('notesequence',notesequence);
      if(notesequence.length>=1){
        tmp=notesequence[0][0];
        count=notesequence[0][1];
        //console.log(notesequence,tmp,count);
        for(let i=1;i<notesequence.length;i++){
          if(tmp!=notesequence[i][0]){
            if(count>45)
              refinednotesequence.push([notesequence[i][0],notesequence[i][1]]);
            tmp=notesequence[i][0];
            count=notesequence[i][1];
          }
          else
            count+=notesequence[i][1];
        }

        if(count>45)
          refinednotesequence.push([tmp,count]);
        //  console.log('refined notes',refinednotesequence);

        //merge refined note[0] if it exist in  unique last notes
      if(refinednotesequence.length>=1){
          if(tmp_len>=1 && unique_notes[tmp_len-1][0]==refinednotesequence[0][0]){
            flag=1;
            unique_notes=[[refinednotesequence[0][0],refinednotesequence[0][1]+unique_notes[tmp_len-1][1]]];
          }
          else
            unique_notes=[];

          for(let i=flag;i<refinednotesequence.length;i++)
            unique_notes.push([refinednotesequence[i][0],refinednotesequence[i][1]]);
          
          //console.log(unique_notes);
          if(unique_notes.length>=1 && tmp_repeatation<repetation){
            for(let i=flag;i<unique_notes.length;i++){
              //console.log('swaraIndex',swaraIndex);
              if(swaraIndex <swarasCount &&  tmp_repeatation <=repetation && unique_notes[i][0]!=music_play_note[swaraIndex])
              {
                if(swaraIndex<(swarasCount/2))
                  left_node_mistake++;
                else
                  right_node_mistake++;
                
              }
              if(swarasCount==1){
                //in case of single swara increment only if it is right
                if(flag==0 && unique_notes[i][0]==music_play_note[swaraIndex]){
                  swaraIndex++;
                }
              }
              //incase multiple swara increment for each swara either it is right or wrong
              else{
                swaraIndex++;
              }
              if(swaraIndex<swarasCount)
                $('#nextnote').text(carnatic_music_notes[swaraIndex]+' ('+music_play_note[swaraIndex]+')');
            }

            if(swaraIndex>=swarasCount & flag==0){
                swaraIndex=0;
                console.log('mistake',left_node_mistake,right_node_mistake);
                $('#nextnote').text(carnatic_music_notes[swaraIndex]+' ('+music_play_note[swaraIndex]+')');	
                tmp_repeatation++;
                $('#repeat').text(tmp_repeatation);
            }
            //console.log(carnatic_music_notes);
            //console.log('after verification',unique_notes[0],'flag',flag,'swaraIndex',swaraIndex,'left_leaf_node',left_node_mistake,'right_node_mistake',right_node_mistake,'repetation',tmp_repeatation);
            unique_notes=[unique_notes.pop()];
            
          }
          else{
            end=1;
          }
        }
        else{
          end=1;
        }
      }
      else{
        end=1;
      }
  }
  if (end && music_notes.length<=45){
    music_notes  = [];
    unique_notes = [];
    //tries for 3 times each time it record swara count
    console.log('repetation',tmp_repeatation,repetation);
    if(tmp_repeatation>=repetation){
      console.log('done');
      tmp_repeatation=0;
      $('#repeat').text('0');
      clearInterval(timer);
      let tmp_index=findLeafNodesIndex(swarasCount,currentIndex);
      console.log('tmp_index',tmp_index);
      if(tmp_index==null){
        if(PrevIndex!=null){
          tmp_index=PrevIndex;
          PrevIndex=null;
          console.log('tmp_index',tmp_index);
          musicPlayer.pause(tmp_index);	
        }
        else
          musicPlayer.pause(currentIndex+1);
        
        }
      else
      {   if(left_node_mistake==0 && right_node_mistake==0)

          {	
            console.log('no mistake procesing to next node','PrevIndex',PrevIndex,'currentIndex',currentIndex);
            left_node_mistake=0;
            right_node_mistake=0;
            //console.log(currentIndex,typeof(currentIndex),currentIndex,currentIndex+1)
            if(PrevIndex==null){
              console.log('moving to currentIndex',currentIndex+1);
              //console.log(currentIndex,typeof(currentIndex),currentIndex,currentIndex+1)
              musicPlayer.pause(currentIndex+1);
            }
            else{
              let tmp_index=PrevIndex;
              PrevIndex=null;
              console.log('moving to index',tmp_index);
              musicPlayer.pause(tmp_index);

            }
          }
        else if(left_node_mistake>right_node_mistake){
            console.log('mistake in left node procesing to next node','PrevIndex',PrevIndex,'currentIndex',currentIndex);
            
            left_node_mistake=0;
            right_node_mistake=0;
            PrevIndex=currentIndex;
            let k=parseInt(swarasCount/2);
            let tmp_notes=carnatic_music_notes.slice(0,k);
            $('#mistake').text('Mistake in '+tmp_notes.join(' '));
            $('#mistake').show();
            setTimeout(function(){$('#mistake').hide()},1500);
            musicPlayer.pause(tmp_index[0]);
        }
        else{
            console.log('mistake in right node procesing to next node','PrevIndex',PrevIndex,'currentIndex',currentIndex);
            left_node_mistake=0;
            right_node_mistake=0;
            PrevIndex=currentIndex;
            let k=parseInt(swarasCount/2);
            let tmp_notes=carnatic_music_notes.slice(k);
            $('#mistake').text('Mistake in '+tmp_notes.join(' '));
            $('#mistake').show();
            setTimeout(function(){$('#mistake').hide()},1500);
            musicPlayer.pause(tmp_index[1]);	
        }
      }
    }
  }
}
  // Allow direct use in browser or through something like Browserify
})(typeof exports === 'undefined' ? this.musicPlayer = {} : exports);


//frequency to note conversions
let noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
let api = {
    noteNumberFromPitch: function noteFromPitch(frequency) {
      let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
      return Math.round(noteNum) + 69;
    },
    frequencyFromNoteNumber: function frequencyFromNoteNumber(note) {
      return 440 * Math.pow(2, (note - 69) / 12);
    },
    centsOffFromPitch: function centsOffFromPitch(frequency, note) {
      return Math.floor(1200 * Math.log(frequency / this.frequencyFromNoteNumber(note)) / Math.log(2));
    },
    noteFromPitch: function noteFromPitch(frequency) {
      return noteStrings[this.noteNumberFromPitch(frequency) % 12]+(Math.floor(this.noteNumberFromPitch(frequency) / 12)-1);
    }
};


function updateGaugeScale(value) {
  // console.log('gaugescalevalue: ',value);
  $('#scale').text((value));
  $('#scale').trigger('click');
};

function findLeafNodesIndex(l,index){
  if(l<=1)
    return null;
  else{
    let right_leaf_node=index-1;
    no_leaf_nodes=parseInt(l/2);
    n=2*no_leaf_nodes-1;
    let left_leaf_node=index-n-1;
    return [left_leaf_node,right_leaf_node];
  }
}