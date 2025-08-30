import React, { useState, useEffect } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

function DashboardCharts({ axiosInstance }) {
    const [chartData, setChartData] = useState(null);

    useEffect(() => {
        const fetchChartData = async () => {
            try {
                const response = await axiosInstance.get('/dashboard_stats');
                const stats = response.data;

                const riskData = {
                    labels: ['Not At Risk', 'At Risk'],
                    datasets: [{
                        data: [stats.risk_distribution.not_at_risk, stats.risk_distribution.at_risk],
                        backgroundColor: ['#2ecc71', '#e74c3c'],
                        borderColor: ['#16213e'],
                        borderWidth: 2,
                    }]
                };

                const gpaData = {
                    labels: Object.keys(stats.gpa_distribution),
                    datasets: [{
                        label: 'Number of Students',
                        data: Object.values(stats.gpa_distribution),
                        backgroundColor: 'rgba(0, 191, 255, 0.6)',
                        borderColor: 'rgba(0, 191, 255, 1)',
                        borderWidth: 1,
                    }]
                };

                setChartData({ risk: riskData, gpa: gpaData });
            } catch (error) {
                console.error("Error fetching chart data:", error);
            }
        };

        fetchChartData();
    }, [axiosInstance]);

    if (!chartData) {
        return <p>Loading charts...</p>;
    }

    const chartOptions = {
        plugins: { legend: { labels: { color: '#e0e0e0' } } }
    };

    const barChartOptions = {
        ...chartOptions,
        scales: {
            y: { ticks: { color: '#e0e0e0', beginAtZero: true }, grid: { color: 'rgba(224, 224, 224, 0.2)' } },
            x: { ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(224, 224, 224, 0.1)' } }
        }
    };

    return (
        <div className="charts-container">
            <div className="chart-card card">
                <h3>Risk Distribution</h3>
                <Pie data={chartData.risk} options={chartOptions} />
            </div>
            <div className="chart-card card">
                <h3>GPA Distribution</h3>
                <Bar data={chartData.gpa} options={barChartOptions} />
            </div>
        </div>
    );
}

export default DashboardCharts;