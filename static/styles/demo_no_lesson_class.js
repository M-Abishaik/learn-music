var carnaticLesson,westernLesson;
function setLesson(carnaticLesson,westernLesson){
		carnaticLesson=carnaticLesson;
		westernLesson=westernLesson;
		//console.log(carnaticLesson,westernLesson);
		//play(0);
        listenNotes();
	}

function play(index){

		if(carnaticLesson.length==index){ 
			$('._start').text('Start');
			$(".box").hide();
			return;
			}
		console.log('note',carnaticLesson[index]);
		$('#notes').text(carnaticLesson[index]);
		playSwaras(index,0);
}
function playSwaras(index,j){
	var swaras=carnaticLesson[index].split(' ');
	if(j==swaras.length){
		play(index+1);
		return;
		}

	else if(j<swaras.length)
		var url=$('base_addr').val()+'/static/Audio/'+$("#shruti").val()+'/'+swaras[j]+'.wav';
	    $('#play_note').text(swaras[j]);
		console.log('swara',swaras[j],index,j,swaras.length);
		var audio=new Audio(url);
		audio.play();
		audio.onended=function(){
			//console.log('ended');
			playSwaras(index,j+1);
		};

}
function listenNotes(l){
		toggleMicrophone();
	}

		

function start(){
	var raga=$("#ragas").val();
	var lesson_name=$('#lesson_name').val();
	if($("._start").text()=='Start'){
		$(".bar").addClass('bar_animinate');
		$("._start").text('Stop');
		$(".box").show();
		get_lesson(lesson_name,raga);
	}
	else{
		$(".bar").removeClass('bar_animinate');
		$("._start").text('Start');	
	}

}

function get_lesson(lesson_name,raga){
	$.ajax({

        url: "/getLesson",
        data:JSON.stringify({"lesson_name":lesson_name,'raga':raga}),
        contentType: "application/json",
        
        headers: { 'Access-Control-Allow-Origin': '*' },
        type: 'POST',
        crossDomain: true,
        dataType: 'json',
                 }) .done(function (json){
                 	//console.log(json['carnatic_lesson'],json['western_lesson']);
        			setLesson(json['carnatic_lesson'],json['western_lesson']);
    }).fail(function(xhr,status,errorThrow){
      console.log('error'+errorThrow)
    });
}

/* global $, Gauge */
$(document).ready(function () {
	'use strict';

	var baseFreq = 440;
	var currentNoteIndex = 57; // A4
	var isRefSoundPlaying = false;
	var isMicrophoneInUse = false;
	var frameId,
		freqTable,
		gauge,
		micStream,
		notesArray,
		audioContext,
		sourceAudioNode,
		analyserAudioNode;
	var music_notes=[];
	var unique_notes=[];
	var x=1;
    var carnaticLesson;
	var westernLesson;



	var isAudioContextSupported = function () {
		// This feature is still prefixed in Safari
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		if (window.AudioContext) {
			return true;
		}
		else {
			return false;
		}
	};

	var reportError = function (message) {
		$('#errorMessage').html(message).show();
	};

	var init = function () {
		$.getJSON('./static/scripts/notes.json', function (data) {
			freqTable = data;
		});
		if (isAudioContextSupported()) {
			audioContext = new window.AudioContext();
			var getUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ?
					navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) :
					function (constraints) {
						return new Promise(function (resolve, reject) {
							navigator.getUserMedia(constraints, resolve, reject);
						});
					};

				getUserMedia({audio: true}).then().catch(reportError);
		}
		else {
			reportError('AudioContext is not supported in this browser');
		}
	};

	var updatePitch = function (pitch) {
		console.log('pitch',pitch);
		//$('#pitch').text(pitch + ' Hz');
	};

	var updateNote = function (note) {
		//console.log('note',note);
		music_notes.push(note);
		$('#note').text(note);
	};

	var updateCents = function (cents) {
		// We may get negative values here.
		// Add 50 cents to what we get
		//gauge.set(cents + 50);
		//$('#cents').text(cents);
	};

	var isGetUserMediaSupported = function () {
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
		if ((navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || navigator.getUserMedia) {
			return true;
		}

		return false;
	};

	var findFundamentalFreq = function (buffer, sampleRate) {
		// We use Autocorrelation to find the fundamental frequency.

		// In order to correlate the signal with itself (hence the name of the algorithm), we will check two points 'k' frames away.
		// The autocorrelation index will be the average of these products. At the same time, we normalize the values.
		// Source: http://www.phy.mty.edu/~suits/autocorrelation.html
		// Assuming the sample rate is 48000Hz, a 'k' equal to 1000 would correspond to a 48Hz signal (48000/1000 = 48),
		// while a 'k' equal to 8 would correspond to a 6000Hz one, which is enough to cover most (if not all)
		// the notes we have in the notes.json file.
		var n = 1024;
		var bestK = -1;
		var bestR = 0;
		for (var k = 8; k <= 1000; k++) {
			var sum = 0;

			for (var i = 0; i < n; i++) {
				sum += ((buffer[i] - 128) / 128) * ((buffer[i + k] - 128) / 128);
			}

			var r = sum / (n + k);

			if (r > bestR) {
				bestR = r;
				bestK = k;
			}

			if (r > 0.9) {
				// Let's assume that this is good enough and stop right here
				break;
			}
		}

		if (bestR > 0.0025) {
			// The period (in frames) of the fundamental frequency is 'bestK'. Getting the frequency from there is trivial.
			var fundamentalFreq = sampleRate / bestK;
			return fundamentalFreq;
		}
		else {
			// We haven't found a good correlation
			return -1;
		}
	};

	var findClosestNote = function (freq, notes) {
		// Use binary search to find the closest note
		var low = -1;
		var high = notes.length;
		while (high - low > 1) {
			var pivot = Math.round((low + high) / 2);
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

	var findCentsOffPitch = function (freq, refFreq) {
		// We need to find how far freq is from baseFreq in cents
		var log2 = 0.6931471805599453; // Math.log(2)
		var multiplicativeFactor = freq / refFreq;
		// We use Math.floor to get the integer part and ignore decimals
		var cents = Math.floor(1200 * (Math.log(multiplicativeFactor) / log2));
		return cents;
	};

	var detectPitch = function () {
		var buffer = new Uint8Array(analyserAudioNode.fftSize);
		analyserAudioNode.getByteTimeDomainData(buffer);

		var fundalmentalFreq = findFundamentalFreq(buffer, audioContext.sampleRate);

		if (fundalmentalFreq !== -1) {
			var note = findClosestNote(fundalmentalFreq, notesArray);
			var cents = findCentsOffPitch(fundalmentalFreq, note.frequency);
			updateNote(note.note);
			//music_notes.push(note.note);
			updateCents(cents);
		}
		else {
			updateNote('--');
			updateCents(-50);
		}

		frameId = window.requestAnimationFrame(detectPitch);
	};

	var streamReceived = function (stream) {
		micStream = stream;
		analyserAudioNode = audioContext.createAnalyser();
		analyserAudioNode.fftSize = 2048;
		sourceAudioNode = audioContext.createMediaStreamSource(micStream);
		sourceAudioNode.connect(analyserAudioNode);
		detectPitch();
	};

	var turnOffMicrophone = function () {
		$('#micButton').attr("disabled", false);
		if (sourceAudioNode && sourceAudioNode.mediaStream && sourceAudioNode.mediaStream.stop) {
			sourceAudioNode.mediaStream.stop();
		}
		console.log(music_notes);
		unique_notes=[];
		var tmp=music_notes[0];
		var count=1;
		for(var i=1;i<music_notes.length;i++){
			if(tmp!=music_notes[i]){
				unique_notes.push([tmp,count]);
				tmp=music_notes[i];
				count=1;
			}
			else{
				count++;
			}
		}
		unique_notes.push([tmp,count]);
		console.log(unique_notes);
		unique_notes=[];
		music_notes=[];
		sourceAudioNode = null;
		analyserAudioNode = null;
		isMicrophoneInUse = false;
	};

	var toggleMicrophone = function () {
			$('#micButton').text('Stop');
			$('#micButton').attr("disabled", true);
			//console.log(music_notes);
			//music_notes=[];
			if (isGetUserMediaSupported()) {
				notesArray = freqTable[baseFreq.toString()];

				var getUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ?
					navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) :
					function (constraints) {
						return new Promise(function (resolve, reject) {
							navigator.getUserMedia(constraints, resolve, reject);
						});
					};

				getUserMedia({audio: true}).then(streamReceived).catch(reportError);
				var timer=setInterval(function(){ console.log(x);x++; }, 1000);
				setTimeout(function(){turnOffMicrophone();clearInterval(timer);x=0;},1000);
				updatePitch(baseFreq);
				isMicrophoneInUse = true;
			}
			else {
				reportError('It looks like this browser does not support getUserMedia. ' +
				'Check <a href="http://caniuse.com/#feat=stream">http://caniuse.com/#feat=stream</a> for more info.');
			}
	};
	init();
});