/*
 THis is a copy of demo_v1.js, few bugs were fixed in it
 from the analysis, the auto correlation algorithm 
 is good but poor audio detection in mobile and good in desktop
*/

/* global $, Gauge */
(function (musicPlayer) {
	'use strict';

	let baseFreq = 440;
	let currentNoteIndex = 57; // A4
	let isRefSoundPlaying = false;
	let isMicrophoneInUse = false;
	let frameId,
		freqTable,
		gauge,
		micStream,
		notesArray,
		audioContext,
		sourceAudioNode,
		analyserAudioNode;
	
	let carnaticLesson = null;
	let westernLesson  = null;

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

	let x=1000;


	musicPlayer.isAudioContextSupported = function () {
		// This feature is still prefixed in Safari
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		if (window.AudioContext) {
			return true;
		}
		else {
			return false;
		}
	};

	musicPlayer.reportError = function (message) {
		console.log("ERROR:",message);
		$("#mistake").text(message);
		// $('#errorMessage').html(message).show();
	};

	musicPlayer.init = function () {
		console.log("Music Player Initialized");
		$.getJSON('static/scripts/notes.json', function (data) {
			freqTable = data;
		});

		
		if (musicPlayer.isAudioContextSupported()) {
			audioContext = new window.AudioContext();
			// console.log(audioContext);
		}
		else {
			musicPlayer.reportError('AudioContext is not supported in this browser');
		}
	};

	musicPlayer.updatePitch = function (pitch) {
		console.log("Pitch: ",pitch + ' Hz');
		// $('#pitch').text(pitch + ' Hz');
	};

	musicPlayer.updateNote = function (note) {
		console.log("Note: ",note)
		// $('#note').text(note);
	};

	musicPlayer.updateCents = function (cents) {
		// We may get negative values here.
		// Add 50 cents to what we get
		
		// gauge.set(cents + 50);
		// $('#cents').text(cents);
		console.log('Cents',cents);
	};

	musicPlayer.isGetUserMediaSupported = function () {
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
		if ((navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || navigator.getUserMedia) {
			return true;
		}

		return false;
	};

	musicPlayer.findFundamentalFreq = function (buffer, sampleRate) {
		// We use Autocorrelation to find the fundamental frequency.

		// In order to correlate the signal with itself (hence the name of the algorithm), we will check two points 'k' frames away.
		// The autocorrelation index will be the average of these products. At the same time, we normalize the values.
		// Source: http://www.phy.mty.edu/~suits/autocorrelation.html
		// Assuming the sample rate is 48000Hz, a 'k' equal to 1000 would correspond to a 48Hz signal (48000/1000 = 48),
		// while a 'k' equal to 8 would correspond to a 6000Hz one, which is enough to cover most (if not all)
		// the notes we have in the notes.json?_ts=1556250856262 file.
		let n = 1024;
		let bestK = -1;
		let bestR = 0;
		for (let k = 8; k <= 1000; k++) {
			let sum = 0;

			for (let i = 0; i < n; i++) {
				sum += ((buffer[i] - 128) / 128) * ((buffer[i + k] - 128) / 128);
			}

			let r = sum / (n + k);

			if (r > bestR) {
				bestR = r;
				bestK = k;
			}

			if (r > 0.9) {
				// Let's assume that this is good enough and stop right here
				break;
			}
		}
		if(x>0){
		      console.log(buffer);
		      console.log(bestR);
		      x--;
		    }
		if (bestR > 0.0025) {
			// The period (in frames) of the fundamental frequency is 'bestK'. Getting the frequency from there is trivial.
			let fundamentalFreq = sampleRate / bestK;
			return fundamentalFreq;
		}
		else {
			// We haven't found a good correlation
			return -1;
		}
	};

	musicPlayer.findClosestNote = function (freq, notes) {
		// Use binary search to find the closest note
		let low = -1;
		let high = notes.length;
		while (high - low > 1) {
			let pivot = Math.round((low + high) / 2);
			if (notes[pivot].frequency <= freq) {
				low = pivot;
			} else {
				high = pivot;
			}
		}

		if (Math.abs(notes[high].frequency - freq) <= Math.abs(notes[low].frequency - freq)) {
			// notes[high] is closer to the frequency we found
			return notes[high];
		}

		return notes[low];
	};

	musicPlayer.findCentsOffPitch = function (freq, refFreq) {
		// We need to find how far freq is from baseFreq in cents
		let log2 = 0.6931471805599453; // Math.log(2)
		let multiplicativeFactor = freq / refFreq;

		// We use Math.floor to get the integer part and ignore decimals
		let cents = Math.floor(1200 * (Math.log(multiplicativeFactor) / log2));
		return cents;
	};

	musicPlayer.detectPitch = function () {
		console.log('detectPitch');
		let buffer = new Uint8Array(analyserAudioNode.fftSize);
		analyserAudioNode.getByteTimeDomainData(buffer);

		let fundalmentalFreq = musicPlayer.findFundamentalFreq(buffer, audioContext.sampleRate);
		console.log(fundalmentalFreq);
		if (fundalmentalFreq !== -1) {
			let note   = musicPlayer.findClosestNote(fundalmentalFreq, notesArray);
			let cents  = musicPlayer.findCentsOffPitch(fundalmentalFreq, note.frequency);
			let _scale = parseInt(note.note[note.note.length - 1]);
			
			if(_scale >= 3 && _scale <=6){
				
				note   = note.note;
				let pitch  = fundalmentalFreq;
				$('#frequency').text(pitch.toFixed(2));
			    $('#note').text(note);
			    
      			music_notes.push(note);
			    let requiredSwaraFreq=12*parseInt(music_play_note[swaraIndex].slice(-1))+_shruti.indexOf(music_play_note[swaraIndex].slice(0,-1));
          		requiredSwaraFreq=notesArray[requiredSwaraFreq];
          		requiredSwaraFreq = requiredSwaraFreq['frequency'];
          		// console.log(note,pitch+" Hz/",requiredSwaraFreq+" Hz");
			    let swarapercent=pitch/requiredSwaraFreq*50;
			    updateGaugeScale(swarapercent);
				// console.log(note,fundalmentalFreq+" Hz",_scale);
				
				// musicPlayer.updateNote(note.note);
				// musicPlayer.updateCents(cents);	
			}
			else{
				// music_notes.push('C4');
      			updateGaugeScale(0);
				// musicPlayer.updateNote('--');
				// musicPlayer.updateCents(-50);
			}
			
		}
		else {
			// music_notes.push('C4');
      		updateGaugeScale(0);
			// musicPlayer.updateNote('--');
			// musicPlayer.updateCents(-50);
		}

		frameId = window.requestAnimationFrame(musicPlayer.detectPitch);
	};

	musicPlayer.streamReceived = function (stream) {
		console.log('streamReceived');
		micStream = stream;

		analyserAudioNode = audioContext.createAnalyser();
		analyserAudioNode.fftSize = 2048;

		sourceAudioNode = audioContext.createMediaStreamSource(micStream);
		sourceAudioNode.connect(analyserAudioNode);

		musicPlayer.detectPitch();
	};


	musicPlayer.turnOffMicrophone = function () {
		if (sourceAudioNode && sourceAudioNode.mediaStream && sourceAudioNode.mediaStream.stop) {
			sourceAudioNode.mediaStream.stop();
		}
		sourceAudioNode = null;
		musicPlayer.updatePitch('--');
		musicPlayer.updateNote('--');
		musicPlayer.updateCents(-50);
		$('#microphoneOptions').toggle(false);
		analyserAudioNode = null;
		window.cancelAnimationFrame(frameId);
		isMicrophoneInUse = false;
	};

	musicPlayer.toggleMicrophone = function () {
		// console.log('Microphone Initilization Started');
		if (audioContext.state === 'suspended') { 	
			audioContext.resume(); 
			// console.log('Microphone Initilization resumed');
		}

		if (!isMicrophoneInUse) {
			$('#microphoneOptions').toggle(true);

			if (musicPlayer.isGetUserMediaSupported()) {
				notesArray = freqTable[baseFreq.toString()];

				let getUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ?
					navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) :
					function (constraints) {
						return new Promise(function (resolve, reject) {
							navigator.getUserMedia(constraints, resolve, reject);
						});
					};

				getUserMedia({audio: true}).then(musicPlayer.streamReceived).catch(musicPlayer.reportError);
				console.log('listening Mode Initialized');
				musicPlayer.updatePitch(baseFreq);
				isMicrophoneInUse = true;
			}
			else {
				musicPlayer.reportError('It looks like this browser does not support getUserMedia. ' +
				'Check <a href="http://caniuse.com/#feat=stream">http://caniuse.com/#feat=stream</a> for more info.');
			}
		}
		else {
			musicPlayer.turnOffMicrophone();
			// console.log('Microphone Initilization Stopped');
		}
	};

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
    musicPlayer.init();
    let lesson = await musicPlayer.fetchLesson()
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
    currentIndex=index;
    music_play_note      = westernLesson[index].split(' ');
    carnatic_music_notes = carnaticLesson[index].split(' ');
    swarasCount=carnatic_music_notes.length;
    swaraIndex=0;
    timer = setInterval(function(){ musicPlayer.checkPitchs() }, 1500);
    $('#nextnote').text(carnatic_music_notes[swaraIndex]+' ('+music_play_note[swaraIndex]+')');
  	musicPlayer.toggleMicrophone();
  }

  musicPlayer.pause = function(index) {
  	left_node_mistake  = 0;
	right_node_mistake = 0;
    musicPlayer.turnOffMicrophone();
    musicPlayer.PlayLesson(index);
  };

  musicPlayer.playBack = function(){
    // fetch index from noteIndex
    let index = $("#noteIndex").val();
    if(index!=='NULL'){
      musicPlayer.turnOffMicrophone();
      index = parseInt(index);
      left_node_mistake=0;
      right_node_mistake=0;
      tmp_repeatation=0;
      $('#repeat').text(tmp_repeatation);
      musicPlayer.PlayLesson(index);
    }
    console.log('Paused Index: ',index);
  }

    musicPlayer.checkPitchs = function(){
	    let end=1;
	    let today = new Date();
	    // console.log('music_notes length',music_notes.length," @ "+today.getMinutes() + ":" + today.getSeconds());
	    // console.log('Current Mistake',left_node_mistake,right_node_mistake);
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
	      console.log('tmp_notes',tmp_notes);
	      
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
	        console.log('notesequence',notesequence);

	      if(notesequence.length>=1){
	        tmp=notesequence[0][0];
	        count=notesequence[0][1];
	        // console.log(notesequence,tmp,count);
	        for(let i=1;i<notesequence.length;i++){
	          if(tmp!=notesequence[i][0]){
	            if(count>35)
	              refinednotesequence.push([notesequence[i][0],notesequence[i][1]]);
	            tmp=notesequence[i][0];
	            count=notesequence[i][1];
	          }
	          else
	            count+=notesequence[i][1];
	        }

	        if(count>35)
	          refinednotesequence.push([tmp,count]);
	         console.log('refined notes',refinednotesequence);

	        //merge refined note[0] if it exist in  unique last notes
	      if(refinednotesequence.length>=1){
	      	  end = 0 ;
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

	              console.log('Mistake as occured',left_node_mistake,right_node_mistake);
	                
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
	      }
	  	}
	      console.log('End: ',end);

	}
	  if (end){
	    // music_notes  = [];
	    unique_notes = [];
	    //tries for 3 times each time it record swara count
	    // console.log('Stopped ,repetation',tmp_repeatation,repetation);
	    if(tmp_repeatation>=repetation){
	      console.log('done');
	      tmp_repeatation=0;
	      $('#repeat').text('0');
	      clearInterval(timer);
	      let tmp_index=findLeafNodesIndex(swarasCount,currentIndex);
	      console.log('tmp_index',tmp_index);
	      

	      // Indigates single swara
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