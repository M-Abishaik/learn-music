class Lesson{
		setLesson(carnaticLesson,westernLesson){
			this.carnaticLesson=carnaticLesson;
			this.westernLesson=westernLesson;
		}
	    start(){
	    	$(".box").show();
		}
		static play(index,l){
			if(l.carnaticLesson.length==index){ 
				$('._start').text('Start');
				$(".box").hide();
				$('#congrats').show();
				return;
				}
			$('._play').show();
			$('._listen').hide();
			console.log('note',l.carnaticLesson[index]);
			$('#notes').text(l.carnaticLesson[index]);
			Lesson.playSwaras(index,0,l);
		}
		static playSwaras(index,j,l){
			var swaras=l.carnaticLesson[index].split(' ');
			if(j==swaras.length){
				Lesson.listenNotes(index+1,l);
				//Lesson.play(index+1,l);
				return;
				}

			else if(j<swaras.length)
				//var url=$('#base_addr').val()+'/static/Audio/'+$('#SHRUTI').val()+'/'+swaras[j]+'.wav';
			    var url=$('#base_addr').val()+'/static/Audio/B/'+swaras[j]+'.wav';
			    $('#play_note').text(swaras[j]);
				console.log('swara',swaras[j],index,j,swaras.length);
				var audio=new Audio(url);
				audio.play();
				audio.onended=function(){
					//console.log('ended');
					Lesson.playSwaras(index,j+1,l);
				};

		}
		static listenNotes(index,l){
			toggleMicrophone(index,l,l.westernLesson[index-1].split(' '),l.carnaticLesson[index-1].split(' '));
		}


		
	}
	var user_lesson =new Lesson(); 
	function start(){
		var raga=$("#ragas").val();
		var lesson_name=$('#lesson_name').val();
		if($("._start").text()=='Start'){
			$(".bar").addClass('bar_animinate');
			$("._start").text('Stop');
			get_lesson(lesson_name,raga,user_lesson);
		}
		else{
			$(".bar").removeClass('bar_animinate');
			$("._start").text('Start');	
		}

	}
	function get_lesson(lesson_name,raga,user_lesson){
		shruti=$('#SHRUTI').val();
		scale =$('#SCALE').val();
		$.ajax({

            url: "/getLesson",
            data:JSON.stringify({"lesson_name":lesson_name,'raga':raga,'shruti':shruti,'scale':scale}),
            contentType: "application/json",
            
            headers: { 'Access-Control-Allow-Origin': '*' },
            type: 'POST',
            crossDomain: true,
            dataType: 'json',
                     }) .done(function (json){
                     	//console.log(json['carnatic_lesson'],json['western_lesson']);
            			user_lesson.setLesson(json['carnatic_lesson'],json['western_lesson']);
            			user_lesson.start();
            			Lesson.play(0,user_lesson);
            			//Lesson.listenNotes(user_lesson);
        }).fail(function(xhr,status,errorThrow){
          console.log('error'+errorThrow)
        });
	}
function findLeafNodesIndex(l,index){
			if(l<=1)
				return null;
			else{
				var right_leaf_node=index-1;
				no_leaf_nodes=parseInt(l/2);
				n=2*no_leaf_nodes-1;
				var left_leaf_node=index-n-1;
				return [left_leaf_node,right_leaf_node];
			}
		}
/* global $, Gauge */
$(document).ready(function () {
	'use strict';
	init();
});

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
var music_play_note;
var carnatic_music_notes;
var repetation=3;
var tmp_repeatation=0;
var left_node_mistake=0;
var right_node_mistake=0;
var swarasCount=0;
var swaraIndex=0;
var currentIndex=0;
var PrevIndex=null;
var Object;
var _shruti=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var timer;
var endSwaraFlag;

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
		//music_notes.push(note);
		$('#note').text(note);
	};

	var updateCents = function (cents) {
		// We may get negative values here.
		// Add 50 cents to what we get
		$('#scale').text((cents));
		$('#scale').trigger('click');
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
			if(note.note=='F8'){
				updateNote('--');
				updateCents(0);
		
			}
			else{
				updateNote(note.note);
				music_notes.push(note.note);
				var swarafreq=12*parseInt(music_play_note[swaraIndex].slice(-1))+_shruti.indexOf(music_play_note[swaraIndex].slice(0,-1));
				//console.log(music_play_note[swaraIndex],swarafreq,notesArray[swarafreq],note.note,fundalmentalFreq);
				var swarafreq=notesArray[swarafreq]['frequency'];
				var swarapercent=fundalmentalFreq/swarafreq*50;
				//console.log(swarapercent);
				updateCents(swarapercent);
			}
		}
		else {
			updateNote('--');
			updateCents(0);
		}
		frameId = window.requestAnimationFrame(detectPitch);
	};
	
	var checkNote=function(){
			var flag=0;
			var d=new Date();
			d=d.toTimeString().split(' ')[0];
					if(music_notes.length>45)
						{	var tmp_notes=music_notes;
							music_notes=[];
							//60 notes are recored for 1 sec therefore 45 notes are required for 0.75 second which can be considered as note
							var free_sec=0;
							var tmp=tmp_notes[0];
							var count=1;
							var notesequence=[];
							var refinednotesequence=[];
							flag=0;
							var note_count=0;
							var tmp_len=unique_notes.length;
							
							//console.log('tmp_len',tmp_len)
							//ignore noice in stream
							for(var i=1;i<tmp_notes.length;i++){
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
							//console.log(notesequence);
							//combine consequtive notes
							if(notesequence.length>=1){
								tmp=notesequence[0][0];
								count=notesequence[0][1];
								//console.log(notesequence,tmp,count);
								for(var i=1;i<notesequence.length;i++){
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
								//console.log(refinednotesequence);
							}
							
							//merge refined note[0] if it exist in  unique last notes
							if(refinednotesequence.length>=1){
								if(tmp_len>=1 && unique_notes[tmp_len-1][0]==refinednotesequence[0][0]){
									flag=1;
									unique_notes=[[refinednotesequence[0][0],refinednotesequence[0][1]+unique_notes[tmp_len-1][1]]];
								}
								else
									unique_notes=[];

								for(var i=flag;i<refinednotesequence.length;i++)
									unique_notes.push([refinednotesequence[i][0],refinednotesequence[i][1]]);
								//console.log('before verification','input note length',refinednotesequence.length,'unique note length',unique_notes.length,'flag',flag,'swaraIndex',swaraIndex,'swarasCount',swarasCount,'left_leaf_node',left_node_mistake,'right_node_mistake',right_node_mistake,'repetation',tmp_repeatation);
								
								if(unique_notes.length>=1 && tmp_repeatation<repetation){
											for(var i=flag;i<unique_notes.length;i++){
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
													if(flag==0 && unique_notes[i][0]==music_play_note[swaraIndex])
														swaraIndex++;
												}
												//incase multiple swara increment for each swara either it is right or wrong
												else
													swaraIndex++;

												if(swaraIndex<swarasCount)
													$('#nextnote').text(carnatic_music_notes[swaraIndex]+' ('+music_play_note[swaraIndex]+')');
											}

										if(swaraIndex>=swarasCount & flag==0){
												swaraIndex=0;
												console.log(left_node_mistake,right_node_mistake);
												$('#nextnote').text(carnatic_music_notes[swaraIndex]+' ('+music_play_note[swaraIndex]+')');	
												tmp_repeatation++;
												$('#repeat').text(tmp_repeatation);
										}
										//console.log(carnatic_music_notes);
										//console.log('after verification',unique_notes[0],'flag',flag,'swaraIndex',swaraIndex,'left_leaf_node',left_node_mistake,'right_node_mistake',right_node_mistake,'repetation',tmp_repeatation);
										unique_notes=[unique_notes.pop()];
									}
							}
							else{
								unique_notes=[];
								music_notes=[];
							}
						}
						else{
							 	//console.log(unique_notes[0],'flag',flag,'swaraIndex',swaraIndex,'left_leaf_node',left_node_mistake,'right_node_mistake',right_node_mistake,'repetation',tmp_repeatation);
								music_notes=[];
								unique_notes=[];
								//tries for 3 times each time it record swara count
								if(tmp_repeatation>=repetation){
									console.log('done');
									tmp_repeatation=0;
									$('#repeat').text('0');
									clearInterval(timer);
									tmp_index=findLeafNodesIndex(swarasCount,currentIndex);
									console.log(left_node_mistake,right_node_mistake);
									if(tmp_index==null){
										if(PrevIndex!=null){
											tmp_index=PrevIndex;
											PrevIndex=null;
											turnOffMicrophone(tmp_index,user_lesson);	
										}
										else
											turnOffMicrophone(currentIndex+1,user_lesson);
										
									}
									else
									{   if(left_node_mistake==0 && right_node_mistake==0)

											{	
												console.log('no mistake procesing to next node','PrevIndex',PrevIndex,'currentIndex',currentIndex,'user_lesson',user_lesson);
												left_node_mistake=0;
												right_node_mistake=0;
												//console.log(currentIndex,typeof(currentIndex),currentIndex,currentIndex+1)
												if(PrevIndex==null){
													console.log('moving to currentIndex',currentIndex+1,user_lesson);
													//console.log(currentIndex,typeof(currentIndex),currentIndex,currentIndex+1)
													turnOffMicrophone(currentIndex+1,user_lesson);
												}
												else{
													tmp_index=PrevIndex;
													PrevIndex=null;
													console.log('moving to index',tmp_index,user_lesson);
													turnOffMicrophone(tmp_index,user_lesson);

												}
											}
										else if(left_node_mistake>right_node_mistake){
												console.log('mistake in left node procesing to next node','PrevIndex',PrevIndex,'currentIndex',currentIndex,'user_lesson',user_lesson);
												
												left_node_mistake=0;
												right_node_mistake=0;
												PrevIndex=currentIndex;
												var k=parseInt(swarasCount/2);
												tmp_notes=carnatic_music_notes.slice(0,k);
												$('#mistake').text('Mistake in '+tmp_notes.join(' '));
												$('#mistake').show();
												setTimeout(function(){$('#mistake').hide()},1500);
												turnOffMicrophone(tmp_index[0],user_lesson);
										}
										else{
												console.log('mistake in right node procesing to next node','PrevIndex',PrevIndex,'currentIndex',currentIndex,'user_lesson',user_lesson);
												left_node_mistake=0;
												right_node_mistake=0;
												PrevIndex=currentIndex;
												var k=parseInt(swarasCount/2);
												tmp_notes=carnatic_music_notes.slice(k);
												$('#mistake').text('Mistake in '+tmp_notes.join(' '));
												$('#mistake').show();
												setTimeout(function(){$('#mistake').hide()},1500);
												turnOffMicrophone(tmp_index[1],user_lesson);	
										}
									}
									//return;
								}
							}

				}	

		

	var streamReceived = function (stream) {
		micStream = stream;
		analyserAudioNode = audioContext.createAnalyser();
		analyserAudioNode.fftSize = 2048;
		sourceAudioNode = audioContext.createMediaStreamSource(micStream);
		sourceAudioNode.connect(analyserAudioNode);
		detectPitch();
	};

	var turnOffMicrophone = function (index,l) {
		if (sourceAudioNode && sourceAudioNode.mediaStream && sourceAudioNode.mediaStream.stop) {
			sourceAudioNode.mediaStream.stop();
		}
		sourceAudioNode = null;
		analyserAudioNode = null;
		isMicrophoneInUse = false;
		Lesson.play(index,l);
	};

	var toggleMicrophone = function (index,l,tmp_notes,car_music_notes) {
			$('#micButton').attr("disabled", true);
			$('._play').hide();
			$('._listen').show();
			currentIndex=index-1;
			music_play_note=tmp_notes;
			carnatic_music_notes=car_music_notes;
			swarasCount=tmp_notes.length;
			swaraIndex=0;
			$('#nextnote').text(carnatic_music_notes[swaraIndex]+' ('+music_play_note[swaraIndex]+')');
			//Object=l;
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
				timer=setInterval(function(){ checkNote(); }, 1500);
				updatePitch(baseFreq);
				isMicrophoneInUse = true;
			}
			else {
				reportError('It looks like this browser does not support getUserMedia. ' +
				'Check <a href="http://caniuse.com/#feat=stream">http://caniuse.com/#feat=stream</a> for more info.');
			}
	};
