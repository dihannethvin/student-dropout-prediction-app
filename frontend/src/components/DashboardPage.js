import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import DashboardCharts from './DashboardCharts';

const API_URL = 'http://127.0.0.1:5000';
const getToken = () => localStorage.getItem('access_token');
const axiosInstance = axios.create({ baseURL: API_URL });
axiosInstance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const PredictIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;

const initialFormState = { id: null, student_name: '', age: '', gpa: '', absences: '', study_time_weekly: '', gender: 'Male', ethnicity: 'Caucasian', parental_education: "Some College", tutoring: 'No', parental_support: 'High', extracurricular: 'No', sports: 'No', music: 'No', volunteering: 'No' };

function DashboardPage() {
    const [students, setStudents] = useState([]);
    const [predictions, setPredictions] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [currentStudent, setCurrentStudent] = useState(initialFormState);
    const [predictionResult, setPredictionResult] = useState(null);
    const [chartKey, setChartKey] = useState(0);
    
    const [riskFilter, setRiskFilter] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'student_name', direction: 'ascending' });

    const fetchStudentsAndPredictions = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/students');
            const studentData = response.data;
            setStudents(studentData);

            if (studentData.length > 0) {
                const predPromises = studentData.map(s => axiosInstance.get(`/predict/${s.id}`));
                const predResults = await Promise.all(predPromises);
                const predMap = predResults.reduce((acc, res) => {
                    acc[res.data.student_id] = res.data.prediction;
                    return acc;
                }, {});
                setPredictions(predMap);
            } else {
                setPredictions({});
            }
            setChartKey(prevKey => prevKey + 1);
        } catch (error) { console.error("Error fetching data:", error); }
    }, []);

    useEffect(() => { fetchStudentsAndPredictions(); }, [fetchStudentsAndPredictions]);

    const filteredAndSortedStudents = useMemo(() => {
        let sortableStudents = [...students];
        if (riskFilter !== 'All') {
            const riskValue = riskFilter === 'At Risk' ? 1 : 0;
            sortableStudents = sortableStudents.filter(s => predictions[s.id] === riskValue);
        }
        sortableStudents.sort((a, b) => {
            const keyA = isNaN(parseFloat(a[sortConfig.key])) ? a[sortConfig.key] : parseFloat(a[sortConfig.key]);
            const keyB = isNaN(parseFloat(b[sortConfig.key])) ? b[sortConfig.key] : parseFloat(b[sortConfig.key]);
            if (keyA < keyB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (keyA > keyB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return sortableStudents;
    }, [students, predictions, riskFilter, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const studentData = { ...currentStudent, age: parseInt(currentStudent.age), gpa: parseFloat(currentStudent.gpa), absences: parseInt(currentStudent.absences), study_time_weekly: parseFloat(currentStudent.study_time_weekly) };
        try {
            if (isEditing) {
                await axiosInstance.put(`/student/${currentStudent.id}`, studentData);
            } else {
                await axiosInstance.post('/student', studentData);
            }
            resetForm();
            fetchStudentsAndPredictions();
        } catch (error) { console.error("Error submitting form:", error); }
    };
    
    const handleEdit = (student) => { setIsEditing(true); setCurrentStudent(student); };
    const handleDelete = async (studentId) => {
        if (window.confirm("Are you sure?")) {
            try { await axiosInstance.delete(`/student/${studentId}`); fetchStudentsAndPredictions(); }
            catch (error) { console.error("Error deleting student:", error); }
        }
    };
    const resetForm = () => { setIsEditing(false); setCurrentStudent(initialFormState); };
    const handleInputChange = (e) => { const { name, value } = e.target; setCurrentStudent(p => ({ ...p, [name]: value })); };
    
    const handleLogout = () => {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    };

    const handlePredict = async (studentId) => {
        try { 
            const response = await axiosInstance.get(`/predict/${studentId}`);
            setPredictionResult(response.data); 
            if (response.data.prediction === 1) {
                const interventionsRes = await axiosInstance.get(`/student/${studentId}/interventions`);
                const hasExisting = interventionsRes.data.some(i => i.recommendation === response.data.recommendation && i.status === 'Pending');
                if (!hasExisting) {
                    await axiosInstance.post(`/student/${studentId}/intervention`, { recommendation: response.data.recommendation });
                }
            }
        } catch (error) { console.error("Error getting prediction:", error); }
    };
    
    const renderSelect = (name, label, options) => (
        <div className="form-field">
            <label>{label}</label>
            <select name={name} value={currentStudent[name]} onChange={handleInputChange}>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );

    return (
        <div className="dashboard-container">
            <div className="header"><h1>Risk Analysis Dashboard</h1><button onClick={handleLogout} className="logout-btn">Logout</button></div>
            <DashboardCharts axiosInstance={axiosInstance} key={chartKey} />
            <div className="content-wrapper">
                <div className="form-section card">
                    <h3>{isEditing ? 'Edit Student Record' : 'Add New Student'}</h3>
                    <form onSubmit={handleFormSubmit} className="student-form">
                        <div className="form-field full-width"><label>Student Name</label><input type="text" name="student_name" value={currentStudent.student_name} onChange={handleInputChange} required /></div>
                        <div className="form-field"><label>Age</label><input type="number" name="age" value={currentStudent.age} onChange={handleInputChange} required /></div>
                        <div className="form-field"><label>GPA</label><input type="number" step="0.1" name="gpa" value={currentStudent.gpa} onChange={handleInputChange} required /></div>
                        <div className="form-field"><label>Absences</label><input type="number" name="absences" value={currentStudent.absences} onChange={handleInputChange} required /></div>
                        <div className="form-field"><label>Weekly Study Time</label><input type="number" step="0.1" name="study_time_weekly" value={currentStudent.study_time_weekly} onChange={handleInputChange} required /></div>
                        {renderSelect('gender', 'Gender', ['Male', 'Female'])}
                        {renderSelect('ethnicity', 'Ethnicity', ['Caucasian', 'African American', 'Asian', 'Other'])}
                        {renderSelect('parental_education', 'Parental Education', ["None", "High School", "Some College", "Bachelor's", "Higher Degree"])}
                        {renderSelect('tutoring', 'Tutoring', ['No', 'Yes'])}
                        {renderSelect('parental_support', 'Parental Support', ['None', 'Low', 'Moderate', 'High', 'Very High'])}
                        {renderSelect('extracurricular', 'Extracurricular', ['No', 'Yes'])}
                        {renderSelect('sports', 'Sports', ['No', 'Yes'])}
                        {renderSelect('music', 'Music', ['No', 'Yes'])}
                        {renderSelect('volunteering', 'Volunteering', ['No', 'Yes'])}
                        <button type="submit" className="submit-btn">{isEditing ? 'Update Record' : 'Add Record'}</button>
                        {isEditing && <button type="button" onClick={resetForm} className="cancel-btn">Cancel</button>}
                    </form>
                </div>
                <div className="list-section card">
                    <div className="list-header"><h3>Student Roster</h3><div className="filter-controls"><label>Filter by Status: </label><select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}><option>All</option> <option>At Risk</option> <option>Not At Risk</option></select></div></div>
                    <div className="table-container">
                        <table>
                            <thead><tr><th onClick={() => requestSort('student_name')} className="sortable">Name</th><th onClick={() => requestSort('gpa')} className="sortable">GPA</th><th>Risk Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {filteredAndSortedStudents.map(s => (
                                    <tr key={s.id}>
                                        <td><Link to={`/student/${s.id}`}>{s.student_name}</Link></td>
                                        <td>{s.gpa}</td>
                                        <td>{typeof predictions[s.id] !== 'undefined' ? <span className={`risk-indicator ${predictions[s.id] === 1 ? 'risk' : 'no-risk'}`}>{predictions[s.id] === 1 ? 'At Risk' : 'Not At Risk'}</span> : '...'}</td>
                                        <td className="actions"><button onClick={() => handlePredict(s.id)} className="action-btn predict-btn" title="Run Prediction"><PredictIcon /></button><button onClick={() => handleEdit(s)} className="action-btn edit-btn" title="Edit"><EditIcon /></button><button onClick={() => handleDelete(s.id)} className="action-btn delete-btn" title="Delete"><DeleteIcon /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {predictionResult && (<div className="modal-backdrop"><div className="prediction-modal card"><h3>Prediction Result</h3><p><strong>Student:</strong> {predictionResult.student_name}</p><p><strong>Status:</strong><span className={predictionResult.prediction === 1 ? 'risk' : 'no-risk'}>{predictionResult.prediction_label}</span></p>

            <div className="explanation-section">
                <p><strong>Reasoning:</strong> {predictionResult.explanation}</p>
                <p><strong>Recommendation:</strong> {predictionResult.recommendation}</p>
            </div>
            <Link to={`/student/${predictionResult.student_id}`} onClick={() => setPredictionResult(null)} className="action-link">View Student Log &rarr;</Link>
            <button onClick={() => setPredictionResult(null)}>Close</button>
            </div></div>)}
        </div>
    );
}

export default DashboardPage;
