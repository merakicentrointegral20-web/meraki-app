import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, getCollection } from "../db";
import { Calendar as CalendarIcon, Clock, User, Sparkles, RefreshCw, Trash2, ArrowLeftRight, Check, AlertTriangle, MessageCircle } from "lucide-react";

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TIME_SLOTS = [
  "08:00", "08:45", "09:30", "10:15", "11:00", "11:45", "12:30", 
  "13:15", "14:00", "14:45", "15:30", "16:15", "17:00", "17:45"
];

export default function AgendaApp() {
  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [terapeutas, setTerapeutas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [activeTerapeutaId, setActiveTerapeutaId] = useState("");
  const [selectedWeekStart, setSelectedWeekStart] = useState("");
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  // Form states
  const [newCita, setNewCita] = useState({
    pacienteId: "", servicioId: "", fecha: "", horaInicio: "",
    costo: 20, esFija: false, cobrada: true, estadoAsistencia: "pendiente"
  });
  const [selectedCita, setSelectedCita] = useState(null);
  const [swapTargetCitaId, setSwapTargetCitaId] = useState("");
  const [dragOverSlot, setDragOverSlot] = useState(null);

  // Load initial week start (Monday of the current week)
  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));
    setSelectedWeekStart(monday.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const unsubCitas = subscribeToCollection("citas", setCitas);
    const unsubPacientes = subscribeToCollection("pacientes", setPacientes);
    const unsubTerapeutas = subscribeToCollection("terapeutas", setTerapeutas);
    const unsubServicios = subscribeToCollection("servicios", setServicios);
    
    return () => {
      unsubCitas();
      unsubPacientes();
      unsubTerapeutas();
      unsubServicios();
    };
  }, []);

  // Set default active therapist once loaded
  useEffect(() => {
    if (terapeutas.length > 0 && !activeTerapeutaId) {
      setActiveTerapeutaId(terapeutas[0].id);
    }
  }, [terapeutas]);

  // Adjust cost when service is selected
  useEffect(() => {
    if (newCita.servicioId) {
      const srv = servicios.find(s => s.id === newCita.servicioId);
      if (srv) {
        setNewCita(prev => ({ ...prev, costo: srv.costo }));
      }
    }
  }, [newCita.servicioId, servicios]);

  const getWeekDays = () => {
    if (!selectedWeekStart) return [];
    const days = [];
    const start = new Date(selectedWeekStart);
    for (let i = 0; i < 6; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({
        name: DAYS_OF_WEEK[i],
        dateStr: d.toISOString().split('T')[0],
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1
      });
    }
    return days;
  };

  const getCitaForSlot = (terapeutaId, dateStr, timeStr) => {
    return citas.find(c => 
      c.terapeutaId === terapeutaId && 
      c.fecha === dateStr && 
      c.horaInicio === timeStr
    );
  };

  // Helper to add minutes to time
  const getEndTime = (timeStr, minutes = 45) => {
    const [h, m] = timeStr.split(":").map(Number);
    let endM = m + minutes;
    let endH = h;
    if (endM >= 60) {
      endH += Math.floor(endM / 60);
      endM = endM % 60;
    }
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const checkCollision = (pacienteId, terapeutaId, fecha, horaInicio, ignoreCitaId = "") => {
    const isIgnored = (id) => {
      if (Array.isArray(ignoreCitaId)) {
        return ignoreCitaId.includes(id);
      }
      return id === ignoreCitaId;
    };

    // Check if therapist already booked
    const therapistCollision = citas.find(c => 
      !isIgnored(c.id) &&
      c.terapeutaId === terapeutaId &&
      c.fecha === fecha &&
      c.horaInicio === horaInicio &&
      c.estadoAsistencia !== "falto_justificado"
    );
    if (therapistCollision) {
      return `El terapeuta ya tiene asignado al paciente ${therapistCollision.pacienteNombre || 'otro'} a esta hora.`;
    }

    // Check if patient already booked with another therapist at same time
    const patientCollision = citas.find(c => 
      !isIgnored(c.id) &&
      c.pacienteId === pacienteId &&
      c.fecha === fecha &&
      c.horaInicio === horaInicio &&
      c.estadoAsistencia !== "falto_justificado"
    );
    if (patientCollision) {
      const ter = terapeutas.find(t => t.id === patientCollision.terapeutaId);
      return `El paciente ya tiene terapia a esta misma hora con ${ter?.nombre || 'otro profesional'}.`;
    }

    return null;
  };

  const handleMoveCita = async (citaId, targetDate, targetTime) => {
    const draggingCita = citas.find(c => c.id === citaId);
    if (!draggingCita) return;

    if (draggingCita.fecha === targetDate && draggingCita.horaInicio === targetTime) {
      return;
    }

    const existingCita = getCitaForSlot(activeTerapeutaId, targetDate, targetTime);

    if (existingCita) {
      // Swapping appointments
      const collisionDrag = checkCollision(draggingCita.pacienteId, activeTerapeutaId, targetDate, targetTime, [draggingCita.id, existingCita.id]);
      const collisionExist = checkCollision(existingCita.pacienteId, activeTerapeutaId, draggingCita.fecha, draggingCita.horaInicio, [draggingCita.id, existingCita.id]);
      
      if (collisionDrag) {
        alert(`⚠️ No se puede intercambiar: ${collisionDrag}`);
        return;
      }
      if (collisionExist) {
        alert(`⚠️ No se puede intercambiar: ${collisionExist}`);
        return;
      }

      if (confirm(`¿Desea intercambiar los horarios de ${draggingCita.pacienteNombre} y ${existingCita.pacienteNombre}?`)) {
        try {
          const sourceDate = draggingCita.fecha;
          const sourceTime = draggingCita.horaInicio;

          await updateDocument("citas", draggingCita.id, {
            fecha: targetDate,
            horaInicio: targetTime,
            horaFin: getEndTime(targetTime)
          });

          await updateDocument("citas", existingCita.id, {
            fecha: sourceDate,
            horaInicio: sourceTime,
            horaFin: getEndTime(sourceTime)
          });

          alert("Horarios intercambiados con éxito.");
          
          const therapist = terapeutas.find(t => t.id === draggingCita.terapeutaId);
          if (therapist && therapist.telefono) {
            if (confirm(`¿Deseas notificar los cambios de horario a ${therapist.nombre} por WhatsApp?`)) {
              const msg = `Hola ${therapist.nombre}, te saluda MERAKI. Se han intercambiado los horarios de dos sesiones en tu agenda:\n- *${draggingCita.pacienteNombre}* pasa a: ${targetDate} a las ${targetTime}\n- *${existingCita.pacienteNombre}* pasa a: ${sourceDate} a las ${sourceTime}\n\n¡Gracias!`;
              const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "")}&text=${encodeURIComponent(msg)}`;
              window.open(url, "_blank");
            }
          }
        } catch (e) {
          console.error(e);
          alert("Error al intercambiar horarios.");
        }
      }
    } else {
      // Moving appointment to empty slot
      const collision = checkCollision(draggingCita.pacienteId, activeTerapeutaId, targetDate, targetTime, draggingCita.id);
      if (collision) {
        alert(`⚠️ No se puede mover: ${collision}`);
        return;
      }

      try {
        const oldFecha = draggingCita.fecha;
        const oldHora = draggingCita.horaInicio;
        await updateDocument("citas", draggingCita.id, {
          fecha: targetDate,
          horaInicio: targetTime,
          horaFin: getEndTime(targetTime)
        });
        triggerWhatsAppChangeNotification(draggingCita, oldFecha, oldHora, targetDate, targetTime);
      } catch (e) {
        console.error(e);
        alert("Error al mover la cita.");
      }
    }
  };

  const handleCellClick = (dateStr, timeStr) => {
    const existing = getCitaForSlot(activeTerapeutaId, dateStr, timeStr);
    if (existing) {
      setSelectedCita(existing);
      setShowEditModal(true);
    } else {
      setNewCita({
        pacienteId: "",
        servicioId: "",
        fecha: dateStr,
        horaInicio: timeStr,
        costo: 20,
        esFija: false,
        cobrada: true,
        estadoAsistencia: "pendiente"
      });
      setShowAddModal(true);
    }
  };

  const handleSaveCita = async (e) => {
    e.preventDefault();
    if (!newCita.pacienteId || !newCita.servicioId) {
      alert("Selecciona un paciente y un servicio.");
      return;
    }

    const collisionMsg = checkCollision(newCita.pacienteId, activeTerapeutaId, newCita.fecha, newCita.horaInicio);
    if (collisionMsg) {
      alert(`⚠️ Choque de horario:\n${collisionMsg}`);
      return;
    }

    const patient = pacientes.find(p => p.id === newCita.pacienteId);
    const service = servicios.find(s => s.id === newCita.servicioId);

    if (patient && patient.estado === "suspendido") {
      alert("⚠️ ALERTA: Este paciente está SUSPENDIDO por la administración. No se puede agendar.");
      return;
    }

    const citaData = {
      pacienteId: newCita.pacienteId,
      pacienteNombre: patient?.nombre,
      servicioId: newCita.servicioId,
      servicioNombre: service?.nombre,
      terapeutaId: activeTerapeutaId,
      fecha: newCita.fecha,
      horaInicio: newCita.horaInicio,
      horaFin: getEndTime(newCita.horaInicio),
      costo: Number(newCita.costo),
      esFija: newCita.esFija,
      cobrada: newCita.cobrada,
      estadoAsistencia: newCita.estadoAsistencia
    };

    try {
      await addDocument("citas", citaData);
      
      // If it's a fixed appointment, we will also copy it for the next 4 weeks as a demonstration
      if (newCita.esFija) {
        const start = new Date(newCita.fecha);
        for (let i = 1; i <= 4; i++) {
          const nextDate = new Date(start);
          nextDate.setDate(start.getDate() + (7 * i));
          const futureCita = {
            ...citaData,
            fecha: nextDate.toISOString().split('T')[0]
          };
          await addDocument("citas", futureCita);
        }
      }

      setShowAddModal(false);
      alert("Cita programada correctamente.");
    } catch (e) {
      console.error(e);
      alert("Error al programar la cita.");
    }
  };

  const handleUpdateCita = async () => {
    const patient = pacientes.find(p => p.id === selectedCita.pacienteId);
    const collisionMsg = checkCollision(selectedCita.pacienteId, selectedCita.terapeutaId, selectedCita.fecha, selectedCita.horaInicio, selectedCita.id);
    if (collisionMsg) {
      alert(`⚠️ Choque de horario:\n${collisionMsg}`);
      return;
    }

    const original = citas.find(c => c.id === selectedCita.id);
    const oldFecha = original ? original.fecha : selectedCita.fecha;
    const oldHora = original ? original.horaInicio : selectedCita.horaInicio;

    try {
      await updateDocument("citas", selectedCita.id, {
        fecha: selectedCita.fecha,
        horaInicio: selectedCita.horaInicio,
        horaFin: getEndTime(selectedCita.horaInicio),
        costo: Number(selectedCita.costo),
        cobrada: selectedCita.cobrada,
        estadoAsistencia: selectedCita.estadoAsistencia
      });
      setShowEditModal(false);
      alert("Cita actualizada.");
      
      if (oldFecha !== selectedCita.fecha || oldHora !== selectedCita.horaInicio) {
        triggerWhatsAppChangeNotification(selectedCita, oldFecha, oldHora, selectedCita.fecha, selectedCita.horaInicio);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCita = async (deleteMode) => {
    // deleteMode: 'only' = only this session, 'all' = this and future ones
    try {
      if (deleteMode === 'all' && selectedCita.esFija) {
        // find future recurring appointments for this patient + therapist + time
        const allCitas = await getCollection("citas");
        const future = allCitas.filter(c => 
          c.pacienteId === selectedCita.pacienteId &&
          c.terapeutaId === selectedCita.terapeutaId &&
          c.horaInicio === selectedCita.horaInicio &&
          c.fecha >= selectedCita.fecha
        );
        for (let c of future) {
          await deleteDocument("citas", c.id);
        }
        alert("Se eliminó esta cita y todas las citas fijas futuras.");
      } else {
        await deleteDocument("citas", selectedCita.id);
        alert("Cita eliminada.");
      }
      setShowEditModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwapCitas = async () => {
    if (!swapTargetCitaId) return;
    const targetCita = citas.find(c => c.id === swapTargetCitaId);
    if (!targetCita) return;

    try {
      // Swap time and date
      const sourceDate = selectedCita.fecha;
      const sourceTime = selectedCita.horaInicio;

      await updateDocument("citas", selectedCita.id, {
        fecha: targetCita.fecha,
        horaInicio: targetCita.horaInicio,
        horaFin: getEndTime(targetCita.horaInicio)
      });

      await updateDocument("citas", targetCita.id, {
        fecha: sourceDate,
        horaInicio: sourceTime,
        horaFin: getEndTime(sourceTime)
      });

      setShowSwapModal(false);
      setShowEditModal(false);
      setSwapTargetCitaId("");
      alert(`Horarios intercambiados con éxito entre ${selectedCita.pacienteNombre} y ${targetCita.pacienteNombre}.`);
    } catch (e) {
      console.error(e);
      alert("Error al intercambiar turnos.");
    }
  };

  const handleCopyWeek = async () => {
    if (!selectedWeekStart) return;
    const prevMon = new Date(selectedWeekStart);
    prevMon.setDate(prevMon.getDate() - 7);
    const prevMonStr = prevMon.toISOString().split('T')[0];
    const prevSatStr = new Date(prevMon.setDate(prevMon.getDate() + 5)).toISOString().split('T')[0];

    // Filter appointments from last week
    const lastWeekCitas = citas.filter(c => c.fecha >= prevMonStr && c.fecha <= prevSatStr);
    if (lastWeekCitas.length === 0) {
      alert("No se encontraron citas en la semana anterior para copiar.");
      return;
    }

    let count = 0;
    try {
      for (let c of lastWeekCitas) {
        // Calculate new date for the current week
        const oldDate = new Date(c.fecha);
        const newDate = new Date(oldDate.setDate(oldDate.getDate() + 7));
        const newDateStr = newDate.toISOString().split('T')[0];

        // Check if there is already a booking in this slot
        const collision = citas.find(curr => 
          curr.terapeutaId === c.terapeutaId && 
          curr.fecha === newDateStr && 
          curr.horaInicio === c.horaInicio
        );

        if (!collision) {
          await addDocument("citas", {
            pacienteId: c.pacienteId,
            pacienteNombre: c.pacienteNombre,
            servicioId: c.servicioId,
            servicioNombre: c.servicioNombre,
            terapeutaId: c.terapeutaId,
            fecha: newDateStr,
            horaInicio: c.horaInicio,
            horaFin: c.horaFin,
            costo: c.costo,
            esFija: c.esFija,
            cobrada: c.cobrada,
            estadoAsistencia: "pendiente"
          });
          count++;
        }
      }
      alert(`Se copiaron ${count} citas de la semana pasada con éxito (evitando choques).`);
    } catch (e) {
      console.error(e);
      alert("Error al copiar semana.");
    }
  };

  const weekDays = getWeekDays();
  const currentWeekEnd = weekDays.length > 0 ? weekDays[5].dateStr : "";

  const handleShareWeeklySchedule = () => {
    const therapist = terapeutas.find(t => t.id === activeTerapeutaId);
    if (!therapist) return;
    
    if (!therapist.telefono) {
      alert("⚠️ Por favor configura el teléfono celular del terapeuta en Ajustes para poder enviarle la agenda.");
      return;
    }

    // Filter appointments of active week
    const weekCitas = citas.filter(c => 
      c.terapeutaId === activeTerapeutaId && 
      c.fecha >= selectedWeekStart && 
      c.fecha <= currentWeekEnd &&
      c.estadoAsistencia !== "falto_justificado"
    );

    if (weekCitas.length === 0) {
      alert(`El profesional ${therapist.nombre} no tiene citas agendadas en esta semana.`);
      return;
    }

    // Build the message
    let msg = `Hola *${therapist.nombre}*, te saluda MERAKI. Te compartimos tu agenda semanal para el período del *${selectedWeekStart}* al *${currentWeekEnd}*:\n\n`;

    // Group by day
    weekDays.forEach(d => {
      const dayCitas = weekCitas
        .filter(c => c.fecha === d.dateStr)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

      if (dayCitas.length > 0) {
        msg += `*${d.name.toUpperCase()} ${d.dayNum}/${d.monthNum}:*\n`;
        dayCitas.forEach(c => {
          msg += `• ${c.horaInicio} - ${c.horaFin}: ${c.pacienteNombre} (${c.servicioNombre})\n`;
        });
        msg += `\n`;
      }
    });

    msg += `¡Que tengas una excelente semana!`;

    const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "")}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const triggerWhatsAppChangeNotification = (cita, oldFecha, oldHora, newFecha, newHora) => {
    const therapist = terapeutas.find(t => t.id === cita.terapeutaId);
    if (!therapist || !therapist.telefono) return;

    if (confirm(`¿Deseas enviar un aviso de cambio al terapeuta ${therapist.nombre} por WhatsApp?`)) {
      const msg = `Hola ${therapist.nombre}, te saluda MERAKI. Se ha modificado el horario de tu sesión con el paciente ${cita.pacienteNombre}.\n\n*Anterior:* ${oldFecha} a las ${oldHora}\n*Nuevo:* ${newFecha} a las ${newHora}\n\n¡Gracias!`;
      const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "")}&text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Agenda y Horarios</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Calendario semanal de terapias por profesional.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-secondary" onClick={handleShareWeeklySchedule} style={{ backgroundColor: "#D1FAE5", color: "#065F46", border: "1px solid #A7F3D0" }}>
            <MessageCircle size={16} /> Compartir Agenda
          </button>
          <button className="btn btn-secondary" onClick={handleCopyWeek}>
            <RefreshCw size={16} /> Copiar Semana Anterior
          </button>
          <input 
            type="date" 
            className="input-field" 
            style={{ width: "160px" }}
            value={selectedWeekStart}
            onChange={(e) => {
              // Ensure we select Monday of that week
              const selected = new Date(e.target.value);
              const day = selected.getDay();
              const diff = selected.getDate() - day + (day === 0 ? -6 : 1);
              const monday = new Date(selected.setDate(diff));
              setSelectedWeekStart(monday.toISOString().split('T')[0]);
            }}
          />
        </div>
      </div>

      {/* Therapist tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid var(--border-light)", gap: "4px", marginBottom: "16px", overflowX: "auto", paddingBottom: "2px" }}>
        {terapeutas.map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTerapeutaId(t.id)}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "none",
              fontWeight: 500,
              cursor: "pointer",
              borderBottom: activeTerapeutaId === t.id ? "3px solid var(--purple-base)" : "3px solid transparent",
              color: activeTerapeutaId === t.id ? "var(--purple-dark)" : "var(--text-muted)",
              transition: "all 0.2s"
            }}
          >
            {t.nombre}
          </button>
        ))}
      </div>

      {/* Weekly Grid */}
      <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "16px", boxShadow: "var(--shadow-sm)", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: "800px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-light)" }}>
              <th style={{ width: "80px", padding: "10px 4px", color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>HORA</th>
              {weekDays.map(d => (
                <th key={d.dateStr} style={{ padding: "10px 4px", textAlign: "center" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.95rem" }}>{d.name}</div>
                  <div style={{ 
                    fontSize: "0.8rem", 
                    color: "var(--text-muted)", 
                    display: "inline-flex", 
                    justifyContent: "center", 
                    alignItems: "center", 
                    width: "24px", 
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: d.dateStr === new Date().toISOString().split('T')[0] ? "var(--purple-base)" : "transparent",
                    color: d.dateStr === new Date().toISOString().split('T')[0] ? "white" : "var(--text-muted)"
                  }}>{d.dayNum}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map(time => {
              const isLunch = time === "13:15" || time === "13:00"; // Block lunch time
              return (
                <tr key={time} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "12px 4px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", borderRight: "1px solid var(--border-soft)", fontWeight: 500 }}>
                    {time}
                  </td>
                  {weekDays.map(d => {
                    const cita = getCitaForSlot(activeTerapeutaId, d.dateStr, time);
                    if (isLunch) {
                      return (
                        <td key={d.dateStr} style={{ backgroundColor: "#F3F4F6", padding: "4px", textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          ALMUERZO
                        </td>
                      );
                    }
                    const isDraggedOver = dragOverSlot && dragOverSlot.dateStr === d.dateStr && dragOverSlot.timeStr === time;
                    return (
                      <td 
                        key={d.dateStr} 
                        onClick={() => handleCellClick(d.dateStr, time)}
                        onDragOver={(e) => {
                          if (!isLunch) e.preventDefault();
                        }}
                        onDragEnter={() => {
                          if (!isLunch) setDragOverSlot({ dateStr: d.dateStr, timeStr: time });
                        }}
                        onDragLeave={() => {
                          setDragOverSlot(null);
                        }}
                        onDrop={(e) => {
                          setDragOverSlot(null);
                          const citaId = e.dataTransfer.getData("text/plain");
                          if (citaId) {
                            handleMoveCita(citaId, d.dateStr, time);
                          }
                        }}
                        style={{ 
                          padding: "6px", 
                          verticalAlign: "middle", 
                          height: "65px",
                          borderRight: "1px solid var(--border-soft)",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          backgroundColor: isDraggedOver ? "var(--purple-pastel-soft)" : "transparent",
                          border: isDraggedOver ? "2px dashed var(--purple-base)" : undefined
                        }}
                        className="table-cell-hover"
                      >
                        {cita ? (
                          <div 
                            draggable={true}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData("text/plain", cita.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            style={{
                              backgroundColor: cita.estadoAsistencia === "falto_injustificado" ? "#FEE2E2" : "var(--purple-light)",
                              borderLeft: `4px solid ${cita.estadoAsistencia === "falto_injustificado" ? "var(--pink-base)" : "var(--purple-base)"}`,
                              borderRadius: "4px",
                              padding: "6px 8px",
                              fontSize: "0.75rem",
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                              cursor: "grab"
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {cita.pacienteNombre}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--purple-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {cita.servicioNombre}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                              <span>${cita.costo}</span>
                              {cita.esFija && <span style={{ fontWeight: "bold" }}>📌 FIJO</span>}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Cita Modal */}
      {showAddModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "450px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarIcon size={20} /> Agendar Terapia
            </h3>
            <form onSubmit={handleSaveCita} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Paciente*</label>
                <select required className="input-field" value={newCita.pacienteId} onChange={(e) => setNewCita({...newCita, pacienteId: e.target.value})}>
                  <option value="">Seleccione Paciente...</option>
                  {pacientes.filter(p => p.estado === "activo").map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Servicio / Terapia*</label>
                <select required className="input-field" value={newCita.servicioId} onChange={(e) => setNewCita({...newCita, servicioId: e.target.value})}>
                  <option value="">Seleccione Servicio...</option>
                  {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} (${s.costo})</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fecha</label>
                  <input type="text" disabled className="input-field" value={newCita.fecha} style={{ backgroundColor: "#F3F4F6" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Hora Inicio</label>
                  <input type="text" disabled className="input-field" value={newCita.horaInicio} style={{ backgroundColor: "#F3F4F6" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Costo de la Sesión ($)*</label>
                <input 
                  type="number" 
                  required 
                  className="input-field" 
                  value={newCita.costo} 
                  onChange={(e) => setNewCita({...newCita, costo: e.target.value})} 
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Precio flexible. Modificable para esta sesión.</span>
              </div>

              <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" id="addCitaFija" checked={newCita.esFija} onChange={(e) => setNewCita({...newCita, esFija: e.target.checked})} />
                  <label htmlFor="addCitaFija" style={{ fontSize: "0.85rem" }}>📌 Cita Fija (Recurrente)</label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" id="addCobrada" checked={newCita.cobrada} onChange={(e) => setNewCita({...newCita, cobrada: e.target.checked})} />
                  <label htmlFor="addCobrada" style={{ fontSize: "0.85rem" }}>💵 Cobrar Sesión</label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agendar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Cita Modal */}
      {showEditModal && selectedCita && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "450px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", marginBottom: "16px" }}>Detalles del Turno</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "0.95rem" }}>
                <strong>Paciente:</strong> {selectedCita.pacienteNombre}<br />
                <strong>Servicio:</strong> {selectedCita.servicioNombre}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fecha</label>
                  <input type="date" className="input-field" value={selectedCita.fecha} onChange={(e) => setSelectedCita({...selectedCita, fecha: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Hora Inicio</label>
                  <select className="input-field" value={selectedCita.horaInicio} onChange={(e) => setSelectedCita({...selectedCita, horaInicio: e.target.value})}>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Valor de la Sesión ($)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={selectedCita.costo} 
                  onChange={(e) => setSelectedCita({...selectedCita, costo: e.target.value})} 
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Asistencia</label>
                  <select className="input-field" value={selectedCita.estadoAsistencia} onChange={(e) => {
                    const status = e.target.value;
                    const cob = status !== "falto_justificado";
                    setSelectedCita({...selectedCita, estadoAsistencia: status, cobrada: cob});
                  }}>
                    <option value="pendiente">Pendiente</option>
                    <option value="asistio">Asistió</option>
                    <option value="falto_justificado">Faltó (Justificado - No Cobrar)</option>
                    <option value="falto_injustificado">Faltó (No Justificado - Cobrar)</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" id="editCobrada" checked={selectedCita.cobrada} onChange={(e) => setSelectedCita({...selectedCita, cobrada: e.target.checked})} />
                    <label htmlFor="editCobrada" style={{ fontSize: "0.85rem" }}>Cobrar Sesión</label>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                <button className="btn btn-secondary" onClick={() => setShowSwapModal(true)} style={{ flex: 1 }}>
                  <ArrowLeftRight size={16} /> Intercambiar Turno
                </button>
                <button className="btn btn-danger" onClick={() => {
                  if (selectedCita.esFija) {
                    if (confirm("Esta cita es FIJA. ¿Quieres eliminar también todas las citas futuras?")) {
                      handleDeleteCita('all');
                    } else {
                      handleDeleteCita('only');
                    }
                  } else {
                    handleDeleteCita('only');
                  }
                }} style={{ display: "flex", justifyContent: "center", padding: "10px" }}>
                  <Trash2 size={16} /> Eliminar
                </button>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid var(--border-light)", margin: "8px 0" }} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleUpdateCita}>Guardar Cambios</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Swap turn modal */}
      {showSwapModal && selectedCita && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1010 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "400px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", marginBottom: "12px" }}>Intercambiar Horario</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
              Intercambia el horario de <strong>{selectedCita.pacienteNombre}</strong> ({selectedCita.fecha} a las {selectedCita.horaInicio}) con otro turno programado de este profesional.
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Seleccionar Turno de Intercambio</label>
                <select className="input-field" value={swapTargetCitaId} onChange={(e) => setSwapTargetCitaId(e.target.value)}>
                  <option value="">Seleccione cita de destino...</option>
                  {citas
                    .filter(c => c.id !== selectedCita.id && c.terapeutaId === activeTerapeutaId)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fecha} ({c.horaInicio}) - {c.pacienteNombre}
                      </option>
                    ))}
                </select>
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button className="btn btn-secondary" onClick={() => setShowSwapModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSwapCitas} disabled={!swapTargetCitaId}>Confirmar Intercambio</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
