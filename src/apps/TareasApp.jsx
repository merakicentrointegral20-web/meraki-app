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
  const [assignee, setAssignee] = useState("Joshua");

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

  // HOLIDAY AND EVENT ALERTS ENGINE WITH WEEKEND SHIFTING
  const getSystemAlerts = () => {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    feriados.forEach(item => {
      const eventDate = new Date(item.fecha);
      eventDate.setHours(0, 0, 0, 0);

      // 1. Calculate default trigger days in advance
      const daysAhead = item.tipo === "feriado" ? 8 : 5;
      
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

      // Check if we should trigger the alert today (or if we are past it but before the event)
      // Trigger if today matches the shifted alertDate OR if today is between the alertDate and the eventDate
      if (today >= alertDate && today <= eventDate) {
        const daysLeft = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `alert_${item.id}`,
          titulo: `¡ALERTA CORPORATIVA!: Se aproxima el ${item.tipo === "feriado" ? "FERIADO" : "EVENTO"} "${item.titulo}" en ${daysLeft} días (${item.fecha}).`,
          tipo: item.tipo,
          originalAlertDate: new Date(new Date(item.fecha).setDate(new Date(item.fecha).getDate() - daysAhead)).toISOString().split('T')[0],
          shiftedAlertDate: alertDate.toISOString().split('T')[0],
          daysLeft
        });
      }
    });

    return alerts;
  };

  const systemAlerts = getSystemAlerts();

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
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
                <option value="Joshua">Asignar a Joshua</option>
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
            {systemAlerts.map(alert => (
              <div 
                key={alert.id}
                style={{ 
                  backgroundColor: alert.tipo === "feriado" ? "#FEE2E2" : "var(--purple-light)",
                  border: `1px solid ${alert.tipo === "feriado" ? "var(--pink-pastel-soft)" : "var(--purple-pastel-soft)"}`,
                  color: alert.tipo === "feriado" ? "var(--pink-dark)" : "var(--purple-dark)",
                  padding: "12px", 
                  borderRadius: "var(--radius-sm)", 
                  display: "flex", 
                  gap: "12px", 
                  alignItems: "flex-start",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
              >
                <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>{alert.titulo}</strong>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    🔔 Alerta calculada originalmente para fin de semana y desplazada automáticamente al <strong>Viernes ({alert.shiftedAlertDate})</strong> para evitar olvidos.
                  </div>
                </div>
              </div>
            ))}

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
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    📅 {formattedDate}
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
