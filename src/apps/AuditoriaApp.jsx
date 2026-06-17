import React, { useState, useEffect } from "react";
import { subscribeToCollection } from "../db";
import { useAuth } from "../context/AuthContext";
import { Shield, Search, Calendar, RefreshCw, X, ShieldAlert } from "lucide-react";

export default function AuditoriaApp() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModulo, setSelectedModulo] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    // Subscribe to audit logs
    const unsubscribe = subscribeToCollection("auditoria", (data) => {
      // Sort newest first
      const sorted = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setLogs(sorted);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedModulo("todos");
    setStartDate("");
    setEndDate("");
  };

  const getBadgeStyles = (accion) => {
    const acc = accion?.toLowerCase() || "";
    if (acc.includes("agenda")) {
      return { backgroundColor: "#F5F3FF", color: "#6D28D9", border: "1px solid #C084FC" };
    }
    if (acc.includes("caja")) {
      return { backgroundColor: "#ECFDF5", color: "#047857", border: "1px solid #34D399" };
    }
    if (acc.includes("paciente")) {
      return { backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #60A5FA" };
    }
    if (acc.includes("ajuste")) {
      return { backgroundColor: "#FFF7ED", color: "#C2410C", border: "1px solid #FDBA74" };
    }
    return { backgroundColor: "#F9FAFB", color: "#374151", border: "1px solid #D1D5DB" };
  };

  // Filter logs logic
  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      log.usuarioNombre?.toLowerCase().includes(searchLower) ||
      log.usuarioEmail?.toLowerCase().includes(searchLower) ||
      log.accion?.toLowerCase().includes(searchLower) ||
      log.detalles?.toLowerCase().includes(searchLower);

    const matchesModulo =
      selectedModulo === "todos"
        ? true
        : log.accion?.toLowerCase().includes(selectedModulo.toLowerCase());

    const logDateOnly = log.fecha ? log.fecha.split("T")[0] : "";
    const matchesStartDate = startDate ? logDateOnly >= startDate : true;
    const matchesEndDate = endDate ? logDateOnly <= endDate : true;

    return matchesSearch && matchesModulo && matchesStartDate && matchesEndDate;
  });

  if (currentUser?.rol !== "administrador") {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--pink-dark)", fontWeight: "bold" }}>
        <ShieldAlert size={48} style={{ marginBottom: "16px", color: "var(--pink-base)" }} />
        <h3>Acceso Denegado</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "8px" }}>
          Solo los administradores autorizados tienen acceso a la auditoría de seguridad del sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Title Header */}
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600, display: "flex", alignItems: "center", gap: "10px" }}>
            <Shield size={24} /> Registro de Actividades (Auditoría)
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Historial detallado e inmutable de modificaciones y acciones de usuarios en el sistema.
          </p>
        </div>
      </div>

      {/* Filters Area */}
      <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "20px", boxShadow: "var(--shadow-sm)" }}>
        <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr auto", gap: "12px", alignItems: "flex-end" }}>
          {/* Text Search */}
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>Búsqueda General</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="input-field"
                placeholder="Buscar por usuario, paciente o detalles..."
                style={{ paddingLeft: "34px" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            </div>
          </div>

          {/* Module Select */}
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>Módulo</label>
            <select className="input-field" value={selectedModulo} onChange={(e) => setSelectedModulo(e.target.value)}>
              <option value="todos">Todos los módulos</option>
              <option value="agenda">Agenda / Citas</option>
              <option value="paciente">Pacientes</option>
              <option value="caja">Caja / Gastos</option>
              <option value="ajuste">Ajustes / Tarifas</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>Desde Fecha</label>
            <div style={{ position: "relative" }}>
              <input
                type="date"
                className="input-field"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>Hasta Fecha</label>
            <div style={{ position: "relative" }}>
              <input
                type="date"
                className="input-field"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Reset Filters */}
          <button
            onClick={handleClearFilters}
            className="btn btn-secondary"
            style={{ height: "42px", display: "flex", gap: "8px", justifyContent: "center", alignItems: "center" }}
            title="Limpiar Filtros"
          >
            <X size={16} /> Limpiar
          </button>
        </div>
      </div>

      {/* Logs View Area */}
      <div className="glass" style={{ flex: 1, borderRadius: "var(--radius-md)", padding: "20px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
            Mostrando <strong>{filteredLogs.length}</strong> de <strong>{logs.length}</strong> actividades registradas
          </span>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, flexDirection: "column", gap: "10px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "50%", border: "3px solid var(--purple-pastel-soft)", borderTopColor: "var(--purple-base)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Cargando bitácora de auditoría...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, padding: "40px 20px", color: "var(--text-muted)" }}>
            <ShieldAlert size={36} style={{ marginBottom: "10px", color: "var(--text-muted)" }} />
            <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>No se encontraron actividades registradas</p>
            <p style={{ fontSize: "0.8rem", marginTop: "4px" }}>Intenta modificando los filtros de búsqueda.</p>
          </div>
        ) : (
          <div className="responsive-table-wrap" style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", fontSize: "0.8rem", color: "var(--text-muted)", position: "sticky", top: 0, backgroundColor: "white", zIndex: 1 }}>
                  <th style={{ padding: "12px 10px" }}>FECHA Y HORA</th>
                  <th style={{ padding: "12px 10px" }}>USUARIO</th>
                  <th style={{ padding: "12px 10px" }}>ACCION</th>
                  <th style={{ padding: "12px 10px" }}>DESCRIPCION DETALLADA DE LA ACTIVIDAD</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const badgeStyle = getBadgeStyles(log.accion);
                  const logDate = log.fecha ? new Date(log.fecha) : null;
                  const formattedDate = logDate
                    ? `${logDate.toLocaleDateString("es-ES")} ${logDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                    : "Fecha no registrada";

                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--border-soft)", fontSize: "0.85rem" }} className="table-cell-hover">
                      {/* Date & Time */}
                      <td style={{ padding: "12px 10px", whiteSpace: "nowrap", color: "var(--text-muted)", fontWeight: 500 }}>
                        {formattedDate}
                      </td>

                      {/* User */}
                      <td style={{ padding: "12px 10px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{log.usuarioNombre}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{log.usuarioEmail}</div>
                      </td>

                      {/* Action Category Badge */}
                      <td style={{ padding: "12px 10px", whiteSpace: "nowrap" }}>
                        <span style={{
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: "12px",
                          display: "inline-block",
                          ...badgeStyle
                        }}>
                          {log.accion}
                        </span>
                      </td>

                      {/* Details Description */}
                      <td style={{ padding: "12px 10px", color: "var(--text-main)", lineHeight: "1.4", fontWeight: 500 }}>
                        {log.detalles}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
