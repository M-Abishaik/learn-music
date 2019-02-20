from flask import Flask,render_template,jsonify,request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc,func
from musical_functions import Build_Notes,Construct_svaras
from Melakarta_ragas import Melakarta_Ragas
import json,os

lessons={
	"lesson1":["s", "r", "g", "m"],
	"lesson2":["s", "r", "g", "m","p","d","n","s"]
}
# base_addr="http://127.0.0.1:5000"
base_addr="https://learnmusic.herokuapp.com"

# base_addr="http://192.168.43.125:5000"

app=Flask('__name__')
# app.config['SQLALCHEMY_DATABASE_URI']=os.getenv('DATABASE_URL','mysql://user:user@localhost/test')
app.config['SQLALCHEMY_DATABASE_URI']=os.getenv('DATABASE_URL')#,'postgres://alioqrrukzmeri:f442afdd37d8bd3f252a8178d1b96a7c276b41b6bee6972024c7bdb33ca74ac9@ec2-23-21-130-182.compute-1.amazonaws.com:5432/dkksbh8v27li8')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS']=True
app.config['SECRET_KEY'] = 'secret'
db = SQLAlchemy(app)

@app.route('/base')
def base():
	return render_template('base.html')
@app.route('/')
def home():
	return render_template('index.html')

@app.route('/feedback',methods=['GET','POST'])
def feedback():
	if(request.method == 'GET'):
		return render_template('feedback.html')
	else:
		from data_models import FeedBack
		data = dict(request.form)
		if(('email' not in data) or ('mobile' not in data) or ('name' not in data) or ('description' not in data)):
			return render_template('feedback.html',message='invalid schema')
		if((data['name']=='') or (data['mobile']=='') or (data['email']=='') or (data['description']=='')):
			return render_template('feedback.html',message='either name,mobile #,email or description is empty')
		else:
			feedback = FeedBack(name=data['name'],email=data['email'],mobile_no=data['mobile'],description=data['description'])
			db.session.add(feedback)
			db.session.commit()
			return render_template('feedback.html',show='show')

@app.route('/login',methods=['GET','POST'])
def login():
	if(request.method == 'GET'):
		return render_template('login.html',message=None)
	else:
		from data_models import Users,FeedBack
		data = dict(request.form)
		if(('username' not in data) or ('password' not in data)):
			return render_template('login.html',message='invalid schema')
		if((data['username']=='') or (data['password']=='')):
			return render_template('login.html',message='invalid username or password')
		else:
			username = data['username'][0]
			print(username)
			user=db.session.query(Users).filter(Users.email == username).first()
			if user and user.verify_password(data['password']):
				return render_template('review.html',username=data['username'],password=data['password'])
			else:
				return render_template('login.html',message='invalid username or password')

@app.route('/review',methods=['POST'])
def review():
	from data_models import FeedBack
	data = request.json
	_feedbacks = []
	end = False
	if(data['lastId'] == ''):
		 _feedbacks = FeedBack.query.order_by(FeedBack.sno.desc()).limit(10).all()
	else:
		 _feedbacks = FeedBack.query.filter(FeedBack.sno < int(data['lastId'])).order_by(FeedBack.sno.desc()).limit(10).all()		
	feedbacks  = list()
	for x in _feedbacks:
		feedbacks.append({
			'name': x.name,
			'date': x.DATE,
			'description': x.description,
			'mobile':x.mobile_no,
			'email':x.email,
			'id':x.sno
		}) 
	if len(feedbacks) <10:
		end = True
	return jsonify(data=feedbacks,end=end)
@app.route('/deletereview',methods=['POST'])
def deletereview():
	data = request.json
	from data_models import FeedBack
	if('Id' not in data):
		return jsonify(response=0,message='Invalid shcema')
	else:
		feedback = FeedBack.query.filter(FeedBack.sno == data['Id']).first()
		if(feedback):
			print(feedback)
			db.session.delete(feedback)
			try:
				db.session.commit()
			except:
				return jsonify(response=0,message='error in deleting review')	
			return jsonify(response=1,message='review deleted')
		else:
			return jsonify(response=0,message='review does not exist')

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