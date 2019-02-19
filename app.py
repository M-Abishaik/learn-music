from flask import Flask,render_template,jsonify,request
from musical_functions import Build_Notes,Construct_svaras
from Melakarta_ragas import Melakarta_Ragas
import json
lessons={
	"lesson1":["s", "r", "g", "m"],
	"lesson2":["s", "r", "g", "m","p","d","n","s"]
}
# base_addr="http://127.0.0.1:5000"
base_addr="https://playmusicapp1.herokuapp.com"

# base_addr="http://192.168.43.125:5000"
app=Flask('__name__')
@app.route('/')
def home():
	return render_template('index.html')
@app.route('/sample')
def sample():
	return render_template('sample.html')

@app.route('/lesson',methods=['POST','GET'])
def lesson():
	data=request.form.to_dict()
	#shruti=data['shruti']
	lesson_name=data['lesson_name']
	return render_template('lesson.html',lesson_name=lesson_name,Melakarta_Ragas=Melakarta_Ragas[1:],base_addr=base_addr)

@app.route('/getLesson',methods=['POST'])
def getLesson():
	data=request.json
	raga=data['raga']
	index=Melakarta_Ragas.index(raga)
	carnatic_notes,western_notes=Construct_svaras(index)
	tmp_lesson=lessons[data['lesson_name']]

	scale=data['scale']
	shruti=data['shruti']
	_shruti=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
	index=_shruti.index(shruti)

	carnatic_lesson=[carnatic_notes[swara] for swara in tmp_lesson]
	tmp_western_lesson=[western_notes[swara] for swara in tmp_lesson]
	print(tmp_western_lesson,index)
	western_lesson=[]
	for swara in tmp_western_lesson:
		tmp_index=_shruti.index(swara)
		print(tmp_index)
		if(tmp_index+index<12):
			print
			western_lesson.append(_shruti[tmp_index+index]+str(scale))
		else:
			western_lesson.append(_shruti[(tmp_index+index)%12]+str(int(scale)+1))
	carnatic_lesson=Build_Notes(carnatic_lesson).getNotes()
	western_lesson=Build_Notes(western_lesson).getNotes()
	print(carnatic_lesson,western_lesson)
	return jsonify(carnatic_lesson=carnatic_lesson,western_lesson=western_lesson)

if __name__=="__main__":
	app.run(debug=True)#,host="192.168.43.125",port=5000)