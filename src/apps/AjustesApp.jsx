import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, registrarLog, getCollection, setDocument } from "../db";
import { useAuth } from "../context/AuthContext";
import { Settings, Users, Briefcase, Tag, Calendar, Plus, Trash2, Edit2, ShieldAlert, X, Database, Download, RefreshCw, AlertTriangle, Upload } from "lucide-react";

export default function AjustesApp() {
  const { currentUser, createNewUser } = useAuth();
  const isAdmin = currentUser?.rol === "administrador";

  const [usuarios, setUsuarios] = useState([]);
  const [terapeutas, setTerapeutas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [snapshots, setSnapshots] = useState([]);

  // Tab state: 'usuarios' | 'terapeutas' | 'servicios' | 'feriados' | 'respaldos'
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
  const [ferForm, setFerForm] = useState({ titulo: "", tipo: "feriado", fecha: "", repeticion: "unica" });

  const [editingTerapeuta, setEditingTerapeuta] = useState(null);
  const [editingServicio, setEditingServicio] = useState(null);
  const [editingFeriado, setEditingFeriado] = useState(null);

  // Backup state variables
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [pendingBackupData, setPendingBackupData] = useState(null);

  useEffect(() => {
    const unsubUsers = subscribeToCollection("usuarios", setUsuarios);
    const unsubTers = subscribeToCollection("terapeutas", setTerapeutas);
    const unsubSrvs = subscribeToCollection("servicios", setServicios);
    const unsubFers = subscribeToCollection("feriados_eventos", setFeriados);
    const unsubSnapshots = subscribeToCollection("respaldos_nube", (data) => {
      const sorted = [...data].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setSnapshots(sorted);
    });
    return () => {
      unsubUsers();
      unsubTers();
      unsubSrvs();
      unsubFers();
      unsubSnapshots();
    };
  }, [isAdmin]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.nombre || !userForm.correo || !userForm.clave) {
      alert("Todos los campos son obligatorios.");
      return;
    }
    try {
      await createNewUser(userForm.correo, userForm.clave, userForm.nombre, userForm.rol);
      await registrarLog(
        currentUser,
        "Ajustes (Crear Usuario)",
        `Creó el usuario ${userForm.correo} con rol ${userForm.rol}`
      );
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
      const dataToSave = {
        nombre: terForm.nombre,
        especialidad: terForm.especialidad,
        comisionActiva: terForm.comisionActiva,
        comisionPorcentaje: terForm.comisionActiva ? Number(terForm.comisionPorcentaje) : 0,
        salarioFijo: !terForm.comisionActiva ? Number(terForm.salarioFijo || 0) : 0,
        telefono: terForm.telefono || ""
      };
      await addDocument("terapeutas", dataToSave);
      await registrarLog(
        currentUser,
        "Ajustes (Crear Terapeuta)",
        `Registró terapeuta ${dataToSave.nombre} (${dataToSave.especialidad}). Comisión: ${dataToSave.comisionActiva ? dataToSave.comisionPorcentaje + "%" : "Falso (Fijo: $" + dataToSave.salarioFijo + ")"}`
      );
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
      const srvData = {
        nombre: srvForm.nombre.toUpperCase(),
        costo: Number(srvForm.costo)
      };
      await addDocument("servicios", srvData);
      await registrarLog(
        currentUser,
        "Ajustes (Crear Servicio)",
        `Agregó servicio "${srvData.nombre}" con costo base de $${srvData.costo}`
      );
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
      const ferData = {
        titulo: ferForm.titulo,
        tipo: ferForm.tipo,
        fecha: ferForm.fecha,
        repeticion: ferForm.repeticion || "unica"
      };
      await addDocument("feriados_eventos", ferData);
      await registrarLog(
        currentUser,
        "Ajustes (Crear Feriado/Evento)",
        `Creó fecha especial "${ferData.titulo}" (${ferData.tipo}, ${ferData.repeticion}) para el día ${ferData.fecha}`
      );
      setFerForm({ titulo: "", tipo: "feriado", fecha: "", repeticion: "unica" });
      alert("Fecha registrada en el calendario corporativo.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFeriado = async (e) => {
    e.preventDefault();
    if (!editingFeriado.titulo || !editingFeriado.fecha) return;
    try {
      const updateData = {
        titulo: editingFeriado.titulo,
        tipo: editingFeriado.tipo,
        fecha: editingFeriado.fecha,
        repeticion: editingFeriado.repeticion || "unica"
      };
      await updateDocument("feriados_eventos", editingFeriado.id, updateData);
      await registrarLog(
        currentUser,
        "Ajustes (Editar Feriado/Evento)",
        `Modificó fecha especial "${updateData.titulo}" (${updateData.tipo}, ${updateData.repeticion}) para el día ${updateData.fecha}`
      );
      setEditingFeriado(null);
      alert("Fecha especial actualizada.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar fecha: " + err.message);
    }
  };

  const handleUpdateTerapeuta = async (e) => {
    e.preventDefault();
    if (!editingTerapeuta.nombre || !editingTerapeuta.especialidad) return;
    try {
      const updateData = {
        nombre: editingTerapeuta.nombre,
        especialidad: editingTerapeuta.especialidad,
        comisionActiva: editingTerapeuta.comisionActiva,
        comisionPorcentaje: editingTerapeuta.comisionActiva ? Number(editingTerapeuta.comisionPorcentaje) : 0,
        salarioFijo: !editingTerapeuta.comisionActiva ? Number(editingTerapeuta.salarioFijo || 0) : 0,
        telefono: editingTerapeuta.telefono || ""
      };
      await updateDocument("terapeutas", editingTerapeuta.id, updateData);
      await registrarLog(
        currentUser,
        "Ajustes (Editar Terapeuta)",
        `Modificó terapeuta ${updateData.nombre}. Especialidad: ${updateData.especialidad}, Comisión: ${updateData.comisionActiva ? updateData.comisionPorcentaje + "%" : "Falso (Fijo: $" + updateData.salarioFijo + ")"}`
      );
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
      const updateSrvData = {
        nombre: editingServicio.nombre.toUpperCase(),
        costo: Number(editingServicio.costo)
      };
      await updateDocument("servicios", editingServicio.id, updateSrvData);
      await registrarLog(
        currentUser,
        "Ajustes (Editar Servicio)",
        `Modificó servicio "${updateSrvData.nombre}" a costo base de $${updateSrvData.costo}`
      );
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
        await registrarLog(
          currentUser,
          "Ajustes (Eliminación)",
          `Eliminó el elemento ID ${itemId} de la colección "${collectionName}"`
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const BACKUP_COLLECTIONS = [
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

  const generateBackupObject = async () => {
    const collectionsData = {};
    for (const colName of BACKUP_COLLECTIONS) {
      try {
        collectionsData[colName] = await getCollection(colName);
      } catch (e) {
        console.error(`Error al respaldar colección ${colName}:`, e);
        collectionsData[colName] = [];
      }
    }
    return {
      metadata: {
        version: "1.0",
        fecha: new Date().toISOString(),
        creadoPor: currentUser?.correo || "sistema",
        registrosTotales: Object.values(collectionsData).reduce((sum, arr) => sum + arr.length, 0)
      },
      collections: collectionsData
    };
  };

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const backup = await generateBackupObject();
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
        `Exportó un respaldo local con ${backup.metadata.registrosTotales} registros.`
      );
      alert("Respaldo local descargado con éxito.");
    } catch (err) {
      console.error("Error al exportar respaldo:", err);
      alert("Error al exportar respaldo: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateCloudSnapshot = async () => {
    try {
      setIsSavingSnapshot(true);
      const backup = await generateBackupObject();
      const backupStr = JSON.stringify(backup);
      
      const sizeInBytes = new Blob([backupStr]).size;
      if (sizeInBytes > 950 * 1024) {
        alert("El tamaño de la base de datos supera el límite de 1MB para almacenamiento directo en la nube. Por favor, descargue el respaldo local (JSON) en su lugar.");
        return;
      }

      const currentSnapshots = await getCollection("respaldos_nube");
      const sortedOldestFirst = [...currentSnapshots].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      if (sortedOldestFirst.length >= 5) {
        const toDeleteCount = sortedOldestFirst.length - 4;
        for (let i = 0; i < toDeleteCount; i++) {
          await deleteDocument("respaldos_nube", sortedOldestFirst[i].id);
        }
      }

      const snapshotDoc = {
        fecha: new Date().toISOString(),
        creadoPor: currentUser?.correo || "administrador",
        registrosTotales: backup.metadata.registrosTotales,
        tamanioBytes: sizeInBytes,
        dataStr: backupStr
      };

      await addDocument("respaldos_nube", snapshotDoc);
      await registrarLog(
        currentUser,
        "Respaldo (Crear Snapshot)",
        `Creó un snapshot en la nube con ${backup.metadata.registrosTotales} registros.`
      );
      alert("Snapshot en la nube guardado con éxito.");
    } catch (err) {
      console.error("Error al crear snapshot en la nube:", err);
      alert("Error al crear snapshot: " + err.message);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const handleDownloadSnapshot = (snapshot) => {
    const blob = new Blob([snapshot.dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = url;
    const dateStr = snapshot.fecha.slice(0, 16).replace("T", "_").replace(":", "-");
    downloadAnchor.download = `meraki_respaldo_nube_${dateStr}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = async (backupData) => {
    try {
      setIsRestoring(true);
      setRestoreProgress("Iniciando restauración...");

      if (!backupData || !backupData.collections) {
        throw new Error("El archivo de respaldo no es válido o está dañado.");
      }

      const collectionsToRestore = Object.keys(backupData.collections);
      let currentStep = 0;
      const totalSteps = collectionsToRestore.length;

      for (const colName of collectionsToRestore) {
        setRestoreProgress(`Limpiando e importando colección: ${colName} (${currentStep + 1}/${totalSteps})...`);

        const currentDocs = await getCollection(colName);
        const batchSize = 20;
        
        for (let i = 0; i < currentDocs.length; i += batchSize) {
          const batch = currentDocs.slice(i, i + batchSize);
          await Promise.all(batch.map(doc => deleteDocument(colName, doc.id)));
        }

        const newDocs = backupData.collections[colName] || [];
        for (let i = 0; i < newDocs.length; i += batchSize) {
          const batch = newDocs.slice(i, i + batchSize);
          await Promise.all(batch.map(item => {
            const docId = item.id;
            const docData = { ...item };
            delete docData.id;
            return setDocument(colName, docId, docData);
          }));
        }

        currentStep++;
      }

      await registrarLog(
        currentUser,
        "Respaldo (Restaurar)",
        `Restauró la base de datos completa desde un respaldo con fecha ${backupData.metadata?.fecha || "desconocida"}.`
      );

      setRestoreProgress("¡Restauración exitosa! Recargando aplicación...");
      alert("Base de datos restaurada con éxito. La aplicación se recargará ahora.");
      window.location.reload();
    } catch (err) {
      console.error("Error en restauración:", err);
      alert("Error al restaurar base de datos: " + err.message);
    } finally {
      setIsRestoring(false);
      setRestoreProgress("");
    }
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
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
            <button 
              onClick={() => setActiveTab("respaldos")}
              style={{
                width: "100%", padding: "12px 14px", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", fontWeight: 500, fontSize: "0.9rem",
                backgroundColor: activeTab === "respaldos" ? "var(--purple-light)" : "transparent",
                color: activeTab === "respaldos" ? "var(--purple-dark)" : "var(--text-muted)"
              }}
            >
              <Database size={16} /> Respaldos y Seguridad
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
                      <option value="recepcionista">Recepcionista (Josua)</option>
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
                    <input type="checkbox" id="comisionActiva" disabled={!isAdmin} checked={terForm.comisionActiva} onChange={(e) => setTerForm({...terForm, comisionActiva: e.target.checked})} />
                    <label htmlFor="comisionActiva" style={{ fontSize: "0.85rem" }}>¿Trabaja por Comisión (% del cobro)?</label>
                  </div>
                  {terForm.comisionActiva ? (
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Porcentaje de Comisión (%)*</label>
                      <input type="number" required disabled={!isAdmin} className="input-field" min="0" max="100" value={terForm.comisionPorcentaje} onChange={(e) => setTerForm({...terForm, comisionPorcentaje: e.target.value})} />
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Salario Fijo Mensual ($)*</label>
                      <input type="number" required disabled={!isAdmin} className="input-field" min="0" value={terForm.salarioFijo} onChange={(e) => setTerForm({...terForm, salarioFijo: e.target.value})} />
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
                    {terapeutas
                      .filter(t => !t.nombre.includes("Recepción") && !t.nombre.includes("Recepcion") && !t.nombre.includes("Josua") && !t.nombre.includes("Joshua"))
                      .map(t => (
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
                    <input type="number" required disabled={!isAdmin} className="input-field" value={srvForm.costo} onChange={(e) => setSrvForm({...srvForm, costo: e.target.value})} />
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
                <form onSubmit={handleCreateFeriado} className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px", backgroundColor: "var(--bg-secondary)", padding: "16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", marginBottom: "20px", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Descripción / Título*</label>
                    <input type="text" required placeholder="Ej. Feriado de Fin de Año / Fiesta de Navidad" className="input-field" value={ferForm.titulo} onChange={(e) => setFerForm({...ferForm, titulo: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Tipo*</label>
                    <select className="input-field" value={ferForm.tipo} onChange={(e) => setFerForm({...ferForm, tipo: e.target.value})}>
                      <option value="feriado">Feriado (Descanso - 8d)</option>
                      <option value="evento">Evento (Programa - 7d)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Fecha*</label>
                    <input type="date" required className="input-field" value={ferForm.fecha} onChange={(e) => setFerForm({...ferForm, fecha: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Repetición*</label>
                    <select className="input-field" value={ferForm.repeticion} onChange={(e) => setFerForm({...ferForm, repeticion: e.target.value})}>
                      <option value="unica">Solo una vez</option>
                      <option value="anual">Cada año (Recurrente)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ gridColumn: "span 4", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", height: "42px", marginTop: "8px" }}>
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
                      <th style={{ padding: "8px" }}>REPETICIÓN</th>
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
                        <td style={{ padding: "8px" }}>
                          <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "10px", fontWeight: 600, backgroundColor: f.repeticion === "anual" ? "#D1FAE5" : "var(--bg-secondary)", color: f.repeticion === "anual" ? "#065F46" : "var(--text-muted)", border: f.repeticion === "anual" ? "none" : "1px solid var(--border-soft)" }}>
                            {f.repeticion === "anual" ? "ANUAL" : "UNA VEZ"}
                          </span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", marginRight: "8px" }}
                            onClick={() => setEditingFeriado(f)}
                          >
                            <Edit2 size={16} />
                          </button>
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

            {/* 5. BACKUPS & SECURITY TAB */}
            {activeTab === "respaldos" && (
              <div>
                <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", marginBottom: "8px" }}>Respaldos y Seguridad de la Base de Datos</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
                  Gestiona copias de seguridad completas de toda la información de la clínica. Puedes guardarlas localmente o conservarlas en la nube de forma segura.
                </p>

                {/* Grid for Actions */}
                <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                  
                  {/* Card 1: Crear Respaldos */}
                  <div className="glass" style={{ padding: "20px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-secondary)" }}>
                    <h4 style={{ fontWeight: 600, color: "var(--purple-dark)", fontSize: "0.95rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Database size={18} /> Crear Respaldos
                    </h4>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                      Genera una copia completa que incluye pacientes, citas, finanzas, empleados, evaluaciones y configuración del sistema.
                    </p>
                    <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                      <button 
                        onClick={handleExportBackup} 
                        disabled={isExporting || isRestoring}
                        className="btn btn-primary" 
                        style={{ justifyContent: "center", gap: "8px" }}
                      >
                        <Download size={16} /> 
                        {isExporting ? "Generando..." : "Descargar Respaldo JSON"}
                      </button>
                      
                      <button 
                        onClick={handleCreateCloudSnapshot} 
                        disabled={isSavingSnapshot || isRestoring}
                        className="btn btn-secondary" 
                        style={{ justifyContent: "center", gap: "8px", border: "1px solid var(--purple-dark)", color: "var(--purple-dark)" }}
                      >
                        <RefreshCw size={16} /> 
                        {isSavingSnapshot ? "Guardando..." : "Crear Snapshot en la Nube"}
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Restaurar Respaldo Manual */}
                  <div className="glass" style={{ padding: "20px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-secondary)" }}>
                    <h4 style={{ fontWeight: 600, color: "var(--pink-dark)", fontSize: "0.95rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <AlertTriangle size={18} /> Restaurar desde Archivo
                    </h4>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                      Selecciona un archivo <strong>.json</strong> previamente descargado para restaurar el sistema. 
                      <span style={{ color: "var(--pink-dark)", fontWeight: 500 }}> ¡Esto sobrescribirá todos los datos actuales!</span>
                    </p>
                    
                    <div style={{ position: "relative" }}>
                      <input 
                        type="file" 
                        accept=".json" 
                        disabled={isRestoring}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            try {
                              const parsed = JSON.parse(evt.target.result);
                              setPendingBackupData(parsed);
                              setConfirmInput("");
                              setShowConfirmModal(true);
                            } catch (err) {
                              alert("El archivo seleccionado no es un JSON válido o está dañado.");
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = null;
                        }}
                        style={{ display: "none" }}
                        id="restore-file-input"
                      />
                      <label 
                        htmlFor="restore-file-input" 
                        className="btn btn-secondary" 
                        style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: isRestoring ? "not-allowed" : "pointer" }}
                      >
                        <Upload size={16} /> Seleccionar Archivo JSON
                      </label>
                    </div>
                  </div>

                </div>

                {/* Cloud Snapshots Table */}
                <h4 style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.9rem", marginBottom: "12px" }}>
                  Historial de Snapshots en la Nube (Últimos 5)
                </h4>
                {snapshots.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "0.85rem", border: "1px dashed var(--border-soft)", borderRadius: "var(--radius-sm)" }}>
                    No hay snapshots guardados en la nube.
                  </div>
                ) : (
                  <div className="responsive-table-wrap">
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border-light)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          <th style={{ padding: "10px" }}>FECHA Y HORA</th>
                          <th style={{ padding: "10px" }}>CREADO POR</th>
                          <th style={{ padding: "10px" }}>REGISTROS</th>
                          <th style={{ padding: "10px" }}>TAMAÑO</th>
                          <th style={{ padding: "10px", textAlign: "right" }}>ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshots.map((snap) => (
                          <tr key={snap.id} style={{ borderBottom: "1px solid var(--border-soft)", fontSize: "0.85rem" }}>
                            <td style={{ padding: "10px", fontWeight: 500 }}>
                              {new Date(snap.fecha).toLocaleString()}
                            </td>
                            <td style={{ padding: "10px", color: "var(--text-muted)" }}>{snap.creadoPor}</td>
                            <td style={{ padding: "10px", fontWeight: 600 }}>{snap.registrosTotales}</td>
                            <td style={{ padding: "10px", color: "var(--text-muted)" }}>
                              {snap.tamanioBytes ? `${(snap.tamanioBytes / 1024).toFixed(1)} KB` : "N/A"}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right" }}>
                              <button 
                                onClick={() => handleDownloadSnapshot(snap)}
                                title="Descargar como JSON local"
                                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--purple-dark)", marginRight: "12px" }}
                              >
                                <Download size={16} />
                              </button>
                              
                              <button 
                                onClick={() => {
                                  try {
                                    const parsed = JSON.parse(snap.dataStr);
                                    setPendingBackupData(parsed);
                                    setConfirmInput("");
                                    setShowConfirmModal(true);
                                  } catch (e) {
                                    alert("Error al cargar datos del snapshot.");
                                  }
                                }}
                                title="Restaurar base de datos a este punto"
                                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--pink-dark)", marginRight: "12px" }}
                              >
                                <RefreshCw size={16} />
                              </button>
                              
                              <button 
                                onClick={async () => {
                                  if (confirm("¿Estás seguro de eliminar este snapshot de la nube permanentemente?")) {
                                    try {
                                      await deleteDocument("respaldos_nube", snap.id);
                                      await registrarLog(currentUser, "Respaldo (Eliminar Snapshot)", `Eliminó snapshot del ${new Date(snap.fecha).toLocaleString()}`);
                                      alert("Snapshot eliminado.");
                                    } catch (err) {
                                      alert("Error al eliminar snapshot: " + err.message);
                                    }
                                  }
                                }}
                                title="Eliminar snapshot"
                                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {snapshots.length > 5 && (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "8px", fontStyle: "italic" }}>
                    Nota: Se mantendrán automáticamente solo los últimos 5 snapshots en la nube.
                  </p>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Modal Double Confirm Restore */}
        {showConfirmModal && createPortal(
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 }}>
            <div className="glass fade-in" style={{ backgroundColor: "white", padding: "28px", borderRadius: "var(--radius-md)", width: "100%", maxWidth: "480px", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", color: "var(--pink-dark)" }}>
                <AlertTriangle size={28} />
                <h3 style={{ fontWeight: 600, margin: 0 }}>¡ATENCIÓN! Confirmar Restauración</h3>
              </div>
              
              <p style={{ fontSize: "0.85rem", color: "var(--text-main)", marginBottom: "12px", lineHeight: "1.4" }}>
                Estás a punto de restaurar la base de datos a un estado anterior ({pendingBackupData?.metadata?.fecha ? new Date(pendingBackupData.metadata.fecha).toLocaleString() : "fecha desconocida"}).
              </p>
              
              <p style={{ fontSize: "0.85rem", color: "var(--pink-dark)", fontWeight: "bold", padding: "10px", backgroundColor: "var(--pink-light)", borderRadius: "var(--radius-sm)", marginBottom: "18px" }}>
                ADVERTENCIA: Esta acción es irreversible. Todos los datos actuales serán borrados y reemplazados por la copia de seguridad.
              </p>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Para confirmar, escribe la palabra <span style={{ color: "var(--pink-dark)" }}>RESTAURAR</span> en mayúsculas:
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Escribe RESTAURAR aquí" 
                  value={confirmInput} 
                  onChange={(e) => setConfirmInput(e.target.value)}
                />
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowConfirmModal(false);
                    setPendingBackupData(null);
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  disabled={confirmInput !== "RESTAURAR"}
                  style={{ backgroundColor: confirmInput === "RESTAURAR" ? "var(--pink-dark)" : "var(--text-muted)", borderColor: confirmInput === "RESTAURAR" ? "var(--pink-dark)" : "var(--text-muted)" }}
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleRestoreBackup(pendingBackupData);
                  }}
                >
                  Confirmar y Restaurar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Restoring progress overlay */}
        {isRestoring && createPortal(
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", zIndex: 1200, color: "white" }}>
            <RefreshCw className="spin" size={48} style={{ marginBottom: "16px", color: "var(--purple-light)" }} />
            <h3 style={{ fontWeight: 600, marginBottom: "8px" }}>Restaurando Base de Datos...</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{restoreProgress}</p>
            <p style={{ fontSize: "0.75rem", color: "var(--pink-dark)", marginTop: "12px" }}>Por favor, no cierre esta pestaña ni apague el dispositivo.</p>
          </div>,
          document.body
        )}

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
                  <input type="checkbox" id="editComisionActiva" disabled={!isAdmin} checked={editingTerapeuta.comisionActiva} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, comisionActiva: e.target.checked})} />
                  <label htmlFor="editComisionActiva" style={{ fontSize: "0.85rem" }}>¿Trabaja por Comisión (% del cobro)?</label>
                </div>
                {editingTerapeuta.comisionActiva ? (
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Porcentaje de Comisión (%)*</label>
                    <input type="number" required disabled={!isAdmin} className="input-field" min="0" max="100" value={editingTerapeuta.comisionPorcentaje} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, comisionPorcentaje: e.target.value})} />
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Salario Fijo Mensual ($)*</label>
                    <input type="number" required disabled={!isAdmin} className="input-field" min="0" value={editingTerapeuta.salarioFijo !== undefined ? editingTerapeuta.salarioFijo : 500} onChange={(e) => setEditingTerapeuta({...editingTerapeuta, salarioFijo: e.target.value})} />
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
                  <input type="number" required disabled={!isAdmin} className="input-field" value={editingServicio.costo} onChange={(e) => setEditingServicio({...editingServicio, costo: e.target.value})} />
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

        {/* Modal Edit Feriado */}
        {editingFeriado && createPortal(
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div className="glass fade-in" style={{ backgroundColor: "white", padding: "24px", borderRadius: "var(--radius-md)", width: "100%", maxWidth: "450px", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontWeight: 600, color: "var(--purple-dark)" }}>Editar Feriado / Evento</h3>
                <button style={{ border: "none", background: "none", cursor: "pointer" }} onClick={() => setEditingFeriado(null)}>
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateFeriado} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Descripción / Título*</label>
                  <input type="text" required className="input-field" value={editingFeriado.titulo} onChange={(e) => setEditingFeriado({...editingFeriado, titulo: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Tipo*</label>
                  <select className="input-field" value={editingFeriado.tipo} onChange={(e) => setEditingFeriado({...editingFeriado, tipo: e.target.value})}>
                    <option value="feriado">Feriado (Descanso - 8d)</option>
                    <option value="evento">Evento (Programa - 7d)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fecha*</label>
                  <input type="date" required className="input-field" value={editingFeriado.fecha} onChange={(e) => setEditingFeriado({...editingFeriado, fecha: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Repetición*</label>
                  <select className="input-field" value={editingFeriado.repeticion || "unica"} onChange={(e) => setEditingFeriado({...editingFeriado, repeticion: e.target.value})}>
                    <option value="unica">Solo una vez</option>
                    <option value="anual">Cada año (Recurrente)</option>
                  </select>
                </div>
                
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingFeriado(null)}>Cancelar</button>
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
