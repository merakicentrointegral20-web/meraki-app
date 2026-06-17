import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, getCollection, registrarLog } from "../db";
import { useAuth } from "../context/AuthContext";
import { Calendar as CalendarIcon, Clock, User, Sparkles, RefreshCw, Trash2, ArrowLeftRight, Check, AlertTriangle, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TIME_SLOTS = [
  "08:15", "09:00", "09:45", "10:30", "11:15", "12:00",
  "13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15"
];

const getLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
};

const parseLocalDateStr = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getMondayOfDate = (dateObj) => {
  const day = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const daysToSub = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToSub);
  return d;
};

const getCleanFirstName = (fullName) => {
  if (!fullName) return "";
  let name = fullName.replace(/^(MSc\.|Psic\.|Lic\.|Dr\.|Dra\.)\s+/i, "");
  return name.split(" ")[0];
};

const resetPatientReminderStatus = (pacienteId, fechaStr) => {
  try {
    const saved = localStorage.getItem("meraki_sent_recordatorios");
    if (!saved) return;
    const recordatorios = JSON.parse(saved);
    let changed = false;
    
    if (recordatorios[fechaStr] && recordatorios[fechaStr][pacienteId]) {
      delete recordatorios[fechaStr][pacienteId];
      if (Object.keys(recordatorios[fechaStr]).length === 0) {
        delete recordatorios[fechaStr];
      }
      changed = true;
    }
    
    const [y, m, d] = fechaStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const day = dateObj.getDay();
    const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dateObj.setDate(diff));
    
    const yMon = monday.getFullYear();
    const mMon = String(monday.getMonth() + 1).padStart(2, '0');
    const dMon = String(monday.getDate()).padStart(2, '0');
    const mondayStr = `${yMon}-${mMon}-${dMon}`;
    
    if (recordatorios[mondayStr] && recordatorios[mondayStr][pacienteId]) {
      delete recordatorios[mondayStr][pacienteId];
      if (Object.keys(recordatorios[mondayStr]).length === 0) {
        delete recordatorios[mondayStr];
      }
      changed = true;
    }
    
    if (changed) {
      localStorage.setItem("meraki_sent_recordatorios", JSON.stringify(recordatorios));
    }
  } catch (err) {
    console.error("Error resetting patient reminder status in localStorage:", err);
  }
};

export default function AgendaApp() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.rol === "administrador";

  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [terapeutas, setTerapeutas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [activeTerapeutaId, setActiveTerapeutaId] = useState("");
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
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showParentsShareModal, setShowParentsShareModal] = useState(false);
  const [parentsSearchQuery, setParentsSearchQuery] = useState("");
  const [recordatoriosEnviados, setRecordatoriosEnviados] = useState({});

  // Justifications
  const [justificacion, setJustificacion] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteJustificacion, setDeleteJustificacion] = useState("");

  // Form states
  const [newCita, setNewCita] = useState({
    pacienteId: "", servicioId: "", fecha: "", horaInicio: "",
    costo: 20, esFija: false, cobrada: true, estadoAsistencia: "pendiente"
  });
  const [selectedCita, setSelectedCita] = useState(null);
  const [swapTargetCitaId, setSwapTargetCitaId] = useState("");
  const [dragOverSlot, setDragOverSlot] = useState(null);
  
  const dateInputRef = useRef(null);

  const handlePrevWeek = () => {
    if (!selectedWeekStart) return;
    const start = parseLocalDateStr(selectedWeekStart);
    start.setDate(start.getDate() - 7);
    setSelectedWeekStart(getLocalDateStr(start));
  };

  const handleNextWeek = () => {
    if (!selectedWeekStart) return;
    const start = parseLocalDateStr(selectedWeekStart);
    start.setDate(start.getDate() + 7);
    setSelectedWeekStart(getLocalDateStr(start));
  };

  const getWeekRangeLabel = (startStr) => {
    if (!startStr) return "";
    const [year, month, day] = startStr.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Sunday
    
    const formatDayMonth = (dateObj) => {
      const d = String(dateObj.getDate()).padStart(2, '0');
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const y = dateObj.getFullYear();
      return `${d}/${m}/${y}`;
    };

    return `Del Lunes ${formatDayMonth(start)} al Domingo ${formatDayMonth(end)}`;
  };

  // Load initial week start
  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));
    
    // If today is Thursday, Friday, Saturday, or Sunday, default to next week:
    if (day === 0 || day >= 4) {
      monday.setDate(monday.getDate() + 7);
    }
    setSelectedWeekStart(getLocalDateStr(monday));
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

  // Set default active therapist once loaded (excluding receptionist)
  useEffect(() => {
    if (terapeutas.length > 0 && !activeTerapeutaId) {
      const activeTers = terapeutas.filter(t => !t.nombre.includes("Recepción") && !t.nombre.includes("Recepcion") && !t.nombre.includes("Josua") && !t.nombre.includes("Joshua"));
      if (activeTers.length > 0) {
        setActiveTerapeutaId(activeTers[0].id);
      }
    }
  }, [terapeutas, activeTerapeutaId]);

  // Adjust cost when service is selected
  useEffect(() => {
    if (newCita.servicioId) {
      const srv = servicios.find(s => s.id === newCita.servicioId);
      if (srv) {
        setNewCita(prev => ({ ...prev, costo: srv.costo }));
      }
    }
  }, [newCita.servicioId, servicios]);

  // Sincronizar recordatoriosEnviados con localStorage
  useEffect(() => {
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

  const getParentsQueue = () => {
    if (!selectedWeekStart || !activeTerapeutaId) return [];
    
    // Calculate week range
    const start = parseLocalDateStr(selectedWeekStart);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(getLocalDateStr(d));
    }
    
    const weekCitas = citas.filter(c => 
      c.terapeutaId === activeTerapeutaId && 
      dates.includes(c.fecha) &&
      c.estadoAsistencia !== "falto_justificado"
    );
    
    const grouped = {};
    weekCitas.forEach(c => {
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
    
    const result = Object.values(grouped);
    result.forEach(item => {
      item.citas.sort((a, b) => {
        const dateComp = a.fecha.localeCompare(b.fecha);
        if (dateComp !== 0) return dateComp;
        return a.hora.localeCompare(b.hora);
      });
    });
    
    result.sort((a, b) => (a.pacienteNombre || "").localeCompare(b.pacienteNombre || "", "es", { sensitivity: "base" }));
    return result;
  };

  const getParentWeeklyMessage = (item) => {
    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const dayNames = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
    
    let citasText = "";
    item.citas.forEach((cita) => {
      const [cy, cm, cd] = cita.fecha.split("-").map(Number);
      const dateObj = new Date(cy, cm - 1, cd);
      const dayName = dayNames[dateObj.getDay()];
      const mName = monthNames[dateObj.getMonth()];
      citasText += `• *${dayName} ${cd} DE ${mName.toUpperCase()}* a las *${cita.hora}* con *${cita.terapeuta.toUpperCase()}*\n`;
    });
    
    return `¡Hola *${item.representante.toUpperCase()}*! 👋\n\n` +
           `Te recordamos las sesiones programadas para *${item.pacienteNombre.toUpperCase()}* en *MERAKI* 🧘‍♀️:\n` +
           `${citasText}\n` +
           `Por favor, confírmanos tu asistencia respondiendo a este mensaje. ¡Te esperamos! ✨`;
  };

  const handleSendWeeklyParentWhatsApp = (item) => {
    const msg = getParentWeeklyMessage(item);
    const formattedPhone = item.telefono.replace(/\s+/g, '').replace(/^0/, '593');
    const encodedText = encodeURIComponent(msg);
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
    
    window.open(url, "_blank");
    
    const dateKey = selectedWeekStart;
    const updated = {
      ...recordatoriosEnviados,
      [dateKey]: {
        ...(recordatoriosEnviados[dateKey] || {}),
        [item.pacienteId]: true
      }
    };
    setRecordatoriosEnviados(updated);
    localStorage.setItem("meraki_sent_recordatorios", JSON.stringify(updated));
    
    registrarLog(
      currentUser,
      "Agenda (Notificación Semanal Padre WA)",
      `ENVIÓ la agenda semanal por WhatsApp a representante de ${item.pacienteNombre}`
    );
  };

  const handleResetParentWeeklyState = (patientId) => {
    const dateKey = selectedWeekStart;
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

  const handleResetAllParentsWeeklyState = () => {
    if (confirm("¿Estás seguro de marcar todos los recordatorios semanales de este terapeuta como PENDIENTES?")) {
      const dateKey = selectedWeekStart;
      const updated = { ...recordatoriosEnviados };
      if (updated[dateKey]) {
        const parentsQueue = getParentsQueue();
        parentsQueue.forEach(item => {
          if (updated[dateKey]) {
            delete updated[dateKey][item.pacienteId];
          }
        });
        if (updated[dateKey] && Object.keys(updated[dateKey]).length === 0) {
          delete updated[dateKey];
        }
      }
      setRecordatoriosEnviados(updated);
      localStorage.setItem("meraki_sent_recordatorios", JSON.stringify(updated));
    }
  };

  const getWeekDays = () => {
    if (!selectedWeekStart) return [];
    const days = [];
    const start = parseLocalDateStr(selectedWeekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({
        name: DAYS_OF_WEEK[i],
        dateStr: getLocalDateStr(d),
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

          resetPatientReminderStatus(draggingCita.pacienteId, sourceDate);
          resetPatientReminderStatus(draggingCita.pacienteId, targetDate);
          resetPatientReminderStatus(existingCita.pacienteId, sourceDate);
          resetPatientReminderStatus(existingCita.pacienteId, targetDate);

          await registrarLog(
            currentUser,
            "Agenda (Intercambio)",
            `Intercambió por arrastre la cita de ${draggingCita.pacienteNombre} (${sourceDate} ${sourceTime}) con la de ${existingCita.pacienteNombre} (${targetDate} ${targetTime})`
          );

          alert("Horarios intercambiados con éxito.");
          
          const therapist = terapeutas.find(t => t.id === draggingCita.terapeutaId);
          if (therapist && therapist.telefono) {
            if (confirm(`¿Deseas notificar los cambios de horario a ${therapist.nombre} por WhatsApp?`)) {
              const msg = `Hola ${therapist.nombre}, te saluda MERAKI. Se han intercambiado los horarios de dos sesiones en tu agenda:\n- *${draggingCita.pacienteNombre}* pasa a: ${targetDate} a las ${targetTime}\n- *${existingCita.pacienteNombre}* pasa a: ${sourceDate} a las ${sourceTime}\n\n¡Gracias!`;
              const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "").replace(/^0/, "593")}&text=${encodeURIComponent(msg)}`;
              window.open(url, "_blank");
              await registrarLog(
                currentUser,
                "Agenda (Notificación WA)",
                `ENVIÓ el mensaje de intercambio de horarios por WhatsApp a ${therapist.nombre} para las sesiones de ${draggingCita.pacienteNombre} y ${existingCita.pacienteNombre}`
              );
            } else {
              await registrarLog(
                currentUser,
                "Agenda (Notificación WA)",
                `OMITIÓ/CANCELÓ el envío del mensaje de intercambio de horarios por WhatsApp a ${therapist.nombre} para las sesiones de ${draggingCita.pacienteNombre} y ${existingCita.pacienteNombre}`
              );
            }
          }

          // Notify patients about the swap
          await triggerPatientWhatsAppChangeNotification(draggingCita, sourceDate, sourceTime, targetDate, targetTime);
          await triggerPatientWhatsAppChangeNotification(existingCita, targetDate, targetTime, sourceDate, sourceTime);
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
        resetPatientReminderStatus(draggingCita.pacienteId, oldFecha);
        resetPatientReminderStatus(draggingCita.pacienteId, targetDate);
        await registrarLog(
          currentUser,
          "Agenda (Reprogramación)",
          `Reprogramó por arrastre la cita de ${draggingCita.pacienteNombre} de ${oldFecha} ${oldHora} a ${targetDate} ${targetTime}`
        );
        triggerWhatsAppChangeNotification(draggingCita, oldFecha, oldHora, targetDate, targetTime);
        await triggerPatientWhatsAppChangeNotification(draggingCita, oldFecha, oldHora, targetDate, targetTime);
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
      setJustificacion("");
      setDeleteJustificacion("");
      setShowDeleteConfirm(false);
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
      resetPatientReminderStatus(citaData.pacienteId, citaData.fecha);
      await registrarLog(
        currentUser,
        "Agenda (Creación)",
        `Programó cita para ${citaData.pacienteNombre} el ${citaData.fecha} a las ${citaData.horaInicio}`
      );
      
      // If it's a fixed appointment, we will also copy it for the next 4 weeks as a demonstration
      if (newCita.esFija) {
        const start = parseLocalDateStr(newCita.fecha);
        for (let i = 1; i <= 4; i++) {
          const nextDate = new Date(start);
          nextDate.setDate(start.getDate() + (7 * i));
          const futureCita = {
            ...citaData,
            fecha: getLocalDateStr(nextDate)
          };
          await addDocument("citas", futureCita);
          resetPatientReminderStatus(futureCita.pacienteId, futureCita.fecha);
          await registrarLog(
            currentUser,
            "Agenda (Creación Recurrente)",
            `Programó cita fija recurrente para ${futureCita.pacienteNombre} el ${futureCita.fecha} a las ${futureCita.horaInicio}`
          );
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
    const oldStatus = original ? original.estadoAsistencia : "";
    const newStatus = selectedCita.estadoAsistencia;

    if (newStatus === "falto_justificado" && oldStatus !== "falto_justificado" && !isAdmin) {
      if (justificacion.trim().length < 15) {
        alert("⚠️ Debes ingresar una justificación detallada (mínimo 15 caracteres) para marcar Falta Justificada.");
        return;
      }
      try {
        await addDocument("auditoria_agenda", {
          tipoEvento: "falto_justificado",
          citaId: selectedCita.id,
          pacienteNombre: selectedCita.pacienteNombre,
          terapeutaId: selectedCita.terapeutaId,
          terapeutaNombre: terapeutas.find(t => t.id === selectedCita.terapeutaId)?.nombre || "",
          fechaCita: selectedCita.fecha,
          horaCita: selectedCita.horaInicio,
          costoCita: Number(selectedCita.costo),
          usuarioEmail: currentUser?.email || "desconocido",
          usuarioNombre: currentUser?.nombre || "desconocido",
          justificacion: justificacion.trim(),
          fechaServidor: new Date().toISOString()
        });
        await registrarLog(
          currentUser,
          "Agenda (Falta Justificada)",
          `Justificó falta de ${selectedCita.pacienteNombre} el ${selectedCita.fecha} ${selectedCita.horaInicio}. Motivo: ${justificacion.trim()}`
        );
      } catch (err) {
        console.error("Error al registrar auditoría:", err);
      }
    }

    try {
      await updateDocument("citas", selectedCita.id, {
        fecha: selectedCita.fecha,
        horaInicio: selectedCita.horaInicio,
        horaFin: getEndTime(selectedCita.horaInicio),
        costo: Number(selectedCita.costo),
        cobrada: selectedCita.cobrada,
        estadoAsistencia: selectedCita.estadoAsistencia
      });
      resetPatientReminderStatus(selectedCita.pacienteId, oldFecha);
      resetPatientReminderStatus(selectedCita.pacienteId, selectedCita.fecha);
      await registrarLog(
        currentUser,
        "Agenda (Modificación)",
        `Modificó cita de ${selectedCita.pacienteNombre}. Fecha: ${selectedCita.fecha}, Hora: ${selectedCita.horaInicio}, Estado: ${selectedCita.estadoAsistencia}`
      );
      setShowEditModal(false);
      alert("Cita actualizada.");

      if (oldFecha !== selectedCita.fecha || oldHora !== selectedCita.horaInicio) {
        triggerWhatsAppChangeNotification(selectedCita, oldFecha, oldHora, selectedCita.fecha, selectedCita.horaInicio);
        await triggerPatientWhatsAppChangeNotification(selectedCita, oldFecha, oldHora, selectedCita.fecha, selectedCita.horaInicio);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCita = async (deleteMode, citaToUse = selectedCita, justif = "") => {
    // deleteMode: 'only' = only this session, 'all' = this and future ones
    if (!citaToUse) return;

    const finalJustification = justif.trim() || deleteJustificacion.trim() || "Eliminación directa sin justificación requerida";

    try {
      await addDocument("auditoria_agenda", {
        tipoEvento: "eliminacion",
        citaId: citaToUse.id,
        pacienteNombre: citaToUse.pacienteNombre,
        terapeutaId: citaToUse.terapeutaId,
        terapeutaNombre: terapeutas.find(t => t.id === citaToUse.terapeutaId)?.nombre || "",
        fechaCita: citaToUse.fecha,
        horaCita: citaToUse.horaInicio,
        costoCita: Number(citaToUse.costo),
        usuarioEmail: currentUser?.email || "desconocido",
        usuarioNombre: currentUser?.nombre || "desconocido",
        justificacion: finalJustification,
        fechaServidor: new Date().toISOString()
      });
      await registrarLog(
        currentUser,
        "Agenda (Eliminación)",
        `Eliminó cita de ${citaToUse.pacienteNombre} del ${citaToUse.fecha} ${citaToUse.horaInicio}. Justificación: ${finalJustification}`
      );
    } catch (err) {
      console.error("Error al registrar auditoría:", err);
    }

    try {
      const allTxs = await getCollection("transacciones");

      if (deleteMode === 'all' && citaToUse.esFija) {
        // find future recurring appointments for this patient + therapist + time
        const allCitas = await getCollection("citas");
        const future = allCitas.filter(c => 
          c.pacienteId === citaToUse.pacienteId &&
          c.terapeutaId === citaToUse.terapeutaId &&
          c.horaInicio === citaToUse.horaInicio &&
          c.fecha >= citaToUse.fecha
        );
        const futureIds = future.map(c => c.id);

        for (let c of future) {
          await deleteDocument("citas", c.id);
          resetPatientReminderStatus(c.pacienteId, c.fecha);
        }

        // Delete associated transactions
        const associatedTxs = allTxs.filter(t => futureIds.includes(t.citaId));
        for (let tx of associatedTxs) {
          await deleteDocument("transacciones", tx.id);
        }

        await registrarLog(
          currentUser,
          "Agenda (Eliminación Recurrente)",
          `Eliminó cita y serie recurrente de ${citaToUse.pacienteNombre} a partir del ${citaToUse.fecha}`
        );
        alert("Se eliminó esta cita, todas las citas fijas futuras y sus cobros asociados.");
      } else {
        await deleteDocument("citas", citaToUse.id);
        resetPatientReminderStatus(citaToUse.pacienteId, citaToUse.fecha);

        // Delete associated transactions
        const associatedTxs = allTxs.filter(t => t.citaId === citaToUse.id);
        for (let tx of associatedTxs) {
          await deleteDocument("transacciones", tx.id);
        }

        alert("Cita y cobros asociados eliminados.");
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

      resetPatientReminderStatus(selectedCita.pacienteId, sourceDate);
      resetPatientReminderStatus(selectedCita.pacienteId, targetCita.fecha);
      resetPatientReminderStatus(targetCita.pacienteId, sourceDate);
      resetPatientReminderStatus(targetCita.pacienteId, targetCita.fecha);

      setShowSwapModal(false);
      setShowEditModal(false);
      setSwapTargetCitaId("");
      alert(`Horarios intercambiados con éxito entre ${selectedCita.pacienteNombre} y ${targetCita.pacienteNombre}.`);

      // Notify therapist of swap via modal
      const therapist = terapeutas.find(t => t.id === selectedCita.terapeutaId);
      if (therapist && therapist.telefono) {
        if (confirm(`¿Deseas notificar los cambios de intercambio al terapeuta ${therapist.nombre} por WhatsApp?`)) {
          const msg = `Hola ${therapist.nombre}, te saluda MERAKI. Se han intercambiado los horarios de dos sesiones en tu agenda:\n- *${selectedCita.pacienteNombre}* pasa a: ${targetCita.fecha} a las ${targetCita.horaInicio}\n- *${targetCita.pacienteNombre}* pasa a: ${sourceDate} a las ${sourceTime}\n\n¡Gracias!`;
          const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "").replace(/^0/, "593")}&text=${encodeURIComponent(msg)}`;
          window.open(url, "_blank");
          await registrarLog(
            currentUser,
            "Agenda (Notificación WA)",
            `ENVIÓ el mensaje de intercambio de horarios por WhatsApp a ${therapist.nombre} para las sesiones de ${selectedCita.pacienteNombre} y ${targetCita.pacienteNombre}`
          );
        } else {
          await registrarLog(
            currentUser,
            "Agenda (Notificación WA)",
            `OMITIÓ/CANCELÓ el envío del mensaje de intercambio de horarios por WhatsApp a ${therapist.nombre} para las sesiones de ${selectedCita.pacienteNombre} y ${targetCita.pacienteNombre}`
          );
        }
      }

      // Notify patients of swap via modal
      await triggerPatientWhatsAppChangeNotification(selectedCita, sourceDate, sourceTime, targetCita.fecha, targetCita.horaInicio);
      await triggerPatientWhatsAppChangeNotification(targetCita, targetCita.fecha, targetCita.horaInicio, sourceDate, sourceTime);
    } catch (e) {
      console.error(e);
      alert("Error al intercambiar turnos.");
    }
  };

  const handleCopyWeek = async () => {
    if (!selectedWeekStart) return;
    const start = parseLocalDateStr(selectedWeekStart);
    
    const prevMon = new Date(start);
    prevMon.setDate(start.getDate() - 7);
    const prevMonStr = getLocalDateStr(prevMon);
    
    const prevSun = new Date(prevMon);
    prevSun.setDate(prevMon.getDate() + 6);
    const prevSunStr = getLocalDateStr(prevSun);

    // Filter appointments from last week
    const lastWeekCitas = citas.filter(c => c.fecha >= prevMonStr && c.fecha <= prevSunStr);
    if (lastWeekCitas.length === 0) {
      alert("No se encontraron citas en la semana anterior para copiar.");
      return;
    }

    let count = 0;
    try {
      for (let c of lastWeekCitas) {
        // Calculate new date for the current week
        const oldDate = parseLocalDateStr(c.fecha);
        const newDate = new Date(oldDate);
        newDate.setDate(oldDate.getDate() + 7);
        const newDateStr = getLocalDateStr(newDate);

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
          resetPatientReminderStatus(c.pacienteId, newDateStr);
          count++;
        }
      }
      if (count > 0) {
        await registrarLog(
          currentUser,
          "Agenda (Replicación Semanal)",
          `Replicó ${count} citas de la semana anterior para la semana en curso`
        );
        alert(`¡Éxito! Se replicaron ${count} citas de la semana pasada.`);
      } else {
        alert("No había citas de la semana anterior que replicar (o todas colisionan).");
      }
    } catch (e) {
      console.error(e);
      alert("Error al copiar semana.");
    }
  };

  const weekDays = getWeekDays();
  const currentWeekEnd = weekDays.length > 0 ? weekDays[weekDays.length - 1].dateStr : "";

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

    const fmtDateSpanish = (dateStr) => {
      if (!dateStr) return "";
      const dateObj = parseLocalDateStr(dateStr);
      const dayName = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][dateObj.getDay()];
      const monthName = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][dateObj.getMonth()];
      return `${dayName} ${String(dateObj.getDate()).padStart(2, '0')} de ${monthName} del ${dateObj.getFullYear()}`;
    };

    // Calculate Sunday as end of week (selectedWeekStart is Monday)
    const startObj = parseLocalDateStr(selectedWeekStart);
    const endObj = new Date(startObj);
    endObj.setDate(startObj.getDate() + 6); // Sunday
    
    const weekEndSundayStr = getLocalDateStr(endObj);

    const periodStr = `${fmtDateSpanish(selectedWeekStart)} al ${fmtDateSpanish(weekEndSundayStr)}`;

    // Build the message
    let msg = `Hola *${therapist.nombre}*, te saluda MERAKI. Te compartimos tu agenda semanal para el período del *${periodStr}*:\n\n`;

    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    // Group by day
    weekDays.forEach(d => {
      const dayCitas = weekCitas
        .filter(c => c.fecha === d.dateStr)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

      if (dayCitas.length > 0) {
        const mName = monthNames[d.monthNum - 1];
        msg += `*${d.name.toUpperCase()} ${String(d.dayNum).padStart(2, '0')} DE ${mName.toUpperCase()}:*\n`;
        dayCitas.forEach(c => {
          msg += `• ${c.horaInicio} - ${c.horaFin}: ${c.pacienteNombre} (${c.servicioNombre})\n`;
        });
        msg += `\n`;
      }
    });

    msg += `¡Que tengas una excelente semana!`;

    const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "").replace(/^0/, "593")}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const triggerWhatsAppChangeNotification = async (cita, oldFecha, oldHora, newFecha, newHora) => {
    const therapist = terapeutas.find(t => t.id === cita.terapeutaId);
    if (!therapist || !therapist.telefono) return;

    if (confirm(`¿Deseas enviar un aviso de cambio al terapeuta ${therapist.nombre} por WhatsApp?`)) {
      const msg = `Hola ${therapist.nombre}, te saluda MERAKI. Se ha modificado el horario de tu sesión con el paciente ${cita.pacienteNombre}.\n\n*Anterior:* ${oldFecha} a las ${oldHora}\n*Nuevo:* ${newFecha} a las ${newHora}\n\n¡Gracias!`;
      const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "").replace(/^0/, "593")}&text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
      await registrarLog(
        currentUser,
        "Agenda (Notificación WA)",
        `ENVIÓ el mensaje de reprogramación por WhatsApp a ${therapist.nombre} para la sesión de ${cita.pacienteNombre} (${newFecha} ${newHora})`
      );
    } else {
      await registrarLog(
        currentUser,
        "Agenda (Notificación WA)",
        `OMITIÓ/CANCELÓ el envío del mensaje de reprogramación por WhatsApp a ${therapist.nombre} para la sesión de ${cita.pacienteNombre} (${newFecha} ${newHora})`
      );
    }
  };

  const triggerPatientWhatsAppChangeNotification = async (cita, oldFecha, oldHora, newFecha, newHora) => {
    const patient = pacientes.find(p => p.id === cita.pacienteId);
    if (!patient || !patient.telefono) return;

    if (confirm(`¿Deseas enviar un aviso de cambio al representante de ${cita.pacienteNombre} (${patient.representante}) por WhatsApp?`)) {
      const msg = `¡Hola ${patient.representante}! 👋 Te saluda MERAKI. Te notificamos que se ha modificado el horario de la sesión de *${cita.pacienteNombre.toUpperCase()}*:\n\n*Anterior:* ${oldFecha} a las ${oldHora}\n*Nuevo:* ${newFecha} a las ${newHora}\n\nPor favor, confírmanos tu asistencia. ¡Te esperamos! ✨`;
      const formattedPhone = patient.telefono.replace(/[^0-9]/g, "").replace(/^0/, "593");
      const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
      await registrarLog(
        currentUser,
        "Agenda (Notificación Paciente WA)",
        `ENVIÓ el mensaje de reprogramación por WhatsApp a representante de ${cita.pacienteNombre} (${newFecha} ${newHora})`
      );
    } else {
      await registrarLog(
        currentUser,
        "Agenda (Notificación Paciente WA)",
        `OMITIÓ/CANCELÓ el envío del mensaje de reprogramación por WhatsApp a representante de ${cita.pacienteNombre} (${newFecha} ${newHora})`
      );
    }
  };

  const currentTherapist = terapeutas.find(t => t.id === activeTerapeutaId);

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Agenda y Horarios</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Calendario semanal de terapias por profesional.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              className="btn"
              style={{
                padding: "6px 12px",
                fontSize: "0.85rem",
                fontWeight: 600,
                backgroundColor: selectedWeekStart === getLocalDateStr(currentMonday) ? "var(--purple-base)" : "var(--border-light)",
                color: selectedWeekStart === getLocalDateStr(currentMonday) ? "white" : "var(--text-muted)",
                transition: "all 0.2s"
              }}
              onClick={() => setSelectedWeekStart(getLocalDateStr(currentMonday))}
            >
              Esta Semana (Lun {formatMondayLabel(currentMonday)})
            </button>
            <button
              type="button"
              className="btn"
              style={{
                padding: "6px 12px",
                fontSize: "0.85rem",
                fontWeight: 600,
                backgroundColor: selectedWeekStart === getLocalDateStr(nextMonday) ? "#10B981" : "var(--border-light)",
                color: selectedWeekStart === getLocalDateStr(nextMonday) ? "white" : "var(--text-muted)",
                transition: "all 0.2s"
              }}
              onClick={() => setSelectedWeekStart(getLocalDateStr(nextMonday))}
            >
              Siguiente Semana (Lun {formatMondayLabel(nextMonday)})
            </button>
            {selectedWeekStart === getLocalDateStr(nextMonday) && (
              <span style={{
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                fontWeight: 600,
                backgroundColor: "#D1FAE5",
                color: "#065F46",
                border: "1px solid #A7F3D0",
                marginLeft: "4px",
                whiteSpace: "nowrap"
              }}>
                💡 Aquí se coordina la siguiente semana
              </span>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handleShareWeeklySchedule} style={{ backgroundColor: "#D1FAE5", color: "#065F46", border: "1px solid #A7F3D0" }}>
            <MessageCircle size={16} /> Enviar a {getCleanFirstName(currentTherapist?.nombre) || "Terapeuta"}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowParentsShareModal(true)} style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE" }}>
            <User size={16} /> Compartir con Padres
          </button>
          <button className="btn btn-secondary" onClick={handleCopyWeek}>
            <RefreshCw size={16} /> Copiar Semana Anterior
          </button>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            backgroundColor: "white", 
            borderRadius: "var(--radius-sm)", 
            border: "1px solid var(--border-light)", 
            padding: "2px 4px",
            boxShadow: "var(--shadow-xs)"
          }}>
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={handlePrevWeek} 
              style={{ 
                border: "none", 
                background: "none", 
                cursor: "pointer", 
                padding: "6px 10px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "var(--purple-dark)" 
              }}
              title="Semana Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            
            <span style={{ 
              fontSize: "0.85rem", 
              fontWeight: 600, 
              color: "var(--text-main)", 
              padding: "0 10px", 
              whiteSpace: "nowrap",
              userSelect: "none"
            }}>
              {getWeekRangeLabel(selectedWeekStart)}
            </span>
            
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={handleNextWeek} 
              style={{ 
                border: "none", 
                background: "none", 
                cursor: "pointer", 
                padding: "6px 10px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "var(--purple-dark)" 
              }}
              title="Semana Siguiente"
            >
              <ChevronRight size={16} />
            </button>
            
            <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border-light)", margin: "0 4px" }} />
            
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={() => dateInputRef.current && dateInputRef.current.showPicker()} 
              style={{ 
                border: "none", 
                background: "none", 
                cursor: "pointer", 
                padding: "6px 10px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "var(--purple-base)" 
              }}
              title="Seleccionar Fecha Específica"
            >
              <CalendarIcon size={16} />
            </button>
            
            <input 
              type="date" 
              ref={dateInputRef}
              style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
              value={selectedWeekStart}
              onChange={(e) => {
                if (!e.target.value) return;
                const selected = parseLocalDateStr(e.target.value);
                const day = selected.getDay();
                const diff = selected.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(selected.setDate(diff));
                setSelectedWeekStart(getLocalDateStr(monday));
              }}
            />
          </div>
        </div>
      </div>

      {/* Therapist tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid var(--border-light)", gap: "4px", marginBottom: "16px", overflowX: "auto", paddingBottom: "2px" }}>
        {terapeutas
          .filter(t => !t.nombre.includes("Recepción") && !t.nombre.includes("Recepcion") && !t.nombre.includes("Josua") && !t.nombre.includes("Joshua"))
          .map(t => (
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
              <th style={{ width: "80px", padding: "10px 4px", color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", borderRight: "1px solid #E2E8F0" }}>HORA</th>
              {weekDays.map((d, colIdx) => (
                <th key={d.dateStr} style={{ 
                  padding: "10px 4px", 
                  textAlign: "center",
                  backgroundColor: colIdx % 2 === 0 ? "white" : "#FAF8FF",
                  borderRight: "1px solid #E2E8F0"
                }}>
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
                    backgroundColor: d.dateStr === getLocalDateStr(new Date()) ? "var(--purple-base)" : "transparent",
                    color: d.dateStr === getLocalDateStr(new Date()) ? "white" : "var(--text-muted)"
                  }}>{d.dayNum}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map(time => {
              const isLunch = time === "12:00"; // Block lunch time
              return (
                <tr key={time} style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "12px 4px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", borderRight: "1px solid #E2E8F0", fontWeight: 500 }}>
                    {time}
                  </td>
                  {weekDays.map((d, colIdx) => {
                    const cita = getCitaForSlot(activeTerapeutaId, d.dateStr, time);
                    if (isLunch) {
                      return (
                        <td key={d.dateStr} style={{ backgroundColor: "#F3F4F6", padding: "4px", textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", borderRight: "1px solid #E2E8F0" }}>
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
                          borderRight: "1px solid #E2E8F0",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          backgroundColor: isDraggedOver ? "var(--purple-pastel-soft)" : (colIdx % 2 === 0 ? "white" : "#FAF8FF"),
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
                              cursor: "grab",
                              position: "relative"
                            }}
                          >
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation(); // Evita abrir el modal de edición
                                if (cita.esFija) {
                                  if (confirm(`La cita de ${cita.pacienteNombre} es FIJA. ¿Quieres eliminar también todas las citas futuras?`)) {
                                    await handleDeleteCita('all', cita, "Eliminado desde la cuadrícula");
                                  } else {
                                    await handleDeleteCita('only', cita, "Eliminado desde la cuadrícula");
                                  }
                                } else {
                                  if (confirm(`¿Estás seguro de que deseas eliminar la cita de ${cita.pacienteNombre}?`)) {
                                    await handleDeleteCita('only', cita, "Eliminado desde la cuadrícula");
                                  }
                                }
                              }}
                              style={{
                                position: "absolute",
                                top: "2px",
                                right: "2px",
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                color: "#EF4444",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                fontWeight: "bold",
                                cursor: "pointer",
                                transition: "background-color 0.2s",
                                zIndex: 10
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = "rgba(239, 68, 68, 0.25)"}
                              onMouseLeave={(e) => e.target.style.backgroundColor = "rgba(239, 68, 68, 0.1)"}
                              title="Eliminar cita"
                            >
                              ×
                            </button>
                            <div style={{ fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "12px" }}>
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
                  {pacientes
                    .filter(p => p.estado === "activo")
                    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" }))
                    .map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Servicio / Terapia*</label>
                <select required className="input-field" value={newCita.servicioId} onChange={(e) => setNewCita({...newCita, servicioId: e.target.value})}>
                  <option value="">Seleccione Servicio...</option>
                  {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} (${s.costo})</option>)}
                </select>
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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
                  readOnly={!isAdmin}
                  style={!isAdmin ? { backgroundColor: "#F3F4F6", cursor: "not-allowed" } : {}}
                  className="input-field" 
                  value={newCita.costo} 
                  onChange={(e) => setNewCita({...newCita, costo: e.target.value})} 
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {isAdmin ? "Precio flexible. Modificable para esta sesión." : "Precio bloqueado para recepción (Administradores pueden modificar)."}
                </span>
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

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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
                  readOnly={!isAdmin}
                  style={!isAdmin ? { backgroundColor: "#F3F4F6", cursor: "not-allowed" } : {}}
                  className="input-field" 
                  value={selectedCita.costo} 
                  onChange={(e) => setSelectedCita({...selectedCita, costo: e.target.value})} 
                />
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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

              {selectedCita.estadoAsistencia === "falto_justificado" && !isAdmin && (
                <div style={{ marginTop: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--pink-dark)", display: "block", marginBottom: "4px" }}>
                    Justificación de la Falta (Mínimo 15 caracteres)*
                  </label>
                  <textarea 
                    required
                    className="input-field" 
                    rows={2}
                    style={{ minHeight: "50px", resize: "none" }}
                    placeholder="Ej: Presentó certificado médico del pediatra por gripe..."
                    value={justificacion}
                    onChange={(e) => setJustificacion(e.target.value)}
                  />
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    Caracteres actuales: {justificacion.length}/15
                  </span>
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSwapModal(true)} style={{ flex: 1 }}>
                  <ArrowLeftRight size={16} /> Intercambiar Turno
                </button>
                <button 
                  type="button"
                  className="btn btn-danger" 
                  onClick={() => {
                    if (selectedCita.esFija) {
                      if (confirm("Esta cita es FIJA. ¿Quieres eliminar también todas las citas futuras?")) {
                        handleDeleteCita('all');
                      } else {
                        handleDeleteCita('only');
                      }
                    } else {
                      if (confirm("¿Estás seguro de que deseas eliminar esta cita?")) {
                        handleDeleteCita('only');
                      }
                    }
                  }} 
                  style={{ display: "flex", justifyContent: "center", padding: "10px", flex: 1, backgroundColor: "#DC2626" }}
                >
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

      {/* Parents Weekly Share Modal */}
      {showParentsShareModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "750px", maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontWeight: 600, color: "var(--purple-dark)" }}>Compartir Agenda con Padres</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                  Planificación semanal de turnos para el profesional: <strong>{currentTherapist ? currentTherapist.nombre : "Terapeuta"}</strong>
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowParentsShareModal(false); setParentsSearchQuery(""); }}
                style={{ minWidth: "auto", padding: "6px 12px" }}
              >
                ✕
              </button>
            </div>

            {/* Filter and stats */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
              <input 
                type="text" 
                placeholder="Buscar paciente o representante..." 
                className="input-field" 
                value={parentsSearchQuery} 
                onChange={(e) => setParentsSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: "200px", margin: 0 }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>
                  Enviados: <strong style={{ color: "var(--purple-dark)" }}>
                    {getParentsQueue().filter(item => recordatoriosEnviados[selectedWeekStart]?.[item.pacienteId]).length}
                  </strong> / {getParentsQueue().length}
                </span>

                {getParentsQueue().some(item => recordatoriosEnviados[selectedWeekStart]?.[item.pacienteId]) && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleResetAllParentsWeeklyState}
                    style={{ fontSize: "0.8rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <RefreshCw size={14} /> Restablecer Todos
                  </button>
                )}
              </div>
            </div>

            {/* Patients list */}
            {getParentsQueue().length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "#f9fafb", borderRadius: "var(--radius-sm)" }}>
                No hay pacientes agendados con este profesional para esta semana.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontWeight: 600, textAlign: "left" }}>
                      <th style={{ padding: "10px 8px" }}>Paciente</th>
                      <th style={{ padding: "10px 8px" }}>Representante</th>
                      <th style={{ padding: "10px 8px" }}>Teléfono</th>
                      <th style={{ padding: "10px 8px" }}>Resumen de Horarios</th>
                      <th style={{ padding: "10px 8px" }}>Estado</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getParentsQueue()
                      .filter(item => 
                        item.pacienteNombre.toLowerCase().includes(parentsSearchQuery.toLowerCase()) || 
                        item.representante.toLowerCase().includes(parentsSearchQuery.toLowerCase())
                      )
                      .map(item => {
                        const isSent = recordatoriosEnviados[selectedWeekStart]?.[item.pacienteId];
                        const citasSummary = item.citas.map(c => {
                          const [y, m, d] = c.fecha.split("-").map(Number);
                          const dateObj = new Date(y, m - 1, d);
                          const dayName = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][dateObj.getDay()];
                          return `${dayName} ${c.hora}`;
                        }).join(", ");

                        return (
                          <tr key={item.pacienteId} style={{ borderBottom: "1px solid var(--border-soft)", height: "50px" }}>
                            <td style={{ padding: "8px", fontWeight: 500 }}>{item.pacienteNombre}</td>
                            <td style={{ padding: "8px" }}>{item.representante}</td>
                            <td style={{ padding: "8px", color: "var(--text-muted)" }}>{item.telefono}</td>
                            <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.8rem" }} title={citasSummary}>
                              <div style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {citasSummary}
                              </div>
                            </td>
                            <td style={{ padding: "8px" }}>
                              {isSent ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#10B981", fontSize: "0.8rem", fontWeight: 600 }}>
                                  <Check size={14} /> Enviado
                                </span>
                              ) : (
                                <span style={{ display: "inline-flex", alignItems: "center", color: "#3B82F6", fontSize: "0.8rem", fontWeight: 600 }}>
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "8px", textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                                <button 
                                  className="btn btn-primary" 
                                  onClick={() => handleSendWeeklyParentWhatsApp(item)}
                                  style={{ 
                                    padding: "6px 10px", 
                                    fontSize: "0.8rem", 
                                    backgroundColor: isSent ? "#EFF6FF" : "#3B82F6", 
                                    color: isSent ? "#1D4ED8" : "white",
                                    border: isSent ? "1px solid #BFDBFE" : "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px"
                                  }}
                                >
                                  <MessageCircle size={12} /> {isSent ? "Reenviar" : "Enviar"}
                                </button>
                                {isSent && (
                                  <button 
                                    className="btn btn-secondary" 
                                    onClick={() => handleResetParentWeeklyState(item.pacienteId)}
                                    style={{ padding: "6px 8px", fontSize: "0.8rem", minWidth: "auto", border: "1px solid var(--border-light)" }}
                                    title="Marcar como pendiente"
                                  >
                                    <RefreshCw size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowParentsShareModal(false); setParentsSearchQuery(""); }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
