import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { subscribeToCollection, getCollection, registrarLog } from "./db";
import PacientesApp from "./apps/PacientesApp";
import AgendaApp from "./apps/AgendaApp";
import RecordatoriosApp from "./apps/RecordatoriosApp";
import CajaApp from "./apps/CajaApp";
import EvaluacionesApp from "./apps/EvaluacionesApp";
import TareasApp from "./apps/TareasApp";
import ComisionesApp from "./apps/ComisionesApp";
import AjustesApp from "./apps/AjustesApp";
import FinanzasDashboardApp from "./apps/FinanzasDashboardApp";
import NominaRrhhApp from "./apps/NominaRrhhApp";
import AuditoriaApp from "./apps/AuditoriaApp";

// Lucide Icons
import { 
  Users, Calendar, MessageSquare, DollarSign, 
  FileText, CheckSquare, Calculator, Settings, 
  LogOut, Home, Lock, Bell, Sparkles, TrendingUp, AlertTriangle,
  Briefcase, Shield, Database
} from "lucide-react";

import "./App.css";

// 1. LOGIN COMPONENT
function LoginScreen() {
  const { login } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null); // 'admin' | 'recep' | null
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (type) => {
    setSelectedUser(type);
    setError("");
    setPassword("");
    if (type === "admin") {
      setEmail("jeni@gmail.com");
    } else if (type === "tono") {
      setEmail("toño@gmail.com");
    } else {
      setEmail("joshua@gmail.com");
    }
  };

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh",
      background: "linear-gradient(135deg, #F5F3FF 0%, #FFF5F5 100%)", padding: "20px"
    }}>
      <div className="glass fade-in" style={{
        padding: "40px", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "420px",
        boxShadow: "0 20px 25px -5px rgba(139, 92, 246, 0.1), 0 10px 10px -5px rgba(139, 92, 246, 0.04)",
        border: "1px solid rgba(255,255,255,0.6)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <img 
            src="/logo.png" 
            alt="MERAKI" 
            style={{
              height: "90px",
              objectFit: "contain",
              marginBottom: "10px",
              filter: "drop-shadow(0 4px 6px rgba(139, 92, 246, 0.1))"
            }}
          />
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 500 }}>Centro de Terapia Integral • Gestión Interna</p>
        </div>

        {error && (
          <div style={{
            backgroundColor: "#FEE2E2", color: "#991B1B", padding: "12px", borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem", marginBottom: "16px", border: "1px solid var(--pink-pastel-soft)"
          }}>
            {error}
          </div>
        )}

        {!selectedUser ? (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 600 }}>Selecciona tu perfil:</p>
            
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", width: "100%" }}>
              {/* Admin Profile */}
              <div 
                onClick={() => handleSelectUser("admin")} 
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", cursor: "pointer", flex: 1 }}
                className="profile-card-hover"
              >
                <div style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--purple-base) 0%, #a78bfa 100%)",
                  display: "flex", justifyContent: "center", alignItems: "center",
                  color: "white", boxShadow: "0 10px 15px -3px rgba(139, 92, 246, 0.25)",
                  border: "3px solid white"
                }}>
                  <Lock size={32} />
                </div>
                <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "1rem" }}>Jeni</span>
                <span style={{ color: "var(--purple-dark)", fontSize: "0.72rem", background: "var(--purple-pastel-soft)", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>Administración</span>
              </div>

              {/* Toño Profile */}
              <div 
                onClick={() => handleSelectUser("tono")} 
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", cursor: "pointer", flex: 1 }}
                className="profile-card-hover"
              >
                <div style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #7C3AED 0%, #a78bfa 100%)",
                  display: "flex", justifyContent: "center", alignItems: "center",
                  color: "white", boxShadow: "0 10px 15px -3px rgba(124, 58, 237, 0.25)",
                  border: "3px solid white"
                }}>
                  <Briefcase size={32} />
                </div>
                <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "1rem" }}>Toño</span>
                <span style={{ color: "#7C3AED", fontSize: "0.72rem", background: "var(--purple-pastel-soft)", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>R. R. H. H.</span>
              </div>

              {/* Recep Profile */}
              <div 
                onClick={() => handleSelectUser("recep")} 
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", cursor: "pointer", flex: 1 }}
                className="profile-card-hover"
              >
                <div style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--pink-base) 0%, #f472b6 100%)",
                  display: "flex", justifyContent: "center", alignItems: "center",
                  color: "white", boxShadow: "0 10px 15px -3px rgba(236, 72, 153, 0.25)",
                  border: "3px solid white"
                }}>
                  <Users size={32} />
                </div>
                <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "1rem" }}>Josua</span>
                <span style={{ color: "var(--pink-dark)", fontSize: "0.72rem", background: "var(--pink-pastel-soft)", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>Recepción</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-secondary)", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%",
                background: selectedUser === "admin" || selectedUser === "tono"
                  ? "linear-gradient(135deg, var(--purple-base) 0%, #a78bfa 100%)" 
                  : "linear-gradient(135deg, var(--pink-base) 0%, #f472b6 100%)",
                display: "flex", justifyContent: "center", alignItems: "center",
                color: "white"
              }}>
                {selectedUser === "admin" ? <Lock size={18} /> : selectedUser === "tono" ? <Briefcase size={18} /> : <Users size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.9rem" }}>
                  {selectedUser === "admin" ? "Jeni (Administración)" : selectedUser === "tono" ? "Toño (Recursos Humanos)" : "Josua (Recepción)"}
                </h4>
                <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {email}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedUser(null)} 
                style={{ border: "none", background: "none", color: "var(--purple-base)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cambiar
              </button>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>Ingresa tu Contraseña</label>
              <input 
                type="password" 
                required 
                autoFocus
                className="input-field" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "10px", padding: "12px" }} disabled={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Componente de Panel de Alertas Críticas e Integridad Contable
function AlertasCriticasPanel({ citas, evaluaciones, transacciones, auditorias, onNavigate }) {
  const todayStr = new Date().toLocaleDateString("en-CA");
  
  // 1. Attended unpaid appointments
  const countCitasSinCobrar = citas.filter(c => 
    c.estadoAsistencia === "asistio" && c.cobrada !== true
  ).length;

  // 2. Unverified transfers
  const countTransferenciasPendientes = transacciones.filter(t => 
    t.tipo === "transferencia" && t.verificado !== true
  ).length;

  // 3. Omitted WhatsApp alerts
  const countWasOmitidos = auditorias.filter(a => 
    a.accion === "Agenda (Notificación WA)" && a.detalles?.includes("OMITIÓ/CANCELÓ")
  ).length;

  // 4. Overdue reports
  const countInformesAtrasados = evaluaciones.filter(ev => 
    (ev.estado === "en_sesion" || ev.estado === "redaccion") && 
    ev.fechaAcordadaRecep && 
    ev.fechaAcordadaRecep < todayStr
  ).length;

  // 5. Schedule conflicts (only active/pending and from today onwards)
  const getChoquesCount = () => {
    let conflicts = 0;
    const grouped = {};
    citas.forEach(c => {
      if (!c.fecha || !c.horaInicio || !c.terapeutaId) return;
      if (c.estadoAsistencia === "cancelado") return;
      if (c.fecha < todayStr) return; // Only show conflicts for today and the future
      const key = `${c.fecha}_${c.horaInicio}_${c.terapeutaId}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });
    Object.values(grouped).forEach(list => {
      if (list.length > 1) {
        conflicts += (list.length - 1);
      }
    });
    return conflicts;
  };
  const countChoques = getChoquesCount();

  const totalAlerts = countCitasSinCobrar + countTransferenciasPendientes + countWasOmitidos + countInformesAtrasados + countChoques;

  if (totalAlerts === 0) {
    return (
      <div className="alerts-panel" style={{ borderLeftColor: "#10B981", background: "rgba(240, 253, 250, 0.6)", borderImage: "none", borderColor: "rgba(16, 185, 129, 0.15)", width: "100%", maxWidth: "800px", margin: "0 auto 24px" }}>
        <div className="alerts-panel-header" style={{ color: "#065F46" }}>
          <Sparkles size={18} style={{ color: "#10B981" }} />
          <span className="alerts-panel-title">Cabina de Control de Integridad</span>
        </div>
        <p style={{ fontSize: "0.82rem", color: "#065F46", fontWeight: 500 }}>
          ✅ Todo en orden — No se registran discrepancias de cobro, retrasos en informes o choques de agenda hoy.
        </p>
      </div>
    );
  }

  return (
    <div className="alerts-panel" style={{ width: "100%", maxWidth: "800px", margin: "0 auto 24px" }}>
      <div className="alerts-panel-header">
        <AlertTriangle size={18} className="pulse-glow" style={{ color: "#EF4444" }} />
        <span className="alerts-panel-title">Alertas Críticas y Discrepancias ({totalAlerts})</span>
      </div>
      
      <div className="alerts-grid">
        {countCitasSinCobrar > 0 && (
          <div className="alert-card" onClick={() => onNavigate("caja")}>
            <div className="alert-card-icon" style={{ backgroundColor: "#FEE2E2", color: "#EF4444" }}>
              <DollarSign size={18} />
            </div>
            <div className="alert-card-content">
              <div className="alert-card-count">{countCitasSinCobrar}</div>
              <div className="alert-card-label">Citas asistidas sin cobrar</div>
            </div>
          </div>
        )}

        {countTransferenciasPendientes > 0 && (
          <div className="alert-card" onClick={() => onNavigate("caja")}>
            <div className="alert-card-icon" style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
              <DollarSign size={18} />
            </div>
            <div className="alert-card-content">
              <div className="alert-card-count">{countTransferenciasPendientes}</div>
              <div className="alert-card-label">Transferencias por conciliar</div>
            </div>
          </div>
        )}

        {countWasOmitidos > 0 && (
          <div className="alert-card" onClick={() => onNavigate("auditoria")}>
            <div className="alert-card-icon" style={{ backgroundColor: "#F3E8FF", color: "#9333EA" }}>
              <MessageSquare size={18} />
            </div>
            <div className="alert-card-content">
              <div className="alert-card-count">{countWasOmitidos}</div>
              <div className="alert-card-label">Avisos WhatsApp omitidos</div>
            </div>
          </div>
        )}

        {countInformesAtrasados > 0 && (
          <div className="alert-card" onClick={() => onNavigate("evaluaciones")}>
            <div className="alert-card-icon" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
              <FileText size={18} />
            </div>
            <div className="alert-card-content">
              <div className="alert-card-count">{countInformesAtrasados}</div>
              <div className="alert-card-label">Informes atrasados</div>
            </div>
          </div>
        )}

        {countChoques > 0 && (
          <div className="alert-card" onClick={() => onNavigate("agenda")}>
            <div className="alert-card-icon" style={{ backgroundColor: "#FFF7ED", color: "#EA580C" }}>
              <Calendar size={18} />
            </div>
            <div className="alert-card-content">
              <div className="alert-card-count">{countChoques}</div>
              <div className="alert-card-label">Choques en la agenda</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 2. MAIN APP DASHBOARD & SWITCHER
function MainDashboard() {
  const { currentUser, logout, isLocalDb } = useAuth();
  const [activeApp, setActiveApp] = useState("launchpad");
  
  const emailClean = currentUser?.email ? currentUser.email.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
  const isTono = emailClean === "tono@gmail.com";
  const isJeni = emailClean === "jeni@gmail.com";

  const [mainView, setMainView] = useState(isTono ? "top" : "administracion");
  const [show4pmAlarm, setShow4pmAlarm] = useState(false);
  const [alarmType, setAlarmType] = useState(null); // 'diario' | 'semanal' | 'ambos'
  const [citas, setCitas] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [transacciones, setTransacciones] = useState([]);
  const [auditorias, setAuditorias] = useState([]);
  const [feriadosEventos, setFeriadosEventos] = useState([]);
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

  const [fridayBackupDismissed, setFridayBackupDismissed] = useState(() => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      return localStorage.getItem(`meraki_friday_backup_dismissed_${todayStr}`) === "true";
    } catch (e) {
      return false;
    }
  });

  const dismissFridayAlert = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    localStorage.setItem(`meraki_friday_backup_dismissed_${todayStr}`, "true");
    setFridayBackupDismissed(true);
  };

  const [isExportingWeekly, setIsExportingWeekly] = useState(false);

  const handleFridayBackup = async () => {
    try {
      setIsExportingWeekly(true);
      const collections = [
        "usuarios",
        "terapeutas",
        "servicios",
        "pacientes",
        "lista_negra",
        "evaluaciones",
        "citas",
        "transacciones",
        "tareas",
        "feriados_eventos",
        "auditoria",
        "auditoria_agenda",
        "empleados"
      ];
      
      const collectionsData = {};
      for (const colName of collections) {
        try {
          collectionsData[colName] = await getCollection(colName);
        } catch (e) {
          console.error(`Error al respaldar colección ${colName}:`, e);
          collectionsData[colName] = [];
        }
      }
      
      const backup = {
        metadata: {
          version: "1.0",
          fecha: new Date().toISOString(),
          creadoPor: currentUser?.correo || "sistema",
          registrosTotales: Object.values(collectionsData).reduce((sum, arr) => sum + arr.length, 0)
        },
        collections: collectionsData
      };
      
      const jsonString = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.href = url;
      const dateStr = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
      downloadAnchor.download = `meraki_respaldo_${dateStr}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
      
      await registrarLog(
        currentUser,
        "Respaldo (Exportar)",
        `Exportó un respaldo semanal de los viernes con ${backup.metadata.registrosTotales} registros.`
      );
      
      alert("Respaldo semanal descargado con éxito.");
      dismissFridayAlert();
    } catch (err) {
      console.error("Error al exportar respaldo:", err);
      alert("Error al exportar respaldo: " + err.message);
    } finally {
      setIsExportingWeekly(false);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "meraki_silenced_alerts") {
        try {
          setSilencedAlerts(e.newValue ? JSON.parse(e.newValue) : {});
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    const unsub = subscribeToCollection("citas", setCitas);
    const unsubEv = subscribeToCollection("evaluaciones", setEvaluaciones);
    const unsubTx = subscribeToCollection("transacciones", setTransacciones);
    const unsubAud = subscribeToCollection("auditoria", setAuditorias);
    const unsubFeriadosEventos = subscribeToCollection("feriados_eventos", setFeriadosEventos);
    return () => {
      unsub();
      unsubEv();
      unsubTx();
      unsubAud();
      unsubFeriadosEventos();
    };
  }, []);

  const playScandalousAlarm = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sawtooth"; 
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.25);
      osc.frequency.linearRampToValueAtTime(600, now + 0.5);
      osc.frequency.linearRampToValueAtTime(1000, now + 0.75);
      osc.frequency.linearRampToValueAtTime(800, now + 1.0);
      
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.setValueAtTime(0.35, now + 0.85);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
      
      osc.start(now);
      osc.stop(now + 1.0);
    } catch (e) {
      console.warn("Audio Context blocked or failed:", e);
    }
  };

  // HOLIDAY AND EVENT ALERTS ENGINE WITH WEEKEND SHIFTING & RECURRENCE
  const getSystemAlerts = () => {
    if (currentUser?.rol !== "recepcionista") return [];
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    feriadosEventos.forEach(item => {
      let eventDate = new Date(item.fecha + "T12:00:00");
      eventDate.setHours(0, 0, 0, 0);

      // Handle annual recurrence
      if (item.repeticion === "anual") {
        const currentYear = today.getFullYear();
        let candidateDate = new Date(currentYear, eventDate.getMonth(), eventDate.getDate());
        candidateDate.setHours(0, 0, 0, 0);
        
        const candidateEnd = new Date(candidateDate);
        candidateEnd.setHours(23, 59, 59, 999);
        if (candidateEnd < today) {
          candidateDate = new Date(currentYear + 1, eventDate.getMonth(), eventDate.getDate());
          candidateDate.setHours(0, 0, 0, 0);
        }
        eventDate = candidateDate;
      }

      // Calculate days ahead trigger
      const daysAhead = item.tipo === "feriado" ? 8 : 7;
      const alertDate = new Date(eventDate);
      alertDate.setDate(eventDate.getDate() - daysAhead);

      // Weekend shift
      const alertDayOfWeek = alertDate.getDay();
      if (alertDayOfWeek === 0) {
        alertDate.setDate(alertDate.getDate() - 2);
      } else if (alertDayOfWeek === 6) {
        alertDate.setDate(alertDate.getDate() - 1);
      }

      if (today >= alertDate && today <= eventDate) {
        const daysLeft = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
        const eventYear = eventDate.getFullYear();
        const alertKey = `alert_${item.id}_${eventYear}`;

        const formattedDate = eventDate.toLocaleDateString("es-ES", { day: 'numeric', month: 'long', year: 'numeric' });

        alerts.push({
          key: alertKey,
          tipo: item.tipo,
          titulo: item.titulo,
          daysLeft,
          fechaStr: formattedDate,
          shiftedAlertDate: alertDate.toISOString().split('T')[0]
        });
      }
    });

    return alerts;
  };

  const systemAlerts = getSystemAlerts();
  const activeHolidayAlert = systemAlerts.find(a => !silencedAlerts[a.key]);
  const hasActiveHolidayAlarm = !!activeHolidayAlert;

  // Sound alarm effect
  useEffect(() => {
    if (show4pmAlarm || hasActiveHolidayAlarm) {
      playScandalousAlarm();
      const audioInterval = setInterval(() => {
        playScandalousAlarm();
      }, 1500);
      return () => clearInterval(audioInterval);
    }
  }, [show4pmAlarm, hasActiveHolidayAlarm]);

  // 3:00 PM Alarm logic check every 30 seconds (Daily & Friday Weekly reminders)
  useEffect(() => {
    if (currentUser?.rol !== "recepcionista") return;

    const checkAlarm = () => {
      const now = new Date();
      const currentHour = now.getHours();

      // Check if it's 3 PM or later
      if (currentHour >= 15) {
        let dailyPending = false;
        let weeklyPending = false;

        const getLocalDateStr = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const r = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${r}`;
        };

        // 1. Check daily reminders for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = getLocalDateStr(tomorrow);
        
        const tomorrowCitas = citas.filter(c => c.fecha === tomorrowStr && c.estadoAsistencia !== "falto_justificado");
        const saved = localStorage.getItem("meraki_sent_recordatorios");
        const sentState = saved ? JSON.parse(saved) : {};

        if (tomorrowCitas.length > 0) {
          const sentForTomorrow = sentState[tomorrowStr] || {};
          const pendingCount = tomorrowCitas.filter(c => !sentForTomorrow[c.pacienteId]).length;
          if (pendingCount > 0) {
            dailyPending = true;
          }
        }        if (dailyPending) {
          setAlarmType("diario");
          setShow4pmAlarm(true);
          return;
        }
      }
      setShow4pmAlarm(false);
      setAlarmType(null);
    };

    checkAlarm();
    const interval = setInterval(checkAlarm, 30000);
    return () => clearInterval(interval);
  }, [citas, currentUser]);

  const isAdmin = currentUser?.rol === "administrador";

  // Calculate overdue evaluations (agreed date has passed, and report not received yet)
  const todayStr = new Date().toLocaleDateString("en-CA");
  const overdueEvsCount = evaluaciones.filter(ev => 
    (ev.estado === "en_sesion" || ev.estado === "redaccion") && 
    ev.fechaAcordadaRecep && 
    ev.fechaAcordadaRecep < todayStr
  ).length;

  // List of Odoo style App icons (Minimalist grids)
  const appModules = [
    { id: "dashboard_finanzas", title: "Dashboard Financiero", desc: "Ingresos y rentabilidad real", icon: <TrendingUp size={28} />, bg: "linear-gradient(135deg, #F5F3FF 0%, #FFF5F5 100%)", color: "var(--purple-dark)", roles: ["administrador"] },
    { id: "pacientes", title: "Pacientes", desc: "Fichas y datos clínicos", icon: <Users size={28} />, bg: "var(--purple-pastel-soft)", color: "var(--purple-dark)", roles: ["administrador", "recepcionista"] },
    { id: "agenda", title: "Agenda", desc: "Calendario de citas", icon: <Calendar size={28} />, bg: "var(--pink-pastel-soft)", color: "var(--pink-dark)", roles: ["administrador", "recepcionista"] },
    { id: "recordatorios", title: "Recordatorios", desc: "WhatsApp 1-click", icon: <MessageSquare size={28} />, bg: "var(--purple-pastel-soft)", color: "var(--purple-dark)", roles: ["administrador", "recepcionista"] },
    { id: "caja", title: "Caja y Finanzas", desc: "Cobros diarios y conciliación", icon: <DollarSign size={28} />, bg: "var(--pink-pastel-soft)", color: "var(--pink-dark)", roles: ["administrador", "recepcionista"] },
    { id: "evaluaciones", title: "Evaluaciones", desc: "Control de informes", icon: <FileText size={28} />, bg: "var(--purple-pastel-soft)", color: "var(--purple-dark)", roles: ["administrador", "recepcionista"] },
    { id: "tareas", title: "Tareas y Calendario", desc: "Checklist y feriados", icon: <CheckSquare size={28} />, bg: "var(--pink-pastel-soft)", color: "var(--pink-dark)", roles: ["administrador", "recepcionista"] },
    { id: "comisiones", title: "Comisiones", desc: "Liquidación por %", icon: <Calculator size={28} />, bg: "var(--purple-pastel-soft)", color: "var(--purple-dark)", roles: ["administrador"] },
    { id: "ajustes", title: "Ajustes", desc: "Usuarios y tarifas", icon: <Settings size={28} />, bg: "var(--pink-pastel-soft)", color: "var(--pink-dark)", roles: ["administrador", "recepcionista"] },
    { id: "nomina_rrhh", title: "Recursos Humanos", desc: "Nómina y Asistencia", icon: <Briefcase size={28} />, bg: "var(--purple-pastel-soft)", color: "var(--purple-dark)", roles: ["administrador"] },
    { id: "auditoria", title: "Auditoría de Actividades", desc: "Historial y logs de cambios", icon: <Shield size={28} />, bg: "var(--pink-pastel-soft)", color: "var(--pink-dark)", roles: ["administrador"] }
  ];

  const visibleApps = appModules.filter(app => {
    // Basic role check
    if (!app.roles.includes(currentUser.rol)) return false;
    
    // Hide nomina_rrhh from launchpad since it's accessed via the Directory Selector
    if (app.id === "nomina_rrhh") return false;
    
    // Jeni is administrator, but only sees auditing/financial/concrete modules
    if (isJeni) {
      const jeniApps = ["dashboard_finanzas", "caja", "evaluaciones", "ajustes", "auditoria"];
      return jeniApps.includes(app.id);
    }
    
    return true;
  });

  const renderActiveApp = () => {
    switch (activeApp) {
      case "pacientes": return <PacientesApp />;
      case "agenda": return <AgendaApp />;
      case "recordatorios": return <RecordatoriosApp />;
      case "caja": return <CajaApp />;
      case "evaluaciones": return <EvaluacionesApp />;
      case "tareas": return <TareasApp />;
      case "comisiones": 
        if (currentUser?.rol !== "administrador") return <div style={{ padding: "40px", textAlign: "center", color: "var(--pink-dark)", fontWeight: "bold" }}>Acceso Denegado</div>;
        return <ComisionesApp />;
      case "ajustes": return <AjustesApp />;
      case "dashboard_finanzas": return <FinanzasDashboardApp />;
      case "nomina_rrhh": return <NominaRrhhApp />;
      case "auditoria":
        if (currentUser?.rol !== "administrador") return <div style={{ padding: "40px", textAlign: "center", color: "var(--pink-dark)", fontWeight: "bold" }}>Acceso Denegado</div>;
        return <AuditoriaApp />;
      default: return null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      
      {/* Holiday / Event Alarm Banner Alert */}
      {activeHolidayAlert && (
        <div style={{
          backgroundColor: activeHolidayAlert.tipo === "feriado" ? "#FCE8E6" : "#F5F3FF", 
          color: activeHolidayAlert.tipo === "feriado" ? "#A8200D" : "#5B21B6", 
          padding: "14px 20px", display: "flex",
          justifyContent: "space-between", alignItems: "center", 
          borderBottom: `2px solid ${activeHolidayAlert.tipo === "feriado" ? "#F3A094" : "#DDD6FE"}`,
          fontSize: "0.9rem", fontWeight: "bold", gap: "10px", 
          animation: "pulseSoft 2s infinite"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={20} className="shake" />
            <span>
              ⏰ ¡ALERTA RECEPCIÓN! Se aproxima el {activeHolidayAlert.tipo === "feriado" ? "FERIADO" : "EVENTO"} "{activeHolidayAlert.titulo}" en {activeHolidayAlert.daysLeft} días ({activeHolidayAlert.fechaStr}).
            </span>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => { 
              setSilencedAlerts(prev => ({ ...prev, [activeHolidayAlert.key]: true }));
            }} 
            style={{ 
              padding: "6px 14px", 
              fontSize: "0.8rem", 
              backgroundColor: activeHolidayAlert.tipo === "feriado" ? "#A8200D" : "var(--purple-dark)",
              border: "none"
            }}
          >
            Apagar Alarma
          </button>
        </div>
      )}

      {/* 3:00 PM Alarm Banner Alert */}
      {show4pmAlarm && (
        <div style={{
          backgroundColor: "#FCE8E6", color: "#A8200D", padding: "14px 20px", display: "flex",
          justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #F3A094",
          fontSize: "0.9rem", fontWeight: "bold", gap: "10px", animation: "pulseSoft 2s infinite"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Bell size={20} className="shake" />
            <span>
              ⏰ ¡ALERTA RECEPCIÓN! Recuerda enviar los recordatorios de citas de mañana por WhatsApp.
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => { setActiveApp("recordatorios"); setShow4pmAlarm(false); }} style={{ padding: "6px 14px", fontSize: "0.8rem", backgroundColor: "#A8200D" }}>
            Enviar Ahora
          </button>
        </div>
      )}
      {/* Overdue Evaluations Banner Alert */}
      {overdueEvsCount > 0 && activeApp !== "evaluaciones" && (
        <div style={{
          backgroundColor: "#FDF2F2", color: "#9B1C1C", padding: "14px 20px", display: "flex",
          justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #FCD3D3",
          fontSize: "0.9rem", fontWeight: "bold", gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={20} className="shake" color="#9B1C1C" />
            <span>⚠️ ¡ALERTA EVALUACIONES! Hay {overdueEvsCount} evaluación(es) fuera de la fecha acordada de entrega por el terapeuta.</span>
          </div>
          <button className="btn btn-primary" onClick={() => setActiveApp("evaluaciones")} style={{ padding: "6px 14px", fontSize: "0.8rem", backgroundColor: "#9B1C1C", border: "none" }}>
            Ver Listado
          </button>
        </div>
      )}

      {/* Friday Backup Weekly Banner Alert */}
      {(isAdmin || currentUser?.rol === "recepcionista") && new Date().getDay() === 5 && !fridayBackupDismissed && (
        <div style={{
          backgroundColor: "#EEF2F6", color: "#1E3A8A", padding: "14px 20px", display: "flex",
          justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #BFDBFE",
          fontSize: "0.9rem", fontWeight: "bold", gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Database size={20} className="shake" color="#1E3A8A" />
            <span>💾 ¡VIERNES DE RESPALDO! Por favor, descarga tu copia de seguridad semanal para mantener los datos de la clínica a salvo.</span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              className="btn btn-primary" 
              disabled={isExportingWeekly}
              onClick={handleFridayBackup} 
              style={{ padding: "6px 14px", fontSize: "0.8rem", backgroundColor: "#1E3A8A", border: "none" }}
            >
              {isExportingWeekly ? "Descargando..." : "Descargar Ahora"}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={dismissFridayAlert} 
              style={{ padding: "6px 14px", fontSize: "0.8rem", border: "1px solid #1E3A8A", color: "#1E3A8A" }}
            >
              Omitir Hoy
            </button>
          </div>
        </div>
      )}

      {/* Header bar */}
      <header className="glass header-responsive" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 30px", borderBottom: "1px solid var(--border-light)", zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => { setActiveApp("launchpad"); if (isTono) setMainView("top"); }}>
          <div style={{
            display: "inline-flex", padding: "8px", borderRadius: "50%",
            background: "linear-gradient(135deg, var(--purple-pastel-soft) 0%, var(--pink-pastel-soft) 100%)",
            color: "var(--purple-base)"
          }}>
            <Sparkles size={20} />
          </div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "var(--purple-dark)", letterSpacing: "-0.5px" }}>MERAKI</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {(activeApp !== "launchpad" || (isTono && mainView !== "top")) && (
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setActiveApp("launchpad");
                if (isTono) {
                  setMainView("top");
                }
              }}
              style={{ padding: "8px 14px", fontSize: "0.85rem" }}
            >
              <Home size={16} /> Menú Principal
            </button>
          )}

          {isLocalDb && (
            <span style={{ fontSize: "0.75rem", padding: "4px 8px", borderRadius: "10px", backgroundColor: "#FEF3C7", color: "#D97706", fontWeight: "bold" }}>
              Modo Local (Sin Conexión)
            </span>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.9rem" }}>{currentUser.nombre}</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "capitalize" }}>{currentUser.rol}</div>
            </div>
            <button 
              onClick={logout}
              style={{
                border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)",
                padding: "8px", borderRadius: "50%", transition: "all 0.2s"
              }}
              className="table-cell-hover"
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main app body */}
      <main style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column" }}>
        {activeApp === "launchpad" ? (
          isTono && mainView === "top" ? (
            /* Toño Directory Selector (Administración vs. Recursos Humanos) */
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0" }}>
              <h2 style={{ fontSize: "2rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "12px", letterSpacing: "-0.5px" }}>
                Hola, Toño 👋
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "32px", textAlign: "center" }}>
                Selecciona el entorno en el que deseas trabajar hoy:
              </p>
              
              <div className="responsive-grid" style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "24px",
                width: "100%",
                maxWidth: "600px",
                padding: "20px"
              }}>
                {/* Option 1: Administracion */}
                <div 
                  onClick={() => setMainView("administracion")}
                  style={{
                    backgroundColor: "white",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-md)",
                    border: "1px solid var(--border-soft)",
                    transition: "all 0.25s ease"
                  }}
                  className="odoo-card-hover"
                >
                  <div style={{
                    width: "70px",
                    height: "70px",
                    borderRadius: "24px",
                    backgroundColor: "var(--pink-pastel-soft)",
                    color: "var(--pink-dark)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Shield size={36} />
                  </div>
                  <h4 style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "1.15rem", marginBottom: "8px" }}>Administración</h4>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
                    Gestionar pacientes, agenda de citas, facturación y finanzas de la clínica.
                  </span>
                </div>

                {/* Option 2: Recursos Humanos */}
                <div 
                  onClick={() => { setActiveApp("nomina_rrhh"); setMainView("top"); }}
                  style={{
                    backgroundColor: "white",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-md)",
                    border: "1px solid var(--border-soft)",
                    transition: "all 0.25s ease"
                  }}
                  className="odoo-card-hover"
                >
                  <div style={{
                    width: "70px",
                    height: "70px",
                    borderRadius: "24px",
                    backgroundColor: "var(--purple-pastel-soft)",
                    color: "var(--purple-dark)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "20px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)"
                  }}>
                    <Briefcase size={36} />
                  </div>
                  <h4 style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "1.15rem", marginBottom: "8px" }}>Recursos Humanos</h4>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
                    Administrar personal administrativo, registrar asistencia, feriados y roles de pago.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Odoo Launchpad App grid view */
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0", width: "100%" }}>
              <h2 style={{ fontSize: "2rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "32px", letterSpacing: "-0.5px", textAlign: "center" }}>
                Hola, {currentUser.nombre.split(" ")[0]} 👋
              </h2>
              
              {isAdmin && (
                <AlertasCriticasPanel 
                  citas={citas} 
                  evaluaciones={evaluaciones}
                  transacciones={transacciones}
                  auditorias={auditorias}
                  onNavigate={setActiveApp}
                />
              )}
              <div className="responsive-grid" style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "24px",
                width: "100%",
                maxWidth: "800px",
                padding: "20px"
              }}>
                {visibleApps.map((app) => (
                  <div 
                    key={app.id} 
                    onClick={() => setActiveApp(app.id)}
                    style={{
                      backgroundColor: "white",
                      borderRadius: "var(--radius-lg)",
                      padding: "24px 16px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "var(--shadow-md)",
                      border: "1px solid var(--border-soft)",
                      transition: "all 0.25s ease"
                    }}
                    className="odoo-card-hover"
                  >
                    <div style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "20px",
                      backgroundColor: app.bg,
                      color: app.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "16px",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)"
                    }}>
                      {app.icon}
                    </div>
                    <h4 style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "1rem", marginBottom: "4px" }}>{app.title}</h4>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>{app.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* Single App full-screen view */
          <div className="glass fade-in" style={{
            borderRadius: "var(--radius-md)", flex: 1, minHeight: "80vh",
            boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-light)",
            backgroundColor: "white", display: "flex", flexDirection: "column"
          }}>
            {renderActiveApp()}
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer style={{
        padding: "16px", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)",
        borderTop: "1px solid var(--border-soft)", backgroundColor: "white"
      }}>
        MERAKI © 2026 • Centro de Terapia Integral. Todos los derechos reservados.
      </footer>
    </div>
  );
}

// 3. EXPORT ROOT WRAPPER WITH AUTH PROVIDER
function App() {
  return (
    <AuthProvider>
      <AuthContainer />
    </AuthProvider>
  );
}

function AuthContainer() {
  const { currentUser, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        minHeight: "100vh", background: "linear-gradient(135deg, #F5F3FF 0%, #FFF5F5 100%)",
        gap: "16px"
      }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%",
          border: "4px solid var(--purple-pastel-soft)", borderTopColor: "var(--purple-base)",
          animation: "spin 1s linear infinite"
        }} />
        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--purple-dark)" }}>Cargando MERAKI...</span>
      </div>
    );
  }
  return currentUser ? <MainDashboard /> : <LoginScreen />;
}

export default App;
