import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, getCollection } from "../db";
import { User, Phone, MapPin, FileText, Plus, Search, ShieldAlert, X, ChevronRight, Edit2 } from "lucide-react";

export default function PacientesApp() {
  const [pacientes, setPacientes] = useState([]);
  const [terapeutas, setTerapeutas] = useState([]);
  const [listaNegra, setListaNegra] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  
  // Forms
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [newPaciente, setNewPaciente] = useState({
    id: "", nombre: "", fechaNacimiento: "", representante: "", cedulaRepresentante: "",
    telefono: "", telefonoEmergencia: "", ciudad: "", terapeutaAsignadoId: "",
    requiereFactura: false,
    datosFacturacion: { ruc: "", nombre: "", correo: "", direccion: "", telefono: "" }
  });
  const [deactivateInfo, setDeactivateInfo] = useState({
    estado: "inactivo", motivoSalida: "", fechaSalida: new Date().toISOString().split('T')[0]
  });
  const [newDiagText, setNewDiagText] = useState("");

  useEffect(() => {
    const unsubPacientes = subscribeToCollection("pacientes", setPacientes);
    const unsubTerapeutas = subscribeToCollection("terapeutas", setTerapeutas);
    const unsubListaNegra = subscribeToCollection("lista_negra", setListaNegra);
    return () => {
      unsubPacientes();
      unsubTerapeutas();
      unsubListaNegra();
    };
  }, []);

  const calculateAge = (birthdate) => {
    if (!birthdate) return "Sin fecha";
    const birth = new Date(birthdate);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    return `${years} AÑOS y ${months} MESES`;
  };

  const handleAddPaciente = async (e) => {
    e.preventDefault();
    if (!newPaciente.id || !newPaciente.nombre) {
      alert("Cédula y Nombre son obligatorios");
      return;
    }
    // Check duplicates
    if (pacientes.some(p => p.id === newPaciente.id)) {
      alert("Error: Ya existe un paciente registrado con esta Cédula.");
      return;
    }

    try {
      const dataToSave = {
        ...newPaciente,
        estado: "activo",
        diagnosticos: newDiagText ? [{ fecha: new Date().toISOString().split('T')[0], diagnostico: newDiagText, usuario: "Recepción" }] : []
      };
      await addDocument("pacientes", dataToSave);
      setShowAddForm(false);
      setNewPaciente({
        id: "", nombre: "", fechaNacimiento: "", representante: "", cedulaRepresentante: "",
        telefono: "", telefonoEmergencia: "", ciudad: "", terapeutaAsignadoId: "",
        requiereFactura: false,
        datosFacturacion: { ruc: "", nombre: "", correo: "", direccion: "", telefono: "" }
      });
      setNewDiagText("");
      alert("Paciente registrado con éxito.");
    } catch (e) {
      console.error(e);
      alert("Error al registrar paciente.");
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateInfo.motivoSalida) {
      alert("Debe escribir un motivo de salida.");
      return;
    }
    try {
      await updateDocument("pacientes", selectedPaciente.id, {
        estado: deactivateInfo.estado,
        motivoSalida: deactivateInfo.motivoSalida,
        fechaSalida: deactivateInfo.fechaSalida
      });
      
      // Auto cancel future appointments for this patient
      const appointments = await getCollection("citas");
      const futureAppointments = appointments.filter(c => c.pacienteId === selectedPaciente.id && c.fecha >= deactivateInfo.fechaSalida);
      for (let app of futureAppointments) {
        await updateDocument("citas", app.id, { estadoAsistencia: "pendiente", cobrada: false });
      }

      setShowDeactivateModal(false);
      setSelectedPaciente(null);
      alert(`Paciente marcado como ${deactivateInfo.estado} y citas futuras liberadas.`);
    } catch (e) {
      console.error(e);
      alert("Error al actualizar estado del paciente.");
    }
  };

  const handleAddDiagnosis = async () => {
    if (!newDiagText.trim()) return;
    const updatedDiag = [
      ...(selectedPaciente.diagnosticos || []),
      { fecha: new Date().toISOString().split('T')[0], diagnostico: newDiagText, usuario: "Administrador" }
    ];
    try {
      await updateDocument("pacientes", selectedPaciente.id, { diagnosticos: updatedDiag });
      setSelectedPaciente({ ...selectedPaciente, diagnosticos: updatedDiag });
      setNewDiagText("");
      alert("Diagnóstico actualizado.");
    } catch (e) {
      console.error(e);
    }
  };

  const checkBlacklist = (paciente) => {
    return listaNegra.some(
      ln => ln.nombre?.toLowerCase() === paciente.nombre?.toLowerCase() ||
            ln.representante?.toLowerCase() === paciente.representante?.toLowerCase()
    );
  };

  const filteredPacientes = pacientes.filter(p => {
    const matchesSearch = 
      p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.representante?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id?.includes(searchTerm);
      
    const matchesEstado = 
      filterEstado === "todos" ? true : p.estado === filterEstado;

    return matchesSearch && matchesEstado;
  });

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Directorio de Pacientes</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Administra las fichas de los niños y representantes.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus size={18} /> Registrar Paciente
        </button>
      </div>

      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: selectedPaciente ? "1.5fr 1fr" : "1fr", gap: "20px" }}>
        {/* Pacientes List Card */}
        <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
          <div className="responsive-flex" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <Search style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} size={18} />
              <input 
                type="text" 
                placeholder="Buscar por niño, representante o cédula..." 
                className="input-field" 
                style={{ paddingLeft: "38px" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="input-field" 
              style={{ width: "160px" }}
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              <option value="todos">Todos los Estados</option>
              <option value="activo">Activo</option>
              <option value="inactivos">Inactivo/Retirado</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>

          <div className="responsive-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  <th style={{ padding: "12px 8px" }}>NINO</th>
                  <th style={{ padding: "12px 8px" }}>CÉDULA</th>
                  <th style={{ padding: "12px 8px" }}>EDAD</th>
                  <th style={{ padding: "12px 8px" }}>REPRESENTANTE</th>
                  <th style={{ padding: "12px 8px" }}>ESTADO</th>
                  <th style={{ padding: "12px 8px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredPacientes.map((p) => {
                  const isBlocked = checkBlacklist(p);
                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedPaciente(p)}
                      style={{ 
                        borderBottom: "1px solid var(--border-soft)", 
                        cursor: "pointer",
                        backgroundColor: selectedPaciente?.id === p.id ? "var(--purple-light)" : "transparent",
                        transition: "background 0.2s"
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: "14px 8px", fontWeight: 500, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                        {p.nombre}
                        {isBlocked && (
                          <span style={{ display: "inline-flex", color: "var(--pink-base)", title: "Lista Negra" }}>
                            <ShieldAlert size={16} />
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 8px", color: "var(--text-muted)" }}>{p.id}</td>
                      <td style={{ padding: "14px 8px", color: "var(--text-main)" }}>{calculateAge(p.fechaNacimiento)}</td>
                      <td style={{ padding: "14px 8px", color: "var(--text-muted)" }}>{p.representante}</td>
                      <td style={{ padding: "14px 8px" }}>
                        <span style={{ 
                          padding: "4px 8px", 
                          borderRadius: "20px", 
                          fontSize: "0.75rem", 
                          fontWeight: 600,
                          backgroundColor: p.estado === "activo" ? "var(--purple-light)" : p.estado === "suspendido" ? "#FEF3C7" : "#F3F4F6",
                          color: p.estado === "activo" ? "var(--purple-dark)" : p.estado === "suspendido" ? "#D97706" : "var(--text-muted)"
                        }}>
                          {p.estado?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "14px 8px", textAlign: "right" }}><ChevronRight size={18} color="var(--text-muted)" /></td>
                    </tr>
                  );
                })}
                {filteredPacientes.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No se encontraron pacientes.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Patient Details Panel */}
        {selectedPaciente && (
          <div className="glass fade-in" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px", borderLeft: "4px solid var(--purple-base)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ color: "var(--text-main)", fontWeight: 600 }}>{selectedPaciente.nombre}</h3>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>C.I: {selectedPaciente.id}</span>
              </div>
              <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }} onClick={() => setSelectedPaciente(null)}>
                <X size={20} />
              </button>
            </div>

            {checkBlacklist(selectedPaciente) && (
              <div style={{ backgroundColor: "#FDF2F8", border: "1px solid var(--pink-pastel-soft)", color: "var(--pink-dark)", padding: "10px", borderRadius: "var(--radius-sm)", display: "flex", gap: "8px", alignItems: "center", fontSize: "0.85rem" }}>
                <ShieldAlert size={18} />
                <span><strong>ALERTA DE LISTA NEGRA</strong>: El representante o niño está registrado en mora.</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.9rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><User size={16} color="var(--text-muted)" /> <strong>Representante:</strong> {selectedPaciente.representante} (C.I: {selectedPaciente.cedulaRepresentante})</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><Phone size={16} color="var(--text-muted)" /> <strong>Teléfonos:</strong> {selectedPaciente.telefono} | Emergencias: {selectedPaciente.telefonoEmergencia}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><MapPin size={16} color="var(--text-muted)" /> <strong>Ciudad:</strong> {selectedPaciente.ciudad}</div>
            </div>

            <hr style={{ border: "0", borderTop: "1px solid var(--border-light)" }} />

            <div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--purple-dark)", marginBottom: "8px" }}>Historial Diagnóstico</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto", padding: "4px" }}>
                {selectedPaciente.diagnosticos?.map((d, i) => (
                  <div key={i} style={{ backgroundColor: "var(--bg-secondary)", padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-soft)", fontSize: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.75rem", marginBottom: "4px" }}>
                      <span>{d.fecha}</span>
                      <span>Por: {d.usuario}</span>
                    </div>
                    <div>{d.diagnostico}</div>
                  </div>
                ))}
                {(!selectedPaciente.diagnosticos || selectedPaciente.diagnosticos.length === 0) && (
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Sin diagnósticos registrados.</span>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <input 
                  type="text" 
                  placeholder="Actualizar diagnóstico..." 
                  className="input-field" 
                  value={newDiagText} 
                  onChange={(e) => setNewDiagText(e.target.value)} 
                />
                <button className="btn btn-secondary" onClick={handleAddDiagnosis} style={{ padding: "8px 12px" }}>Agregar</button>
              </div>
            </div>

            <hr style={{ border: "0", borderTop: "1px solid var(--border-light)" }} />

            <div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>Perfil de Facturación</h4>
              <div style={{ fontSize: "0.85rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div><strong>¿Desea Factura?:</strong> {selectedPaciente.requiereFactura ? "Sí" : "No"}</div>
                <div><strong>RUC/C.I:</strong> {selectedPaciente.datosFacturacion?.ruc || "Sin datos"}</div>
                <div style={{ gridColumn: "span 2" }}><strong>Nombre Factura:</strong> {selectedPaciente.datosFacturacion?.nombre || "Sin datos"}</div>
                <div style={{ gridColumn: "span 2" }}><strong>Dirección:</strong> {selectedPaciente.datosFacturacion?.direccion || "Sin datos"}</div>
                <div style={{ gridColumn: "span 2" }}><strong>Correo:</strong> {selectedPaciente.datosFacturacion?.correo || "Sin datos"}</div>
              </div>
            </div>

            {selectedPaciente.estado === "activo" ? (
              <button 
                className="btn btn-danger" 
                style={{ marginTop: "12px", width: "100%", justifyContent: "center" }}
                onClick={() => setShowDeactivateModal(true)}
              >
                Suspender / Desactivar Paciente
              </button>
            ) : (
              <div style={{ backgroundColor: "#FEF3C7", padding: "10px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", color: "#D97706" }}>
                <strong>Motivo de Salida ({selectedPaciente.fechaSalida}):</strong> {selectedPaciente.motivoSalida}
                <button 
                  className="btn btn-primary" 
                  style={{ width: "100%", justifyContent: "center", marginTop: "8px", padding: "6px" }}
                  onClick={async () => {
                    await updateDocument("pacientes", selectedPaciente.id, { estado: "activo", motivoSalida: "", fechaSalida: "" });
                    setSelectedPaciente({ ...selectedPaciente, estado: "activo", motivoSalida: "", fechaSalida: "" });
                    alert("Paciente reactivado.");
                  }}
                >
                  Reactivar Paciente
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Add Paciente */}
      {showAddForm && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "600px", maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontWeight: 600, color: "var(--purple-dark)" }}>Registrar Nuevo Paciente</h3>
              <button style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => setShowAddForm(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddPaciente} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Cédula del Niño*</label>
                  <input type="text" required className="input-field" value={newPaciente.id} onChange={(e) => setNewPaciente({...newPaciente, id: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nombre del Niño*</label>
                  <input type="text" required className="input-field" value={newPaciente.nombre} onChange={(e) => setNewPaciente({...newPaciente, nombre: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fecha de Nacimiento*</label>
                  <input type="date" required className="input-field" value={newPaciente.fechaNacimiento} onChange={(e) => setNewPaciente({...newPaciente, fechaNacimiento: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Ciudad*</label>
                  <input type="text" required className="input-field" value={newPaciente.ciudad} onChange={(e) => setNewPaciente({...newPaciente, ciudad: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nombre Representante*</label>
                  <input type="text" required className="input-field" value={newPaciente.representante} onChange={(e) => setNewPaciente({...newPaciente, representante: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Cédula Representante*</label>
                  <input type="text" required className="input-field" value={newPaciente.cedulaRepresentante} onChange={(e) => setNewPaciente({...newPaciente, cedulaRepresentante: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Teléfono*</label>
                  <input type="text" required className="input-field" value={newPaciente.telefono} onChange={(e) => setNewPaciente({...newPaciente, telefono: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Teléfono de Emergencia*</label>
                  <input type="text" required className="input-field" value={newPaciente.telefonoEmergencia} onChange={(e) => setNewPaciente({...newPaciente, telefonoEmergencia: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Terapeuta Asignado*</label>
                  <select required className="input-field" value={newPaciente.terapeutaAsignadoId} onChange={(e) => setNewPaciente({...newPaciente, terapeutaAsignadoId: e.target.value})}>
                    <option value="">Seleccione...</option>
                    {terapeutas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                  <input type="checkbox" id="reqFactura" checked={newPaciente.requiereFactura} onChange={(e) => setNewPaciente({...newPaciente, requiereFactura: e.target.checked})} />
                  <label htmlFor="reqFactura" style={{ fontSize: "0.85rem", fontWeight: 500 }}>¿Requiere Factura?</label>
                </div>
              </div>
 
              {newPaciente.requiereFactura && (
                <div style={{ border: "1px solid var(--purple-pastel-soft)", padding: "12px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--purple-light)" }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--purple-dark)", marginBottom: "8px" }}>Datos de Facturación</h4>
                  <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <input type="text" placeholder="RUC / Cédula" className="input-field" value={newPaciente.datosFacturacion.ruc} onChange={(e) => setNewPaciente({...newPaciente, datosFacturacion: {...newPaciente.datosFacturacion, ruc: e.target.value}})} />
                    <input type="text" placeholder="Nombre en Factura" className="input-field" value={newPaciente.datosFacturacion.nombre} onChange={(e) => setNewPaciente({...newPaciente, datosFacturacion: {...newPaciente.datosFacturacion, nombre: e.target.value}})} />
                    <input type="email" placeholder="Correo" className="input-field" value={newPaciente.datosFacturacion.correo} onChange={(e) => setNewPaciente({...newPaciente, datosFacturacion: {...newPaciente.datosFacturacion, correo: e.target.value}})} />
                    <input type="text" placeholder="Dirección" className="input-field" value={newPaciente.datosFacturacion.direccion} onChange={(e) => setNewPaciente({...newPaciente, datosFacturacion: {...newPaciente.datosFacturacion, direccion: e.target.value}})} />
                  </div>
                </div>
              )}
 
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Diagnóstico Inicial (Opcional)</label>
                <textarea rows="2" className="input-field" placeholder="Escriba el diagnóstico aquí..." value={newDiagText} onChange={(e) => setNewDiagText(e.target.value)}></textarea>
              </div>
 
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Deactivate Paciente */}
      {showDeactivateModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "400px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontWeight: 600, color: "var(--pink-dark)", marginBottom: "12px" }}>Suspender Paciente</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>Se liberarán automáticamente todas las citas agendadas a partir de la fecha seleccionada.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Estado Final*</label>
                <select className="input-field" value={deactivateInfo.estado} onChange={(e) => setDeactivateInfo({...deactivateInfo, estado: e.target.value})}>
                  <option value="inactivo">Inactivo / Retirado</option>
                  <option value="suspendido">Suspendido (Falta de pago, etc.)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fecha de Salida*</label>
                <input type="date" className="input-field" value={deactivateInfo.fechaSalida} onChange={(e) => setDeactivateInfo({...deactivateInfo, fechaSalida: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Motivo de Salida*</label>
                <input type="text" required className="input-field" placeholder="Ej. Retiro por clases, Falta de pago" value={deactivateInfo.motivoSalida} onChange={(e) => setDeactivateInfo({...deactivateInfo, motivoSalida: e.target.value})} />
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button className="btn btn-secondary" onClick={() => setShowDeactivateModal(false)}>Cancelar</button>
                <button className="btn btn-danger" onClick={handleDeactivate}>Confirmar Suspensión</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
