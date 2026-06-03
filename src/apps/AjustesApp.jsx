import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from "../db";
import { useAuth } from "../context/AuthContext";
import { Settings, Users, Briefcase, Tag, Calendar, Plus, Trash2, Edit2, ShieldAlert, X } from "lucide-react";

export default function AjustesApp() {
  const { currentUser, createNewUser } = useAuth();
  const isAdmin = currentUser?.rol === "administrador";

  const [usuarios, setUsuarios] = useState([]);
  const [terapeutas, setTerapeutas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [feriados, setFeriados] = useState([]);

  // Tab state: 'usuarios' | 'terapeutas' | 'servicios' | 'feriados'
  const [activeTab, setActiveTab] = useState("terapeutas");

  useEffect(() => {
    if (isAdmin) {
      setActiveTab("usuarios");
    }
  }, [isAdmin]);

  // Form states
  const [userForm, setUserForm] = useState({ nombre: "", correo: "", clave: "", rol: "recepcionista" });
  const [terForm, setTerForm] = useState({ nombre: "", especialidad: "", comisionActiva: true, comisionPorcentaje: 60, salarioFijo: 500, telefono: "" });
  const [srvForm, setSrvForm] = useState({ nombre: "", costo: 20 });
  const [ferForm, setFerForm] = useState({ titulo: "", tipo: "feriado", fecha: "" });

  const [editingTerapeuta, setEditingTerapeuta] = useState(null);
  const [editingServicio, setEditingServicio] = useState(null);

  useEffect(() => {
    const unsubUsers = subscribeToCollection("usuarios", setUsuarios);
    const unsubTers = subscribeToCollection("terapeutas", setTerapeutas);
    const unsubSrvs = subscribeToCollection("servicios", setServicios);
    const unsubFers = subscribeToCollection("feriados_eventos", setFeriados);
    return () => {
      unsubUsers();
      unsubTers();
      unsubSrvs();
      unsubFers();
    };
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.nombre || !userForm.correo || !userForm.clave) {
      alert("Todos los campos son obligatorios.");
      return;
    }
    try {
      await createNewUser(userForm.correo, userForm.clave, userForm.nombre, userForm.rol);
      setUserForm({ nombre: "", correo: "", clave: "", rol: "recepcionista" });
      alert("Usuario creado con éxito. Ya puede iniciar sesión con estas credenciales.");
    } catch (err) {
      console.error(err);
      alert("Error al crear usuario: " + err.message);
    }
  };

  const handleCreateTerapeuta = async (e) => {
    e.preventDefault();
    if (!terForm.nombre || !terForm.especialidad) return;
    try {
      await addDocument("terapeutas", {
        nombre: terForm.nombre,
        especialidad: terForm.especialidad,
        comisionActiva: terForm.comisionActiva,
        comisionPorcentaje: terForm.comisionActiva ? Number(terForm.comisionPorcentaje) : 0,
        salarioFijo: !terForm.comisionActiva ? Number(terForm.salarioFijo || 0) : 0,
        telefono: terForm.telefono || ""
      });
      setTerForm({ nombre: "", especialidad: "", comisionActiva: true, comisionPorcentaje: 60, salarioFijo: 500, telefono: "" });
      alert("Terapeuta registrado.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateServicio = async (e) => {
    e.preventDefault();
    if (!srvForm.nombre || !srvForm.costo) return;
    try {
      await addDocument("servicios", {
        nombre: srvForm.nombre.toUpperCase(),
        costo: Number(srvForm.costo)
      });
      setSrvForm({ nombre: "", costo: 20 });
      alert("Servicio registrado con éxito.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFeriado = async (e) => {
    e.preventDefault();
    if (!ferForm.titulo || !ferForm.fecha) return;
    try {
      await addDocument("feriados_eventos", {
        titulo: ferForm.titulo,
        tipo: ferForm.tipo,
        fecha: ferForm.fecha
      });
      setFerForm({ titulo: "", tipo: "feriado", fecha: "" });
      alert("Fecha registrada en el calendario corporativo.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTerapeuta = async (e) => {
    e.preventDefault();
    if (!editingTerapeuta.nombre || !editingTerapeuta.especialidad) return;
    try {
      await updateDocument("terapeutas", editingTerapeuta.id, {
        nombre: editingTerapeuta.nombre,
        especialidad: editingTerapeuta.especialidad,
        comisionActiva: editingTerapeuta.comisionActiva,
        comisionPorcentaje: editingTerapeuta.comisionActiva ? Number(editingTerapeuta.comisionPorcentaje) : 0,
        salarioFijo: !editingTerapeuta.comisionActiva ? Number(editingTerapeuta.salarioFijo || 0) : 0,
        telefono: editingTerapeuta.telefono || ""
      });
      setEditingTerapeuta(null);
      alert("Profesional actualizado con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar profesional.");
    }
  };

  const handleUpdateServicio = async (e) => {
    e.preventDefault();
    if (!editingServicio.nombre || !editingServicio.costo) return;
    try {
      await updateDocument("servicios", editingServicio.id, {
        nombre: editingServicio.nombre.toUpperCase(),
        costo: Number(editingServicio.costo)
      });
      setEditingServicio(null);
      alert("Servicio actualizado con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar servicio.");
    }
  };

  const handleDeleteItem = async (collectionName, itemId) => {
    if (confirm("¿Estás seguro de eliminar este elemento permanentemente?")) {
      try {
        await deleteDocument(collectionName, itemId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Ajustes y Configuración</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Administra usuarios, catálogos de servicios, terapeutas y eventos especiales.</p>
        </div>
      </div>

        <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "24px" }}>
          {/* Vertical Menu Buttons */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "12px", display: "flex", flexDirection: "column", gap: "6px", alignSelf: "start" }}>
            {isAdmin && (
              <button 
                onClick={() => setActiveTab("usuarios")}
                style={{
                  width: "100%", padding: "12px 14px", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", fontWeight: 500, fontSize: "0.9rem",
                  backgroundColor: activeTab === "usuarios" ? "var(--purple-light)" : "transparent",
                  color: activeTab === "usuarios" ? "var(--purple-dark)" : "var(--text-muted)"
                }}
              >
                <Users size={16} /> Usuarios del Sistema
              </button>
            )}
            <button 
              onClick={() => setActiveTab("terapeutas")}
              style={{
                width: "100%", padding: "12px 14px", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", fontWeight: 500, fontSize: "0.9rem",
                backgroundColor: activeTab === "terapeutas" ? "var(--purple-light)" : "transparent",
                color: activeTab === "terapeutas" ? "var(--purple-dark)" : "var(--text-muted)"
              }}
            >
              <Briefcase size={16} /> Terapeutas
            </button>
            <button 
              onClick={() => setActiveTab("servicios")}
              style={{
                width: "100%", padding: "12px 14px", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", fontWeight: 500, fontSize: "0.9rem",
                backgroundColor: activeTab === "servicios" ? "var(--purple-light)" : "transparent",
                color: activeTab === "servicios" ? "var(--purple-dark)" : "var(--text-muted)"
              }}
            >
              <Tag size={16} /> Servicios y Precios
            </button>
            <button 
              onClick={() => setActiveTab("feriados")}
              style={{
                width: "100%", padding: "12px 14px", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", fontWeight: 500, fontSize: "0.9rem",
                backgroundColor: activeTab === "feriados" ? "var(--purple-light)" : "transparent",
                color: activeTab === "feriados" ? "var(--purple-dark)" : "var(--text-muted)"
              }}
            >
              <Calendar size={16} /> Feriados y Eventos
            </button>
          </div>

          {/* Form and List View Panels */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "24px", boxShadow: "var(--shadow-sm)" }}>
            
            {/* 1. USER SETTINGS TAB */}
            {activeTab === "usuarios" && (
              <div>
                <h3 style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Gestión de Usuarios del Sistema</h3>
                
                {/* Create user form */}
                <form onSubmit={handleCreateUser} className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", backgroundColor: "var(--bg-secondary)", padding: "16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", marginBottom: "20px" }}>
                  <h4 style={{ gridColumn: "span 2", fontWeight: 600, fontSize: "0.85rem", color: "var(--purple-dark)" }}>Crear Nuevo Usuario</h4>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nombre Completo*</label>
                    <input type="text" required className="input-field" value={userForm.nombre} onChange={(e) => setUserForm({...userForm, nombre: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Correo Electrónico*</label>
                    <input type="email" required className="input-field" value={userForm.correo} onChange={(e) => setUserForm({...userForm, correo: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Contraseña*</label>
                    <input type="password" required className="input-field" value={userForm.clave} onChange={(e) => setUserForm({...userForm, clave: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Rol del Usuario*</label>
                    <select className="input-field" value={userForm.rol} onChange={(e) => setUserForm({...userForm, rol: e.target.value})}>
                      <option value="recepcionista">Recepcionista (Joshua)</option>
                      <option value="administrador">Administrador/a</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ gridColumn: "span 2", marginTop: "8px", justifyContent: "center" }}>
                    <Plus size={16} /> Crear Cuenta
                  </button>
                </form>

                {/* Users List */}
                <div className="responsive-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      <th style={{ padding: "8px" }}>NOMBRE</th>
                      <th style={{ padding: "8px" }}>CORREO</th>
                      <th style={{ padding: "8px" }}>ROL</th>
                      <th style={{ padding: "8px", textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "45px", fontSize: "0.85rem" }}>
                        <td style={{ padding: "8px", fontWeight: 500 }}>{u.nombre}</td>
                        <td style={{ padding: "8px", color: "var(--text-muted)" }}>{u.correo}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "10px", backgroundColor: u.rol === "administrador" ? "var(--purple-light)" : "var(--border-soft)", color: u.rol === "administrador" ? "var(--purple-dark)" : "var(--text-muted)" }}>
                            {u.rol?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            onClick={() => handleDeleteItem("usuarios", u.id)}
                            disabled={u.id === currentUser?.uid} // Don't delete yourself
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* 2. THERAPISTS CATALOG TAB */}
            {activeTab === "terapeutas" && (
              <div>
                <h3 style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Catálogo de Terapeutas Profesionales</h3>
                
                {/* Create form */}
                <form onSubmit={handleCreateTerapeuta} className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", backgroundColor: "var(--bg-secondary)", padding: "16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", marginBottom: "20px" }}>
                  <h4 style={{ gridColumn: "span 2", fontWeight: 600, fontSize: "0.85rem", color: "var(--purple-dark)" }}>Registrar Profesional</h4>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nombre Completo*</label>
                    <input type="text" required className="input-field" value={terForm.nombre} onChange={(e) => setTerForm({...terForm, nombre: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Especialidad / Área*</label>
                    <input type="text" required className="input-field" placeholder="Ej. Terapia Ocupacional, Lenguaje" value={terForm.especialidad} onChange={(e) => setTerForm({...terForm, especialidad: e.target.value})} />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Teléfono WhatsApp (Ej. 593987654321 sin "+")*</label>
                    <input type="text" required placeholder="593987654321" className="input-field" value={terForm.telefono} onChange={(e) => setTerForm({...terForm, telefono: e.target.value})} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
                    <input type="checkbox" id="comisionActiva" checked={terForm.comisionActiva} onChange={(e) => setTerForm({...terForm, comisionActiva: e.target.checked})} />
                    <label htmlFor="comisionActiva" style={{ fontSize: "0.85rem" }}>¿Trabaja por Comisión (% del cobro)?</label>
                  </div>
                  {terForm.comisionActiva ? (
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Porcentaje de Comisión (%)*</label>
                      <input type="number" required className="input-field" min="0" max="100" value={terForm.comisionPorcentaje} onChange={(e) => setTerForm({...terForm, comisionPorcentaje: e.target.value})} />
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Salario Fijo Mensual ($)*</label>
                      <input type="number" required className="input-field" min="0" value={terForm.salarioFijo} onChange={(e) => setTerForm({...terForm, salarioFijo: e.target.value})} />
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary" style={{ gridColumn: "span 2", marginTop: "8px", justifyContent: "center" }}>
                    <Plus size={16} /> Agregar Terapeuta
                  </button>
                </form>

                {/* List */}
                <div className="responsive-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      <th style={{ padding: "8px" }}>NOMBRE</th>
                      <th style={{ padding: "8px" }}>ESPECIALIDAD</th>
                      <th style={{ padding: "8px" }}>TELÉFONO WHATSAPP</th>
                      <th style={{ padding: "8px" }}>MODALIDAD DE COBRO</th>
                      <th style={{ padding: "8px", textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {terapeutas.map(t => (
                      <tr key={t.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "45px", fontSize: "0.85rem" }}>
                        <td style={{ padding: "8px", fontWeight: 500 }}>{t.nombre}</td>
                        <td style={{ padding: "8px", color: "var(--text-muted)" }}>{t.especialidad}</td>
                        <td style={{ padding: "8px", color: "var(--text-muted)", fontFamily: "monospace" }}>{t.telefono || "Sin registrar"}</td>
                        <td style={{ padding: "8px" }}>
                          {t.comisionActiva ? (
                            <span style={{ color: "var(--purple-dark)", fontWeight: "bold" }}>Comisión ({t.comisionPorcentaje}%)</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontWeight: "bold" }}>Salario Fijo (${t.salarioFijo || 500})</span>
                          )}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", marginRight: "8px" }}
                            onClick={() => setEditingTerapeuta(t)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            onClick={() => handleDeleteItem("terapeutas", t.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* 3. SERVICES CATALOG TAB */}
            {activeTab === "servicios" && (
              <div>
                <h3 style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Catálogo de Servicios y Tarifas</h3>
                
                {/* Create form */}
                <form onSubmit={handleCreateServicio} className="responsive-flex" style={{ display: "flex", gap: "12px", backgroundColor: "var(--bg-secondary)", padding: "16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", marginBottom: "20px", alignItems: "flex-end" }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Nombre del Servicio (Terapia)*</label>
                    <input type="text" required placeholder="Ej. TERAPIA OCUPACIONAL" className="input-field" value={srvForm.nombre} onChange={(e) => setSrvForm({...srvForm, nombre: e.target.value})} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Costo Estándar ($)*</label>
                    <input type="number" required className="input-field" value={srvForm.costo} onChange={(e) => setSrvForm({...srvForm, costo: e.target.value})} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ height: "42px" }}>
                    <Plus size={16} /> Agregar
                  </button>
                </form>

                {/* List */}
                <div className="responsive-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      <th style={{ padding: "8px" }}>NOMBRE DEL SERVICIO</th>
                      <th style={{ padding: "8px" }}>COSTO BASE</th>
                      <th style={{ padding: "8px", textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicios.map(s => (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "45px", fontSize: "0.85rem" }}>
                        <td style={{ padding: "8px", fontWeight: 500 }}>{s.nombre}</td>
                        <td style={{ padding: "8px", fontWeight: "bold", color: "var(--purple-dark)" }}>${s.costo}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", marginRight: "8px" }}
                            onClick={() => setEditingServicio(s)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            onClick={() => handleDeleteItem("servicios", s.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* 4. HOLIDAYS/EVENTS TAB */}
            {activeTab === "feriados" && (
              <div>
                <h3 style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Feriados y Eventos del Centro</h3>
                
                {/* Create form */}
                <form onSubmit={handleCreateFeriado} className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", backgroundColor: "var(--bg-secondary)", padding: "16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", marginBottom: "20px", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Descripción / Título*</label>
                    <input type="text" required placeholder="Ej. Feriado de Fin de Año / Fiesta de Navidad" className="input-field" value={ferForm.titulo} onChange={(e) => setFerForm({...ferForm, titulo: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Tipo*</label>
                    <select className="input-field" value={ferForm.tipo} onChange={(e) => setFerForm({...ferForm, tipo: e.target.value})}>
                      <option value="feriado">Feriado (Descanso - 8d)</option>
                      <option value="evento">Evento (Programa - 5d)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Fecha*</label>
                    <input type="date" required className="input-field" value={ferForm.fecha} onChange={(e) => setFerForm({...ferForm, fecha: e.target.value})} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ gridColumn: "span 3", justifyContent: "center" }}>
                    <Plus size={16} /> Guardar Fecha
                  </button>
                </form>

                {/* List */}
                <div className="responsive-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      <th style={{ padding: "8px" }}>TÍTULO</th>
                      <th style={{ padding: "8px" }}>FECHA</th>
                      <th style={{ padding: "8px" }}>TIPO</th>
                      <th style={{ padding: "8px", textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {feriados.map(f => (
                      <tr key={f.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "45px", fontSize: "0.85rem" }}>
                        <td style={{ padding: "8px", fontWeight: 500 }}>{f.titulo}</td>
                        <td style={{ padding: "8px", color: "var(--text-muted)" }}>{f.fecha}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "10px", fontWeight: 600, backgroundColor: f.tipo === "feriado" ? "var(--pink-light)" : "var(--purple-light)", color: f.tipo === "feriado" ? "var(--pink-dark)" : "var(--purple-dark)" }}>
                            {f.tipo?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            onClick={() => handleDeleteItem("feriados_eventos", f.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Modal Edit Terapeuta */}
        {editingTerapeuta && createPortal(
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "450px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontWeight: 600, color: "var(--purple-dark)" }}>Editar Terapeuta</h3>
                <button style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => setEditingTerapeuta(null)}>
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateTerapeuta} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nombre Completo*</label>
                  <input type="text" required className="input-field" value={editingTerapeuta.nombre} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, nombre: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Especialidad / Área*</label>
                  <input type="text" required className="input-field" value={editingTerapeuta.especialidad} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, especialidad: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Teléfono WhatsApp (Ej. 593987654321)*</label>
                  <input type="text" required className="input-field" value={editingTerapeuta.telefono || ""} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, telefono: e.target.value})} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <input type="checkbox" id="editComisionActiva" checked={editingTerapeuta.comisionActiva} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, comisionActiva: e.target.checked})} />
                  <label htmlFor="editComisionActiva" style={{ fontSize: "0.85rem" }}>¿Trabaja por Comisión (% del cobro)?</label>
                </div>
                {editingTerapeuta.comisionActiva ? (
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Porcentaje de Comisión (%)*</label>
                    <input type="number" required className="input-field" min="0" max="100" value={editingTerapeuta.comisionPorcentaje} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, comisionPorcentaje: e.target.value})} />
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Salario Fijo Mensual ($)*</label>
                    <input type="number" required className="input-field" min="0" value={editingTerapeuta.salarioFijo !== undefined ? editingTerapeuta.salarioFijo : 500} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, salarioFijo: e.target.value})} />
                  </div>
                )}
                
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingTerapeuta(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar Cambios</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Modal Edit Servicio */}
        {editingServicio && createPortal(
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "450px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontWeight: 600, color: "var(--purple-dark)" }}>Editar Servicio</h3>
                <button style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => setEditingServicio(null)}>
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateServicio} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nombre del Servicio (Terapia)*</label>
                  <input type="text" required className="input-field" value={editingServicio.nombre} onChange={(e) => setEditingServicio({...editingServicio, nombre: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Costo Base ($)*</label>
                  <input type="number" required className="input-field" value={editingServicio.costo} onChange={(e) => setEditingServicio({...editingServicio, costo: e.target.value})} />
                </div>
                
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingServicio(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar Cambios</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
