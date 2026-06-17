import React, { useState, useEffect } from "react";
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from "../db";
import { useAuth } from "../context/AuthContext";
import { CheckSquare, Square, Trash2, Plus, Bell, Calendar, User, ShieldAlert, Award } from "lucide-react";

export default function TareasApp() {
  const { currentUser } = useAuth();
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [assignee, setAssignee] = useState("Josua");
  const [silencedAlerts, setSilencedAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem("meraki_silenced_alerts");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("meraki_silenced_alerts", JSON.stringify(silencedAlerts));
  }, [silencedAlerts]);

  useEffect(() => {
    const unsubTareas = subscribeToCollection("tareas", setTareas);
    const unsubUsuarios = subscribeToCollection("usuarios", setUsuarios);
    const unsubFeriados = subscribeToCollection("feriados_eventos", setFeriados);
    return () => {
      unsubTareas();
      unsubUsuarios();
      unsubFeriados();
    };
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      await addDocument("tareas", {
        titulo: newTaskTitle,
        completada: false,
        asignadoA: assignee,
        creadoPor: currentUser?.nombre || "Usuario",
        fechaCreacion: new Date().toISOString()
      });
      setNewTaskTitle("");
      alert("Tarea creada.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      await updateDocument("tareas", task.id, {
        completada: !task.completada,
        fechaCompletada: !task.completada ? new Date().toISOString() : null
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteDocument("tareas", taskId);
    } catch (e) {
      console.error(e);
    }
  };

  // HOLIDAY AND EVENT ALERTS ENGINE WITH WEEKEND SHIFTING & RECURRENCE
  const getSystemAlerts = () => {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    feriados.forEach(item => {
      // Add T12:00:00 to avoid timezone shifting when parsed
      let eventDate = new Date(item.fecha + "T12:00:00");
      eventDate.setHours(0, 0, 0, 0);

      // Handle annual recurrence
      if (item.repeticion === "anual") {
        const currentYear = today.getFullYear();
        let candidateDate = new Date(currentYear, eventDate.getMonth(), eventDate.getDate());
        candidateDate.setHours(0, 0, 0, 0);
        
        // If event passed this year, compute for next year
        const candidateEnd = new Date(candidateDate);
        candidateEnd.setHours(23, 59, 59, 999);
        if (candidateEnd < today) {
          candidateDate = new Date(currentYear + 1, eventDate.getMonth(), eventDate.getDate());
          candidateDate.setHours(0, 0, 0, 0);
        }
        eventDate = candidateDate;
      }

      // 1. Calculate trigger days in advance (at least 1 week before)
      // Feriado: 8 days; Evento: 7 days
      const daysAhead = item.tipo === "feriado" ? 8 : 7;
      
      // Calculate alert date
      const alertDate = new Date(eventDate);
      alertDate.setDate(eventDate.getDate() - daysAhead);

      // 2. Weekend shifting logic:
      // If alertDate falls on Sunday (0) or Saturday (6), move back to Friday
      const alertDayOfWeek = alertDate.getDay();
      if (alertDayOfWeek === 0) { // Sunday -> Move back 2 days to Friday
        alertDate.setDate(alertDate.getDate() - 2);
      } else if (alertDayOfWeek === 6) { // Saturday -> Move back 1 day to Friday
        alertDate.setDate(alertDate.getDate() - 1);
      }

      // Check if alert is active today (today is between shifted alertDate and eventDate)
      if (today >= alertDate && today <= eventDate) {
        const daysLeft = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
        const eventYear = eventDate.getFullYear();
        const alertKey = `alert_${item.id}_${eventYear}`;

        const formattedDate = eventDate.toLocaleDateString("es-ES", { day: 'numeric', month: 'long', year: 'numeric' });

        alerts.push({
          id: item.id,
          key: alertKey,
          titulo: `¡ALERTA CORPORATIVA!: Se aproxima el ${item.tipo === "feriado" ? "FERIADO" : "EVENTO"} "${item.titulo}" en ${daysLeft} días (${formattedDate}).`,
          tipo: item.tipo,
          originalAlertDate: new Date(new Date(eventDate).setDate(eventDate.getDate() - daysAhead)).toISOString().split('T')[0],
          shiftedAlertDate: alertDate.toISOString().split('T')[0],
          daysLeft,
          repeticion: item.repeticion || "unica"
        });
      }
    });

    return alerts;
  };

  const systemAlerts = getSystemAlerts();

  // Play audio alarm repeating every 8 seconds if there are active unsilenced alerts
  useEffect(() => {
    const activeUnsilenced = systemAlerts.filter(a => !silencedAlerts[a.key]);
    if (activeUnsilenced.length === 0) return;

    const playAlarmSound = () => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const playNote = (frequency, startTime, duration) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          osc.type = "sine";
          osc.frequency.setValueAtTime(frequency, startTime);
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        
        const now = audioCtx.currentTime;
        // Double beep chime (pleasant but distinct notification sound)
        playNote(587.33, now, 0.2); // D5
        playNote(783.99, now + 0.12, 0.45); // G5
      } catch (e) {
        console.error("Audio context error:", e);
      }
    };

    const initialTimeout = setTimeout(() => {
      playAlarmSound();
    }, 1200);

    const interval = setInterval(() => {
      playAlarmSound();
    }, 8000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [systemAlerts, silencedAlerts]);

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <style>{`
        @keyframes alert-pulse {
          0% { box-shadow: 0 0 0 0px rgba(139, 92, 246, 0.4); }
          100% { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
        }
        @keyframes alert-pulse-feriado {
          0% { box-shadow: 0 0 0 0px rgba(239, 68, 68, 0.4); }
          100% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        }
      `}</style>
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Tareas y Alertas Corporativas</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Organiza tus pendientes del día y mantente al tanto de feriados y eventos especiales.</p>
        </div>
      </div>

      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" }}>
        {/* Checklist Card */}
        <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckSquare size={20} color="var(--purple-base)" /> Pendientes y Checklist Diario
          </h3>

          {/* Quick Create Task Form */}
          <form onSubmit={handleAddTask} className="responsive-flex" style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input 
              type="text" 
              placeholder="Escribe un nuevo pendiente..." 
              required
              className="input-field" 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            {currentUser?.rol === "administrador" && (
              <select className="input-field" style={{ width: "150px" }} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="Josua">Asignar a Josua</option>
                <option value="Administradora">Asignar a Admin</option>
              </select>
            )}
            <button type="submit" className="btn btn-primary">
              <Plus size={16} /> Agregar
            </button>
          </form>

          {/* Tasks List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* 1. Show System Alerts as High Priority Pinned Tasks */}
            {systemAlerts.map(alert => {
              const isSilenced = !!silencedAlerts[alert.key];
              return (
                <div 
                  key={alert.key}
                  style={{ 
                    backgroundColor: isSilenced ? "var(--bg-secondary)" : (alert.tipo === "feriado" ? "#FEE2E2" : "var(--purple-light)"),
                    border: `1px solid ${isSilenced ? "var(--border-soft)" : (alert.tipo === "feriado" ? "var(--pink-pastel-soft)" : "var(--purple-pastel-soft)")}`,
                    color: isSilenced ? "var(--text-muted)" : (alert.tipo === "feriado" ? "var(--pink-dark)" : "var(--purple-dark)"),
                    padding: "12px", 
                    borderRadius: "var(--radius-sm)", 
                    display: "flex", 
                    gap: "12px", 
                    alignItems: "center",
                    justifyContent: "space-between",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    opacity: isSilenced ? 0.7 : 1,
                    transition: "all 0.3s ease",
                    animation: !isSilenced ? (alert.tipo === "feriado" ? "alert-pulse-feriado 2s infinite alternate" : "alert-pulse 2s infinite alternate") : "none"
                  }}
                >
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flex: 1 }}>
                    <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: "2px", color: isSilenced ? "var(--text-muted)" : "inherit" }} />
                    <div>
                      <strong style={{ fontSize: "0.9rem", textDecoration: isSilenced ? "line-through" : "none" }}>{alert.titulo}</strong>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        {alert.repeticion === "anual" ? "🔁 Evento Anual Recurrente. " : ""}
                        🔔 Alerta calculada originalmente para fin de semana y desplazada automáticamente al <strong>Viernes ({alert.shiftedAlertDate})</strong> para evitar olvidos.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSilencedAlerts(prev => ({
                        ...prev,
                        [alert.key]: !isSilenced
                      }));
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      backgroundColor: isSilenced ? "var(--border-soft)" : (alert.tipo === "feriado" ? "var(--pink-dark)" : "var(--purple-dark)"),
                      color: isSilenced ? "var(--text-main)" : "white",
                      boxShadow: !isSilenced ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.2s"
                    }}
                  >
                    {isSilenced ? (
                      <>🔇 Activar Alarma</>
                    ) : (
                      <>🔊 Apagar Alarma</>
                    )}
                  </button>
                </div>
              );
            })}

            {/* 2. Show User Checklist Tasks */}
            {tareas.filter(t => !t.completada).map(t => (
              <div 
                key={t.id} 
                className="table-row-hover"
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "12px", 
                  borderRadius: "var(--radius-sm)", 
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-soft)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }} onClick={() => handleToggleTask(t)}>
                  <Square size={20} style={{ cursor: "pointer", color: "var(--text-muted)" }} />
                  <div>
                    <span style={{ fontSize: "0.95rem", color: "var(--text-main)", cursor: "pointer" }}>{t.titulo}</span>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Asignada a: <strong>{t.asignadoA}</strong> | Creado por: {t.creadoPor}
                    </div>
                  </div>
                </div>
                <button 
                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                  onClick={() => handleDeleteTask(t.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {/* 3. Completed Tasks */}
            {tareas.filter(t => t.completada).length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 500 }}>Tareas Completadas</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {tareas.filter(t => t.completada).map(t => (
                    <div 
                      key={t.id} 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        padding: "10px 12px", 
                        borderRadius: "var(--radius-sm)", 
                        backgroundColor: "var(--bg-secondary)", 
                        border: "1px dashed var(--border-light)",
                        opacity: 0.6
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }} onClick={() => handleToggleTask(t)}>
                        <CheckSquare size={20} style={{ cursor: "pointer", color: "#10B981" }} />
                        <span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontSize: "0.9rem" }}>{t.titulo}</span>
                      </div>
                      <button 
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                        onClick={() => handleDeleteTask(t.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tareas.length === 0 && systemAlerts.length === 0 && (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>¡No tienes pendientes programados para hoy!</div>
            )}
          </div>
        </div>

        {/* Corporate Agenda Details Card */}
        <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={20} color="var(--purple-base)" /> Feriados y Eventos Especiales
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Listado de fechas clave corporativas. El sistema creará avisos en la recepción 8 días antes para feriados y 5 días antes para eventos.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "350px", overflowY: "auto", padding: "4px" }}>
            {feriados.map((item) => {
              const dateObj = new Date(item.fecha);
              const formattedDate = dateObj.toLocaleDateString("es-ES", { day: 'numeric', month: 'long', year: 'numeric' });
              return (
                <div 
                  key={item.id}
                  style={{ 
                    padding: "12px", 
                    borderRadius: "var(--radius-sm)", 
                    backgroundColor: "var(--bg-primary)",
                    borderLeft: `4px solid ${item.tipo === "feriado" ? "var(--pink-base)" : "var(--purple-base)"}`,
                    boxShadow: "var(--shadow-sm)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{item.titulo}</strong>
                    <span style={{ 
                      fontSize: "0.7rem", 
                      padding: "2px 6px", 
                      borderRadius: "10px",
                      fontWeight: 600,
                      backgroundColor: item.tipo === "feriado" ? "var(--pink-light)" : "var(--purple-light)",
                      color: item.tipo === "feriado" ? "var(--pink-dark)" : "var(--purple-dark)"
                    }}>{item.tipo?.toUpperCase()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      📅 {formattedDate}
                    </span>
                    <span style={{ fontSize: "0.7rem", padding: "1px 5px", borderRadius: "4px", backgroundColor: item.repeticion === "anual" ? "#D1FAE5" : "var(--bg-secondary)", color: item.repeticion === "anual" ? "#065F46" : "var(--text-muted)", border: item.repeticion === "anual" ? "none" : "1px solid var(--border-soft)" }}>
                      {item.repeticion === "anual" ? "Anual" : "Una vez"}
                    </span>
                  </div>
                </div>
              );
            })}
            {feriados.length === 0 && (
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>No hay fechas corporativas registradas.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
