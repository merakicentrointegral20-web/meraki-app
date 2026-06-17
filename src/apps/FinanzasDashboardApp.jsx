import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, deleteDocument } from "../db";
import { useAuth } from "../context/AuthContext";
import { 
  TrendingUp, DollarSign, Users, Award, Percent, 
  Printer, Calendar, Wallet, BarChart3, PieChart as PieIcon,
  ArrowRight, TrendingDown, RefreshCw, AlertCircle, Trash2, Plus, X, ShieldAlert
} from "lucide-react";

// Native SVG Donut Chart Component
function DonutChart({ data }) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  if (total === 0) {
    return (
      <div style={{ 
        height: "120px", display: "flex", justifyContent: "center", 
        alignItems: "center", color: "var(--text-muted)", fontSize: "0.85rem",
        border: "1px dashed var(--border-light)", borderRadius: "var(--radius-sm)"
      }}>
        Sin datos disponibles
      </div>
    );
  }

  let currentAngle = -90; // start at the top
  const radius = 30;
  const circumference = 2 * Math.PI * radius; // 188.495

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const strokeLength = (percentage / 100) * circumference;
          const strokeOffset = circumference - strokeLength;
          const rotation = currentAngle;
          currentAngle += (percentage / 100) * 360;

          return (
            <circle
              key={index}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={item.color}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              transform={`rotate(${rotation} 50 50)`}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          );
        })}
        <circle cx="50" cy="50" r={18} fill="white" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        {data.map((item, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: item.color }} />
            <span style={{ fontWeight: 600, color: "var(--text-main)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "120px" }}>{item.label}</span>
            <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>${item.value.toFixed(0)} ({((item.value / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinanzasDashboardApp() {
  const { currentUser } = useAuth();
  const [terapeutas, setTerapeutas] = useState([]);
  const [citas, setCitas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [bonos, setBonos] = useState([]);
  
  // Tabs: 'mensual' | 'comparador'
  const [activeTab, setActiveTab] = useState("mensual");

  // Pestaña Mensual Filter
  const [selectedMonth, setSelectedMonth] = useState("");

  // Pestaña Comparativa Filters
  const [periodAType, setPeriodAType] = useState("mes");
  const [periodAValue, setPeriodAValue] = useState("");
  const [periodBType, setPeriodBType] = useState("mes");
  const [periodBValue, setPeriodBValue] = useState("");

  // Bonus management modal state
  const [managingBonusTer, setManagingBonusTer] = useState(null);
  const [newBonus, setNewBonus] = useState({ monto: "", motivo: "", fecha: "" });

  // Selectors details
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  const months = [
    { v: "01", l: "Enero" }, { v: "02", l: "Febrero" }, { v: "03", l: "Marzo" },
    { v: "04", l: "Abril" }, { v: "05", l: "Mayo" }, { v: "06", l: "Junio" },
    { v: "07", l: "Julio" }, { v: "08", l: "Agosto" }, { v: "09", l: "Septiembre" },
    { v: "10", l: "Octubre" }, { v: "11", l: "Noviembre" }, { v: "12", l: "Diciembre" }
  ];
  const quarters = [
    { v: "Q1", l: "Q1: Ene-Mar" }, { v: "Q2", l: "Q2: Abr-Jun" },
    { v: "Q3", l: "Q3: Jul-Sep" }, { v: "Q4", l: "Q4: Oct-Dec" }
  ];
  const semesters = [
    { v: "S1", l: "S1: Ene-Jun" }, { v: "S2", l: "S2: Jul-Dic" }
  ];

  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    
    // Set default monthly
    setSelectedMonth(`${y}-${m}`);

    // Set default Period A to previous month, Period B to current month
    const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth();
    const prevYear = today.getMonth() === 0 ? y - 1 : y;
    const prevMonthStr = String(prevMonth).padStart(2, '0');
    
    setPeriodAValue(`${prevYear}-${prevMonthStr}`);
    setPeriodBValue(`${y}-${m}`);
  }, []);

  useEffect(() => {
    const unsubTer = subscribeToCollection("terapeutas", setTerapeutas);
    const unsubCitas = subscribeToCollection("citas", setCitas);
    const unsubGastos = subscribeToCollection("gastos", setGastos);
    const unsubBonos = subscribeToCollection("bonos_extras", setBonos);
    return () => {
      unsubTer();
      unsubCitas();
      unsubGastos();
      unsubBonos();
    };
  }, []);

  // Map of colors for pie chart segments
  const colors = ["#8B5CF6", "#EC4899", "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#6B7280", "#14B8A6"];

  // Helper to parse dates and return range + count of months
  const getPeriodInfo = (type, value) => {
    if (!value) return { label: "", start: "", end: "", numMonths: 0 };
    
    let start = "";
    let end = "";
    let label = "";
    let numMonths = 1;

    if (type === "mes") {
      const [year, month] = value.split("-");
      start = `${value}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      end = `${value}-${String(lastDay).padStart(2, '0')}`;
      const monthLabel = months.find(m => m.v === month)?.l || month;
      label = `${monthLabel} ${year}`;
      numMonths = 1;
    } 
    else if (type === "trimestre") {
      const [year, q] = value.split("-");
      if (q === "Q1") {
        start = `${year}-01-01`; end = `${year}-03-31`; label = `Q1 ${year} (Ene-Mar)`;
      } else if (q === "Q2") {
        start = `${year}-04-01`; end = `${year}-06-30`; label = `Q2 ${year} (Abr-Jun)`;
      } else if (q === "Q3") {
        start = `${year}-07-01`; end = `${year}-09-30`; label = `Q3 ${year} (Jul-Sep)`;
      } else {
        start = `${year}-10-01`; end = `${year}-12-31`; label = `Q4 ${year} (Oct-Dic)`;
      }
      numMonths = 3;
    }
    else if (type === "semestre") {
      const [year, s] = value.split("-");
      if (s === "S1") {
        start = `${year}-01-01`; end = `${year}-06-30`; label = `Semestre 1 ${year} (Ene-Jun)`;
      } else {
        start = `${year}-07-01`; end = `${year}-12-31`; label = `Semestre 2 ${year} (Jul-Dic)`;
      }
      numMonths = 6;
    }
    else if (type === "año") {
      start = `${value}-01-01`;
      end = `${value}-12-31`;
      label = `Año ${value}`;
      numMonths = 12;
    }

    return { label, start, end, numMonths };
  };

  // Helper to calculate statistics for any arbitrary range
  const calculatePeriodMetrics = (start, end, numMonths) => {
    if (!start || !end) return { totalRevenues: 0, totalPayouts: 0, totalExpenses: 0, netProfit: 0, globalMargin: 0, breakdown: [], expensesBreakdown: [] };

    // Filter appointments
    const filteredCitas = citas.filter(c => 
      c.fecha >= start && 
      c.fecha <= end && 
      c.estadoAsistencia === "asistio" && 
      c.cobrada === true
    );

    // Filter expenses
    const filteredGastos = gastos.filter(g => 
      g.fecha >= start && 
      g.fecha <= end
    );

    // Filter bonos
    const filteredBonos = bonos.filter(b => {
      const bonusFecha = b.fecha || `${b.mes}-15`;
      return bonusFecha >= start && bonusFecha <= end;
    });

    let totalRevenues = 0;
    let totalPayouts = 0;

    const breakdown = terapeutas.map(t => {
      const therapistSessions = filteredCitas.filter(c => c.terapeutaId === t.id);
      const grossRevenue = therapistSessions.reduce((acc, s) => acc + Number(s.costo), 0);
      
      let payout = 0;
      let modalityLabel = "";

      if (t.comisionActiva) {
        const pct = Number(t.comisionPorcentaje || 0);
        // Commission is calculated over charged sessions
        payout = therapistSessions.reduce((acc, s) => acc + (Number(s.costo) * pct) / 100, 0);
        modalityLabel = `Comisión (${pct}%)`;
      } else {
        payout = Number(t.salarioFijo !== undefined ? t.salarioFijo : 500) * numMonths;
        modalityLabel = `Salario Fijo ($${(t.salarioFijo || 500).toFixed(0)}/mes)`;
      }

      // Filter and sum bonuses/extras for this therapist
      const therapistBonos = filteredBonos.filter(b => b.terapeutaId === t.id);
      const totalBonos = therapistBonos.reduce((acc, b) => acc + Number(b.monto), 0);
      const totalPayout = payout + totalBonos;

      const netProfit = grossRevenue - totalPayout;
      const margin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

      totalRevenues += grossRevenue;
      totalPayouts += totalPayout;

      return {
        id: t.id,
        nombre: t.nombre,
        especialidad: t.especialidad,
        modality: modalityLabel,
        isComision: t.comisionActiva,
        totalSessions: therapistSessions.length,
        grossRevenue,
        payout,
        totalBonos,
        totalPayout,
        netProfit,
        margin
      };
    });

    // General Operating Expenses (excluding Petty Cash Replenishments to avoid double-counting)
    const totalExpenses = filteredGastos
      .filter(g => g.categoria !== "Reposición de Caja Chica")
      .reduce((acc, g) => acc + Number(g.monto), 0);

    // Group expenses by category
    const categories = ["Caja Chica", "Alquiler", "Servicios Públicos", "Materiales y Papelería", "Mantenimiento", "Otros"];
    const expensesBreakdown = categories.map((cat, index) => {
      const val = filteredGastos.filter(g => g.categoria === cat).reduce((acc, g) => acc + Number(g.monto), 0);
      return {
        label: cat,
        value: val,
        color: colors[index % colors.length]
      };
    }).filter(e => e.value > 0);

    const netProfit = totalRevenues - totalPayouts - totalExpenses;
    const globalMargin = totalRevenues > 0 ? (netProfit / totalRevenues) * 100 : 0;

    return {
      totalRevenues,
      totalPayouts,
      totalExpenses,
      netProfit,
      globalMargin,
      breakdown,
      expensesBreakdown
    };
  };

  // 1. Calculations for Monthly Tab
  const pInfoMonthly = getPeriodInfo("mes", selectedMonth);
  const metricsMonthly = calculatePeriodMetrics(pInfoMonthly.start, pInfoMonthly.end, pInfoMonthly.numMonths);

  // 2. Calculations for Comparative Tab
  const pInfoA = getPeriodInfo(periodAType, periodAValue);
  const pInfoB = getPeriodInfo(periodBType, periodBValue);
  const metricsA = calculatePeriodMetrics(pInfoA.start, pInfoA.end, pInfoA.numMonths);
  const metricsB = calculatePeriodMetrics(pInfoB.start, pInfoB.end, pInfoB.numMonths);

  // Dynamically generate accountant feedback text
  const getAnalystText = () => {
    if (metricsA.totalRevenues === 0 && metricsB.totalRevenues === 0) {
      return "No se registran suficientes datos financieros en ninguno de los dos períodos para emitir un diagnóstico analítico.";
    }

    const revDiff = metricsB.totalRevenues - metricsA.totalRevenues;
    const revDiffPct = metricsA.totalRevenues > 0 ? (revDiff / metricsA.totalRevenues) * 100 : 100;
    
    const profitDiff = metricsB.netProfit - metricsA.netProfit;
    const profitDiffPct = metricsA.netProfit > 0 ? (profitDiff / metricsA.netProfit) * 100 : (metricsA.netProfit < 0 && metricsB.netProfit > 0 ? 100 : 0);

    const expDiff = (metricsB.totalExpenses + metricsB.totalPayouts) - (metricsA.totalExpenses + metricsA.totalPayouts);
    const expDiffPct = (metricsA.totalExpenses + metricsA.totalPayouts) > 0 ? (expDiff / (metricsA.totalExpenses + metricsA.totalPayouts)) * 100 : 0;

    let textRevenues = "";
    if (revDiff > 0) {
      textRevenues = `La facturación bruta del centro experimentó un aumento saludable del **${revDiffPct.toFixed(1)}%** en ${pInfoB.label} respecto a ${pInfoA.label}, sumando **$${revDiff.toFixed(2)}** en ingresos adicionales. Esto sugiere un mayor flujo de pacientes o un incremento en tarifas cobradas.`;
    } else if (revDiff < 0) {
      textRevenues = `Se observa una contracción en los ingresos brutos del **${Math.abs(revDiffPct).toFixed(1)}%** en ${pInfoB.label} en comparación con ${pInfoA.label}. Esto representa **$${Math.abs(revDiff).toFixed(2)}** menos de facturación y amerita revisar los niveles de agendamiento y absentismo escolar.`;
    } else {
      textRevenues = `La facturación bruta del centro se mantuvo estancada con un cambio del **0.0%** entre ambos períodos, manteniendo un ingreso constante de **$${metricsB.totalRevenues.toFixed(2)}**.`;
    }

    let textExpenses = "";
    const totalExpB = metricsB.totalExpenses + metricsB.totalPayouts;
    const pctOfRevB = metricsB.totalRevenues > 0 ? (totalExpB / metricsB.totalRevenues) * 100 : 0;
    if (expDiff > 0) {
      textExpenses = `Por el lado de los egresos, el costo operativo total (terapeutas y gastos generales) creció un **${expDiffPct.toFixed(1)}%**. En ${pInfoB.label}, la estructura total de costos devoró el **${pctOfRevB.toFixed(1)}%** de lo facturado, totalizando **$${totalExpB.toFixed(2)}**.`;
    } else if (expDiff < 0) {
      textExpenses = `Se logró una optimización de gastos, disminuyendo el costo operativo total en un **${Math.abs(expDiffPct).toFixed(1)}%**. En el período de comparación, la estructura de costos representa un **${pctOfRevB.toFixed(1)}%** de la facturación, indicando una mayor eficiencia en el control presupuestario.`;
    } else {
      textExpenses = `La estructura de gastos generales y pago a profesionales se mantuvo estable sin variaciones entre períodos.`;
    }

    let textProfit = "";
    if (profitDiff > 0) {
      textProfit = `La utilidad neta real escaló de forma favorable un **${profitDiffPct.toFixed(1)}%**, reportando una rentabilidad de **$${metricsB.netProfit.toFixed(2)}** en ${pInfoB.label} contra **$${metricsA.netProfit.toFixed(2)}** en el anterior. El margen de ganancia neta subió al **${metricsB.globalMargin.toFixed(1)}%**, situando al centro en un estado financiero sumamente saludable.`;
    } else if (profitDiff < 0) {
      textProfit = `La utilidad neta real se vio afectada negativamente por una caída de **$${Math.abs(profitDiff).toFixed(2)}**. El margen neto global se redujo al **${metricsB.globalMargin.toFixed(1)}%** (anteriormente **${metricsA.globalMargin.toFixed(1)}%**). Esto indica que los egresos/salarios están creciendo por encima del volumen de ingresos en el centro.`;
    } else {
      textProfit = `La utilidad neta y el margen neto no registraron variaciones nominales de importancia, permaneciendo en **$${metricsB.netProfit.toFixed(2)}** y **${metricsB.globalMargin.toFixed(1)}%** respectivamente.`;
    }

    // Best therapist in comparative B
    const sortedTers = [...metricsB.breakdown].sort((a, b) => b.netProfit - a.netProfit);
    const starTer = sortedTers[0];
    let textStar = "";
    if (starTer && starTer.netProfit > 0) {
      textStar = `El terapeuta que reportó la mayor utilidad neta operativa (ingreso cobrado menos costo directo) en ${pInfoB.label} fue **${starTer.nombre}**, generando un total neta de **$${starTer.netProfit.toFixed(2)}** con un excelente margen operativo individual de **${starTer.margin.toFixed(0)}%**.`;
    }

    return {
      textRevenues,
      textExpenses,
      textProfit,
      textStar
    };
  };

  const handleAddBonus = async (e) => {
    e.preventDefault();
    if (!newBonus.monto || !newBonus.motivo) {
      alert("Por favor completa el monto y el motivo.");
      return;
    }
    try {
      await addDocument("bonos_extras", {
        terapeutaId: managingBonusTer.id,
        mes: selectedMonth,
        monto: Number(newBonus.monto),
        motivo: newBonus.motivo,
        fecha: newBonus.fecha || (selectedMonth ? `${selectedMonth}-15` : ""),
        registradoPor: currentUser?.nombre || "Administrador"
      });
      setNewBonus({ monto: "", motivo: "", fecha: selectedMonth ? `${selectedMonth}-15` : "" });
      alert("Bono registrado con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al registrar bono: " + err.message);
    }
  };

  const handleDeleteBonus = async (id) => {
    if (confirm("¿Estás seguro de eliminar este bono/ajuste permanentemente?")) {
      try {
        await deleteDocument("bonos_extras", id);
      } catch (err) {
        console.error(err);
        alert("Error al eliminar bono.");
      }
    }
  };

  const analystReport = getAnalystText();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fade-in print-full-width" style={{ padding: "20px" }}>
      {/* Print styles inserted directly to restrict elements on print */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: #111827 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .glass {
            background: white !important;
            box-shadow: none !important;
            border: 1px solid #D1D5DB !important;
            backdrop-filter: none !important;
            margin-bottom: 20px !important;
            page-break-inside: avoid;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingUp size={24} /> Dashboard de Control Financiero
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Rentabilidad mensual real deduciendo nómina y gastos (Exclusivo Administradora).</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print" style={{ display: "flex", gap: "12px", borderBottom: "2px solid var(--border-light)", marginBottom: "20px" }}>
        <button 
          onClick={() => setActiveTab("mensual")}
          style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 500, cursor: "pointer",
            borderBottom: activeTab === "mensual" ? "3px solid var(--purple-base)" : "3px solid transparent",
            color: activeTab === "mensual" ? "var(--purple-dark)" : "var(--text-muted)"
          }}
        >
          <Calendar size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} /> Control Mensual
        </button>
        <button 
          onClick={() => setActiveTab("comparador")}
          style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 500, cursor: "pointer",
            borderBottom: activeTab === "comparador" ? "3px solid var(--purple-base)" : "3px solid transparent",
            color: activeTab === "comparador" ? "var(--purple-dark)" : "var(--text-muted)"
          }}
        >
          <BarChart3 size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} /> Comparativa de Períodos
        </button>
      </div>

      {/* ======================= TAB 1: CONTROL MENSUAL ======================= */}
      {activeTab === "mensual" && (
        <div className="print-full-width">
          {/* Month Selector Card */}
          <div className="glass no-print" style={{ borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "20px", display: "flex", gap: "16px", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Seleccionar Mes de Operación:</span>
            <input 
              type="month" 
              className="input-field" 
              style={{ width: "180px" }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          {/* Title for print */}
          <div style={{ display: "none" }} className="show-on-print">
            <h1 style={{ fontSize: "1.8rem", color: "#6D28D9", marginBottom: "4px" }}>MERAKI - Reporte de Control Financiero</h1>
            <p style={{ color: "#4B5563", fontSize: "0.9rem", marginBottom: "20px" }}>Período: {pInfoMonthly.label} • Exclusivo de Administración</p>
          </div>

          {/* KPI Cards */}
          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "18px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}>
                <DollarSign size={14} /> Facturación Bruta (A)
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-main)" }}>
                ${metricsMonthly.totalRevenues.toFixed(2)}
              </span>
              <span style={{ color: "#10B981", fontSize: "0.7rem", fontWeight: 600 }}>Citas completadas cobradas</span>
            </div>

            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "18px", display: "flex", flexDirection: "column", gap: "6px", borderLeft: "4px solid var(--purple-base)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}>
                <Users size={14} /> Nómina Profesional (B)
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--purple-dark)" }}>
                ${metricsMonthly.totalPayouts.toFixed(2)}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Comisiones + salarios fijos</span>
            </div>

            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "18px", display: "flex", flexDirection: "column", gap: "6px", borderLeft: "4px solid var(--pink-base)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}>
                <Wallet size={14} /> Gastos Generales (C)
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--pink-dark)" }}>
                ${metricsMonthly.totalExpenses.toFixed(2)}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Servicios, renta y caja chica</span>
            </div>

            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "18px", display: "flex", flexDirection: "column", gap: "6px", borderLeft: "4px solid #10B981", backgroundColor: "var(--purple-light)" }}>
              <span style={{ color: "var(--purple-dark)", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <Award size={14} /> Utilidad Neta Real (A - B - C)
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--purple-dark)" }}>
                ${metricsMonthly.netProfit.toFixed(2)}
              </span>
              <span style={{ color: "#10B981", fontSize: "0.7rem", fontWeight: 600 }}>Retorno real del negocio</span>
            </div>

            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "18px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}>
                <Percent size={14} /> Margen Neto de Ganancia
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-main)" }}>
                {metricsMonthly.globalMargin.toFixed(1)}%
              </span>
              <span style={{ color: "var(--purple-base)", fontSize: "0.7rem", fontWeight: 600 }}>Tasa de retorno del capital</span>
            </div>
          </div>

          {/* Donut and Bar Charts Section */}
          <div className="responsive-grid print-full-width" style={{ display: "grid", gridTemplateColumns: "1.3fr 1.7fr", gap: "20px", marginBottom: "20px" }}>
            
            {/* Visual SVG Donut Charts (Proportion) */}
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)" }}>Desglose de Egresos Mensual</h3>
              
              {metricsMonthly.totalPayouts === 0 && metricsMonthly.totalExpenses === 0 ? (
                <div style={{ height: "120px", display: "flex", justifyContent: "center", alignItems: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Sin egresos registrados en este período.
                </div>
              ) : (
                <DonutChart 
                  data={[
                    { label: "Nómina Directa", value: metricsMonthly.totalPayouts, color: "var(--purple-base)" },
                    ...metricsMonthly.expensesBreakdown.map(e => ({ label: e.label, value: e.value, color: e.color }))
                  ]}
                />
              )}
            </div>

            {/* Income vs Expenses Bar Chart */}
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "12px" }}>Facturación vs Egreso Directo por Profesional</h3>
              
              {metricsMonthly.totalRevenues === 0 ? (
                <div style={{ height: "120px", display: "flex", justifyContent: "center", alignItems: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Sin facturación en este período.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, justifyContent: "center" }}>
                  {metricsMonthly.breakdown
                    .filter(b => b.grossRevenue > 0)
                    .map(item => {
                      const maxVal = Math.max(...metricsMonthly.breakdown.map(b => b.grossRevenue), 1);
                      const revPct = (item.grossRevenue / maxVal) * 75;
                      const payPct = (item.payout / maxVal) * 75;

                      return (
                        <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>{item.nombre}</span>
                          
                          {/* Revenue Bar */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: `${Math.max(5, revPct)}%`, height: "10px", borderRadius: "5px", background: "linear-gradient(90deg, var(--purple-base) 0%, #a78bfa 100%)" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500 }}>Bruto: ${item.grossRevenue.toFixed(0)}</span>
                          </div>

                          {/* Payout Bar */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: `${Math.max(5, payPct)}%`, height: "10px", borderRadius: "5px", background: "linear-gradient(90deg, var(--pink-base) 0%, #f472b6 100%)" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--pink-dark)", fontWeight: 500 }}>Pago: ${item.payout.toFixed(0)}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", fontSize: "0.7rem", borderTop: "1px solid var(--border-light)", paddingTop: "10px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "var(--purple-base)" }} />
                  <span>Bruto Recaudado</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "var(--pink-base)" }} />
                  <span>Pago Terapeuta</span>
                </div>
              </div>
            </div>

          </div>

          {/* Table Breakdown */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Detalle de Rentabilidad por Profesional</h3>
            <div className="responsive-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  <th style={{ padding: "10px 6px" }}>PROFESIONAL</th>
                  <th style={{ padding: "10px 6px" }}>MODALIDAD</th>
                  <th style={{ padding: "10px 6px", textAlign: "center" }}>CITAS ASISTIDAS</th>
                  <th style={{ padding: "10px 6px" }}>BRUTO ($)</th>
                  <th style={{ padding: "10px 6px" }}>BONOS / EXTRAS ($)</th>
                  <th style={{ padding: "10px 6px" }}>EGRESO / PAGO ($)</th>
                  <th style={{ padding: "10px 6px" }}>UTILIDAD NETA ($)</th>
                  <th style={{ padding: "10px 6px" }}>MARGEN</th>
                </tr>
              </thead>
              <tbody>
                {metricsMonthly.breakdown.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "42px", fontSize: "0.82rem" }}>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>{item.nombre}</td>
                    <td style={{ padding: "8px 6px", color: "var(--text-muted)", fontSize: "0.72rem" }}>{item.modality}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 500 }}>{item.totalSessions}</td>
                    <td style={{ padding: "8px 6px" }}>${item.grossRevenue.toFixed(2)}</td>
                    <td style={{ padding: "8px 6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 600 }}>${item.totalBonos.toFixed(2)}</span>
                        <button 
                          className="btn btn-secondary no-print" 
                          onClick={() => {
                            setManagingBonusTer(item);
                            setNewBonus({ monto: "", motivo: "", fecha: selectedMonth ? `${selectedMonth}-15` : "" });
                          }}
                          style={{ padding: "3px 8px", fontSize: "0.7rem", height: "auto" }}
                        >
                          <Plus size={10} style={{ marginRight: "2px" }} /> Gestionar
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "8px 6px", color: "var(--pink-dark)", fontWeight: 500 }}>
                      -${item.totalPayout.toFixed(2)}
                      {item.totalBonos > 0 && (
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>
                          (Base: ${item.payout.toFixed(0)})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 6px", color: item.netProfit >= 0 ? "#10B981" : "var(--pink-dark)", fontWeight: 600 }}>
                      ${item.netProfit.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <span style={{ 
                        padding: "2px 6px", borderRadius: "10px", fontSize: "0.68rem", fontWeight: 600,
                        backgroundColor: item.margin > 0 ? "#D1FAE5" : "#FEE2E2",
                        color: item.margin > 0 ? "#065F46" : "#991B1B"
                      }}>
                        {item.margin.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {metricsMonthly.breakdown.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No hay terapeutas registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: COMPARATIVA DE PERÍODOS ======================= */}
      {activeTab === "comparador" && (
        <div className="print-full-width">
          {/* Comparative Selectors */}
          <div className="glass no-print" style={{ borderRadius: "var(--radius-md)", padding: "20px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--purple-dark)", marginBottom: "14px" }}>Configurar Períodos a Contrastar</h3>
            <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
              
              {/* Period A Selectors */}
              <div className="period-col-left" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-main)" }}>Período A (Base)</span>
                
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px", alignItems: "center" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Tipo:</label>
                  <select 
                    className="input-field" 
                    value={periodAType} 
                    onChange={(e) => { setPeriodAType(e.target.value); setPeriodAValue(""); }}
                  >
                    <option value="mes">Mensual</option>
                    <option value="trimestre">Trimestral</option>
                    <option value="semestre">Semestral</option>
                    <option value="año">Anual</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px", alignItems: "center" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Selección:</label>
                  {periodAType === "mes" && (
                    <input 
                      type="month" 
                      className="input-field" 
                      value={periodAValue} 
                      onChange={(e) => setPeriodAValue(e.target.value)} 
                    />
                  )}
                  {periodAType === "trimestre" && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <select className="input-field" style={{ flex: 1 }} value={periodAValue.split("-")[0] || currentYear} onChange={(e) => {
                        const q = periodAValue.split("-")[1] || "Q1";
                        setPeriodAValue(`${e.target.value}-${q}`);
                      }}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select className="input-field" style={{ flex: 2 }} value={periodAValue.split("-")[1] || "Q1"} onChange={(e) => {
                        const y = periodAValue.split("-")[0] || currentYear;
                        setPeriodAValue(`${y}-${e.target.value}`);
                      }}>
                        {quarters.map(q => <option key={q.v} value={q.v}>{q.l}</option>)}
                      </select>
                    </div>
                  )}
                  {periodAType === "semestre" && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <select className="input-field" style={{ flex: 1 }} value={periodAValue.split("-")[0] || currentYear} onChange={(e) => {
                        const s = periodAValue.split("-")[1] || "S1";
                        setPeriodAValue(`${e.target.value}-${s}`);
                      }}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select className="input-field" style={{ flex: 2 }} value={periodAValue.split("-")[1] || "S1"} onChange={(e) => {
                        const y = periodAValue.split("-")[0] || currentYear;
                        setPeriodAValue(`${y}-${e.target.value}`);
                      }}>
                        {semesters.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </select>
                    </div>
                  )}
                  {periodAType === "año" && (
                    <select className="input-field" value={periodAValue} onChange={(e) => setPeriodAValue(e.target.value)}>
                      <option value="">Seleccione...</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* Period B Selectors */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-main)" }}>Período B (Comparativo)</span>
                
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px", alignItems: "center" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Tipo:</label>
                  <select 
                    className="input-field" 
                    value={periodBType} 
                    onChange={(e) => { setPeriodBType(e.target.value); setPeriodBValue(""); }}
                  >
                    <option value="mes">Mensual</option>
                    <option value="trimestre">Trimestral</option>
                    <option value="semestre">Semestral</option>
                    <option value="año">Anual</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px", alignItems: "center" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Selección:</label>
                  {periodBType === "mes" && (
                    <input 
                      type="month" 
                      className="input-field" 
                      value={periodBValue} 
                      onChange={(e) => setPeriodBValue(e.target.value)} 
                    />
                  )}
                  {periodBType === "trimestre" && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <select className="input-field" style={{ flex: 1 }} value={periodBValue.split("-")[0] || currentYear} onChange={(e) => {
                        const q = periodBValue.split("-")[1] || "Q1";
                        setPeriodBValue(`${e.target.value}-${q}`);
                      }}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select className="input-field" style={{ flex: 2 }} value={periodBValue.split("-")[1] || "Q1"} onChange={(e) => {
                        const y = periodBValue.split("-")[0] || currentYear;
                        setPeriodBValue(`${y}-${e.target.value}`);
                      }}>
                        {quarters.map(q => <option key={q.v} value={q.v}>{q.l}</option>)}
                      </select>
                    </div>
                  )}
                  {periodBType === "semestre" && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <select className="input-field" style={{ flex: 1 }} value={periodBValue.split("-")[0] || currentYear} onChange={(e) => {
                        const s = periodBValue.split("-")[1] || "S1";
                        setPeriodBValue(`${e.target.value}-${s}`);
                      }}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select className="input-field" style={{ flex: 2 }} value={periodBValue.split("-")[1] || "S1"} onChange={(e) => {
                        const y = periodBValue.split("-")[0] || currentYear;
                        setPeriodBValue(`${y}-${e.target.value}`);
                      }}>
                        {semesters.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </select>
                    </div>
                  )}
                  {periodBType === "año" && (
                    <select className="input-field" value={periodBValue} onChange={(e) => setPeriodBValue(e.target.value)}>
                      <option value="">Seleccione...</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Print specific header title */}
          <div style={{ display: "none" }} className="show-on-print">
            <h1 style={{ fontSize: "1.6rem", color: "#6D28D9", marginBottom: "4px" }}>MERAKI - Informe Comparativo Multitemporal</h1>
            <p style={{ color: "#4B5563", fontSize: "0.85rem", marginBottom: "20px" }}>
              Contrasta del Período A: <strong>{pInfoA.label || "N/A"}</strong> con el Período B: <strong>{pInfoB.label || "N/A"}</strong>
            </p>
          </div>

          {/* Comparative Metrics KPI Cards */}
          <div className="responsive-grid print-full-width" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
            
            {/* KPI: Facturación Bruta */}
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Facturación Bruta (Ingresos)</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>A: ${metricsA.totalRevenues.toFixed(0)}</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)" }}>B: ${metricsB.totalRevenues.toFixed(0)}</span>
              </div>
              {(() => {
                const diff = metricsB.totalRevenues - metricsA.totalRevenues;
                const pct = metricsA.totalRevenues > 0 ? (diff / metricsA.totalRevenues) * 100 : 0;
                return (
                  <span style={{ 
                    fontSize: "0.75rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "2px",
                    color: diff >= 0 ? "#10B981" : "#EF4444"
                  }}>
                    {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {diff >= 0 ? "+" : ""}${diff.toFixed(0)} ({diff >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                  </span>
                );
              })()}
            </div>

            {/* KPI: Costo Nómina */}
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Nómina Terapeutas</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>A: ${metricsA.totalPayouts.toFixed(0)}</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--purple-dark)" }}>B: ${metricsB.totalPayouts.toFixed(0)}</span>
              </div>
              {(() => {
                const diff = metricsB.totalPayouts - metricsA.totalPayouts;
                const pct = metricsA.totalPayouts > 0 ? (diff / metricsA.totalPayouts) * 100 : 0;
                return (
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    Var: {diff >= 0 ? "+" : ""}${diff.toFixed(0)} ({diff >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                  </span>
                );
              })()}
            </div>

            {/* KPI: Gastos Operativos */}
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Gastos Generales</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>A: ${metricsA.totalExpenses.toFixed(0)}</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--pink-dark)" }}>B: ${metricsB.totalExpenses.toFixed(0)}</span>
              </div>
              {(() => {
                const diff = metricsB.totalExpenses - metricsA.totalExpenses;
                const pct = metricsA.totalExpenses > 0 ? (diff / metricsA.totalExpenses) * 100 : 0;
                return (
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    Var: {diff >= 0 ? "+" : ""}${diff.toFixed(0)} ({diff >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                  </span>
                );
              })()}
            </div>

            {/* KPI: Utilidad Neta Real */}
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "var(--purple-light)" }}>
              <span style={{ color: "var(--purple-dark)", fontSize: "0.78rem", fontWeight: 600 }}>Utilidad Neta Real</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--purple-dark)", opacity: 0.7 }}>A: ${metricsA.netProfit.toFixed(0)}</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--purple-dark)" }}>B: ${metricsB.netProfit.toFixed(0)}</span>
              </div>
              {(() => {
                const diff = metricsB.netProfit - metricsA.netProfit;
                const pct = metricsA.netProfit !== 0 ? (diff / Math.abs(metricsA.netProfit)) * 100 : 0;
                return (
                  <span style={{ 
                    fontSize: "0.75rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "2px",
                    color: diff >= 0 ? "#10B981" : "#EF4444"
                  }}>
                    {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {diff >= 0 ? "+" : ""}${diff.toFixed(0)} ({diff >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                  </span>
                );
              })()}
            </div>

          </div>

          {/* Dynamic SVG Comparison Chart & Pie Chart */}
          <div className="responsive-grid print-full-width" style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: "20px", marginBottom: "20px" }}>
            
            {/* SVG Bars comparing A vs B side-by-side */}
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)" }}>Comparativo Visual: Facturación, Gastos y Utilidades</h3>
              
              {metricsA.totalRevenues === 0 && metricsB.totalRevenues === 0 ? (
                <div style={{ height: "180px", display: "flex", justifyContent: "center", alignItems: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Configura períodos con transacciones para generar la comparativa visual.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "10px 0" }}>
                  {/* Category 1: Ingresos Brutos */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                      <span style={{ fontWeight: 600 }}>Facturación Bruta (Ingresos)</span>
                      <span style={{ color: "var(--text-muted)" }}>A: ${metricsA.totalRevenues.toFixed(0)} | B: ${metricsB.totalRevenues.toFixed(0)}</span>
                    </div>
                    {/* Progress bars */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.7rem", width: "15px", color: "var(--text-muted)" }}>A</span>
                        <div style={{ flex: 1, backgroundColor: "var(--border-soft)", height: "8px", borderRadius: "4px" }}>
                          <div style={{ 
                            width: `${(metricsA.totalRevenues / Math.max(metricsA.totalRevenues, metricsB.totalRevenues, 1)) * 100}%`,
                            height: "100%", borderRadius: "4px", backgroundColor: "#A78BFA"
                          }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.7rem", width: "15px", fontWeight: "bold", color: "var(--purple-dark)" }}>B</span>
                        <div style={{ flex: 1, backgroundColor: "var(--border-soft)", height: "8px", borderRadius: "4px" }}>
                          <div style={{ 
                            width: `${(metricsB.totalRevenues / Math.max(metricsA.totalRevenues, metricsB.totalRevenues, 1)) * 100}%`,
                            height: "100%", borderRadius: "4px", backgroundColor: "var(--purple-base)"
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category 2: Nómina Terapeutas */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                      <span style={{ fontWeight: 600 }}>Nómina de Profesionales</span>
                      <span style={{ color: "var(--text-muted)" }}>A: ${metricsA.totalPayouts.toFixed(0)} | B: ${metricsB.totalPayouts.toFixed(0)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.7rem", width: "15px", color: "var(--text-muted)" }}>A</span>
                        <div style={{ flex: 1, backgroundColor: "var(--border-soft)", height: "8px", borderRadius: "4px" }}>
                          <div style={{ 
                            width: `${(metricsA.totalPayouts / Math.max(metricsA.totalPayouts, metricsB.totalPayouts, 1)) * 100}%`,
                            height: "100%", borderRadius: "4px", backgroundColor: "#C084FC"
                          }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.7rem", width: "15px", fontWeight: "bold", color: "var(--purple-dark)" }}>B</span>
                        <div style={{ flex: 1, backgroundColor: "var(--border-soft)", height: "8px", borderRadius: "4px" }}>
                          <div style={{ 
                            width: `${(metricsB.totalPayouts / Math.max(metricsA.totalPayouts, metricsB.totalPayouts, 1)) * 100}%`,
                            height: "100%", borderRadius: "4px", backgroundColor: "#8B5CF6"
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category 3: Gastos Generales */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                      <span style={{ fontWeight: 600 }}>Gastos Generales / Caja Chica</span>
                      <span style={{ color: "var(--text-muted)" }}>A: ${metricsA.totalExpenses.toFixed(0)} | B: ${metricsB.totalExpenses.toFixed(0)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.7rem", width: "15px", color: "var(--text-muted)" }}>A</span>
                        <div style={{ flex: 1, backgroundColor: "var(--border-soft)", height: "8px", borderRadius: "4px" }}>
                          <div style={{ 
                            width: `${(metricsA.totalExpenses / Math.max(metricsA.totalExpenses, metricsB.totalExpenses, 1)) * 100}%`,
                            height: "100%", borderRadius: "4px", backgroundColor: "#F472B6"
                          }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.7rem", width: "15px", fontWeight: "bold", color: "var(--pink-dark)" }}>B</span>
                        <div style={{ flex: 1, backgroundColor: "var(--border-soft)", height: "8px", borderRadius: "4px" }}>
                          <div style={{ 
                            width: `${(metricsB.totalExpenses / Math.max(metricsA.totalExpenses, metricsB.totalExpenses, 1)) * 100}%`,
                            height: "100%", borderRadius: "4px", backgroundColor: "var(--pink-base)"
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category 4: Utilidad Real */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                      <span style={{ fontWeight: 600 }}>Utilidad Neta Real</span>
                      <span style={{ color: "var(--text-muted)" }}>A: ${metricsA.netProfit.toFixed(0)} | B: ${metricsB.netProfit.toFixed(0)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.7rem", width: "15px", color: "var(--text-muted)" }}>A</span>
                        <div style={{ flex: 1, backgroundColor: "var(--border-soft)", height: "8px", borderRadius: "4px" }}>
                          <div style={{ 
                            width: `${(Math.max(0, metricsA.netProfit) / Math.max(metricsA.netProfit, metricsB.netProfit, 1)) * 100}%`,
                            height: "100%", borderRadius: "4px", backgroundColor: "#34D399"
                          }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.7rem", width: "15px", fontWeight: "bold", color: "#059669" }}>B</span>
                        <div style={{ flex: 1, backgroundColor: "var(--border-soft)", height: "8px", borderRadius: "4px" }}>
                          <div style={{ 
                            width: `${(Math.max(0, metricsB.netProfit) / Math.max(metricsA.netProfit, metricsB.netProfit, 1)) * 100}%`,
                            height: "100%", borderRadius: "4px", backgroundColor: "#10B981"
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Donut Chart: Period B Cost Structure (therapists vs other expenses) */}
            <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)" }}>Estructura de Gastos: {pInfoB.label || "Período B"}</h3>
              
              {metricsB.totalPayouts === 0 && metricsB.totalExpenses === 0 ? (
                <div style={{ height: "180px", display: "flex", justifyContent: "center", alignItems: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Sin gastos registrados en el Período B.
                </div>
              ) : (
                <DonutChart 
                  data={[
                    { label: "Nómina Directa", value: metricsB.totalPayouts, color: "var(--purple-base)" },
                    ...metricsB.expensesBreakdown.map(e => ({ label: e.label, value: e.value, color: e.color }))
                  ]}
                />
              )}
            </div>

          </div>

          {/* Super Pro Accounting Analyst Diagnosis Report */}
          <div className="glass print-full-width" style={{ borderRadius: "var(--radius-md)", padding: "24px", marginBottom: "20px", borderLeft: "6px solid var(--purple-base)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--purple-dark)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Award size={20} /> Diagnóstico del Analista Contable • MERAKI
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, border: "1px solid var(--border-light)", padding: "2px 8px", borderRadius: "10px" }}>
                Generado Automáticamente
              </span>
            </div>

            {metricsA.totalRevenues === 0 && metricsB.totalRevenues === 0 ? (
              <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                Configure ambos períodos para proyectar el informe financiero del analista contable.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.88rem", lineHeight: "1.5", color: "var(--text-main)" }}>
                <p>
                  A continuación, se detalla la auditoría de variaciones financieras identificadas al contrastar el <strong>Período A ({pInfoA.label})</strong> frente al <strong>Período B ({pInfoB.label})</strong>:
                </p>

                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <li>
                    <strong>Comportamiento de la Facturación:</strong> {analystReport.textRevenues}
                  </li>
                  <li>
                    <strong>Estructura y Comportamiento de Egresos:</strong> {analystReport.textExpenses}
                  </li>
                  <li>
                    <strong>Evolución del Beneficio Neto:</strong> {analystReport.textProfit}
                  </li>
                  {analystReport.textStar && (
                    <li>
                      <strong>Rendimiento Operativo Directo:</strong> {analystReport.textStar}
                    </li>
                  )}
                </ul>

                <div style={{ 
                  marginTop: "16px", padding: "14px", borderRadius: "var(--radius-sm)", 
                  backgroundColor: metricsB.netProfit >= 0 ? "var(--purple-light)" : "#FEF2F2",
                  border: `1px solid ${metricsB.netProfit >= 0 ? "var(--purple-pastel-soft)" : "#FCA5A5"}`
                }}>
                  <strong style={{ display: "flex", alignItems: "center", gap: "6px", color: metricsB.netProfit >= 0 ? "var(--purple-dark)" : "#B91C1C", marginBottom: "4px" }}>
                    <AlertCircle size={16} /> Recomendación de Optimización Financiera:
                  </strong>
                  <span style={{ color: "var(--text-main)" }}>
                    {metricsB.netProfit < 0 ? (
                      "Alerta: El centro registra pérdidas en el período comparativo. Es crítico implementar un control estricto de caja chica reduciendo gastos superfluos e incrementar el ratio de facturación bruta mediante campañas de retención de pacientes o agendamiento intensivo."
                    ) : metricsB.globalMargin < 15 ? (
                      "Sugerencia: Aunque se registran ganancias, el margen de utilidad es estrecho (< 15%). Recomendamos evaluar la migración de profesionales con salarios fijos subutilizados a esquemas por comisión variable, logrando así que el egreso de nómina se adapte dinámicamente al volumen de citas cobradas."
                    ) : (
                      "Felicitaciones: El centro opera en una banda de rentabilidad excelente (> 15%). Recomendamos mantener el esquema actual, incentivar la captación de nuevos pacientes dirigidos hacia los profesionales con mayor rentabilidad individual y planificar reservas de capital operativo."
                    )}
                  </span>
                </div>

                <div style={{ marginTop: "20px", borderTop: "1px dashed var(--border-light)", paddingTop: "14px", display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  <span>Auditoría de Sistemas Financieros MERAKI</span>
                  <span>Firma: Analista Contable del Sistema</span>
                </div>
              </div>
            )}
          </div>

          {/* Comparative Table Breakdown */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Desglose Comparativo de Terapeutas</h3>
            <div className="responsive-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  <th style={{ padding: "10px 6px" }}>PROFESIONAL</th>
                  <th style={{ padding: "10px 6px" }}>INGRESOS (A vs B)</th>
                  <th style={{ padding: "10px 6px" }}>EGRESOS (A vs B)</th>
                  <th style={{ padding: "10px 6px" }}>UTILIDAD OPERATIVA A</th>
                  <th style={{ padding: "10px 6px" }}>UTILIDAD OPERATIVA B</th>
                  <th style={{ padding: "10px 6px", textAlign: "right" }}>VARIACIÓN NETA</th>
                </tr>
              </thead>
              <tbody>
                {metricsB.breakdown.map((itemB) => {
                  const itemA = metricsA.breakdown.find(a => a.id === itemB.id) || { grossRevenue: 0, payout: 0, totalPayout: 0, netProfit: 0 };
                  const diff = itemB.netProfit - itemA.netProfit;
                  const diffPct = itemA.netProfit !== 0 ? (diff / Math.abs(itemA.netProfit)) * 100 : 0;

                  return (
                    <tr key={itemB.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "42px", fontSize: "0.82rem" }}>
                      <td style={{ padding: "8px 6px", fontWeight: 600 }}>{itemB.nombre}</td>
                      <td style={{ padding: "8px 6px" }}>${itemA.grossRevenue.toFixed(0)} → ${itemB.grossRevenue.toFixed(0)}</td>
                      <td style={{ padding: "8px 6px", color: "var(--pink-dark)" }}>-${(itemA.totalPayout || 0).toFixed(0)} → -${itemB.totalPayout.toFixed(0)}</td>
                      <td style={{ padding: "8px 6px" }}>${itemA.netProfit.toFixed(0)}</td>
                      <td style={{ padding: "8px 6px", fontWeight: "bold" }}>${itemB.netProfit.toFixed(0)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>
                        <span style={{ 
                          padding: "2px 6px", borderRadius: "10px", fontSize: "0.68rem", fontWeight: 600,
                          backgroundColor: diff >= 0 ? "#D1FAE5" : "#FEE2E2",
                          color: diff >= 0 ? "#065F46" : "#991B1B"
                        }}>
                          {diff >= 0 ? "+" : ""}${diff.toFixed(0)} ({diff >= 0 ? "+" : ""}{diffPct.toFixed(0)}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

        </div>
      )}

      {/* Modal for Managing Bonuses */}
      {managingBonusTer && createPortal(
        <div className="no-print" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "500px", maxWidth: "90%", maxHeight: "85vh", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "white", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", fontSize: "1.1rem" }}>Bonos y Ajustes Extras</h3>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Profesional: <strong>{managingBonusTer.nombre}</strong> | Mes: {selectedMonth}
                </span>
              </div>
              <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }} onClick={() => setManagingBonusTer(null)}>
                <X size={20} />
              </button>
            </div>

            {/* List of active bonuses */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", minHeight: "120px", maxHeight: "250px" }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>Ajustes Registrados en el Mes:</h4>
              {bonos.filter(b => b.terapeutaId === managingBonusTer.id && b.mes === selectedMonth).length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.8rem", border: "1px dashed var(--border-light)", borderRadius: "var(--radius-sm)" }}>
                  No se registran bonos o extras para este profesional en este mes.
                </div>
              ) : (
                bonos
                  .filter(b => b.terapeutaId === managingBonusTer.id && b.mes === selectedMonth)
                  .map(b => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--purple-dark)" }}>${b.monto.toFixed(2)}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-main)" }}>{b.motivo}</span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Fecha: {b.fecha} | Registrado por: {b.registradoPor || "Admin"}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteBonus(b.id)}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--pink-dark)" }}
                        title="Eliminar Ajuste"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Form to add a new bonus */}
            <form onSubmit={handleAddBonus} style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--border-light)", paddingTop: "14px" }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--purple-dark)" }}>Agregar Nuevo Ajuste / Bono</h4>
              
              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Monto ($)*</label>
                  <input 
                    type="number" 
                    required 
                    min="0.01" 
                    step="0.01" 
                    placeholder="Ej. 50" 
                    className="input-field" 
                    value={newBonus.monto} 
                    onChange={(e) => setNewBonus({...newBonus, monto: e.target.value})} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Fecha del Ajuste*</label>
                  <input 
                    type="date" 
                    required 
                    className="input-field" 
                    value={newBonus.fecha} 
                    onChange={(e) => setNewBonus({...newBonus, fecha: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 500, display: "block", marginBottom: "4px" }}>Concepto / Motivo*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. Bono de Productividad, Reintegro de Materiales" 
                  className="input-field" 
                  value={newBonus.motivo} 
                  onChange={(e) => setNewBonus({...newBonus, motivo: e.target.value})} 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ justifyContent: "center", marginTop: "4px" }}>
                <Plus size={16} /> Registrar Bono / Ajuste
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
