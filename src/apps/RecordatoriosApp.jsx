import React, { useState, useEffect } from "react";
import { subscribeToCollection, getCollection, updateDocument } from "../db";
import { Send, CheckCircle2, AlertCircle, Play, ChevronRight, MessageSquare, Calendar, RefreshCw } from "lucide-react";

const getLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatTargetDateLabel = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()} de ${monthNames[dateObj.getMonth()]}`;
};

const getWeeklyTargetMonday = (dateObj) => {
  const day = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  // Calculate Monday of the selected date's week:
  const daysToSub = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToSub);
  
  // If the selected date is Thursday, Friday, Saturday, or Sunday, we want NEXT week's Monday (add 7 days):
  if (day === 0 || day >= 4) {
    d.setDate(d.getDate() + 7);
  }
  return d;
};

const getMondayOfDate = (dateObj) => {
  const day = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const daysToSub = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToSub);
  return d;
};

export default function RecordatoriosApp() {
  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [terapeutas, setTerapeutas] = useState([]);
  const [recordatoriosEnviados, setRecordatoriosEnviados] = useState({}); // { [date]: { [patientId]: true } }
  
  // Tab states: 'diario' | 'semanal'
  const activeTab = "diario";
  const [targetDate, setTargetDate] = useState("");
  
  // Weekly batch states
  const [selectedWeekStart, setSelectedWeekStart] = useState("");

  const todayObj = new Date();
  const currentMonday = getMondayOfDate(todayObj);
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  const formatMondayLabel = (mondayObj) => {
    const d = String(mondayObj.getDate()).padStart(2, '0');
    const m = String(mondayObj.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
  };
  
  // Assistant states
  const [assistantActive, setAssistantActive] = useState(false);
  const [currentAssistantIdx, setCurrentAssistantIdx] = useState(0);
  const [assistantQueue, setAssistantQueue] = useState([]);
  const [countdown, setCountdown] = useState(0);

  // Set automatic daily date based on today's day of week and scheduled Saturday appointments
  useEffect(() => {
    if (citas.length === 0) return;
    
    const calculateTargetDate = (citasList) => {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      const getLocalDateString = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      let target = new Date();
      
      if (dayOfWeek === 5) {
        // Today is Friday. Check if Saturday has appointments.
        const sat = new Date(today);
        sat.setDate(today.getDate() + 1);
        const satStr = getLocalDateString(sat);
        const hasSatAppointments = citasList.some(c => c.fecha === satStr && c.estadoAsistencia !== "falto_justificado");
        
        if (hasSatAppointments) {
          target.setDate(today.getDate() + 1); // Saturday
        } else {
          target.setDate(today.getDate() + 3); // Monday
        }
      } else if (dayOfWeek === 6) {
        // Today is Saturday. Target is Monday.
        target.setDate(today.getDate() + 2); // Monday
      } else if (dayOfWeek === 0) {
        // Today is Sunday. Target is Monday.
        target.setDate(today.getDate() + 1); // Monday
      } else {
        // Today is Mon, Tue, Wed, Thu. Target is tomorrow.
        target.setDate(today.getDate() + 1);
      }
      
      return getLocalDateString(target);
    };

    const dateStr = calculateTargetDate(citas);
    setTargetDate(dateStr);
  }, [citas]);

  // Set default weekly date on load, and load saved state
  useEffect(() => {
    const today = new Date();
    const targetMonday = getWeeklyTargetMonday(today);
    setSelectedWeekStart(getLocalDateString(targetMonday));
    
    // Load sent recordatorios state from localstorage
    const loadState = () => {
      const saved = localStorage.getItem("meraki_sent_recordatorios");
      if (saved) {
        setRecordatoriosEnviados(JSON.parse(saved));
      } else {
        setRecordatoriosEnviados({});
      }
    };
    loadState();

    const handleStorageChange = (e) => {
      if (e.key === "meraki_sent_recordatorios") {
        loadState();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const handleFocus = () => loadState();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    const unsubCitas = subscribeToCollection("citas", setCitas);
    const unsubPacientes = subscribeToCollection("pacientes", setPacientes);
    const unsubTerapeutas = subscribeToCollection("terapeutas", setTerapeutas);
    return () => {
      unsubCitas();
      unsubPacientes();
      unsubTerapeutas();
    };
  }, []);

  const saveSentState = (date, patientId) => {
    const updated = {
      ...recordatoriosEnviados,
      [date]: {
        ...(recordatoriosEnviados[date] || {}),
        [patientId]: true
      }
    };
    setRecordatoriosEnviados(updated);
    localStorage.setItem("meraki_sent_recordatorios", JSON.stringify(updated));
  };

  // 1. DAILY RECORDATORIOS LOGIC
  const getDailyQueue = () => {
    if (!targetDate) return [];
    // Get all appointments scheduled for the targetDate
    const dayAppointments = citas.filter(c => c.fecha === targetDate && c.estadoAsistencia !== "falto_justificado");
    
    // Group by patient representative contact
    const grouped = {};
    dayAppointments.forEach(c => {
      const patient = pacientes.find(p => p.id === c.pacienteId);
      if (!patient) return;
      
      const therapist = terapeutas.find(t => t.id === c.terapeutaId);

      if (!grouped[c.pacienteId]) {
        grouped[c.pacienteId] = {
          pacienteId: c.pacienteId,
          pacienteNombre: c.pacienteNombre,
          representante: patient.representante,
          telefono: patient.telefono,
          terapias: []
        };
      }
      grouped[c.pacienteId].terapias.push({
        hora: c.horaInicio,
        servicio: c.servicioNombre,
        terapeuta: therapist?.nombre || "Terapeuta"
      });
    });

    return Object.values(grouped);
  };

  // 2. WEEKLY RECORDATORIOS LOGIC
  const getWeeklyQueue = () => {
    if (!selectedWeekStart) return [];
    const [year, month, day] = selectedWeekStart.split("-").map(Number);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(year, month - 1, day + i);
      dates.push(getLocalDateString(d));
    }

    const weekAppointments = citas.filter(c => dates.includes(c.fecha) && c.estadoAsistencia !== "falto_justificado");
    
    const grouped = {};
    weekAppointments.forEach(c => {
      const patient = pacientes.find(p => p.id === c.pacienteId);
      if (!patient) return;

      const therapist = terapeutas.find(t => t.id === c.terapeutaId);

      if (!grouped[c.pacienteId]) {
        grouped[c.pacienteId] = {
          pacienteId: c.pacienteId,
          pacienteNombre: c.pacienteNombre,
          representante: patient.representante,
          telefono: patient.telefono,
          citas: []
        };
      }
      
      grouped[c.pacienteId].citas.push({
        fecha: c.fecha,
        hora: c.horaInicio,
        terapeuta: therapist?.nombre || "Terapeuta"
      });
    });

    // Sort chronologically
    Object.values(grouped).forEach(item => {
      item.citas.sort((a, b) => {
        const dateComp = a.fecha.localeCompare(b.fecha);
        if (dateComp !== 0) return dateComp;
        return a.hora.localeCompare(b.hora);
      });
    });

    return Object.values(grouped);
  };

  const DAYS_SHORT = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  // Message formatters
  const getDailyMessage = (item) => {
    const [year, month, day] = targetDate.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    
    const fmtDateDaily = (dObj) => {
      const dayNames = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
      const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
      const dayName = dayNames[dObj.getDay()];
      const mName = monthNames[dObj.getMonth()];
      return `${dayName}, ${String(dObj.getDate()).padStart(2, '0')} DE ${mName} DEL ${dObj.getFullYear()}`;
    };

    const textDate = fmtDateDaily(dateObj);
    const therapiesText = item.terapias.map(t => `• *${t.servicio.toUpperCase()}* a las *${t.hora}* con *${t.terapeuta.toUpperCase()}*`).join("\n");
    
    const localTodayStr = getLocalDateString(new Date());
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const localTomorrowStr = getLocalDateString(tomorrowObj);
    
    let relativeDay = "";
    if (targetDate === localTodayStr) {
      relativeDay = "hoy";
    } else if (targetDate === localTomorrowStr) {
      relativeDay = "mañana";
    } else {
      relativeDay = "el día";
    }
    
    return `¡Hola *${item.representante.toUpperCase()}*! 👋\n\n` +
           `Te recordamos la cita de *${item.pacienteNombre.toUpperCase()}* en *MERAKI* 🧘‍♀️ para ${relativeDay} *${textDate}*:\n` +
           `${therapiesText}\n\n` +
           `Por favor, llega *a tiempo* ⏳ para asegurar su atención. Según nuestras políticas, la inasistencia podría resultar en la *pérdida de su turno* y la necesidad de cancelarlo. Si surge alguna enfermedad o calamidad, te pedimos *justificarla con pruebas documentales* 📝, las cuales serán revisadas por nuestra administración.\n\n` +
           `¡Te esperamos en *MERAKI*! ✨📌 Importante: Al no recibir respuesta a este mensaje, se asume que el horario ha sido aceptado. En caso de requerir reprogramación, es necesario notificar inmediatamente al momento de recibir el horario.`;
  };

  const getWeeklyMessage = (item) => {
    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const dayNames = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
    
    let citasText = "";
    item.citas.forEach((cita, index) => {
      const [cy, cm, cd] = cita.fecha.split("-").map(Number);
      const dateObj = new Date(cy, cm - 1, cd);
      const dayName = dayNames[dateObj.getDay()];
      const mName = monthNames[cm - 1];
      
      citasText += `• Sesión ${index + 1}: *${dayName}, ${String(cd).padStart(2, '0')} de ${mName} del ${cy}*, a las *${cita.hora}* con *${cita.terapeuta.toUpperCase()}*.\n`;
    });

    return `¡Hola *${item.representante.toUpperCase()}*! 👋\n\n` +
           `Te recordamos las sesiones programadas para *${item.pacienteNombre.toUpperCase()}* en *MERAKI* 🧘‍♀️:\n` +
           `${citasText}\n` +
           `Por favor, llega *a tiempo* ⏳ para asegurar su atención. Según nuestras políticas, la inasistencia podría resultar en la *pérdida de su turno* y la necesidad de cancelarlo. Si surge alguna enfermedad o calamidad, te pedimos *justificarla con pruebas documentales* 📝, las cuales serán revisadas por nuestra administración.\n\n` +
           `¡Te esperamos en *MERAKI*! ✨📌 Importante: Al no recibir respuesta a este mensaje, se asume que el horario ha sido aceptado. En caso de requerir reprogramación, es necesario notificar inmediatamente al momento de recibir el horario.`;
  };

  const getTargetDateText = () => {
    if (!targetDate) return "";
    try {
      const [year, month, day] = targetDate.split("-").map(Number);
      const dateObj = new Date(year, month - 1, day);
      return dateObj.toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) {
      return targetDate;
    }
  };

  const getIsSkippedDate = () => {
    if (!targetDate) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrow);
    return targetDate !== tomorrowStr;
  };

  const sendWhatsApp = (telefono, mensaje, patientId, dateKey) => {
    const formattedPhone = telefono.replace(/\s+/g, '').replace(/^0/, '593'); // Format for Ecuador (Meraki location: La Troncal / Guayaquil)
    const encodedText = encodeURIComponent(mensaje);
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
    
    // Open in a new tab
    window.open(url, "_blank");
    
    // Save state
    saveSentState(dateKey, patientId);
  };

  const handleResetSentState = (patientId) => {
    const dateKey = activeTab === "diario" ? targetDate : selectedWeekStart;
    const updated = { ...recordatoriosEnviados };
    if (updated[dateKey]) {
      delete updated[dateKey][patientId];
      if (Object.keys(updated[dateKey]).length === 0) {
        delete updated[dateKey];
      }
    }
    setRecordatoriosEnviados(updated);
    localStorage.setItem("meraki_sent_recordatorios", JSON.stringify(updated));
  };

  const handleResetAllSentState = () => {
    if (confirm("¿Estás seguro de marcar todos los recordatorios de este período como PENDIENTES?")) {
      const dateKey = activeTab === "diario" ? targetDate : selectedWeekStart;
      const updated = { ...recordatoriosEnviados };
      delete updated[dateKey];
      setRecordatoriosEnviados(updated);
      localStorage.setItem("meraki_sent_recordatorios", JSON.stringify(updated));
    }
  };

  // ASSISTANT SEQUENTIAL SYSTEM
  const startAssistant = (queue) => {
    if (queue.length === 0) {
      alert("No hay recordatorios pendientes en la lista.");
      return;
    }
    setAssistantQueue(queue);
    setCurrentAssistantIdx(0);
    setAssistantActive(true);
    setCountdown(0);
  };

  const executeAssistantSend = () => {
    const item = assistantQueue[currentAssistantIdx];
    if (!item) return;

    const msg = activeTab === 'diario' ? getDailyMessage(item) : getWeeklyMessage(item);
    const dateKey = activeTab === 'diario' ? targetDate : selectedWeekStart;
    
    sendWhatsApp(item.telefono, msg, item.pacienteId, dateKey);

    // If there is a next one, set countdown to delay security click and advance
    if (currentAssistantIdx < assistantQueue.length - 1) {
      setCurrentAssistantIdx(currentAssistantIdx + 1);
      setCountdown(4); // 4 seconds delay before allowing next click to prevent WhatsApp detection
    } else {
      setAssistantActive(false);
      alert("¡Todos los recordatorios del asistente han sido procesados!");
    }
  };

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const dailyQueue = getDailyQueue();
  const weeklyQueue = getWeeklyQueue();
  const currentQueue = activeTab === "diario" ? dailyQueue : weeklyQueue;
  const currentDateKey = activeTab === "diario" ? targetDate : selectedWeekStart;

  const countSent = currentQueue.filter(item => recordatoriosEnviados[currentDateKey]?.[item.pacienteId]).length;
  const countPending = currentQueue.length - countSent;

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Envíos de Recordatorios</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Notifica a los representantes vía WhatsApp Web de forma segura.</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{
            padding: "8px 16px",
            backgroundColor: "white",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-light)",
            fontSize: "0.9rem",
            fontWeight: "600",
            color: "var(--purple-dark)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "var(--shadow-xs)"
          }}>
            <Calendar size={16} />
            <span>Recordatorios para: {formatTargetDateLabel(targetDate)}</span>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => startAssistant(currentQueue.filter(item => !recordatoriosEnviados[currentDateKey]?.[item.pacienteId]))}
            disabled={countPending === 0}
          >
            <Play size={16} /> Iniciar Envío en Secuencia ({countPending} pendientes)
          </button>
          {countSent > 0 && (
            <button 
              className="btn btn-secondary"
              onClick={handleResetAllSentState}
              style={{ display: "flex", gap: "6px", alignItems: "center" }}
            >
              <RefreshCw size={14} /> Restablecer Todo
            </button>
          )}
        </div>
      </div>



      {/* Alerta de Salto de Agenda (para días no laborables o sin citas) */}
      {activeTab === "diario" && getIsSkippedDate() && (
        <div style={{
          backgroundColor: "var(--purple-light)",
          color: "var(--purple-dark)",
          padding: "12px 18px",
          borderRadius: "var(--radius-sm)",
          fontSize: "0.85rem",
          fontWeight: "600",
          marginBottom: "20px",
          border: "1px solid var(--purple-pastel-soft)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          💡 <span><strong>Salto de Agenda:</strong> El sistema seleccionó automáticamente el **{getTargetDateText()}** porque no hay citas programadas para fechas intermedias. ¡Puedes adelantar los envíos de este día hoy!</span>
        </div>
      )}

      {/* Stats bar */}
      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Total Clientes</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--text-main)" }}>{currentQueue.length}</span>
        </div>
        <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px", borderLeft: "4px solid #10B981" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Mensajes Enviados</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "#10B981" }}>{countSent}</span>
        </div>
        <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px", borderLeft: "4px solid var(--purple-base)" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Pendientes de Envío</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--purple-base)" }}>{countPending}</span>
        </div>
      </div>

      {/* Sequence Assistant overlay */}
      {assistantActive && assistantQueue[currentAssistantIdx] && (
        <div className="responsive-flex" style={{ backgroundColor: "var(--purple-light)", border: "1px solid var(--purple-pastel-soft)", padding: "20px", borderRadius: "var(--radius-md)", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--purple-base)", color: "white", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "bold" }}>
              {currentAssistantIdx + 1}/{assistantQueue.length}
            </div>
            <div>
              <h4 style={{ fontWeight: 600, color: "var(--purple-dark)" }}>Asistente de Envío en Secuencia</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Enviando a: <strong>{assistantQueue[currentAssistantIdx].representante}</strong> (Paciente: {assistantQueue[currentAssistantIdx].pacienteNombre}) | Celular: {assistantQueue[currentAssistantIdx].telefono}
              </p>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {countdown > 0 ? (
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Retraso de seguridad: {countdown}s...</span>
            ) : null}
            <button 
              className="btn btn-primary" 
              onClick={executeAssistantSend} 
              disabled={countdown > 0}
            >
              <Send size={16} /> Abrir y Enviar Mensaje
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                if (currentAssistantIdx < assistantQueue.length - 1) {
                  setCurrentAssistantIdx(currentAssistantIdx + 1);
                } else {
                  setAssistantActive(false);
                }
              }}
            >
              Omitir <ChevronRight size={16} />
            </button>
            <button className="btn btn-danger" onClick={() => setAssistantActive(false)}>Detener</button>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
        <div className="responsive-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              <th style={{ padding: "12px 8px" }}>NINO / PACIENTE</th>
              <th style={{ padding: "12px 8px" }}>REPRESENTANTE</th>
              <th style={{ padding: "12px 8px" }}>CELULAR</th>
              <th style={{ padding: "12px 8px" }}>RESUMEN DE CITAS</th>
              <th style={{ padding: "12px 8px" }}>ESTADO ENVÍO</th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {currentQueue.map((item) => {
              const isSent = recordatoriosEnviados[currentDateKey]?.[item.pacienteId];
              const msg = activeTab === 'diario' ? getDailyMessage(item) : getWeeklyMessage(item);
              
              let citasSummary = "";
              if (activeTab === 'diario') {
                citasSummary = item.terapias.map(t => `${t.hora} (${t.servicio})`).join(", ");
              } else {
                citasSummary = item.citas.map(c => `${c.fecha.substring(5)} ${c.hora}`).join(", ");
              }

              return (
                <tr key={item.pacienteId} style={{ borderBottom: "1px solid var(--border-soft)", height: "60px" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 500 }}>{item.pacienteNombre}</td>
                  <td style={{ padding: "12px 8px" }}>{item.representante}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{item.telefono}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.8rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "250px" }}>
                    {citasSummary}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {isSent ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#10B981", fontSize: "0.8rem", fontWeight: 600 }}>
                          <CheckCircle2 size={16} /> Enviado
                        </span>
                        <button 
                          style={{ border: "none", background: "none", padding: 0, cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
                          title="Restablecer a Pendiente"
                          onClick={() => handleResetSentState(item.pacienteId)}
                        >
                          <RefreshCw size={12} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--purple-base)", fontSize: "0.8rem", fontWeight: 600 }}>
                        <AlertCircle size={16} /> Pendiente
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <button 
                      className={`btn ${isSent ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      onClick={() => sendWhatsApp(item.telefono, msg, item.pacienteId, currentDateKey)}
                    >
                      <Send size={14} /> {isSent ? 'Reenviar' : 'Enviar'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {currentQueue.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                  No hay terapias programadas para esta fecha.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
