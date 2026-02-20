// client/src/components/settings/Schedule/ScheduleCreator.js
import React, { useState, useEffect } from 'react';
import ScheduleService from '../../../services/ScheduleService';
import AttributionService from '../../../services/AttributionService';
import ScheduleHoursService from '../../../services/ScheduleHoursService';
import { useToast } from '../../../hooks/useToast';
import './ScheduleCreator.scss';

const ScheduleCreator = () => {
    const [sets, setSets] = useState([]);
    const [selectedSet, setSelectedSet] = useState('');
    const [attributions, setAttributions] = useState([]);
    const [hours, setHours] = useState([]);
    const [grid, setGrid] = useState({}); // Clé: "day-hourId"
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const days = [
        { id: 1, label: 'Lundi' },
        { id: 2, label: 'Mardi' },
        { id: 3, label: 'Mercredi' },
        { id: 4, label: 'Jeudi' },
        { id: 5, label: 'Vendredi' }
    ];

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [setsRes, attrRes, hoursRes] = await Promise.all([
                ScheduleService.getScheduleSets(),
                AttributionService.getAttributions(),
                ScheduleHoursService.getScheduleHours()
            ]);
            setSets(setsRes.data);
            setAttributions(attrRes.data);
            setHours(hoursRes);
            setLoading(false);
        } catch (error) {
            showToast('Erreur lors du chargement des données', 'error');
        }
    };

    const handleSelectSet = async (setId) => {
        setSelectedSet(setId);
        if (!setId) {
            setGrid({});
            return;
        }
        try {
            const res = await ScheduleService.getScheduleById(setId);
            const newGrid = {};
            res.data.forEach(slot => {
                newGrid[`${slot.day_of_week}-${slot.time_slot_id}`] = {
                    attribution_id: slot.attribution_id || '',
                    room: slot.room || ''
                };
            });
            setGrid(newGrid);
        } catch (error) {
            showToast('Erreur lors du chargement de l\'horaire', 'error');
        }
    };

    const updateCell = (day, hourId, field, value) => {
        const key = `${day}-${hourId}`;
        setGrid(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
        }));
    };

    const handleSave = async () => {
        if (!selectedSet) return showToast('Veuillez sélectionner un horaire', 'warning');

        const slotsToSave = Object.entries(grid)
            .filter(([_, data]) => data.attribution_id) // On ne sauvegarde que les cases remplies
            .map(([key, data]) => {
                const [day, hourId] = key.split('-');
                return {
                    day_of_week: parseInt(day),
                    time_slot_id: parseInt(hourId),
                    attribution_id: data.attribution_id,
                    room: data.room
                };
            });

        try {
            await ScheduleService.saveSlots(selectedSet, slotsToSave);
            showToast('Emploi du temps enregistré !', 'success');
        } catch (error) {
            showToast('Erreur lors de la sauvegarde', 'error');
        }
    };

    if (loading) return <div>Chargement...</div>;

    return (
        <div className="schedule-creator-container">
            <div className="header-controls">
                <select value={selectedSet} onChange={(e) => handleSelectSet(e.target.value)}>
                    <option value="">-- Choisir un horaire --</option>
                    {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="btn-save" onClick={handleSave}>Enregistrer</button>
            </div>

            <div className="schedule-table-wrapper">
                <table className="schedule-table">
                    <thead>
                    <tr>
                        <th>Heures</th>
                        {days.map(d => <th key={d.id}>{d.label}</th>)}
                    </tr>
                    </thead>
                    <tbody>
                    {hours.map(h => (
                        <tr key={h.id}>
                            <td className="time-cell">{h.libelle}</td>
                            {days.map(d => {
                                const cellData = grid[`${d.id}-${h.id}`] || {};
                                const currentAttr = attributions.find(a => a.id == cellData.attribution_id);

                                return (
                                    <td key={`${d.id}-${h.id}`}
                                        className="slot-cell"
                                        style={{ borderLeft: currentAttr ? `5px solid ${currentAttr.color}` : '' }}>
                                        <select
                                            value={cellData.attribution_id || ''}
                                            onChange={(e) => updateCell(d.id, h.id, 'attribution_id', e.target.value)}
                                        >
                                            <option value="">Libre</option>
                                            {attributions.map(a => (
                                                <option key={a.id} value={a.id}>{a.class} - {a.subject}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Local"
                                            value={cellData.room || ''}
                                            onChange={(e) => updateCell(d.id, h.id, 'room', e.target.value)}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ScheduleCreator;