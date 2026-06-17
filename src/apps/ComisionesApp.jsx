import React, { useState, useEffect } from "react";
import { subscribeToCollection, getCollection, addDocument, deleteDocument } from "../db";
import { useAuth } from "../context/AuthContext";
import { Calculator, DollarSign, Calendar, FileText, Printer, ShieldAlert, Plus, Trash2 } from "lucide-react";

export default function ComisionesApp() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.rol === "administrador";

  const [terapeutas, setTerapeutas] = useState([]);
  const [citas, setCitas] = useState([]);
  const [bonos, setBonos] = useState([]);
  
  // Filter form
  const [selectedTerId, setSelectedTerId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  
  // Calculations result
  const [result, setResult] = useState(null);
  
  // New bonus form state
  const [bonusForm, setBonusForm] = useState({ motivo: "", monto: "", fecha: "", tipo: "ingreso" });

  // Initialize dates
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
    const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
    
    setDateStart(firstDay);
    setDateEnd(lastDay);
    setBonusForm(prev => ({ ...prev, fecha: lastDay, tipo: "ingreso" }));
  }, []);

  useEffect(() => {
    const unsubTer = subscribeToCollection("terapeutas", setTerapeutas);
    const unsubCitas = subscribeToCollection("citas", setCitas);
    const unsubBonos = subscribeToCollection("bonos_extras", setBonos);
    return () => {
      unsubTer();
      unsubCitas();
      unsubBonos();
    };
  }, []);

  const calculateCommissions = () => {
    if (!selectedTerId || !dateStart || !dateEnd) {
      alert("Selecciona un profesional y un rango de fechas.");
      return;
    }

    const therapist = terapeutas.find(t => t.id === selectedTerId);
    if (!therapist) return;

    if (!therapist.comisionActiva) {
      if (!isAdmin) {
        alert("No tienes permisos para ver liquidaciones de profesionales con Salario Fijo.");
        return;
      }
      const fixedSal = Number(therapist.salarioFijo !== undefined ? therapist.salarioFijo : 500);
      alert(`El profesional ${therapist.nombre} está registrado bajo modalidad de Salario Fijo ($${fixedSal}). Se calculará su salario base mensual más bonos y extras.`);
      setResult({
        therapistId: selectedTerId,
        therapistName: therapist.nombre,
        modality: "Salario Fijo",
        totalSessions: 0,
        totalBilling: 0,
        percentage: 0,
        baseAmount: fixedSal,
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
      therapistId: selectedTerId,
      therapistName: therapist.nombre,
      modality: "Comisión por Porcentaje",
      totalSessions: matchingSessions.length,
      totalBilling,
      percentage,
      baseAmount: amountDue,
      sessionsList: matchingSessions
    });
  };

  const handleAddBonus = async (e) => {
    e.preventDefault();
    if (!result || !bonusForm.motivo || !bonusForm.monto || !bonusForm.fecha) {
      alert("Por favor completa todos los campos del ajuste.");
      return;
    }

    try {
      let parsedMonto = Number(bonusForm.monto);
      if (bonusForm.tipo === "descuento") {
        parsedMonto = -Math.abs(parsedMonto);
      }

      const isWithinRange = bonusForm.fecha >= dateStart && bonusForm.fecha <= dateEnd;
      if (!isWithinRange) {
        if (!confirm("Nota: La fecha del ajuste está fuera del rango consultado. ¿Deseas agregarlo de todas formas?")) {
          return;
        }
      }

      await addDocument("bonos_extras", {
        terapeutaId: result.therapistId,
        monto: parsedMonto,
        motivo: bonusForm.motivo,
        fecha: bonusForm.fecha,
        mes: bonusForm.fecha.substring(0, 7), // format: YYYY-MM
        registradoPor: currentUser?.nombre || "Recepción",
        estado: "pendiente"
      });

      setBonusForm({
        motivo: "",
        monto: "",
        fecha: dateEnd || new Date().toISOString().split('T')[0],
        tipo: "ingreso"
      });
      alert("Ajuste / Bono registrado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al registrar ajuste: " + err.message);
    }
  };

  const handleDeleteBonus = async (bonusId) => {
    if (confirm("¿Estás seguro de eliminar este ajuste permanentemente?")) {
      try {
        await deleteDocument("bonos_extras", bonusId);
        alert("Ajuste eliminado correctamente.");
      } catch (err) {
        console.error(err);
        alert("Error al eliminar ajuste: " + err.message);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getMatchingBonos = () => {
    if (!result) return [];
    return bonos.filter(b => 
      b.terapeutaId === result.therapistId &&
      b.fecha >= dateStart &&
      b.fecha <= dateEnd
    );
  };

  const matchingBonosList = getMatchingBonos();
  const totalBonosVal = isAdmin ? matchingBonosList.reduce((acc, b) => acc + Number(b.monto), 0) : 0;
  const finalAmountDue = result ? (result.baseAmount + totalBonosVal) : 0;

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
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
                  {terapeutas
                    .filter(t => (isAdmin || t.comisionActiva) && !t.nombre.includes("Recepción") && !t.nombre.includes("Recepcion") && !t.nombre.includes("Josua") && !t.nombre.includes("Joshua"))
                    .map(t => (
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
            <div className="glass fade-in print-area" style={{ borderRadius: "var(--radius-md)", padding: "24px", boxShadow: "var(--shadow-md)" }}>
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
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--purple-dark)", marginTop: "4px" }}>${finalAmountDue.toFixed(2)}</div>
                  {isAdmin && (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>
                      Base: $${result.baseAmount.toFixed(2)} | Ajustes: ${totalBonosVal >= 0 ? `+$${totalBonosVal.toFixed(2)}` : `-$${Math.abs(totalBonosVal).toFixed(2)}`}
                    </div>
                  )}
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

              {/* Additional Adjustments (Bonos / Horas Extras) */}
              {isAdmin && (
                <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-light)", paddingTop: "20px" }}>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "12px", display: "flex", gap: "6px", alignItems: "center" }}>
                    <DollarSign size={18} color="var(--purple-base)" /> Ajustes Adicionales (Bonos, Horas Extras, Descuentos)
                  </h4>

                  {/* List of adjustments */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    {matchingBonosList.map((b) => (
                      <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--bg-secondary)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-soft)", fontSize: "0.85rem" }}>
                        <div>
                          <span style={{ fontWeight: 500, color: "var(--text-muted)", marginRight: "8px" }}>{b.fecha}</span>
                          <strong style={{ color: "var(--text-main)" }}>{b.motivo}</strong>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "8px" }}>(Registrado por: {b.registradoPor})</span>
                          <span style={{ 
                            fontSize: "0.72rem", 
                            padding: "2px 6px", 
                            borderRadius: "10px", 
                            fontWeight: "bold", 
                            backgroundColor: (b.estado === "procesado" ? "var(--purple-light)" : "#FEF3C7"), 
                            color: (b.estado === "procesado" ? "var(--purple-dark)" : "#b45309"),
                            marginLeft: "8px"
                          }}>
                            {b.estado === "procesado" ? "Procesado" : "Pendiente"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontWeight: 600, color: b.monto >= 0 ? "var(--purple-dark)" : "var(--pink-dark)" }}>
                            {b.monto >= 0 ? `+$${Number(b.monto).toFixed(2)}` : `-$${Math.abs(Number(b.monto)).toFixed(2)}`}
                          </span>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
                            onClick={() => handleDeleteBonus(b.id)}
                            title="Eliminar Ajuste"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {matchingBonosList.length === 0 && (
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin ajustes o bonos registrados para este período.</span>
                    )}
                  </div>

                  {/* Form to add new bonus/extra hour */}
                  <form onSubmit={handleAddBonus} className="responsive-flex" style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap", marginTop: "12px" }}>
                    <div style={{ width: "160px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Tipo de Ajuste*</label>
                      <select 
                        className="input-field" 
                        value={bonusForm.tipo} 
                        onChange={(e) => setBonusForm({...bonusForm, tipo: e.target.value})}
                      >
                        <option value="ingreso">Bono / Extra (+)</option>
                        <option value="descuento">Descuento / Amonestación (-)</option>
                      </select>
                    </div>
                    <div style={{ flex: 2, minWidth: "150px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Descripción / Motivo*</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Ej. Horas Extras Sábado, Bono Productividad" 
                        className="input-field" 
                        value={bonusForm.motivo} 
                        onChange={(e) => setBonusForm({...bonusForm, motivo: e.target.value})} 
                      />
                    </div>
                    <div style={{ width: "120px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Valor ($)*</label>
                      <input 
                        type="number" 
                        required 
                        step="0.01"
                        placeholder="Ej. 25.00" 
                        className="input-field" 
                        value={bonusForm.monto} 
                        onChange={(e) => setBonusForm({...bonusForm, monto: e.target.value})} 
                      />
                    </div>
                    <div style={{ width: "140px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Fecha*</label>
                      <input 
                        type="date" 
                        required 
                        className="input-field" 
                        value={bonusForm.fecha} 
                        onChange={(e) => setBonusForm({...bonusForm, fecha: e.target.value})} 
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: "42px" }}>
                      <Plus size={16} /> Agregar
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
