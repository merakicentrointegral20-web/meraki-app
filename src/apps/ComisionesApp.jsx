import React, { useState, useEffect } from "react";
import { subscribeToCollection, getCollection } from "../db";
import { useAuth } from "../context/AuthContext";
import { Calculator, DollarSign, Calendar, FileText, Printer, ShieldAlert } from "lucide-react";

export default function ComisionesApp() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.rol === "administrador";

  const [terapeutas, setTerapeutas] = useState([]);
  const [citas, setCitas] = useState([]);
  
  // Filter form
  const [selectedTerId, setSelectedTerId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  
  // Calculations result
  const [result, setResult] = useState(null);

  useEffect(() => {
    const unsubTer = subscribeToCollection("terapeutas", setTerapeutas);
    const unsubCitas = subscribeToCollection("citas", setCitas);
    return () => {
      unsubTer();
      unsubCitas();
    };
  }, []);

  // Set default dates (current month)
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
    const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
    
    setDateStart(firstDay);
    setDateEnd(lastDay);
  }, []);

  const calculateCommissions = () => {
    if (!selectedTerId || !dateStart || !dateEnd) {
      alert("Selecciona un profesional y un rango de fechas.");
      return;
    }

    const therapist = terapeutas.find(t => t.id === selectedTerId);
    if (!therapist) return;

    if (!therapist.comisionActiva) {
      alert(`El profesional ${therapist.nombre} está registrado bajo modalidad de Salario Fijo. No genera comisiones por porcentaje.`);
      setResult({
        therapistName: therapist.nombre,
        modality: "Salario Fijo",
        totalSessions: 0,
        totalBilling: 0,
        percentage: 0,
        amountDue: 0,
        sessionsList: []
      });
      return;
    }

    // Query appointments in range
    // Rules:
    // 1. Must match therapistId
    // 2. Date must be between dateStart and dateEnd
    // 3. Must be completed (asistio)
    // 4. Must be marked to charge (cobrada = true)
    const matchingSessions = citas.filter(c => 
      c.terapeutaId === selectedTerId &&
      c.fecha >= dateStart &&
      c.fecha <= dateEnd &&
      c.estadoAsistencia === "asistio" &&
      c.cobrada === true
    );

    const totalBilling = matchingSessions.reduce((acc, s) => acc + Number(s.costo), 0);
    const percentage = Number(therapist.comisionPorcentaje || 0);
    const amountDue = (totalBilling * percentage) / 100;

    setResult({
      therapistName: therapist.nombre,
      modality: "Comisión por Porcentaje",
      totalSessions: matchingSessions.length,
      totalBilling,
      percentage,
      amountDue,
      sessionsList: matchingSessions
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Cálculo de Comisiones</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Calcula los ingresos de los profesionales que cobran por porcentaje de terapias atendidas.</p>
        </div>
      </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Query Filter Card */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Calculator size={20} color="var(--purple-base)" /> Filtros de Liquidación
            </h3>
            
            <div className="responsive-flex" style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "6px" }}>Profesional Evaluado</label>
                <select className="input-field" value={selectedTerId} onChange={(e) => setSelectedTerId(e.target.value)}>
                  <option value="">Seleccione profesional...</option>
                  {terapeutas.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} {t.comisionActiva ? `(${t.comisionPorcentaje}%)` : "(Salario Fijo)"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "6px" }}>Fecha Inicio</label>
                <input type="date" className="input-field" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "6px" }}>Fecha Fin</label>
                <input type="date" className="input-field" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={calculateCommissions} style={{ height: "42px" }}>
                Calcular Comisiones
              </button>
            </div>
          </div>

          {/* Results Summary and Table */}
          {result && (
            <div className="glass fade-in" style={{ borderRadius: "var(--radius-md)", padding: "24px", boxShadow: "var(--shadow-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Liquidación de Comisiones</h3>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Profesional: <strong>{result.therapistName}</strong> | Rango: del {dateStart} al {dateEnd}
                  </span>
                </div>
                <button className="btn btn-secondary" onClick={handlePrint}>
                  <Printer size={16} /> Imprimir Reporte
                </button>
              </div>

              {/* Summary KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", padding: "14px", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Sesiones Realizadas</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>{result.totalSessions}</div>
                </div>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", padding: "14px", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Facturación Total</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>${result.totalBilling}</div>
                </div>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", padding: "14px", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Porcentaje de Comisión</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--purple-base)", marginTop: "4px" }}>{result.percentage}%</div>
                </div>
                <div style={{ backgroundColor: "var(--purple-light)", border: "1px solid var(--purple-pastel-soft)", padding: "14px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--purple-base)" }}>
                  <div style={{ color: "var(--purple-dark)", fontSize: "0.8rem", fontWeight: 500 }}>Monto a Pagar</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--purple-dark)", marginTop: "4px" }}>${result.amountDue.toFixed(2)}</div>
                </div>
              </div>

              {/* Session breakdown list */}
              <div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "12px", display: "flex", gap: "6px", alignItems: "center" }}>
                  <FileText size={18} color="var(--purple-base)" /> Desglose Detallado de Terapias
                </h4>
                <div className="responsive-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      <th style={{ padding: "10px 8px" }}>FECHA</th>
                      <th style={{ padding: "10px 8px" }}>HORA</th>
                      <th style={{ padding: "10px 8px" }}>PACIENTE / NINO</th>
                      <th style={{ padding: "10px 8px" }}>SERVICIO / TERAPIA</th>
                      <th style={{ padding: "10px 8px" }}>VALOR SESIÓN</th>
                      <th style={{ padding: "10px 8px" }}>COMISIÓN INDIVIDUAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sessionsList.map((s, idx) => {
                      const comm = (Number(s.costo) * result.percentage) / 100;
                      return (
                        <tr key={s.id || idx} style={{ borderBottom: "1px solid var(--border-soft)", height: "45px", fontSize: "0.85rem" }}>
                          <td style={{ padding: "8px", fontWeight: 500 }}>{s.fecha}</td>
                          <td style={{ padding: "8px", color: "var(--text-muted)" }}>{s.horaInicio}</td>
                          <td style={{ padding: "8px" }}>{s.pacienteNombre}</td>
                          <td style={{ padding: "8px", color: "var(--text-muted)" }}>{s.servicioNombre}</td>
                          <td style={{ padding: "8px", fontWeight: 500 }}>${s.costo}</td>
                          <td style={{ padding: "8px", fontWeight: 600, color: "var(--purple-dark)" }}>${comm.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {result.sessionsList.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                          No se registran terapias cobradas en este rango de fechas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
