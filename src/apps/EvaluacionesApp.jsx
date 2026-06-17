import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, getCollection, registrarLog } from "../db";
import { useAuth } from "../context/AuthContext";
import { FileText, Calendar, Clock, AlertTriangle, ShieldCheck, History, Edit, Plus, X, User, MessageCircle, Search } from "lucide-react";

export default function EvaluacionesApp() {
  const { currentUser } = useAuth();
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [terapeutas, setTerapeutas] = useState([]);
  const [auditorias, setAuditorias] = useState([]);

  const todayStr = new Date().toLocaleDateString("en-CA");
  const [activeTab, setActiveTab] = useState("activas");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTerapeuta, setFilterTerapeuta] = useState("todos");
  const [filterEstado, setFilterEstado] = useState("todos");

  const activeOverdueEvaluations = evaluaciones.filter(ev => {
    if (ev.estado === "entregado") return false;
    const isOverdueAcordada = (ev.estado === "en_sesion" || ev.estado === "redaccion" || ev.estado === "recibido") && 
                               ev.fechaAcordadaRecep && 
                               ev.fechaAcordadaRecep < todayStr;
    const isOverdueFin = ev.estado === "redaccion" && getElapsedDays(ev) > 5;
    return isOverdueAcordada || isOverdueFin;
  });
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  
  // Form states
  const [newEv, setNewEv] = useState({
    pacienteId: "", tipo: "EVALUACIÓN COMPLETA", terapeutaId: "",
    fechaInicio: "", fechaFin: "", fechaAcordadaRecep: "",
    observacion: ""
  });
  
  const [selectedEv, setSelectedEv] = useState(null);
  const [editForm, setEditForm] = useState({
    fechaInicio: "", fechaFin: "", fechaAcordadaRecep: "",
    fechaRealRecep: "", fechaEntregaPadre: "", observacion: "",
    estado: "en_sesion"
  });
  const [justification, setJustification] = useState("");

  useEffect(() => {
    const unsubEv = subscribeToCollection("evaluaciones", setEvaluaciones);
    const unsubPac = subscribeToCollection("pacientes", setPacientes);
    const unsubTer = subscribeToCollection("terapeutas", setTerapeutas);
    const unsubAud = subscribeToCollection("auditoria_evaluaciones", setAuditorias);
    return () => {
      unsubEv();
      unsubPac();
      unsubTer();
      unsubAud();
    };
  }, []);

  const calculateAge = (birthdate) => {
    if (!birthdate) return "Sin fecha";
    const birth = new Date(birthdate);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0) { years--; months += 12; }
    return `${years} AÑOS y ${months} MESES`;
  };

  const getElapsedDays = (ev) => {
    if (!ev.fechaFin) return 0;
    const end = new Date(ev.fechaFin);
    const real = ev.fechaRealRecep ? new Date(ev.fechaRealRecep) : new Date();
    const diff = Math.floor((real - end) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const checkFueraDeTiempo = (ev) => {
    const days = getElapsedDays(ev);
    return days >= 6;
  };

  const handleOpenEditModal = (ev) => {
    setSelectedEv(ev);
    setEditForm({
      fechaInicio: ev.fechaInicio || "",
      fechaFin: ev.fechaFin || "",
      fechaAcordadaRecep: ev.fechaAcordadaRecep || "",
      fechaRealRecep: ev.fechaRealRecep || "",
      fechaEntregaPadre: ev.fechaEntregaPadre || "",
      observacion: ev.observacion || "",
      estado: ev.estado || "en_sesion"
    });
    setJustification("");
    setShowEditModal(true);
  };

  const handleCreateEvaluation = async (e) => {
    e.preventDefault();
    if (!newEv.pacienteId || !newEv.terapeutaId) {
      alert("Seleccione paciente y terapeuta.");
      return;
    }

    const patient = pacientes.find(p => p.id === newEv.pacienteId);
    
    // Auto calculate agreed date if not entered (End + 14 days)
    let agreedDate = newEv.fechaAcordadaRecep;
    if (!agreedDate && newEv.fechaFin) {
      const end = new Date(newEv.fechaFin);
      end.setDate(end.getDate() + 14);
      agreedDate = end.toISOString().split('T')[0];
    }

    const evData = {
      id: "EV" + (evaluaciones.length + 1),
      pacienteId: newEv.pacienteId,
      nombrePaciente: patient?.nombre,
      cedula: patient?.id,
      edad: calculateAge(patient?.fechaNacimiento),
      tipo: newEv.tipo,
      terapeutaId: newEv.terapeutaId,
      fechaInicio: newEv.fechaInicio,
      fechaFin: newEv.fechaFin,
      fechaAcordadaRecep: agreedDate,
      fechaRealRecep: "",
      fechaEntregaPadre: "",
      observacion: newEv.observacion,
      estado: "en_sesion"
    };

    try {
      await addDocument("evaluaciones", evData);
      setShowAddModal(false);
      setNewEv({
        pacienteId: "", tipo: "EVALUACIÓN COMPLETA", terapeutaId: "",
        fechaInicio: "", fechaFin: "", fechaAcordadaRecep: "",
        observacion: ""
      });
      alert("Proceso de evaluación creado.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateEvaluation = async (e) => {
    e.preventDefault();
    if (!justification || justification.length < 15) {
      alert("Debe escribir un motivo descriptivo de al menos 15 caracteres para auditar los cambios.");
      return;
    }

    // Identify changed fields
    const changedFields = [];
    const logEntries = [];
    const fieldsToCheck = ["fechaInicio", "fechaFin", "fechaAcordadaRecep", "fechaRealRecep", "fechaEntregaPadre"];

    fieldsToCheck.forEach(field => {
      const oldVal = selectedEv[field] || "Vacio";
      const newVal = editForm[field] || "Vacio";
      if (oldVal !== newVal) {
        changedFields.push(field);
        logEntries.push({
          evaluacionId: selectedEv.id,
          usuario: currentUser?.nombre || "Usuario",
          fechaCambio: new Date().toISOString(),
          campoModificado: field,
          valorAnterior: oldVal,
          valorNuevo: newVal,
          justificacion: justification
        });
      }
    });

    try {
      // 1. Update the document
      await updateDocument("evaluaciones", selectedEv.id, {
        ...editForm
      });

      // 2. Add audit logs
      for (let log of logEntries) {
        await addDocument("auditoria_evaluaciones", log);
      }

      setShowEditModal(false);
      alert("Evaluación actualizada y auditoría registrada con éxito.");
    } catch (e) {
      console.error(e);
      alert("Error al actualizar la evaluación.");
    }
  };

  const sortedEvaluaciones = [...evaluaciones].sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
    return numB - numA;
  });

  const filteredEvaluations = sortedEvaluaciones.filter(ev => {
    const matchesTab = activeTab === "activas" ? ev.estado !== "entregado" : ev.estado === "entregado";
    const matchesSearch = 
      ev.nombrePaciente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTerapeuta = filterTerapeuta === "todos" ? true : ev.terapeutaId === filterTerapeuta;
    const matchesEstado = filterEstado === "todos" ? true : ev.estado === filterEstado;
    return matchesTab && matchesSearch && matchesTerapeuta && matchesEstado;
  });

  const handleStatusCardClick = (status) => {
    if (status === "entregado") {
      setActiveTab("entregadas");
      setFilterEstado(filterEstado === "entregado" ? "todos" : "entregado");
    } else {
      setActiveTab("activas");
      setFilterEstado(filterEstado === status ? "todos" : status);
    }
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      {/* CABECERA PRINCIPAL */}
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Seguimiento de Evaluaciones</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Control de entrega de informes clínicos y cumplimiento de plazos.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-secondary" onClick={() => setShowAuditModal(true)}>
            <History size={16} /> Bitácora de Auditoría
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Crear Evaluación
          </button>
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS INTERACTIVAS */}
      <div style={{
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "24px"
      }}>
        {/* En Sesiones */}
        <div 
          onClick={() => handleStatusCardClick("en_sesion")}
          style={{
            backgroundColor: "white",
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            borderTop: "4px solid var(--purple-base)",
            flex: "1 1 200px",
            boxShadow: filterEstado === "en_sesion" ? "0 0 0 2px var(--purple-base), var(--shadow-md)" : "var(--shadow-sm)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            transform: filterEstado === "en_sesion" ? "translateY(-2px)" : "none"
          }}
          className="table-row-hover"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>En Sesiones</span>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--purple-base)" }}></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-main)", marginTop: "8px" }}>
            {evaluaciones.filter(e => e.estado === "en_sesion").length}
          </div>
        </div>

        {/* En Redacción */}
        <div 
          onClick={() => handleStatusCardClick("redaccion")}
          style={{
            backgroundColor: "white",
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            borderTop: "4px solid #F59E0B",
            flex: "1 1 200px",
            boxShadow: filterEstado === "redaccion" ? "0 0 0 2px #F59E0B, var(--shadow-md)" : "var(--shadow-sm)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            transform: filterEstado === "redaccion" ? "translateY(-2px)" : "none"
          }}
          className="table-row-hover"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>En Redacción (Informes)</span>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#F59E0B" }}></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-main)", marginTop: "8px" }}>
            {evaluaciones.filter(e => e.estado === "redaccion").length}
          </div>
        </div>

        {/* Listos en Recepción */}
        <div 
          onClick={() => handleStatusCardClick("recibido")}
          style={{
            backgroundColor: "white",
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            borderTop: "4px solid #3B82F6",
            flex: "1 1 200px",
            boxShadow: filterEstado === "recibido" ? "0 0 0 2px #3B82F6, var(--shadow-md)" : "var(--shadow-sm)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            transform: filterEstado === "recibido" ? "translateY(-2px)" : "none"
          }}
          className="table-row-hover"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>Listos en Recepción</span>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#3B82F6" }}></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-main)", marginTop: "8px" }}>
            {evaluaciones.filter(e => e.estado === "recibido").length}
          </div>
        </div>

        {/* Entregados a Padres */}
        <div 
          onClick={() => handleStatusCardClick("entregado")}
          style={{
            backgroundColor: "white",
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            borderTop: "4px solid #10B981",
            flex: "1 1 200px",
            boxShadow: filterEstado === "entregado" ? "0 0 0 2px #10B981, var(--shadow-md)" : "var(--shadow-sm)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            transform: filterEstado === "entregado" ? "translateY(-2px)" : "none"
          }}
          className="table-row-hover"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>Entregados a Padres</span>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10B981" }}></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-main)", marginTop: "8px" }}>
            {evaluaciones.filter(e => e.estado === "entregado").length}
          </div>
        </div>
      </div>

      {/* DISEÑO EN DOS COLUMNAS FLEXIBLES */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
        
        {/* COLUMNA IZQUIERDA: LISTADO PRINCIPAL (Filtros y Tabla) */}
        <div style={{ 
          flex: activeTab === "activas" ? "2.3 1 650px" : "1 1 100%", 
          minWidth: 0,
          display: "flex", 
          flexDirection: "column", 
          gap: "16px" 
        }}>
          
          {/* BARRA DE FILTROS */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            {/* Pestañas */}
            <div style={{ display: "flex", gap: "4px", backgroundColor: "#F3F4F6", padding: "4px", borderRadius: "8px" }}>
              <button
                onClick={() => { setActiveTab("activas"); setFilterEstado("todos"); }}
                style={{
                  padding: "6px 16px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor: activeTab === "activas" ? "white" : "transparent",
                  color: activeTab === "activas" ? "var(--purple-dark)" : "var(--text-muted)",
                  boxShadow: activeTab === "activas" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                Evaluaciones Activas ({evaluaciones.filter(e => e.estado !== "entregado").length})
              </button>
              <button
                onClick={() => { setActiveTab("entregadas"); setFilterEstado("todos"); }}
                style={{
                  padding: "6px 16px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor: activeTab === "entregadas" ? "white" : "transparent",
                  color: activeTab === "entregadas" ? "var(--purple-dark)" : "var(--text-muted)",
                  boxShadow: activeTab === "entregadas" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                Historial de Entregas ({evaluaciones.filter(e => e.estado === "entregado").length})
              </button>
            </div>

            {/* Búsqueda y Terapeuta */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
              <div style={{ position: "relative", minWidth: "220px" }}>
                <Search style={{ position: "absolute", left: "10px", top: "9px", color: "var(--text-muted)" }} size={16} />
                <input
                  type="text"
                  placeholder="Buscar por paciente o ID..."
                  className="input-field"
                  style={{ paddingLeft: "32px", fontSize: "0.85rem", height: "34px", margin: 0 }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="input-field"
                style={{ width: "180px", fontSize: "0.85rem", height: "34px", margin: 0 }}
                value={filterTerapeuta}
                onChange={(e) => setFilterTerapeuta(e.target.value)}
              >
                <option value="todos">Todos los Terapeutas</option>
                {terapeutas
                  .filter(t => !t.nombre.includes("Recepción") && !t.nombre.includes("Recepcion") && !t.nombre.includes("Josua") && !t.nombre.includes("Joshua"))
                  .map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* TABLA PRINCIPAL */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
            <div className="responsive-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    <th style={{ padding: "12px 8px" }}>ID</th>
                    <th style={{ padding: "12px 8px" }}>PACIENTE</th>
                    <th style={{ padding: "12px 8px" }}>EDAD</th>
                    <th style={{ padding: "12px 8px" }}>TIPO</th>
                    <th style={{ padding: "12px 8px" }}>TERAPEUTA</th>
                    {activeTab === "activas" ? (
                      <>
                        <th style={{ padding: "12px 8px" }}>ESTADO</th>
                        <th style={{ padding: "12px 8px" }}>DÍAS TRANSCURRIDOS</th>
                        <th style={{ padding: "12px 8px" }}>FECHA LÍMITE</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: "12px 8px" }}>RECEPCIÓN</th>
                        <th style={{ padding: "12px 8px" }}>ENTREGA A PADRES</th>
                        <th style={{ padding: "12px 8px" }}>PLAZO</th>
                      </>
                    )}
                    <th style={{ padding: "12px 8px", textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvaluations.map((ev) => {
                    const days = getElapsedDays(ev);
                    const isLate = checkFueraDeTiempo(ev);
                    const therapist = terapeutas.find(t => t.id === ev.terapeutaId);
                    const isOverdueAcordada = (ev.estado === "en_sesion" || ev.estado === "redaccion") && ev.fechaAcordadaRecep && ev.fechaAcordadaRecep < todayStr;
                    
                    const patient = pacientes.find(p => p.id === ev.pacienteId);
                    const ageStr = patient ? calculateAge(patient.fechaNacimiento) : (ev.edad || "N/A");

                    return (
                      <tr key={ev.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "55px" }} className="table-row-hover">
                        <td style={{ padding: "12px 8px", fontWeight: 600, color: "var(--purple-dark)" }}>{ev.id}</td>
                        <td style={{ padding: "12px 8px", fontWeight: 500 }}>{ev.nombrePaciente}</td>
                        <td style={{ padding: "12px 8px", fontSize: "0.85rem", color: "var(--text-muted)" }}>{ageStr}</td>
                        <td style={{ padding: "12px 8px", fontSize: "0.85rem", color: "var(--text-main)" }}>{ev.tipo}</td>
                        <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{therapist?.nombre || "Terapeuta"}</td>
                        
                        {activeTab === "activas" ? (
                          <>
                            <td style={{ padding: "12px 8px" }}>
                              <span style={{
                                padding: "4px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600,
                                backgroundColor: ev.estado === "en_sesion" ? "var(--purple-light)" : ev.estado === "redaccion" ? "#FEF3C7" : "#DBEAFE",
                                color: ev.estado === "en_sesion" ? "var(--purple-dark)" : ev.estado === "redaccion" ? "#B45309" : "#1E40AF"
                              }}>
                                {ev.estado === "en_sesion" ? "EN SESIÓN" : ev.estado === "redaccion" ? "REDACCIÓN" : "EN RECEPCIÓN"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 8px", fontWeight: 500, fontSize: "0.85rem" }}>
                              {ev.fechaFin ? (
                                <span style={{ color: ev.estado === "redaccion" && days > 5 ? "#EF4444" : "inherit" }}>
                                  {days} días desde fin
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>En sesiones</span>
                              )}
                            </td>
                            <td style={{ padding: "12px 8px", fontSize: "0.85rem" }}>
                              {ev.fechaAcordadaRecep ? (
                                <span style={{
                                  color: isOverdueAcordada ? "#EF4444" : "var(--text-main)",
                                  fontWeight: isOverdueAcordada ? 600 : "normal"
                                }}>
                                  {ev.fechaAcordadaRecep}
                                  {isOverdueAcordada && " (Vencido)"}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Sin definir</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: "12px 8px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                              {ev.fechaRealRecep || "N/A"}
                            </td>
                            <td style={{ padding: "12px 8px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                              {ev.fechaEntregaPadre || "Pendiente"}
                            </td>
                            <td style={{ padding: "12px 8px" }}>
                              {isLate ? (
                                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "inline-flex", gap: "4px", alignItems: "center" }}>
                                  <AlertTriangle size={12} color="#F59E0B" /> Entregado con retraso
                                </span>
                              ) : (
                                <span style={{ color: "#065F46", fontSize: "0.8rem", display: "inline-flex", gap: "4px", alignItems: "center" }}>
                                  <ShieldCheck size={12} color="#10B981" /> A tiempo
                                </span>
                              )}
                            </td>
                          </>
                        )}

                        <td style={{ padding: "12px 8px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                            {activeTab === "activas" && (
                              <>
                                {therapist?.telefono ? (
                                  <button
                                    className="btn"
                                    style={{ padding: "4px 8px", fontSize: "0.8rem", backgroundColor: "#E0F2FE", color: "#0369A1", border: "1px solid #BAE6FD" }}
                                    onClick={async () => {
                                      const msg = `Hola ${therapist.nombre}, te saluda MERAKI. Tienes asignada la evaluación de ${ev.nombrePaciente} (${ev.tipo}). Recuerda que el informe escrito debe ser entregado en recepción a los 5 días de haber concluido la evaluación. La fecha límite acordada es el ${ev.fechaAcordadaRecep || "N/A"}. ¡Muchas gracias!`;
                                      const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "").replace(/^0/, "593")}&text=${encodeURIComponent(msg)}`;
                                      window.open(url, "_blank");
                                      await registrarLog(
                                        currentUser,
                                        "Evaluaciones (Alerta WA)",
                                        `Envió alerta de informe por WhatsApp al terapeuta ${therapist.nombre} para el paciente ${ev.nombrePaciente}`
                                      );
                                    }}
                                    title="Enviar recordatorio de plazo por WhatsApp"
                                  >
                                    <MessageCircle size={14} /> Recordar
                                  </button>
                                ) : (
                                  <button
                                    className="btn"
                                    style={{ padding: "4px 8px", fontSize: "0.8rem", backgroundColor: "#F3F4F6", color: "var(--text-muted)", border: "1px solid var(--border-light)", cursor: "not-allowed" }}
                                    disabled
                                    title="Configure el celular del terapeuta en Ajustes para enviar alerta"
                                  >
                                    <MessageCircle size={14} /> Recordar
                                  </button>
                                )}
                              </>
                            )}
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                              onClick={() => handleOpenEditModal(ev)}
                            >
                              <Edit size={14} /> Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredEvaluations.length === 0 && (
                    <tr>
                      <td colSpan={activeTab === "activas" ? 9 : 9} style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                        No se encontraron evaluaciones.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: SIDEBAR DE ALERTAS DE ATRASO (Solo visible en Evaluaciones Activas) */}
        {activeTab === "activas" && (
          <div style={{ 
            flex: "1 1 300px", 
            minWidth: 0,
            position: "sticky",
            top: "20px"
          }}>
            <div className="glass" style={{ 
              padding: "20px", 
              borderRadius: "var(--radius-md)", 
              boxShadow: "var(--shadow-sm)",
              borderLeft: "5px solid #EF4444",
              backgroundColor: "rgba(255, 255, 255, 0.95)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ color: "#991B1B", fontWeight: 600, fontSize: "1.05rem", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertTriangle size={18} color="#EF4444" />
                  Fuera de Plazo
                </h3>
                <span style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: 700, 
                  color: "white", 
                  backgroundColor: "#EF4444", 
                  padding: "2px 8px", 
                  borderRadius: "10px" 
                }}>
                  {activeOverdueEvaluations.length}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "500px", overflowY: "auto", paddingRight: "4px" }}>
                {activeOverdueEvaluations.map(ev => {
                  const days = getElapsedDays(ev);
                  const therapist = terapeutas.find(t => t.id === ev.terapeutaId);
                  const isOverdueAcordada = (ev.estado === "en_sesion" || ev.estado === "redaccion") && ev.fechaAcordadaRecep && ev.fechaAcordadaRecep < todayStr;
                  const isOverdueFin = ev.estado === "redaccion" && days > 5;
                  
                  let delayMsg = "";
                  if (isOverdueAcordada && isOverdueFin) {
                    delayMsg = `Venció (${ev.fechaAcordadaRecep}) y lleva ${days} días desde fin.`;
                  } else if (isOverdueAcordada) {
                    delayMsg = `Superó fecha límite (${ev.fechaAcordadaRecep}).`;
                  } else if (isOverdueFin) {
                    delayMsg = `Lleva ${days} días desde fin (Límite: 5d).`;
                  }

                  return (
                    <div key={ev.id} style={{
                      backgroundColor: "#FFF5F5",
                      border: "1px solid #FCA5A5",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontWeight: 600, color: "#111827", fontSize: "0.85rem" }}>{ev.nombrePaciente}</span>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#B91C1C", backgroundColor: "#FEE2E2", padding: "1px 5px", borderRadius: "4px" }}>
                          {ev.id}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {ev.tipo} • <strong>{therapist?.nombre || "Terapeuta"}</strong>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#B91C1C", display: "flex", alignItems: "center", gap: "4px", fontWeight: 500 }}>
                        <Clock size={12} /> {delayMsg}
                      </div>

                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
                        {therapist?.telefono ? (
                          <button
                            className="btn"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.75rem",
                              backgroundColor: "#FEE2E2",
                              color: "#991B1B",
                              border: "1px solid #FCA5A5",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                            onClick={async () => {
                              const msg = `Hola ${therapist.nombre}, te saluda MERAKI. Te recordamos amablemente que la evaluación de ${ev.nombrePaciente} (${ev.tipo}) se encuentra fuera de plazo. La fecha acordada de recepción era el ${ev.fechaAcordadaRecep || "N/A"}. Por favor, ingresa el informe hoy para poder coordinar la entrega. ¡Muchas gracias!`;
                              const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "").replace(/^0/, "593")}&text=${encodeURIComponent(msg)}`;
                              window.open(url, "_blank");
                              await registrarLog(
                                currentUser,
                                "Evaluaciones (Alerta WA)",
                                `Envió alerta de informe por WhatsApp al terapeuta ${therapist.nombre} para el paciente ${ev.nombrePaciente}`
                              );
                            }}
                          >
                            <MessageCircle size={12} /> Alerta
                          </button>
                        ) : (
                          <button
                            className="btn"
                            style={{ padding: "4px 8px", fontSize: "0.75rem", backgroundColor: "#F3F4F6", color: "var(--text-muted)", border: "1px solid var(--border-light)", cursor: "not-allowed" }}
                            disabled
                          >
                            <MessageCircle size={12} /> Alerta
                          </button>
                        )}
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          onClick={() => handleOpenEditModal(ev)}
                        >
                          <Edit size={12} /> Editar
                        </button>
                      </div>
                    </div>
                  );
                })}

                {activeOverdueEvaluations.length === 0 && (
                  <div style={{ 
                    textAlign: "center", 
                    padding: "20px 10px", 
                    color: "#065F46",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px"
                  }}>
                    <ShieldCheck size={36} color="#10B981" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      ¡Todo al día! Sin evaluaciones retrasadas.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "500px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontWeight: 600, color: "var(--purple-dark)" }}>Iniciar Nueva Evaluación</h3>
              <button style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateEvaluation} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Paciente*</label>
                <select required className="input-field" value={newEv.pacienteId} onChange={(e) => setNewEv({...newEv, pacienteId: e.target.value})}>
                  <option value="">Seleccione Paciente...</option>
                  {pacientes
                    .filter(p => p.estado === "activo")
                    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" }))
                    .map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Tipo de Evaluación*</label>
                <select className="input-field" value={newEv.tipo} onChange={(e) => setNewEv({...newEv, tipo: e.target.value})}>
                  <option value="EVALUACIÓN COMPLETA">EVALUACIÓN COMPLETA</option>
                  <option value="OBSERVACIÓN CLÍNICA">OBSERVACIÓN CLÍNICA</option>
                  <option value="EVALUACIÓN DE LENGUAJE">EVALUACIÓN DE LENGUAJE</option>
                  <option value="VALORACIÓN CLÍNICA">VALORACIÓN CLÍNICA</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Terapeuta Evaluador*</label>
                <select required className="input-field" value={newEv.terapeutaId} onChange={(e) => setNewEv({...newEv, terapeutaId: e.target.value})}>
                  <option value="">Seleccione Terapeuta...</option>
                  {terapeutas
                    .filter(t => !t.nombre.includes("Recepción") && !t.nombre.includes("Recepcion") && !t.nombre.includes("Josua") && !t.nombre.includes("Joshua"))
                    .map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fecha Inicio*</label>
                  <input type="date" required className="input-field" value={newEv.fechaInicio} onChange={(e) => setNewEv({...newEv, fechaInicio: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fecha Fin (Estimada)*</label>
                  <input type="date" required className="input-field" value={newEv.fechaFin} onChange={(e) => setNewEv({...newEv, fechaFin: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Observaciones Iniciales</label>
                <textarea rows="2" className="input-field" value={newEv.observacion} onChange={(e) => setNewEv({...newEv, observacion: e.target.value})}></textarea>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Iniciar Proceso</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEv && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "500px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontWeight: 600, color: "var(--purple-dark)" }}>Actualizar Fechas de Evaluación</h3>
              <button style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateEvaluation} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "0.85rem", backgroundColor: "var(--purple-light)", padding: "10px", borderRadius: "var(--radius-sm)" }}>
                <strong>Paciente:</strong> {selectedEv.nombrePaciente}<br />
                <strong>Evaluación:</strong> {selectedEv.tipo}
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Estado de la Evaluación</label>
                <select className="input-field" value={editForm.estado} onChange={(e) => setEditForm({...editForm, estado: e.target.value})}>
                  <option value="en_sesion">En Sesión</option>
                  <option value="redaccion">En Redacción (Informes)</option>
                  <option value="recibido">Recibido en Recepción</option>
                  <option value="entregado">Entregado a Padres</option>
                </select>
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Inicio Evaluación</label>
                  <input type="date" className="input-field" value={editForm.fechaInicio} onChange={(e) => setEditForm({...editForm, fechaInicio: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fin Evaluación</label>
                  <input type="date" className="input-field" value={editForm.fechaFin} onChange={(e) => setEditForm({...editForm, fechaFin: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Acordado Recepción (Límite)</label>
                  <input type="date" className="input-field" value={editForm.fechaAcordadaRecep} onChange={(e) => setEditForm({...editForm, fechaAcordadaRecep: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Real Entrega Recepción</label>
                  <input type="date" className="input-field" value={editForm.fechaRealRecep} onChange={(e) => setEditForm({...editForm, fechaRealRecep: e.target.value})} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Entrega a los Padres</label>
                  <input type="date" className="input-field" value={editForm.fechaEntregaPadre} onChange={(e) => setEditForm({...editForm, fechaEntregaPadre: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Observaciones</label>
                <textarea rows="2" className="input-field" value={editForm.observacion} onChange={(e) => setEditForm({...editForm, observacion: e.target.value})}></textarea>
              </div>

              {/* Mandatory Reason for audit logs */}
              <div style={{ backgroundColor: "#FEF3C7", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid #F59E0B" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#B45309", display: "flex", gap: "4px", alignItems: "center" }}>
                  <AlertTriangle size={14} /> JUSTIFICACIÓN DE MODIFICACIÓN*
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej. Terapeuta se enfermó / Padre reprogramó entrega (Mín. 15 caract.)"
                  className="input-field"
                  style={{ marginTop: "6px" }}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Faltan {Math.max(0, 15 - justification.length)} caracteres.</span>
              </div>

              {/* Show previous audit history for this evaluation */}
              <div>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Historial de Auditoría Interno</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "100px", overflowY: "auto", fontSize: "0.75rem", backgroundColor: "var(--bg-secondary)", padding: "6px", borderRadius: "var(--radius-sm)" }}>
                  {auditorias
                    .filter(a => a.evaluacionId === selectedEv.id)
                    .map((a, i) => (
                      <div key={i} style={{ borderBottom: "1px solid var(--border-soft)", paddingBottom: "4px", marginBottom: "4px" }}>
                        <strong>{a.usuario}</strong> ({new Date(a.fechaCambio).toLocaleDateString()}) - <em>Modificó: {a.campoModificado}</em><br />
                        <span style={{ color: "var(--text-muted)" }}>{a.valorAnterior} ➔ {a.valorNuevo} | Motivo: "{a.justificacion}"</span>
                      </div>
                    ))}
                  {auditorias.filter(a => a.evaluacionId === selectedEv.id).length === 0 && (
                    <span style={{ color: "var(--text-muted)" }}>No se registran cambios de fechas en esta evaluación.</span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={justification.length < 15}>Guardar con Auditoría</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Audit List Modal */}
      {showAuditModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "650px", maxWidth: "90%", maxHeight: "80vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", display: "flex", alignItems: "center", gap: "8px" }}>
                <History size={20} /> Historial Global de Auditoría de Fechas
              </h3>
              <button style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => setShowAuditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {auditorias.map((a, i) => (
                <div key={i} className="glass" style={{ padding: "12px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                    <span style={{ fontWeight: "bold" }}>Evaluación ID: {a.evaluacionId}</span>
                    <span>{new Date(a.fechaCambio).toLocaleString("es-ES")}</span>
                  </div>
                  <div>
                    Modificado por: <strong>{a.usuario}</strong>
                  </div>
                  <div style={{ color: "var(--purple-dark)", fontSize: "0.8rem", fontWeight: 500 }}>
                    Campo: <span style={{ fontFamily: "monospace" }}>{a.campoModificado}</span> | Valor: {a.valorAnterior} ➔ {a.valorNuevo}
                  </div>
                  <div style={{ borderLeft: "2px solid var(--pink-base)", paddingLeft: "8px", color: "var(--text-muted)", fontStyle: "italic", marginTop: "4px" }}>
                    Justificación: "{a.justificacion}"
                  </div>
                </div>
              ))}
              {auditorias.length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No se han registrado modificaciones de auditoría de fechas.</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
