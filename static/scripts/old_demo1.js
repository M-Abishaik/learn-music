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
				return;
				}
			console.log('note',l.carnaticLesson[index]);
			$('#notes').text(l.carnaticLesson[index]);
			Lesson.playSwaras(index,0,l);
		}
		static playSwaras(index,j,l){
			var swaras=l.carnaticLesson[index].split(' ');
			if(j==swaras.length){
				Lesson.play(index+1,l);
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
					Lesson.playSwaras(index,j+1,l);
				};

		}
		listenNotes(){
			this.toggleMicrophone();
		}
	
	isAudioContextSupported() {
		// This feature is still prefixed in Safari
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		if (window.AudioContext) {
			return true;
		}
		else {
			return false;
		}
	}

	reportError(message) {
		$('#errorMessage').html(message).show();
	}


	updatePitch(pitch) {
		console.log('pitch',pitch);
		//$('#pitch').text(pitch + ' Hz');
	}

	updateNote(note) {
		//console.log('note',note);
		this.music_notes.push(note);
		$('#note').text(note);
	}

	updateCents(cents) {
		// We may get negative values here.
		// Add 50 cents to what we get
		//gauge.set(cents + 50);
		//$('#cents').text(cents);
	}

	isGetUserMediaSupported() {
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
		if ((navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || navigator.getUserMedia) {
			return true;
		}

		return false;
	}

	findFundamentalFreq(buffer, sampleRate) {
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
	}

	findClosestNote(freq, notes) {
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
	}

	findCentsOffPitch(freq, refFreq) {
		// We need to find how far freq is from baseFreq in cents
		var log2 = 0.6931471805599453; // Math.log(2)
		var multiplicativeFactor = freq / refFreq;
		// We use Math.floor to get the integer part and ignore decimals
		var cents = Math.floor(1200 * (Math.log(multiplicativeFactor) / log2));
		return cents;
	}

	detectPitch() {
		var buffer = new Uint8Array(this.analyserAudioNode.fftSize);
		this.analyserAudioNode.getByteTimeDomainData(buffer);

		var fundalmentalFreq = this.findFundamentalFreq(buffer, this.audioContext.sampleRate);

		if (fundalmentalFreq !== -1) {
			var note = this.findClosestNote(fundalmentalFreq, this.notesArray);
			var cents = this.findCentsOffPitch(fundalmentalFreq, note.frequency);
			this.updateNote(note.note);
			//music_notes.push(note.note);
			this.updateCents(cents);
		}
		else {
			this.updateNote('--');
			this.updateCents(-50);
		}

		this.frameId = window.requestAnimationFrame(detectPitch);
	}

	streamReceived(stream) {
		this.micStream = stream;
		this.analyserAudioNode = this.audioContext.createAnalyser();
		this.analyserAudioNode.fftSize = 2048;
		this.sourceAudioNode = this.audioContext.createMediaStreamSource(this.micStream);
		this.sourceAudioNode.connect(this.analyserAudioNode);
		this.detectPitch();
	}

	turnOffMicrophone() {
		$('#micButton').attr("disabled", false);
		if (this.sourceAudioNode && this.sourceAudioNode.mediaStream && this.sourceAudioNode.mediaStream.stop) {
			this.sourceAudioNode.mediaStream.stop();
		}
		console.log(this.music_notes);
		this.unique_notes=[];
		var tmp=this.music_notes[0];
		var count=1;
		for(var i=1;i<this.music_notes.length;i++){
			if(tmp!=this.music_notes[i]){
				this.unique_notes.push([tmp,count]);
				tmp=this.music_notes[i];
				count=1;
			}
			else{
				count++;
			}
		}
		this.unique_notes.push([tmp,count]);
		console.log(this.unique_notes);
		this.unique_notes=[];
		this.music_notes=[];
		this.sourceAudioNode = null;
		this.analyserAudioNode = null;
		this.isMicrophoneInUse = false;
	}

	toggleMicrophone() {
			$('#micButton').text('Stop');
			$('#micButton').attr("disabled", true);
			//console.log(this.music_notes);
			//this.music_notes=[];
			console.log(this.freqTable);
			if (this.isGetUserMediaSupported()) {
				this.notesArray = this.freqTable[this.baseFreq.toString()];

				var getUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ?
					navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) :
					function (constraints) {
						return new Promise(function (resolve, reject) {
							navigator.getUserMedia(constraints, resolve, reject);
						});
					};

				getUserMedia({audio: true}).then(this.streamReceived).catch(this.reportError);
				this.updatePitch(this.baseFreq);
				this.isMicrophoneInUse = true;
			}
			else {
				this.reportError('It looks like this browser does not support getUserMedia. ' +
				'Check <a href="http://caniuse.com/#feat=stream">http://caniuse.com/#feat=stream</a> for more info.');
			}
	}
	setFreqTable(data){
		this.freqTable = data;
		this.getFreqTable();
		
	}
	getFreqTable(){
		console.log(this.freqTable);
	}
	constructor(){
	this.baseFreq = 440;
	this.isMicrophoneInUse = false;
	this.music_notes=[];
	this.unique_notes=[];
	this.x=1;
	this.freqTable=[];
		this.setFreqTable();
		if (this.isAudioContextSupported()) {
			this.audioContext = new window.AudioContext();
			var getUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ?
					navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) :
					function (constraints) {
						return new Promise(function (resolve, reject) {
							navigator.getUserMedia(constraints, resolve, reject);
						});
					};

				getUserMedia({audio: true}).then().catch(this.reportError);
		}
		else {
			this.reportError('AudioContext is not supported in this browser');
		}
	}	
}
	var user_lesson =new Lesson(); 
	$.getJSON('./static/scripts/notes.json', function (data) {
		user_lesson.setFreqTable(data);
		});
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
            			user_lesson.setLesson(json['carnatic_lesson'],json['western_lesson']);
            			user_lesson.start();
            			//Lesson.play(0,user_lesson);
            			user_lesson.listenNotes();
        }).fail(function(xhr,status,errorThrow){
          console.log('error'+errorThrow)
        });
	}

	