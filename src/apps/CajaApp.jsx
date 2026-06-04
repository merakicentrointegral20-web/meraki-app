import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, getCollection, deleteDocument } from "../db";
import { useAuth } from "../context/AuthContext";
import { DollarSign, CheckCircle2, AlertTriangle, Search, FileText, Check, Copy, Upload, ArrowUpRight, Trash2, Plus, Wallet } from "lucide-react";

export default function CajaApp() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.rol === "administrador";

  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [transacciones, setTransacciones] = useState([]);
  const [gastos, setGastos] = useState([]);
  
  // Tab states: 'cobros_hoy' | 'conciliacion' | 'deudas' | 'gastos'
  const [activeTab, setActiveTab] = useState("cobros_hoy");
  const [targetDate, setTargetDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Expenses filter and form state
  const [gastosMonth, setGastosMonth] = useState("");
  const [gForm, setGForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: "",
    categoria: "Caja Chica",
    descripcion: "",
    metodoPago: "Efectivo"
  });
  
  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    monto: 20, tipo: "efectivo", banco: "", comprobante: "",
    verificado: false, facturado: false
  });

  // Abono modal for Cuentas por Cobrar
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [selectedDeuda, setSelectedDeuda] = useState(null);
  const [abonoForm, setAbonoForm] = useState({
    monto: "", tipo: "efectivo", banco: "", comprobante: "",
    verificado: false, facturado: false
  });

  useEffect(() => {
    const today = new Date();
    setTargetDate(today.toISOString().split('T')[0]);
    
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    setGastosMonth(`${y}-${m}`);
  }, []);

  useEffect(() => {
    const unsubCitas = subscribeToCollection("citas", setCitas);
    const unsubPacientes = subscribeToCollection("pacientes", setPacientes);
    const unsubTransacciones = subscribeToCollection("transacciones", setTransacciones);
    const unsubGastos = subscribeToCollection("gastos", setGastos);
    return () => {
      unsubCitas();
      unsubPacientes();
      unsubTransacciones();
      unsubGastos();
    };
  }, []);

  const getCobrosHoy = () => {
    // Get all appointments of targetDate that are set to be charged
    return citas.filter(c => c.fecha === targetDate && c.cobrada === true);
  };

  const getDeudasRep = () => {
    // For each patient, sum all sessions marked as cobrada but not paid
    // Wait, in our database:
    // Every session has a cost (e.g. $20) and a state (estadoAsistencia: asistio, etc.)
    // If cita.cobrada === true:
    // It is an expense.
    // If there is an associated payment transaction, it is an income.
    // Total Debt = Total Cost of Completed/Charged Sessions - Total Payments Registered
    const deudas = {};
    
    // 1. Accumulate all charged sessions
    citas.forEach(c => {
      if (c.cobrada && c.estadoAsistencia !== "pendiente" && c.estadoAsistencia !== "falto_justificado") {
        const patient = pacientes.find(p => p.id === c.pacienteId);
        if (!patient) return;
        
        const repName = patient.representante || "Representante";
        const repId = patient.cedulaRepresentante || patient.id;

        if (!deudas[repId]) {
          deudas[repId] = {
            repId,
            representante: repName,
            pacienteNombre: patient.nombre,
            telefono: patient.telefono,
            totalCargos: 0,
            totalAbonado: 0,
            citasPendientes: []
          };
        }
        deudas[repId].totalCargos += Number(c.costo);
        
        // Find if this specific cita is unpaid
        // In our data, a cita is paid if we associate it, or if overall balance is negative.
        // Let's assume a simpler model: if the cita is not marked as completed-paid, we list it as pending
        // Wait, to keep it simple: we calculate the balance.
      }
    });

    // 2. Accumulate all payments registered for each representative
    transacciones.forEach(t => {
      const repId = t.representanteId;
      if (deudas[repId]) {
        deudas[repId].totalAbonado += Number(t.monto);
      }
    });

    // 3. Filter only those who owe money (Cargos > Abonos)
    return Object.values(deudas)
      .map(d => ({
        ...d,
        saldoDebe: d.totalCargos - d.totalAbonado
      }))
      .filter(d => d.saldoDebe > 0);
  };

  const handleOpenPayModal = (cita) => {
    const patient = pacientes.find(p => p.id === cita.pacienteId);
    setSelectedCita(cita);
    setPaymentForm({
      monto: Number(cita.costo),
      tipo: "efectivo",
      banco: "",
      comprobante: "",
      verificado: false,
      facturado: false
    });
    setShowPayModal(true);
  };

  const handleRegisterPayment = async (e) => {
    e.preventDefault();
    if (!selectedCita) return;

    const patient = pacientes.find(p => p.id === selectedCita.pacienteId);
    const repId = patient?.cedulaRepresentante || patient?.id || "Desconocido";

    try {
      // Register the transaction
      const transData = {
        representanteId: repId,
        pacienteId: selectedCita.pacienteId,
        pacienteNombre: selectedCita.pacienteNombre,
        citaId: selectedCita.id,
        monto: Number(paymentForm.monto),
        tipo: paymentForm.tipo,
        banco: paymentForm.tipo !== "efectivo" ? paymentForm.banco : "",
        comprobante: paymentForm.tipo !== "efectivo" ? paymentForm.comprobante : "",
        fechaRegistro: new Date().toISOString(),
        verificado: paymentForm.tipo === "efectivo" ? true : false, // Cash is auto-verified
        facturado: paymentForm.facturado
      };
      
      await addDocument("transacciones", transData);

      // Update the cita status to asistio (so it counts as completed) and make sure it remains cobrada
      await updateDocument("citas", selectedCita.id, {
        estadoAsistencia: "asistio"
      });

      setShowPayModal(false);
      alert("Cobro registrado correctamente.");
    } catch (e) {
      console.error(e);
      alert("Error al registrar pago.");
    }
  };

  const handleOpenAbonoModal = (deuda) => {
    setSelectedDeuda(deuda);
    setAbonoForm({
      monto: Number(deuda.saldoDebe),
      tipo: "efectivo",
      banco: "",
      comprobante: "",
      verificado: false,
      facturado: false
    });
    setShowAbonoModal(true);
  };

  const handleRegisterAbono = async (e) => {
    e.preventDefault();
    if (!selectedDeuda) return;

    try {
      const transData = {
        representanteId: selectedDeuda.repId,
        pacienteNombre: selectedDeuda.pacienteNombre,
        monto: Number(abonoForm.monto),
        tipo: abonoForm.tipo,
        banco: abonoForm.tipo !== "efectivo" ? abonoForm.banco : "",
        comprobante: abonoForm.tipo !== "efectivo" ? abonoForm.comprobante : "",
        fechaRegistro: new Date().toISOString(),
        verificado: abonoForm.tipo === "efectivo" ? true : false, // Cash is auto-verified
        facturado: abonoForm.facturado
      };

      await addDocument("transacciones", transData);
      setShowAbonoModal(false);
      alert("Abono / Pago registrado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al registrar el abono/pago.");
    }
  };

  const handleClearDebt = async (deuda) => {
    if (confirm(`¿Estás seguro de eliminar la deuda pendiente de $${deuda.saldoDebe} de ${deuda.representante}? Esto registrará un ajuste contable para saldar la cuenta.`)) {
      try {
        await addDocument("transacciones", {
          representanteId: deuda.repId,
          pacienteNombre: deuda.pacienteNombre,
          monto: Number(deuda.saldoDebe),
          tipo: "ajuste_saldo",
          motivo: "Depuración / Eliminación de deudas viejas",
          fechaRegistro: new Date().toISOString(),
          verificado: true,
          facturado: false
        });
        alert("Deuda eliminada y saldada con éxito.");
      } catch (err) {
        console.error(err);
        alert("Error al eliminar la deuda.");
      }
    }
  };

  const handleVerifyTransaction = async (transId) => {
    if (!isAdmin) {
      alert("Solo el Administrador puede verificar transferencias bancarias.");
      return;
    }
    try {
      await updateDocument("transacciones", transId, { verificado: true });
      alert("Transferencia bancaria verificada e ingresada a caja con éxito.");
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Datos copiados al portapapeles.");
  };

  const handleCreateGasto = async (e) => {
    e.preventDefault();
    if (!gForm.monto || !gForm.descripcion) {
      alert("Monto y descripción son obligatorios.");
      return;
    }
    try {
      await addDocument("gastos", {
        fecha: gForm.fecha,
        monto: Number(gForm.monto),
        categoria: gForm.categoria,
        descripcion: gForm.descripcion,
        metodoPago: gForm.metodoPago,
        registradoPor: currentUser.nombre
      });
      setGForm({
        fecha: new Date().toISOString().split('T')[0],
        monto: "",
        categoria: "Caja Chica",
        descripcion: "",
        metodoPago: "Efectivo"
      });
      alert("Gasto registrado con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al registrar gasto: " + err.message);
    }
  };

  const handleDeleteGasto = async (gastoId) => {
    if (!isAdmin) {
      alert("Acceso denegado. Solo la administradora puede eliminar gastos.");
      return;
    }
    if (confirm("¿Estás seguro de eliminar este gasto permanentemente?")) {
      try {
        await deleteDocument("gastos", gastoId);
        alert("Gasto eliminado correctamente.");
      } catch (err) {
        console.error(err);
        alert("Error al eliminar gasto.");
      }
    }
  };

  const cobrosHoy = getCobrosHoy();
  const deudasRep = getDeudasRep();
  
  // Calculate today's cash totals
  const totalEsperadoHoy = cobrosHoy.reduce((acc, c) => acc + Number(c.costo), 0);
  
  // Count how much of today's appointments have been paid
  // A cita today is paid if there is a transaction matching the citaId
  const getCitaPayStatus = (citaId) => {
    return transacciones.find(t => t.citaId === citaId);
  };

  const totalCobradoHoy = cobrosHoy.reduce((acc, c) => {
    const pay = getCitaPayStatus(c.id);
    return acc + (pay ? Number(pay.monto) : 0);
  }, 0);

  const pendientesCobroHoy = cobrosHoy.filter(c => !getCitaPayStatus(c.id));
  const verifiList = transacciones.filter(t => t.tipo !== "efectivo" && t.verificado === false);

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Caja y Cobros Diarios</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Control de recaudación diaria y conciliación bancaria.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {activeTab === "cobros_hoy" && (
            <input 
              type="date" 
              className="input-field" 
              style={{ width: "160px" }}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          )}
          {activeTab === "gastos" && (
            <input 
              type="month" 
              className="input-field" 
              style={{ width: "160px" }}
              value={gastosMonth}
              onChange={(e) => setGastosMonth(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "2px solid var(--border-light)", marginBottom: "20px" }}>
        <button 
          onClick={() => setActiveTab("cobros_hoy")}
          style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 500, cursor: "pointer",
            borderBottom: activeTab === "cobros_hoy" ? "3px solid var(--purple-base)" : "3px solid transparent",
            color: activeTab === "cobros_hoy" ? "var(--purple-dark)" : "var(--text-muted)"
          }}
        >
          Cobros del Día (Rojo/Verde)
        </button>
        <button 
          onClick={() => setActiveTab("conciliacion")}
          style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 500, cursor: "pointer",
            borderBottom: activeTab === "conciliacion" ? "3px solid var(--purple-base)" : "3px solid transparent",
            color: activeTab === "conciliacion" ? "var(--purple-dark)" : "var(--text-muted)"
          }}
        >
          Conciliación de Transferencias ({verifiList.length} pendientes)
        </button>
        <button 
          onClick={() => setActiveTab("deudas")}
          style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 500, cursor: "pointer",
            borderBottom: activeTab === "deudas" ? "3px solid var(--purple-base)" : "3px solid transparent",
            color: activeTab === "deudas" ? "var(--purple-dark)" : "var(--text-muted)"
          }}
        >
          Cuentas por Cobrar ({deudasRep.length})
        </button>
        <button 
          onClick={() => setActiveTab("gastos")}
          style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 500, cursor: "pointer",
            borderBottom: activeTab === "gastos" ? "3px solid var(--purple-base)" : "3px solid transparent",
            color: activeTab === "gastos" ? "var(--purple-dark)" : "var(--text-muted)"
          }}
        >
          Gastos y Caja Chica
        </button>
      </div>

      {activeTab === "cobros_hoy" && (
        <>
          {/* Daily cash status */}
          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Total Esperado Hoy</span>
              <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--text-main)" }}>${totalEsperadoHoy}</span>
            </div>
            <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px", borderLeft: "4px solid #10B981" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Total Recaudado Hoy</span>
              <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "#10B981" }}>${totalCobradoHoy}</span>
            </div>
            <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px", borderLeft: "4px solid var(--pink-base)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Pendiente por Cobrar</span>
              <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--pink-base)" }}>${totalEsperadoHoy - totalCobradoHoy}</span>
            </div>
          </div>

          {/* List of today's collections */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Sesiones Agendadas de Hoy</h3>
            <div className="responsive-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  <th style={{ padding: "12px 8px" }}>HORA</th>
                  <th style={{ padding: "12px 8px" }}>NINO / PACIENTE</th>
                  <th style={{ padding: "12px 8px" }}>TERAPIA</th>
                  <th style={{ padding: "12px 8px" }}>COSTO</th>
                  <th style={{ padding: "12px 8px" }}>ESTADO DE ASISTENCIA</th>
                  <th style={{ padding: "12px 8px" }}>ESTADO PAGO</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {cobrosHoy.map((c) => {
                  const pay = getCitaPayStatus(c.id);
                  const patient = pacientes.find(p => p.id === c.pacienteId);
                  const requiresInvoice = patient?.requiereFactura;
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "55px" }}>
                      <td style={{ padding: "12px 8px", fontWeight: 600, color: "var(--text-muted)" }}>{c.horaInicio}</td>
                      <td style={{ padding: "12px 8px", fontWeight: 500 }}>
                        {c.pacienteNombre}
                        {requiresInvoice && (
                          <span style={{ marginLeft: "6px", padding: "2px 6px", borderRadius: "4px", fontSize: "0.65rem", fontWeight: "bold", backgroundColor: "var(--purple-light)", color: "var(--purple-dark)" }} title="Requiere factura">
                            SRI
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{c.servicioNombre}</td>
                      <td style={{ padding: "12px 8px", fontWeight: 500 }}>${c.costo}</td>
                      <td style={{ padding: "12px 8px" }}>
                        <span style={{ 
                          padding: "2px 6px", borderRadius: "10px", fontSize: "0.75rem", 
                          backgroundColor: c.estadoAsistencia === "asistio" ? "#D1FAE5" : c.estadoAsistencia === "falto_injustificado" ? "#FEE2E2" : "#F3F4F6",
                          color: c.estadoAsistencia === "asistio" ? "#065F46" : c.estadoAsistencia === "falto_injustificado" ? "#991B1B" : "var(--text-muted)"
                        }}>
                          {c.estadoAsistencia?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {pay ? (
                          <span style={{ padding: "4px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: "#D1FAE5", color: "#065F46", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={12} /> PAGADO
                          </span>
                        ) : (
                          <span style={{ padding: "4px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: "#FEE2E2", color: "#991B1B", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertTriangle size={12} /> SIN PAGAR
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        {!pay ? (
                          <button 
                            className="btn btn-primary"
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            onClick={() => handleOpenPayModal(c)}
                          >
                            Cobrar
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{pay.tipo?.toUpperCase()}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {cobrosHoy.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>No hay terapias programadas sujetas a cobro para hoy.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "conciliacion" && (
        <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Buzón de Transferencias Pendientes de Verificación (Odoo Conciliación)</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>Verifica estos depósitos y transferencias en el portal del banco antes de confirmar su ingreso a caja.</p>
          <div className="responsive-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                <th style={{ padding: "12px 8px" }}>NINO / PACIENTE</th>
                <th style={{ padding: "12px 8px" }}>BANCO</th>
                <th style={{ padding: "12px 8px" }}>COMPROBANTE</th>
                <th style={{ padding: "12px 8px" }}>MONTO</th>
                <th style={{ padding: "12px 8px" }}>REGISTRADO EN</th>
                <th style={{ padding: "12px 8px", textAlign: "right" }}>ACCIÓN (ADMIN)</th>
              </tr>
            </thead>
            <tbody>
              {verifiList.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "55px" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 500 }}>{t.pacienteNombre}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{t.banco?.toUpperCase()}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace" }}>{t.comprobante}</td>
                  <td style={{ padding: "12px 8px", fontWeight: 600, color: "var(--purple-dark)" }}>${t.monto}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.8rem" }}>{new Date(t.fechaRegistro).toLocaleString("es-ES")}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <button 
                      className="btn btn-primary"
                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      onClick={() => handleVerifyTransaction(t.id)}
                      disabled={!isAdmin}
                    >
                      <Check size={14} /> Verificar Comprobante
                    </button>
                  </td>
                </tr>
              ))}
              {verifiList.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>No hay transferencias pendientes de verificación.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {activeTab === "deudas" && (
        <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Cuentas por Cobrar (Clientes en Mora)</h3>
          <div className="responsive-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                <th style={{ padding: "12px 8px" }}>REPRESENTANTE</th>
                <th style={{ padding: "12px 8px" }}>CÉDULA / RUC</th>
                <th style={{ padding: "12px 8px" }}>PACIENTE</th>
                <th style={{ padding: "12px 8px" }}>TELÉFONO</th>
                <th style={{ padding: "12px 8px" }}>TOTAL CARGOS</th>
                <th style={{ padding: "12px 8px" }}>TOTAL ABONADO</th>
                <th style={{ padding: "12px 8px" }}>DEUDA PENDIENTE</th>
                <th style={{ padding: "12px 8px", textAlign: "right" }}>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {deudasRep.map((d) => (
                <tr key={d.repId} style={{ borderBottom: "1px solid var(--border-soft)", height: "55px" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 500, color: "var(--pink-dark)" }}>{d.representante}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{d.repId}</td>
                  <td style={{ padding: "12px 8px" }}>{d.pacienteNombre}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{d.telefono}</td>
                  <td style={{ padding: "12px 8px" }}>${d.totalCargos}</td>
                  <td style={{ padding: "12px 8px" }}>${d.totalAbonado}</td>
                  <td style={{ padding: "12px 8px", fontWeight: 600, color: "var(--pink-base)" }}>${d.saldoDebe}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                      <button 
                        className="btn btn-primary"
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                        onClick={() => handleOpenAbonoModal(d)}
                      >
                        Registrar Pago
                      </button>
                      <button 
                        className="btn btn-danger"
                        style={{ padding: "6px 10px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        onClick={() => handleClearDebt(d)}
                        title="Eliminar / Depurar Deuda"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {deudasRep.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>No hay representantes en mora. ¡Caja al día!</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {activeTab === "gastos" && (
        <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", alignItems: "start" }}>
          
          {/* Form to Register Expense */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
              <Wallet size={18} style={{ color: "var(--purple-base)" }} /> Registrar Gasto / Caja Chica
            </h3>
            <form onSubmit={handleCreateGasto} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Fecha*</label>
                <input 
                  type="date" 
                  required 
                  className="input-field" 
                  value={gForm.fecha} 
                  onChange={(e) => setGForm({...gForm, fecha: e.target.value})} 
                />
              </div>
              
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Categoría*</label>
                <select 
                  className="input-field" 
                  value={gForm.categoria} 
                  onChange={(e) => setGForm({...gForm, categoria: e.target.value})}
                >
                  <option value="Caja Chica">Caja Chica (Menor)</option>
                  <option value="Alquiler">Alquiler de Local</option>
                  <option value="Servicios Públicos">Servicios Públicos (Luz/Agua/Net)</option>
                  <option value="Materiales y Papelería">Materiales y Papelería</option>
                  <option value="Mantenimiento">Mantenimiento y Limpieza</option>
                  <option value="Otros">Otros Gastos Generales</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Monto ($)*</label>
                <input 
                  type="number" 
                  required 
                  min="0.01" 
                  step="0.01" 
                  className="input-field" 
                  placeholder="Ej. 12.50" 
                  value={gForm.monto} 
                  onChange={(e) => setGForm({...gForm, monto: e.target.value})} 
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Método de Pago*</label>
                <select 
                  className="input-field" 
                  value={gForm.metodoPago} 
                  onChange={(e) => setGForm({...gForm, metodoPago: e.target.value})}
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Descripción / Concepto*</label>
                <textarea 
                  required 
                  rows="3" 
                  className="input-field" 
                  placeholder="Ej. Compra de botellones de agua para la sala de espera" 
                  value={gForm.descripcion} 
                  onChange={(e) => setGForm({...gForm, descripcion: e.target.value})}
                  style={{ resize: "none" }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ justifyContent: "center", marginTop: "10px" }}>
                <Plus size={16} /> Registrar Gasto
              </button>
            </form>
          </div>

          {/* List/Historial of Expenses */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)" }}>Historial de Gastos</h3>
              <span style={{ fontSize: "0.85rem", fontWeight: "bold", backgroundColor: "var(--pink-light)", color: "var(--pink-dark)", padding: "4px 10px", borderRadius: "12px" }}>
                Total Mes: ${
                  gastos
                    .filter(g => g.fecha.startsWith(gastosMonth))
                    .reduce((acc, g) => acc + Number(g.monto), 0)
                    .toFixed(2)
                }
              </span>
            </div>
            
            <div className="responsive-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  <th style={{ padding: "12px 8px" }}>FECHA</th>
                  <th style={{ padding: "12px 8px" }}>CATEGORÍA</th>
                  <th style={{ padding: "12px 8px" }}>DESCRIPCIÓN</th>
                  <th style={{ padding: "12px 8px" }}>PAGO</th>
                  <th style={{ padding: "12px 8px" }}>REGISTRADO POR</th>
                  <th style={{ padding: "12px 8px" }}>MONTO ($)</th>
                  {isAdmin && <th style={{ padding: "12px 8px", textAlign: "right" }}></th>}
                </tr>
              </thead>
              <tbody>
                {gastos
                  .filter(g => g.fecha.startsWith(gastosMonth))
                  .sort((a, b) => b.fecha.localeCompare(a.fecha))
                  .map((g) => (
                    <tr key={g.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "50px", fontSize: "0.85rem" }}>
                      <td style={{ padding: "8px", fontWeight: 500 }}>{g.fecha}</td>
                      <td style={{ padding: "8px" }}>
                        <span style={{ 
                          padding: "2px 6px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 600,
                          backgroundColor: g.categoria === "Caja Chica" ? "#FEF3C7" : g.categoria === "Alquiler" ? "#F5F3FF" : g.categoria === "Servicios Públicos" ? "#E0F2FE" : "#F3F4F6",
                          color: g.categoria === "Caja Chica" ? "#D97706" : g.categoria === "Alquiler" ? "var(--purple-dark)" : g.categoria === "Servicios Públicos" ? "#0369A1" : "var(--text-muted)"
                        }}>
                          {g.categoria}
                        </span>
                      </td>
                      <td style={{ padding: "8px", color: "var(--text-muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.descripcion}>
                        {g.descripcion}
                      </td>
                      <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.75rem" }}>{g.metodoPago}</td>
                      <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.75rem" }}>{g.registradoPor || "Sistema"}</td>
                      <td style={{ padding: "8px", fontWeight: 600, color: "var(--pink-dark)" }}>${Number(g.monto).toFixed(2)}</td>
                      {isAdmin && (
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button 
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            onClick={() => handleDeleteGasto(g.id)}
                            title="Eliminar Gasto"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                {gastos.filter(g => g.fecha.startsWith(gastosMonth)).length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>No hay gastos registrados en este mes.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && selectedCita && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "450px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <DollarSign size={20} /> Registrar Cobro
            </h3>
            
            <form onSubmit={handleRegisterPayment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "0.9rem", backgroundColor: "var(--purple-light)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--purple-pastel-soft)" }}>
                <strong>Niño:</strong> {selectedCita.pacienteNombre}<br />
                <strong>Terapia:</strong> {selectedCita.servicioNombre}<br />
                <strong>Costo pactado:</strong> ${selectedCita.costo}
              </div>

              {/* Invoicing indicator */}
              {pacientes.find(p => p.id === selectedCita.pacienteId)?.requiereFactura && (
                <div style={{ backgroundColor: "#FDF2F8", border: "1px solid var(--pink-pastel-soft)", color: "var(--pink-dark)", padding: "10px", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", fontWeight: "bold" }}>
                    <FileText size={16} /> CLIENTE REQUIERE FACTURA (SRI)
                  </div>
                  {(() => {
                    const pat = pacientes.find(p => p.id === selectedCita.pacienteId);
                    const invoiceData = `RUC: ${pat.datosFacturacion.ruc}\nNombre: ${pat.datosFacturacion.nombre}\nDirección: ${pat.datosFacturacion.direccion}\nCorreo: ${pat.datosFacturacion.correo}`;
                    return (
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: "4px 8px", fontSize: "0.75rem", justifyContent: "center" }}
                        onClick={() => copyToClipboard(invoiceData)}
                      >
                        <Copy size={12} /> Copiar datos de Factura
                      </button>
                    );
                  })()}
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Monto Cobrado ($)*</label>
                <input 
                  type="number" 
                  required 
                  className="input-field" 
                  value={paymentForm.monto} 
                  onChange={(e) => setPaymentForm({...paymentForm, monto: e.target.value})} 
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Método de Pago*</label>
                <select className="input-field" value={paymentForm.tipo} onChange={(e) => setPaymentForm({...paymentForm, tipo: e.target.value})}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="deposito">Depósito Bancario</option>
                </select>
              </div>

              {paymentForm.tipo !== "efectivo" && (
                <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Banco*</label>
                    <select required className="input-field" value={paymentForm.banco} onChange={(e) => setPaymentForm({...paymentForm, banco: e.target.value})}>
                      <option value="">Seleccione...</option>
                      <option value="pichincha">Pichincha</option>
                      <option value="guayaquil">Guayaquil</option>
                      <option value="pacifico">Pacífico</option>
                      <option value="jardin azuayo">Jardín Azuayo</option>
                      <option value="bolivariano">Bolivariano</option>
                      <option value="jep">JEP</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nro Comprobante*</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ej. 7335470" 
                      className="input-field" 
                      value={paymentForm.comprobante} 
                      onChange={(e) => setPaymentForm({...paymentForm, comprobante: e.target.value})} 
                    />
                  </div>
                  <div style={{ gridColumn: "span 2", marginTop: "4px" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "flex", gap: "4px", alignItems: "center" }}>
                      <Upload size={14} /> Subir Captura de Comprobante (Opcional)
                    </label>
                    <div style={{ border: "2px dashed var(--purple-pastel-soft)", borderRadius: "var(--radius-sm)", padding: "10px", textAlign: "center", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Arrastra o selecciona la imagen del recibo
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <input type="checkbox" id="payFacturado" checked={paymentForm.facturado} onChange={(e) => setPaymentForm({...paymentForm, facturado: e.target.checked})} />
                <label htmlFor="payFacturado" style={{ fontSize: "0.85rem" }}>Marcar factura como EMITIDA en el SRI</label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Ingreso</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showAbonoModal && selectedDeuda && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "450px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <DollarSign size={20} /> Registrar Pago / Abono
            </h3>
            
            <form onSubmit={handleRegisterAbono} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "0.9rem", backgroundColor: "var(--purple-light)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--purple-pastel-soft)" }}>
                <strong>Representante:</strong> {selectedDeuda.representante}<br />
                <strong>Cédula:</strong> {selectedDeuda.repId}<br />
                <strong>Paciente:</strong> {selectedDeuda.pacienteNombre}<br />
                <strong>Deuda Pendiente:</strong> ${selectedDeuda.saldoDebe}
              </div>

              {/* Check if patient requires invoice */}
              {(() => {
                const pat = pacientes.find(p => p.cedulaRepresentante === selectedDeuda.repId || p.id === selectedDeuda.repId);
                if (pat?.requiereFactura) {
                  const invoiceData = `RUC: ${pat.datosFacturacion?.ruc || ""}\nNombre: ${pat.datosFacturacion?.nombre || ""}\nDirección: ${pat.datosFacturacion?.direccion || ""}\nCorreo: ${pat.datosFacturacion?.correo || ""}`;
                  return (
                    <div style={{ backgroundColor: "#FDF2F8", border: "1px solid var(--pink-pastel-soft)", color: "var(--pink-dark)", padding: "10px", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", fontWeight: "bold" }}>
                        <FileText size={16} /> CLIENTE REQUIERE FACTURA (SRI)
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: "4px 8px", fontSize: "0.75rem", justifyContent: "center" }}
                        onClick={() => copyToClipboard(invoiceData)}
                      >
                        <Copy size={12} /> Copiar datos de Factura
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Monto a Abonar ($)*</label>
                <input 
                  type="number" 
                  required 
                  min="0.01"
                  step="0.01"
                  className="input-field" 
                  value={abonoForm.monto} 
                  onChange={(e) => setAbonoForm({...abonoForm, monto: e.target.value})} 
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Método de Pago*</label>
                <select className="input-field" value={abonoForm.tipo} onChange={(e) => setAbonoForm({...abonoForm, tipo: e.target.value})}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="deposito">Depósito Bancario</option>
                </select>
              </div>

              {abonoForm.tipo !== "efectivo" && (
                <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Banco*</label>
                    <select required className="input-field" value={abonoForm.banco} onChange={(e) => setAbonoForm({...abonoForm, banco: e.target.value})}>
                      <option value="">Seleccione...</option>
                      <option value="pichincha">Pichincha</option>
                      <option value="guayaquil">Guayaquil</option>
                      <option value="pacifico">Pacífico</option>
                      <option value="jardin azuayo">Jardín Azuayo</option>
                      <option value="bolivariano">Bolivariano</option>
                      <option value="jep">JEP</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nro Comprobante*</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ej. 7335470" 
                      className="input-field" 
                      value={abonoForm.comprobante} 
                      onChange={(e) => setAbonoForm({...abonoForm, comprobante: e.target.value})} 
                    />
                  </div>
                  <div style={{ gridColumn: "span 2", marginTop: "4px" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "flex", gap: "4px", alignItems: "center" }}>
                      <Upload size={14} /> Subir Captura de Comprobante (Opcional)
                    </label>
                    <div style={{ border: "2px dashed var(--purple-pastel-soft)", borderRadius: "var(--radius-sm)", padding: "10px", textAlign: "center", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Arrastra o selecciona la imagen del recibo
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <input type="checkbox" id="abonoFacturado" checked={abonoForm.facturado} onChange={(e) => setAbonoForm({...abonoForm, facturado: e.target.checked})} />
                <label htmlFor="abonoFacturado" style={{ fontSize: "0.85rem" }}>Marcar factura como EMITIDA en el SRI</label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAbonoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Ingreso</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
