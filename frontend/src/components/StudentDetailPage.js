import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

// --- Axios Setup (same as your dashboard) ---
const API_URL = 'http://127.0.0.1:5000';
const getToken = () => localStorage.getItem('access_token');
const axiosInstance = axios.create({ baseURL: API_URL });
axiosInstance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

function StudentDetailPage() {
    const { studentId } = useParams();
    const [student, setStudent] = useState(null);
    const [interventions, setInterventions] = useState([]);
    const [editingIntervention, setEditingIntervention] = useState(null);
    const [notes, setNotes] = useState('');

    const fetchStudentData = useCallback(async () => {
        try {
            // Fetch student list and find the current student
            const studentsRes = await axiosInstance.get('/students');
            const currentStudent = studentsRes.data.find(s => s.id === parseInt(studentId));
            setStudent(currentStudent);

            // Fetch intervention history for this student
            const interventionsRes = await axiosInstance.get(`/student/${studentId}/interventions`);
            setInterventions(interventionsRes.data);
        } catch (error) {
            console.error("Error fetching student data:", error);
        }
    }, [studentId]);

    useEffect(() => {
        fetchStudentData();
    }, [fetchStudentData]);

    const handleUpdateIntervention = async (interventionId) => {
        try {
            await axiosInstance.put(`/intervention/${interventionId}`, {
                notes: notes,
                status: 'Completed'
            });
            setEditingIntervention(null);
            setNotes('');
            fetchStudentData(); // Refresh data to show changes
        } catch (error) {
            console.error("Error updating intervention:", error);
        }
    };

    if (!student) return <div className="loading-text">Loading student details...</div>;

    return (
        <div className="detail-page-container">
            <Link to="/dashboard" className="back-link">&larr; Back to Dashboard</Link>
            <h1>{student.student_name}'s Profile</h1>
            
            <div className="student-details-grid">
                <div className="detail-card card"><strong>GPA</strong> {student.gpa}</div>
                <div className="detail-card card"><strong>Absences</strong> {student.absences}</div>
                <div className="detail-card card"><strong>Study Time</strong> {student.study_time_weekly} hrs/wk</div>
                <div className="detail-card card"><strong>Parental Support</strong> {student.parental_support}</div>
            </div>

            <div className="interventions-section card">
                <h2>Intervention Log</h2>
                {interventions.length === 0 ? <p>No interventions logged for this student.</p> : (
                    <div className="timeline">
                        {interventions.map(i => (
                            <div key={i.id} className={`timeline-item ${i.status.toLowerCase()}`}>
                                <div className="timeline-dot"></div>
                                <div className="timeline-content">
                                    <span className="timeline-date">{i.created_at}</span>
                                    <h4>{i.recommendation}</h4>
                                    <p><strong>Status:</strong> {i.status}</p>
                                    
                                    {editingIntervention === i.id ? (
                                        <div className="edit-intervention">
                                            <textarea 
                                                value={notes} 
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Add completion notes..."
                                            />
                                            <button onClick={() => handleUpdateIntervention(i.id)}>Save Notes</button>
                                            <button onClick={() => setEditingIntervention(null)} className="cancel-btn">Cancel</button>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="notes"><strong>Notes:</strong> {i.notes || 'N/A'}</p>
                                            {i.status === 'Pending' && (
                                                <button onClick={() => { setEditingIntervention(i.id); setNotes(i.notes || ''); }} className="action-btn edit-btn">Log Action</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default StudentDetailPage;