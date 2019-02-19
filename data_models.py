from flask_sqlalchemy import SQLAlchemy
from app import app,db
from datetime import datetime,timedelta
from flask_script import Manager
from flask_migrate import Migrate, MigrateCommand
from passlib.apps import custom_app_context as pwd_context

# Create our database model
class Users(db.Model):
    __tablename__ = "users"
    sno        = db.Column(db.Integer,primary_key=True, autoincrement=True)
    name       = db.Column(db.String(200)) 
    mobile_no  = db.Column(db.String(10))
    email      = db.Column(db.String(50))
    password   = db.Column(db.String(1000))

    def hash_password(self, password):
        return pwd_context.encrypt(password)

    def verify_password(self, password):
        return pwd_context.verify(password, self.password)


    def __init__(self,password,name,email,mobile_no):
        self.password = self.hash_password(password)
        self.name=name
        self.mobile_no=mobile_no
        self.email=email
    
    def __repr__(self):
        return '<Sno %r, email %r>' % (self.sno,self.email)

class FeedBack(db.Model):
    __tablename__="feedback"
    sno  =db.Column(db.Integer,primary_key=True, autoincrement=True)
    name       = db.Column(db.String(200)) 
    mobile_no  = db.Column(db.String(10))
    email      = db.Column(db.String(50))
    description=db.Column(db.Text(),)
    DATE=db.Column(db.String(50),default=(datetime.utcnow()+timedelta(hours=5,minutes=30)).replace(microsecond=0).strftime("%A, %d. %B %Y %I:%M%p"))
    
    """doc string for FeedBack object: db.Model"""
    def __init__(self, description,name,mobile_no,email):
        self.description = description
        self.name        = name
        self.mobile_no   = mobile_no
        self.email       = email
        

    def __repr__(self):
        return '<Sno %r,Name %r>' % (self.sno,self.name)
migrate = Migrate(app, db)
manager = Manager(app)
manager.add_command('db', MigrateCommand)


#To upgrade and degrade database use following commands
"""
python3 data_model.py db init
python3 data_model.py db migrate
python3 data_model.py db upgrade
python3 data_model.py db --help
"""

if __name__ == '__main__':
    manager.run()