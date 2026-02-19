import React, {useEffect, useState} from 'react';
import { useLocation } from 'react-router-dom';
import ClassesManager from "./Class/ClassManager";
import ScheduleManager from "./Schedule/ScheduleManager";
import HolidaysManager from "./holidays/HolidaysManager";
import JournalManager from "../journal/JournalManager";
import AttributionManager from "./Attribution/AttributionManager";
import StudentManager from "./Student/StudentManager";
import ScheduleCreator from "./Schedule/ScheduleCreator";
import { useAuth } from "../../hooks/useAuth";
import './Settings.scss';

const Settings = () => {
    const location = useLocation();
    const { user } = useAuth();



    const [collapsed, setCollapsed] = useState({
        admin: false,
        user: user?.role === "ADMIN"
    });

    const toggleSection = (section) => {
        setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const initialTab = user?.role === "ADMIN" ? 'horaire' : 'classes';
    const [activeTab, setActiveTab] = useState(() => {
        if (location.state?.activeTab) {
            return location.state.activeTab;
        }
        return user?.role === "ADMIN" ? 'journals' : 'classes';
    });

    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }
    }, [location.state]);

    // Définition des sections de manière structurée
    const sections = [];
    if (user?.role === "ADMIN") {
        sections.push({
            id: 'admin',
            title: 'Administration',
            tabs: [
                { id: 'schedule', label: 'Heures de cours', icon: '⏰' },
                { id: 'holidays', label: 'Calendrier', icon: '📅' },
                { id: 'horaire', label: 'Horaire', icon: '🗓️' }
            ]
        });
    }

    sections.push({
        id: 'user',
        title: 'Ma Classe',
        tabs: [
            { id: 'journals', label: 'Journaux', icon: '📚' },
            { id: 'classes', label: 'Classes', icon: '🏫' },
            { id: 'students', label: 'Élèves', icon: '👥' },
            { id: 'attributions', label: 'Attributions', icon: '💼' },
        ]
    });

    const renderTabContent = () => {
        switch (activeTab) {
            case 'journals': return <JournalManager />;
            case 'classes': return <ClassesManager />;
            case 'students': return <StudentManager />;
            case 'schedule': return <ScheduleManager />;
            case 'holidays': return <HolidaysManager />;
            case 'attributions': return <AttributionManager />;
            case 'horaire': return <ScheduleCreator />;
            default: return <ClassesManager />;
        }
    };
    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1>⚙️ Paramètres</h1>
                <p>Gérez vos préférences et configurations</p>
            </div>

            <div className="settings-content">
                <div className="settings-sidebar">
                    <nav className="settings-nav">
                        {sections.map((section) => (
                            <div
                                key={section.id}
                                className={`nav-section ${section.id}-section ${collapsed[section.id] ? 'collapsed' : ''}`}
                            >
                                <div className="section-header-toggle" onClick={() => toggleSection(section.id)}>
                                    <h3 className="section-title">{section.title}</h3>
                                    <span className="toggle-arrow">{collapsed[section.id] ? '▶' : '▼'}</span>
                                </div>

                                <div className="section-content">
                                    {section.tabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                                            onClick={() => setActiveTab(tab.id)}
                                        >
                                            <span className="tab-icon">{tab.icon}</span>
                                            <span className="tab-label">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="settings-main">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default Settings;