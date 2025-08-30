import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required
import joblib
import pandas as pd
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# --- APP SETUP ---
app = Flask(__name__)
CORS(app)

# --- DATABASE CONFIGURATION ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- JWT & BCRYPT CONFIGURATION ---
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# --- LOAD THE FINAL ML MODEL ---
print("Loading the final, robust model...")
model = joblib.load('student_model_final_robust.joblib')
print("Model loaded successfully!")


# --- DATABASE MODELS ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    def __init__(self, username, password): self.username = username; self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    def check_password(self, password): return bcrypt.check_password_hash(self.password_hash, password)

class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gpa = db.Column(db.Float, nullable=False)
    absences = db.Column(db.Integer, nullable=False)
    study_time_weekly = db.Column(db.Float, nullable=False)
    gender = db.Column(db.String(50)); ethnicity = db.Column(db.String(50)); parental_education = db.Column(db.String(100)); tutoring = db.Column(db.String(50)); parental_support = db.Column(db.String(50)); extracurricular = db.Column(db.String(50)); sports = db.Column(db.String(50)); music = db.Column(db.String(50)); volunteering = db.Column(db.String(50))
    # Add relationship to the new Intervention table
    interventions = db.relationship('Intervention', backref='student', lazy=True, cascade="all, delete-orphan")

# --- NEW: INTERVENTION TABLE ---
class Intervention(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student.id'), nullable=False)
    recommendation = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default='Pending')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# --- API ROUTES ---
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(); username = data.get('username'); password = data.get('password')
    if User.query.filter_by(username=username).first(): return jsonify({'message': 'Username already exists'}), 409
    new_user = User(username=username, password=password); db.session.add(new_user); db.session.commit()
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(); username = data.get('username'); password = data.get('password')
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        access_token = create_access_token(identity=user.id)
        return jsonify({'access_token': access_token})
    return jsonify({'message': 'Invalid username or password'}), 401

@app.route('/student', methods=['POST'])
@jwt_required()
def add_student():
    data = request.get_json()
    student_data = {key: value for key, value in data.items() if key != 'id'}
    new_student = Student(**student_data); db.session.add(new_student); db.session.commit()
    return jsonify({'message': 'Student data saved successfully'}), 201

@app.route('/students', methods=['GET'])
@jwt_required()
def get_students():
    students = Student.query.all()
    # Exclude interventions from this main list to keep it light
    return jsonify([{key: getattr(s, key) for key in s.__table__.columns.keys() if key != 'interventions'} for s in students])

@app.route('/student/<int:student_id>', methods=['PUT'], endpoint='update_student')
@jwt_required()
def update_student(student_id):
    student = Student.query.get(student_id)
    if not student: return jsonify({'message': 'Student not found'}), 404
    data = request.get_json()
    for key, value in data.items():
        if hasattr(student, key) and key != 'id': setattr(student, key, value)
    db.session.commit()
    return jsonify({'message': 'Student updated successfully'})

@app.route('/student/<int:student_id>', methods=['DELETE'], endpoint='delete_student')
@jwt_required()
def delete_student(student_id):
    student = Student.query.get(student_id)
    if not student: return jsonify({'message': 'Student not found'}), 404
    db.session.delete(student); db.session.commit()
    return jsonify({'message': 'Student deleted successfully'})

# --- UPDATED PREDICT ROUTE WITH RECOMMENDATIONS & EXPLANATIONS ---
@app.route('/predict/<int:student_id>', methods=['GET'])
@jwt_required()
def predict(student_id):
    student = Student.query.get(student_id)
    if not student: return jsonify({'message': 'Student not found'}), 404
    
    input_data = pd.DataFrame({'GPA': [student.gpa]})
    prediction = model.predict(input_data)
    result = int(prediction[0])
    
    recommendation = "No immediate action recommended."
    explanation = f"The student's GPA of {student.gpa} is above the risk threshold."

    if result == 1:
        if student.gpa < 1.0:
            recommendation = "Schedule mandatory academic probation meeting and tutoring."
            explanation = f"The primary risk factor is a critically low GPA ({student.gpa})."
        elif student.absences > 8:
            recommendation = "Initiate advisor outreach regarding high attendance issues."
            explanation = f"Although the GPA is borderline, the high number of absences ({student.absences}) is a major concern."
        else:
            recommendation = "Place on academic watch and recommend optional tutoring."
            explanation = f"The student's GPA ({student.gpa}) has fallen into a range associated with a higher risk of dropout."

    return jsonify({
        'student_id': student.id, 'student_name': student.student_name,
        'prediction': result, 'prediction_label': 'At Risk' if result == 1 else 'Not At Risk',
        'recommendation': recommendation,
        'explanation': explanation
    })
    
# --- NEW ROUTES FOR INTERVENTIONS ---
@app.route('/student/<int:student_id>/interventions', methods=['GET'])
@jwt_required()
def get_interventions(student_id):
    interventions = Intervention.query.filter_by(student_id=student_id).order_by(Intervention.created_at.desc()).all()
    return jsonify([{
        'id': i.id, 'recommendation': i.recommendation, 'status': i.status,
        'notes': i.notes, 'created_at': i.created_at.strftime('%Y-%m-%d %H:%M')
    } for i in interventions])

# This is a new route to log a new intervention
@app.route('/student/<int:student_id>/intervention', methods=['POST'])
@jwt_required()
def add_intervention(student_id):
    data = request.get_json()
    new_intervention = Intervention(
        student_id=student_id,
        recommendation=data.get('recommendation'),
        notes=data.get('notes', '')
    )
    db.session.add(new_intervention)
    db.session.commit()
    return jsonify({'message': 'Intervention logged successfully'}), 201


@app.route('/intervention/<int:intervention_id>', methods=['PUT'])
@jwt_required()
def update_intervention(intervention_id):
    intervention = Intervention.query.get(intervention_id)
    if not intervention: return jsonify({'message': 'Intervention not found'}), 404
    data = request.get_json()
    intervention.status = data.get('status', intervention.status)
    intervention.notes = data.get('notes', intervention.notes)
    db.session.commit()
    return jsonify({'message': 'Intervention updated successfully'})

# --- DASHBOARD STATS ROUTE (SIMPLIFIED) ---
@app.route('/dashboard_stats', methods=['GET'])
@jwt_required()
def dashboard_stats():
    students = Student.query.all()
    if not students:
        return jsonify({
            'risk_distribution': {'at_risk': 0, 'not_at_risk': 0},
            'gpa_distribution': {'0-1': 0, '1-2': 0, '2-3': 0, '3-4': 0, '4+': 0}
        })

    gpas = pd.DataFrame({'GPA': [s.gpa for s in students]})
    predictions = model.predict(gpas)
    risk_count = sum(predictions)
    risk_distribution = {'at_risk': int(risk_count), 'not_at_risk': len(students) - int(risk_count)}

    gpa_bins = {'0-1': 0, '1-2': 0, '2-3': 0, '3-4': 0, '4+': 0}
    for s in students:
        if s.gpa < 1: gpa_bins['0-1'] += 1
        elif s.gpa < 2: gpa_bins['1-2'] += 1
        elif s.gpa < 3: gpa_bins['2-3'] += 1
        elif s.gpa < 4: gpa_bins['3-4'] += 1
        else: gpa_bins['4+'] += 1

    return jsonify({'risk_distribution': risk_distribution, 'gpa_distribution': gpa_bins})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)