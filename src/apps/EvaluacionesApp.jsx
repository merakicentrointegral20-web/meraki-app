import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, getCollection } from "../db";
import { useAuth } from "../context/AuthContext";
import { FileText, Calendar, Clock, AlertTriangle, ShieldCheck, History, Edit, Plus, X, User, MessageCircle } from "lucide-react";

export default function EvaluacionesApp() {
  const { currentUser } = useAuth();
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [terapeutas, setTerapeutas] = useState([]);
  const [auditorias, setAuditorias] = useState([]);

  const todayStr = new Date().toLocaleDateString("en-CA");
  const overdueEvaluations = evaluaciones.filter(ev => 
    (ev.estado === "en_sesion" || ev.estado === "redaccion") && 
    ev.fechaAcordadaRecep && 
    ev.fechaAcordadaRecep < todayStr
  );
  
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
    return days >= 11;
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

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
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

      {overdueEvaluations.length > 0 && (
        <div style={{
          backgroundColor: "#FDF2F2", color: "#9B1C1C", padding: "14px 20px", borderRadius: "var(--radius-md)",
          border: "1px solid #FDE8E8", marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center"
        }}>
          <AlertTriangle size={20} color="#9B1C1C" className="shake" />
          <div>
            <strong>⚠️ Alerta de Entrega Expirada:</strong> Se registran {overdueEvaluations.length} evaluaciones que han excedido su Fecha Acordada de entrega. Por favor, solicite a los terapeutas correspondientes redactar e ingresar los informes.
          </div>
        </div>
      )}

      {/* Grid of statuses (Odoo style kanban header) */}
      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {["en_sesion", "redaccion", "recibido", "entregado"].map(state => {
          const count = evaluaciones.filter(e => e.estado === state).length;
          const label = state === "en_sesion" ? "En Sesiones" : state === "redaccion" ? "En Redacción (10d)" : state === "recibido" ? "En Recepción" : "Entregado a Padres";
          const borderC = state === "en_sesion" ? "var(--purple-base)" : state === "redaccion" ? "#D97706" : state === "recibido" ? "#2563EB" : "#10B981";
          return (
            <div key={state} className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", borderTop: `4px solid ${borderC}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
                <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Evaluations Table */}
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
              <th style={{ padding: "12px 8px" }}>DIAS TRANSCURRIDOS</th>
              <th style={{ padding: "12px 8px" }}>ESTADO</th>
              <th style={{ padding: "12px 8px" }}>INDICADOR</th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {evaluaciones.map((ev) => {
              const days = getElapsedDays(ev);
              const isLate = checkFueraDeTiempo(ev);
              const therapist = terapeutas.find(t => t.id === ev.terapeutaId);
              const isOverdueAcordada = (ev.estado === "en_sesion" || ev.estado === "redaccion") && ev.fechaAcordadaRecep && ev.fechaAcordadaRecep < todayStr;
              
              return (
                <tr key={ev.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "55px" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 600, color: "var(--purple-dark)" }}>{ev.id}</td>
                  <td style={{ padding: "12px 8px", fontWeight: 500 }}>{ev.nombrePaciente}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.85rem" }}>{ev.edad}</td>
                  <td style={{ padding: "12px 8px" }}>{ev.tipo}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{therapist?.nombre || "Terapeuta"}</td>
                  <td style={{ padding: "12px 8px", fontWeight: 500 }}>
                    {ev.fechaFin ? `${days} días` : "No terminada"}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span style={{
                      padding: "4px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600,
                      backgroundColor: ev.estado === "en_sesion" ? "var(--purple-light)" : ev.estado === "redaccion" ? "#FEF3C7" : ev.estado === "recibido" ? "#DBEAFE" : "#D1FAE5",
                      color: ev.estado === "en_sesion" ? "var(--purple-dark)" : ev.estado === "redaccion" ? "#B45309" : ev.estado === "recibido" ? "#1E40AF" : "#065F46"
                    }}>
                      {ev.estado === "en_sesion" ? "EN SESION" : ev.estado === "redaccion" ? "REDACCIÓN" : ev.estado === "recibido" ? "RECIBIDO" : "ENTREGADO"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {isOverdueAcordada ? (
                      <span style={{ color: "var(--pink-dark)", backgroundColor: "var(--pink-light)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", display: "inline-flex", gap: "4px", alignItems: "center", animation: "pulseSoft 2s infinite" }}>
                        <AlertTriangle size={12} /> EXCEDIDA ({ev.fechaAcordadaRecep})
                      </span>
                    ) : ev.estado === "en_sesion" || ev.estado === "redaccion" ? (
                      <span style={{ color: "var(--purple-dark)", backgroundColor: "var(--purple-light)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", display: "inline-flex", gap: "4px", alignItems: "center" }}>
                        <Clock size={12} /> EN PLAZO (Límite: {ev.fechaAcordadaRecep || "N/A"})
                      </span>
                    ) : (
                      isLate ? (
                        <span style={{ color: "var(--pink-dark)", backgroundColor: "var(--pink-light)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", display: "inline-flex", gap: "4px", alignItems: "center" }}>
                          <AlertTriangle size={12} /> FUERA DE TIEMPO
                        </span>
                      ) : (
                        <span style={{ color: "#065F46", backgroundColor: "#D1FAE5", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", display: "inline-flex", gap: "4px", alignItems: "center" }}>
                          <ShieldCheck size={12} /> ENTREGADA A TIEMPO
                        </span>
                      )
                    )}
                  </td>
                   <td style={{ padding: "12px 8px", textAlign: "right" }}>
                     <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                       {therapist?.telefono ? (
                         <button
                           className="btn"
                           style={{ padding: "4px 8px", fontSize: "0.8rem", backgroundColor: "#D1FAE5", color: "#065F46", border: "1px solid #A7F3D0" }}
                           onClick={() => {
                             const msg = `Hola ${therapist.nombre}, te saluda MERAKI. Tienes asignada la evaluación de ${ev.nombrePaciente} (${ev.tipo}). Recuerda que el informe escrito debe ser entregado en recepción a los 10 días de haber concluido la evaluación. La fecha máxima de entrega acordada es el ${ev.fechaAcordadaRecep || "N/A"}. ¡Muchas gracias!`;
                             const url = `https://api.whatsapp.com/send?phone=${therapist.telefono.replace(/[^0-9]/g, "")}&text=${encodeURIComponent(msg)}`;
                             window.open(url, "_blank");
                           }}
                           title="Notificar asignación de evaluación por WhatsApp"
                         >
                           <MessageCircle size={14} /> Alerta
                         </button>
                       ) : (
                         <button
                           className="btn"
                           style={{ padding: "4px 8px", fontSize: "0.8rem", backgroundColor: "#F3F4F6", color: "var(--text-muted)", border: "1px solid var(--border-light)", cursor: "not-allowed" }}
                           disabled
                           title="Configure el celular del terapeuta en Ajustes para enviar alerta"
                         >
                           <MessageCircle size={14} /> Alerta
                         </button>
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
            {evaluaciones.length === 0 && (
              <tr>
                <td colSpan="9" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>No hay procesos de evaluación activos.</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
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
                  {pacientes.filter(p => p.estado === "activo").map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
                  {terapeutas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
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
