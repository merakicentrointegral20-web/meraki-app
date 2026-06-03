import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { subscribeToCollection } from "./db";
import PacientesApp from "./apps/PacientesApp";
import AgendaApp from "./apps/AgendaApp";
import RecordatoriosApp from "./apps/RecordatoriosApp";
import CajaApp from "./apps/CajaApp";
import EvaluacionesApp from "./apps/EvaluacionesApp";
import TareasApp from "./apps/TareasApp";
import ComisionesApp from "./apps/ComisionesApp";
import AjustesApp from "./apps/AjustesApp";
import FinanzasDashboardApp from "./apps/FinanzasDashboardApp";

// Lucide Icons
import { 
  Users, Calendar, MessageSquare, DollarSign, 
  FileText, CheckSquare, Calculator, Settings, 
  LogOut, Home, Lock, Bell, Sparkles, TrendingUp, AlertTriangle
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
            
            <div style={{ display: "flex", gap: "30px", justifyContent: "center", width: "100%" }}>
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
                <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "1rem" }}>Joshua</span>
                <span style={{ color: "var(--pink-dark)", fontSize: "0.72rem", background: "var(--pink-pastel-soft)", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>Recepción</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-secondary)", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%",
                background: selectedUser === "admin" 
                  ? "linear-gradient(135deg, var(--purple-base) 0%, #a78bfa 100%)" 
                  : "linear-gradient(135deg, var(--pink-base) 0%, #f472b6 100%)",
                display: "flex", justifyContent: "center", alignItems: "center",
                color: "white"
              }}>
                {selectedUser === "admin" ? <Lock size={18} /> : <Users size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.9rem" }}>
                  {selectedUser === "admin" ? "Jeni (Administración)" : "Joshua (Recepción)"}
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

// 2. MAIN APP DASHBOARD & SWITCHER
function MainDashboard() {
  const { currentUser, logout, isLocalDb } = useAuth();
  const [activeApp, setActiveApp] = useState("launchpad");
  const [show4pmAlarm, setShow4pmAlarm] = useState(false);
  const [citas, setCitas] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);

  useEffect(() => {
    const unsub = subscribeToCollection("citas", setCitas);
    const unsubEv = subscribeToCollection("evaluaciones", setEvaluaciones);
    return () => {
      unsub();
      unsubEv();
    };
  }, []);

  // 4:00 PM Alarm logic check every 30 seconds
  useEffect(() => {
    if (currentUser?.rol !== "recepcionista") return;

    const checkAlarm = () => {
      const now = new Date();
      const currentHour = now.getHours();

      // Check if it's 4 PM or later
      if (currentHour >= 16) {
        // Find if we have appointments for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const tomorrowCitas = citas.filter(c => c.fecha === tomorrowStr);
        if (tomorrowCitas.length > 0) {
          // Check if reminders were sent (mock check using localstorage state)
          const saved = localStorage.getItem("meraki_sent_recordatorios");
          const sentState = saved ? JSON.parse(saved) : {};
          const sentForTomorrow = sentState[tomorrowStr] || {};
          
          const pendingCount = tomorrowCitas.filter(c => !sentForTomorrow[c.pacienteId]).length;
          
          if (pendingCount > 0) {
            setShow4pmAlarm(true);
            return;
          }
        }
      }
      setShow4pmAlarm(false);
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
    { id: "comisiones", title: "Comisiones", desc: "Liquidación por %", icon: <Calculator size={28} />, bg: "var(--purple-pastel-soft)", color: "var(--purple-dark)", roles: ["administrador", "recepcionista"] },
    { id: "ajustes", title: "Ajustes", desc: "Usuarios y tarifas", icon: <Settings size={28} />, bg: "var(--pink-pastel-soft)", color: "var(--pink-dark)", roles: ["administrador", "recepcionista"] }
  ];

  const visibleApps = appModules.filter(app => app.roles.includes(currentUser.rol));

  const renderActiveApp = () => {
    switch (activeApp) {
      case "pacientes": return <PacientesApp />;
      case "agenda": return <AgendaApp />;
      case "recordatorios": return <RecordatoriosApp />;
      case "caja": return <CajaApp />;
      case "evaluaciones": return <EvaluacionesApp />;
      case "tareas": return <TareasApp />;
      case "comisiones": return <ComisionesApp />;
      case "ajustes": return <AjustesApp />;
      case "dashboard_finanzas": return <FinanzasDashboardApp />;
      default: return null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      
      {/* 4:00 PM Alarm Banner Alert */}
      {show4pmAlarm && (
        <div style={{
          backgroundColor: "#FCE8E6", color: "#A8200D", padding: "14px 20px", display: "flex",
          justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #F3A094",
          fontSize: "0.9rem", fontWeight: "bold", gap: "10px", animation: "pulseSoft 2s infinite"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Bell size={20} className="shake" />
            <span>⏰ ¡ALERTA RECEPCIÓN! Son las 4:00 PM o más. Recuerda enviar los recordatorios de citas de mañana por WhatsApp.</span>
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
      {/* Header bar */}
      <header className="glass header-responsive" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 30px", borderBottom: "1px solid var(--border-light)", zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => setActiveApp("launchpad")}>
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
          {activeApp !== "launchpad" && (
            <button 
              className="btn btn-secondary" 
              onClick={() => setActiveApp("launchpad")}
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
          /* Odoo Launchpad App grid view */
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "32px", letterSpacing: "-0.5px" }}>
              Hola, {currentUser.nombre.split(" ")[0]} 👋
            </h2>
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
  const { currentUser } = useAuth();
  return currentUser ? <MainDashboard /> : <LoginScreen />;
}

export default App;
