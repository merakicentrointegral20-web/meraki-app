import React, { useState, useEffect, useMemo } from "react";
import { subscribeToCollection, addDocument, setDocument, deleteDocument } from "../db";
import { useAuth } from "../context/AuthContext";
import { createPortal } from "react-dom";
import { 
  Users, Calendar, Briefcase, FileText, CheckSquare, Plus, Trash2, Printer, Edit2, 
  AlertCircle, Lock, Unlock, FileSpreadsheet, PlusCircle, UserPlus, Info, CheckCircle
} from "lucide-react";

export default function NominaRrhhApp() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.rol === "administrador";

  // Active sub-tab inside HR module
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'empleados' | 'marcaciones' | 'nomina' | 'feriados'

  // DB States
  const [empleados, setEmpleados] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [roles, setRoles] = useState([]);
  const [mesesCerrados, setMesesCerrados] = useState([]);

  // Subscriptions
  useEffect(() => {
    const unsubEmp = subscribeToCollection("empleados", (data) => setEmpleados(data.sort((a,b) => a.nombres.localeCompare(b.nombres))));
    const unsubNov = subscribeToCollection("novedades", setNovedades);
    const unsubFer = subscribeToCollection("feriados", setFeriados);
    const unsubRol = subscribeToCollection("roles", setRoles);
    const unsubCerrados = subscribeToCollection("meses_cerrados", (data) => setMesesCerrados(data.map(d => d.key || d.id)));

    return () => {
      unsubEmp();
      unsubNov();
      unsubFer();
      unsubRol();
      unsubCerrados();
    };
  }, []);

  // Utility helpers
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (f) => {
    if (!f) return "—";
    try {
      return new Date(f + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) {
      return f;
    }
  };
  const MN = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // --- 1. MODAL STATE FOR EMPLEADO ---
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [empForm, setEmpForm] = useState({ id: "", nombres: "", cedula: "", cargo: "", sueldo: "", ingreso: "", estado: "activo", cuenta: "", banco: "", fr: "SI" });

  const handleOpenEmpModal = (emp = null) => {
    if (emp) {
      setEmpForm({
        id: emp.id,
        nombres: emp.nombres || "",
        cedula: emp.cedula || "",
        cargo: emp.cargo || "",
        sueldo: emp.sueldo || "",
        ingreso: emp.ingreso || "",
        estado: emp.estado || "activo",
        cuenta: emp.cuenta || "",
        banco: emp.banco || "",
        fr: emp.fr || "SI"
      });
    } else {
      setEmpForm({ id: "", nombres: "", cedula: "", cargo: "", sueldo: "", ingreso: "", estado: "activo", cuenta: "", banco: "", fr: "SI" });
    }
    setShowEmpModal(true);
  };

  const handleSaveEmp = async (e) => {
    e.preventDefault();
    if (!empForm.nombres || !empForm.cedula || !empForm.cargo || !empForm.sueldo || !empForm.ingreso) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }
    const id = empForm.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const data = {
      id,
      nombres: empForm.nombres.trim().toUpperCase(),
      cedula: empForm.cedula.trim(),
      cargo: empForm.cargo.trim(),
      sueldo: parseFloat(empForm.sueldo) || 0,
      ingreso: empForm.ingreso,
      estado: empForm.estado,
      cuenta: empForm.cuenta.trim(),
      banco: empForm.banco.trim(),
      fr: empForm.fr
    };
    try {
      await setDocument("empleados", id, data);
      setShowEmpModal(false);
      alert("Empleado guardado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar empleado: " + err.message);
    }
  };

  const handleDeleteEmp = async (id) => {
    if (!confirm("¿Estás seguro de eliminar este empleado?")) return;
    try {
      await deleteDocument("empleados", id);
      alert("Empleado eliminado.");
    } catch (err) {
      console.error(err);
    }
  };

  // --- 2. MODAL STATE FOR NOVEDADES ---
  const [showNovModal, setShowNovModal] = useState(false);
  const [novForm, setNovForm] = useState({ id: "", empId: "", tipo: "PERMISO", ini: "", fin: "", obs: "" });

  const handleOpenNovModal = (empId = "") => {
    setNovForm({ id: "", empId: empId, tipo: "PERMISO", ini: "", fin: "", obs: "" });
    setShowNovModal(true);
  };

  const handleSaveNov = async (e) => {
    e.preventDefault();
    if (!novForm.empId || !novForm.ini || !novForm.fin) {
      alert("Por favor completa los campos requeridos.");
      return;
    }
    const id = novForm.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const data = {
      id,
      empId: novForm.empId,
      tipo: novForm.tipo,
      ini: novForm.ini,
      fin: novForm.fin,
      obs: novForm.obs.trim()
    };
    try {
      await setDocument("novedades", id, data);
      setShowNovModal(false);
      alert("Novedad registrada.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNov = async (id) => {
    if (!confirm("¿Eliminar novedad?")) return;
    try {
      await deleteDocument("novedades", id);
      alert("Novedad eliminada.");
    } catch (err) {
      console.error(err);
    }
  };

  // --- 3. MODAL STATE FOR FERIADOS ---
  const [showFerModal, setShowFerModal] = useState(false);
  const [ferForm, setFerForm] = useState({ id: "", nombre: "", fecha: "", rec: "no" });

  const handleOpenFerModal = () => {
    setFerForm({ id: "", nombre: "", fecha: "", rec: "no" });
    setShowFerModal(true);
  };

  const handleSaveFer = async (e) => {
    e.preventDefault();
    if (!ferForm.nombre || !ferForm.fecha) {
      alert("Completa los campos.");
      return;
    }
    const id = ferForm.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const data = {
      id,
      nombre: ferForm.nombre.trim(),
      fecha: ferForm.fecha,
      rec: ferForm.rec
    };
    try {
      await setDocument("feriados", id, data);
      setShowFerModal(false);
      alert("Feriado guardado.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFer = async (id) => {
    if (!confirm("¿Eliminar feriado?")) return;
    try {
      await deleteDocument("feriados", id);
    } catch (err) {
      console.error(err);
    }
  };

  // --- 4. CALCULATIONS CORE ENGINE ---
  const isHoliday = (date, m, a) => {
    const mm = pad(m) + "-" + pad(date.getDate());
    const iso = a + "-" + pad(m) + "-" + pad(date.getDate());
    return feriados.some(f => (f.rec === "si" && f.fecha === mm) || (f.rec !== "si" && f.fecha === iso));
  };

  const holidayName = (date, m, a) => {
    const mm = pad(m) + "-" + pad(date.getDate());
    const iso = a + "-" + pad(m) + "-" + pad(date.getDate());
    const f = feriados.find(f => (f.rec === "si" && f.fecha === mm) || (f.rec !== "si" && f.fecha === iso));
    return f ? f.nombre : "";
  };

  const calcFR = (emp, m, a) => {
    if (emp.fr !== "SI") return 0;
    const ing = new Date(emp.ingreso + "T12:00:00");
    const cumple = new Date(ing);
    cumple.setFullYear(cumple.getFullYear() + 1);
    const inicio = new Date(a, m - 1, 1);
    const fin = new Date(a, m, 0);

    if (cumple > fin) return 0;
    const s = parseFloat(emp.sueldo) || 0;
    const trunc2 = (x) => Math.floor(x * 100) / 100;
    if (cumple > inicio) {
      const prop = trunc2(s * 0.0833 * ((fin.getDate() - cumple.getDate() + 1) / fin.getDate()));
      return prop;
    }
    return trunc2(s * 0.0833);
  };

  const calculateRol = (emp, m, a) => {
    const k = emp.id + "_" + m + "_" + a;
    const re = roles.find(r => r.key === k) || {};
    const s = parseFloat(emp.sueldo) || 0;
    const pxh = s / 240;

    const hs = parseFloat(re.hs || 0);
    const he = parseFloat(re.he || 0);
    const bo = parseFloat(re.bo || 0);
    const vs = hs * pxh * 1.5;
    const ve = he * pxh * 2;
    const totalFuera = vs + ve + bo;

    const ph = parseFloat(re.ph || 0);
    const pq = parseFloat(re.pq || 0);
    const es = parseFloat(re.es || 0);
    const ir = parseFloat(re.ir || 0);
    const ot = parseFloat(re.ot || 0);
    const dp = parseInt(re.dp || 0);

    const dtManual = re.dtReal !== undefined && re.dtReal !== null && re.dtReal !== "" ? parseInt(re.dtReal) : null;
    const ingD = new Date(emp.ingreso + "T12:00:00");
    const iniM = new Date(a, m - 1, 1);
    
    let sm = s;
    if (dtManual !== null) {
      sm = s * dtManual / 30;
    } else if (ingD > iniM) {
      sm = s * (new Date(a, m, 0).getDate() - ingD.getDate() + 1) / 30;
    }

    // Auto days calculation
    const dm = new Date(a, m, 0).getDate();
    let flt = 0;
    for (let d = 1; d <= dm; d++) {
      const dt = new Date(a, m - 1, d);
      if (dt.getDay() === 0 || dt.getDay() === 6) continue;
      if (isHoliday(dt, m, a)) continue;
      const iso = a + "-" + pad(m) + "-" + pad(d);
      if (novedades.some(n => n.empId === emp.id && n.ini <= iso && n.fin >= iso && n.tipo === "FALTA")) {
        flt++;
      }
    }
    const diasTrabAuto = Math.max(0, 30 - flt - dp);
    const diasTrab = dtManual !== null ? dtManual : diasTrabAuto;

    const fr = calcFR(emp, m, a);
    const baseIESS = sm;
    const iess = baseIESS * 0.0945;
    const totalI = sm + fr;
    const totalE = iess + ph + pq + es + ir + ot;
    const neto = totalI - totalE;

    return {
      s, sm, diasTrab, fr, hs, he, vs, ve, bo, totalFuera, baseIESS, iess, ph, pq, es, ir, ot, totalI, totalE, neto, dp, dtReal: dtManual, re, key: k
    };
  };

  // --- 5. MARCACIONES TAB STATE ---
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // --- 6. NOMINA CALCULATIONS TAB STATE ---
  const [nominaMonth, setNominaMonth] = useState(new Date().getMonth() + 1);
  const [nominaYear, setNominaYear] = useState(new Date().getFullYear());
  
  // Calculate specific employee sheet modal
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcForm, setCalcForm] = useState({ empId: "", mes: 1, anio: 2026, dtReal: "", hs: 0, he: 0, bo: 0, ph: 0, pq: 0, es: 0, ir: 0, ot: 0 });

  const handleOpenCalcModal = (empId, mes, anio) => {
    const emp = empleados.find(e => e.id === empId);
    if (!emp) return;
    const k = empId + "_" + mes + "_" + anio;
    const re = roles.find(r => r.key === k) || {};

    setCalcForm({
      empId,
      mes,
      anio,
      dtReal: re.dtReal !== undefined && re.dtReal !== null ? re.dtReal : "",
      hs: re.hs || 0,
      he: re.he || 0,
      bo: re.bo || 0,
      ph: re.ph || 0,
      pq: re.pq || 0,
      es: re.es || 0,
      ir: re.ir || 0,
      ot: re.ot || 0
    });
    setShowCalcModal(true);
  };

  const handleSaveCalc = async (e) => {
    e.preventDefault();
    const k = calcForm.empId + "_" + calcForm.mes + "_" + calcForm.anio;
    const data = {
      key: k,
      empId: calcForm.empId,
      mes: calcForm.mes,
      anio: calcForm.anio,
      dtReal: calcForm.dtReal !== "" ? parseInt(calcForm.dtReal) : null,
      hs: parseFloat(calcForm.hs) || 0,
      he: parseFloat(calcForm.he) || 0,
      bo: parseFloat(calcForm.bo) || 0,
      ph: parseFloat(calcForm.ph) || 0,
      pq: parseFloat(calcForm.pq) || 0,
      es: parseFloat(calcForm.es) || 0,
      ir: parseFloat(calcForm.ir) || 0,
      ot: parseFloat(calcForm.ot) || 0,
      dp: 0
    };
    try {
      await setDocument("roles", k, data);
      setShowCalcModal(false);
      alert("Nómina guardada con éxito.");
    } catch (err) {
      console.error(err);
    }
  };

  // Lock/Unlock Month
  const keyMes = (m, a) => a + "_" + pad(m);
  const esMesCerrado = (m, a) => mesesCerrados.includes(keyMes(m, a));

  const handleToggleCierreMes = async () => {
    const k = keyMes(nominaMonth, nominaYear);
    const cerrado = esMesCerrado(nominaMonth, nominaYear);
    if (cerrado) {
      if (!confirm(`¿Abrir el mes de ${MN[nominaMonth]} ${nominaYear}? Esto permitirá volver a calcular roles.`)) return;
      await deleteDocument("meses_cerrados", k);
      alert(`Mes ${MN[nominaMonth]} abierto.`);
    } else {
      if (!confirm(`¿Cerrar el mes de ${MN[nominaMonth]} ${nominaYear}? Una vez cerrado, se bloquearán las modificaciones de nómina.`)) return;
      await setDocument("meses_cerrados", k, { key: k, mes: nominaMonth, anio: nominaYear, cerradoEn: new Date().toISOString() });
      alert(`Mes ${MN[nominaMonth]} cerrado.`);
    }
  };

  // --- 7. PRINTING HELPERS ---
  const printPopup = (html) => {
    const w = window.open("", "_blank");
    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Meraki — Imprimir</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: white; padding: 20px; }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="position:fixed; top:0; left:0; right:0; background:#7C3AED; color:white; padding:12px; display:flex; gap:10px; align-items:center; z-index:9999;">
            <button onclick="window.print()" style="background:white; color:#7C3AED; border:none; padding:6px 14px; border-radius:6px; font-weight:bold; cursor:pointer;">🖨️ Imprimir / Guardar PDF</button>
            <button onclick="window.close()" style="background:transparent; color:white; border:1px solid white; padding:5px 12px; border-radius:6px; cursor:pointer;">Cerrar</button>
          </div>
          <div style="margin-top: 50px;">
            ${html}
          </div>
        </body>
      </html>
    `;
    w.document.write(docHtml);
    w.document.close();
  };

  const getRolHtml = (emp, mes, anio) => {
    const r = calculateRol(emp, mes, anio);
    const numRol = empleados.filter(e => e.estado === "activo").findIndex(e => e.id === emp.id) + 1;
    const v = x => x > 0 ? x.toFixed(2) : "-";

    const iRows = [
      ["Sueldo Proporcional", r.sm.toFixed(2)],
      ["Horas Suplementarias:", "-"],
      ["Horas Extraordinarias:", "-"],
      ["Horas Recargo Nocturno", "-"],
      ["Bonos", "-"],
      ["Décimo Tercera Remuneración Mensual", "-"],
      ["Décimo Cuarta Remuneración Mensual", "-"],
      ["Fondo de Reserva Mensual", r.fr > 0 ? r.fr.toFixed(2) : "-"],
    ];

    const eRows = [
      ["9.45% Aporte Personal IESS", r.iess.toFixed(2)],
      ["Quincena", "-"],
      ["Préstamos Hipotecarios", v(r.ph)],
      ["Préstamos Quirografarios", v(r.pq)],
      ["Extensión Salud Cónyuge", v(r.es)],
      ["Impuesto a la Renta", v(r.ir)],
      ["Otros Descuentos", v(r.ot)],
    ];

    const maxR = Math.max(iRows.length, eRows.length);
    let trs = "";
    for (let i = 0; i < maxR; i++) {
      const ir2 = iRows[i] || ["", ""];
      const er = eRows[i] || ["", ""];
      const iv = ir2[1], ev = er[1];
      trs += `
        <tr style="border-bottom:1px solid #e2e8f0; height: 32px;">
          <td style="padding:6px; font-size:11px; width:40%;">${ir2[0]}</td>
          <td style="padding:6px; font-size:11px; text-align:right; width:10%; font-weight:${iv !== "-" ? "600" : "400"}">${iv}</td>
          <td style="padding:6px; font-size:11px; width:40%;">${er[0]}</td>
          <td style="padding:6px; font-size:11px; text-align:right; width:10%; font-weight:${ev !== "-" ? "600" : "400"}">${ev}</td>
        </tr>
      `;
    }

    return `
      <div style="font-family: Arial, sans-serif; width: 680px; margin: 20px auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="width: 120px; vertical-align: middle;">
              <img src="/logo.png" style="width: 100px; height: auto;" alt="Meraki">
            </td>
            <td style="vertical-align: middle; padding-left: 20px;">
              <div style="font-size: 10px; font-weight: 700; color: #64748b;">COLABORADOR:</div>
              <div style="font-size: 15px; font-weight: 800; color: #7C3AED; margin-bottom: 4px;">${emp.nombres}</div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b;">IDENTIFICACIÓN:</div>
              <div style="font-size: 12px; font-weight: 700; color: #334155;">${emp.cedula}</div>
            </td>
          </tr>
        </table>
        <div style="background: #7C3AED; color: white; text-align: center; padding: 8px; font-size: 14px; font-weight: bold; letter-spacing: 1.5px; border-radius: 6px; margin: 16px 0;">ROL DE PAGOS MENSUAL</div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 16px; font-size: 11px; border-radius: 6px; overflow: hidden;">
          <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;"><td style="padding:6px; font-weight:700;">No.</td><td style="padding:6px;">${numRol}</td><td style="padding:6px; font-weight:700;">Fecha Ingreso:</td><td style="padding:6px; text-align:right;">${fmtDate(emp.ingreso)}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding:6px; font-weight:700;">Período:</td><td style="padding:6px; font-weight:600; color:#7C3AED;">${MN[mes]} ${anio}</td><td style="padding:6px; font-weight:700;">Días Trabajados:</td><td style="padding:6px; text-align:right;">${r.diasTrab}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;"><td style="padding:6px; font-weight:700;">Sueldo Base:</td><td style="padding:6px;">$${r.s.toFixed(2)}</td><td style="padding:6px; font-weight:700;">Fondo Reserva:</td><td style="padding:6px; text-align:right;">${emp.fr === "SI" ? "APLICA" : "NO APLICA"}</td></tr>
          <tr><td style="padding:6px; font-weight:700; vertical-align:top;">Cargo:</td><td style="padding:6px; vertical-align:top;" colspan="3">${emp.cargo}</td></tr>
        </table>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 16px;">
          <thead>
            <tr style="background: #7C3AED; color: white;">
              <th colspan="2" style="padding:8px; font-size:12px; text-align:center; border-right: 1px solid #6D28D9;">INGRESOS</th>
              <th colspan="2" style="padding:8px; font-size:12px; text-align:center;">EGRESOS</th>
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <tr style="font-weight: bold; background: #f8fafc;">
            <td style="padding:8px; font-size:11px; width:40%; border-right: 1px solid #e2e8f0;">Total Ingresos:</td>
            <td style="padding:8px; font-size:11px; text-align:right; width:10%; border-right: 2px solid #7C3AED; color: #059669;">$${r.totalI.toFixed(2)}</td>
            <td style="padding:8px; font-size:11px; width:40%; border-right: 1px solid #e2e8f0;">Total Egresos:</td>
            <td style="padding:8px; font-size:11px; text-align:right; width:10%; color: #dc2626;">$${r.totalE.toFixed(2)}</td>
          </tr>
          <tr style="background: #f1f5f9; font-weight: bold;">
            <td colspan="2" style="border-right: 2px solid #7C3AED; padding: 10px;"></td>
            <td style="padding:10px; font-size:13px;">Neto Recibido en Cuenta:</td>
            <td style="padding:10px; font-size:15px; text-align:right; color:#7C3AED;">$${r.neto.toFixed(2)}</td>
          </tr>
        </table>
        <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
          <tr>
            <td style="padding: 40px 10px 5px; width: 50%; text-align: center; font-size: 11px; font-weight: bold;">
              <div style="border-top: 1px solid #64748b; padding-top: 6px; display: inline-block; width: 80%;">ELABORADO POR</div>
            </td>
            <td style="padding: 40px 10px 5px; width: 50%; text-align: center; font-size: 11px; font-weight: bold;">
              <div style="border-top: 1px solid #64748b; padding-top: 6px; display: inline-block; width: 80%;">RECIBÍ CONFORME</div>
            </td>
          </tr>
        </table>
      </div>
    `;
  };

  const handlePrintSingleRol = (emp, mes, anio) => {
    printPopup(getRolHtml(emp, mes, anio));
  };

  const handlePrintAllRoles = (mes, anio) => {
    const act = empleados.filter(e => e.estado === "activo");
    if (!act.length) {
      alert("No hay empleados activos.");
      return;
    }
    const html = act.map(e => getRolHtml(e, mes, anio)).join('<div style="page-break-after:always;"></div>');
    printPopup(html);
  };

  const getResumenNominaHtml = (mes, anio) => {
    const act = empleados.filter(e => e.estado === "activo");
    let tN = 0, tF = 0;
    const rows = act.map((e, idx) => {
      const r = calculateRol(e, mes, anio);
      tN += r.neto;
      tF += r.totalFuera;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; height: 35px;">
          <td style="padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px;"><strong>${e.nombres}</strong></td>
          <td style="padding: 8px;">${e.cargo}</td>
          <td style="padding: 8px; text-align: right; font-weight: 600;">$${r.neto.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right;">${r.totalFuera > 0 ? '$' + r.totalFuera.toFixed(2) : '-'}</td>
          <td style="padding: 8px; text-align: right; font-weight: 600; color: #7C3AED;">$${(r.neto + r.totalFuera).toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    return `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; background: white;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="/logo.png" style="width: 110px; height: auto; margin-bottom: 8px;" alt="Meraki">
          <h2 style="color: #7C3AED; font-weight: 800;">RESUMEN DE NÓMINA GENERAL</h2>
          <p style="color: #64748b; font-size: 13px;">Mes: ${MN[mes]} ${anio} • Centro de Terapia Integral MERAKI</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #7C3AED; color: white;">
              <th style="padding: 10px; width: 5%;">#</th>
              <th style="padding: 10px; text-align: left; width: 35%;">Nombres</th>
              <th style="padding: 10px; text-align: left; width: 25%;">Cargo</th>
              <th style="padding: 10px; text-align: right; width: 12%;">Neto Rol</th>
              <th style="padding: 10px; text-align: right; width: 12%;">Fuera Rol</th>
              <th style="padding: 10px; text-align: right; width: 12%;">Total Pago</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #7C3AED; height: 38px;">
              <td colspan="3" style="padding: 10px; text-align: left;">TOTALES GENERALES</td>
              <td style="padding: 10px; text-align: right; color: #7C3AED;">$${tN.toFixed(2)}</td>
              <td style="padding: 10px; text-align: right; color: #b45309;">$${tF.toFixed(2)}</td>
              <td style="padding: 10px; text-align: right; color: #7C3AED; font-size: 13px;">$${(tN + tF).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top: 40px; text-align: right; font-size: 11px; color: #64748b;">
          Generado el ${new Date().toLocaleDateString("es-EC")}
        </div>
      </div>
    `;
  };

  const handlePrintResumen = () => {
    printPopup(getResumenNominaHtml(nominaMonth, nominaYear));
  };

  // --- 8. EXCEL EXPORT HELPERS (DYNAMIC SHEETJS INJECTION) ---
  const handleExportExcel = (tipo) => {
    if (typeof window.XLSX === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = () => handleExportExcel(tipo);
      document.head.appendChild(script);
      return;
    }

    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const act = empleados.filter(e => e.estado === "activo");
    const titleText = `MERAKI - NOMINA ${MN[nominaMonth].toUpperCase()} ${nominaYear}`;

    if (tipo === "c") {
      // Complete Excel
      const headers = ["#", "Nombres", "Cédula", "Cargo", "Sueldo Base", "Sueldo Mes", "F.Reserva", "T.Ingresos ROL", "IESS 9.45%", "P.Hipotecario", "P.Quirografario", "Ext.Salud", "Imp.Renta", "Otros Desc.", "T.Descuentos", "NETO ROL", "H.Sup (h)", "Val.H.Sup", "H.Ext (h)", "Val.H.Ext", "Bonos", "TOTAL FUERA ROL", "TOTAL GENERAL"];
      const dataRows = [
        [titleText],
        ["DATOS", "", "", "", "INGRESOS DENTRO DEL ROL", "", "", "", "EGRESOS Y DESCUENTOS ROL", "", "", "", "", "", "", "NETO ROL", "FUERA DEL ROL", "", "", "", "", "", "PAGO GENERAL"],
        headers
      ];

      act.forEach((e, idx) => {
        const r = calculateRol(e, nominaMonth, nominaYear);
        dataRows.push([
          idx + 1, e.nombres, e.cedula, e.cargo, r.s, parseFloat(r.sm.toFixed(2)), r.fr, parseFloat(r.totalI.toFixed(2)),
          parseFloat(r.iess.toFixed(2)), r.ph, r.pq, r.es, r.ir, r.ot, parseFloat(r.totalE.toFixed(2)),
          parseFloat(r.neto.toFixed(2)), r.hs, parseFloat(r.vs.toFixed(2)), r.he, parseFloat(r.ve.toFixed(2)), r.bo,
          parseFloat(r.totalFuera.toFixed(2)), parseFloat((r.neto + r.totalFuera).toFixed(2))
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);
      XLSX.utils.book_append_sheet(wb, ws, "NÓMINA COMPLETA");
    } else {
      // Legal Excel
      const headers = ["#", "Nombres", "Cédula", "Cargo", "Días Trab.", "Sueldo Base", "Sueldo Proporcional", "F.Reserva", "T.Ingresos", "IESS 9.45%", "P.Hipotecario", "P.Quirografario", "Ext.Salud", "Imp.Renta", "Otros", "T.Descuentos", "NETO A PAGAR", "Firma"];
      const dataRows = [
        [titleText],
        ["DATOS", "", "", "", "INGRESOS", "", "", "", "", "DESCUENTOS", "", "", "", "", "", "", "NETO", "FIRMA"],
        headers
      ];

      act.forEach((e, idx) => {
        const r = calculateRol(e, nominaMonth, nominaYear);
        dataRows.push([
          idx + 1, e.nombres, e.cedula, e.cargo, r.diasTrab, r.s, parseFloat(r.sm.toFixed(2)), r.fr, parseFloat(r.totalI.toFixed(2)),
          parseFloat(r.iess.toFixed(2)), r.ph, r.pq, r.es, r.ir, r.ot, parseFloat(r.totalE.toFixed(2)),
          parseFloat(r.neto.toFixed(2)), ""
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);
      XLSX.utils.book_append_sheet(wb, ws, "ROL LEGAL");
    }

    XLSX.writeFile(wb, `MERAKI_${MN[nominaMonth].toUpperCase()}_${nominaYear}_${tipo === "c" ? "COMPLETO" : "ROL_LEGAL"}.xlsx`);
  };

  // --- 9. ATTENDANCE & CALENDAR DATA CALCULATOR ---
  const getMarcacionesStats = (eId, mes, anio) => {
    if (!eId) return { tr: 0, ff: 0, nv: 0, dc: 0, list: [] };
    const dm = new Date(anio, mes, 0).getDate();
    const ds = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    let tr = 0, ff = 0, nv = 0, dc = 0;
    const list = [];

    for (let d = 1; d <= dm; d++) {
      const dt = new Date(anio, mes - 1, d);
      const dw = dt.getDay();
      const iso = anio + "-" + pad(mes) + "-" + pad(d);
      const label = ds[dw] + ", " + d + " de " + MN[mes] + " de " + anio;
      const weekend = dw === 0 || dw === 6;
      const feriado = !weekend && isHoliday(dt, mes, anio);
      const nameFer = feriado ? holidayName(dt, mes, anio) : "";
      const novedad = (!weekend && !feriado) ? novedades.find(n => n.empId === eId && n.ini <= iso && n.fin >= iso) : null;

      if (weekend) {
        dc++;
        list.push({ label, type: "descanso", detail: "DÍA DE DESCANSO" });
      } else if (feriado) {
        ff++;
        list.push({ label, type: "feriado", detail: `FERIADO — ${nameFer}` });
      } else if (novedad) {
        nv++;
        list.push({ label, type: "novedad", detail: `${novedad.tipo}${novedad.obs ? " — " + novedad.obs : ""}` });
      } else {
        tr++;
        list.push({ label, type: "trabajo", detail: "08:00 - 17:00 (Trabajo Regular)" });
      }
    }

    return { tr, ff, nv, dc, list };
  };

  const activeMarcStats = useMemo(() => {
    return getMarcacionesStats(selectedEmpId, filterMonth, filterYear);
  }, [selectedEmpId, filterMonth, filterYear, novedades, feriados]);

  // Total salaries in dashboard
  const activeSueldoSum = useMemo(() => {
    return empleados.filter(e => e.estado === "activo").reduce((acc, e) => acc + (parseFloat(e.sueldo) || 0), 0);
  }, [empleados]);

  // Overall totals for role sheet view
  const activeRolTotalSum = useMemo(() => {
    let tN = 0, tF = 0;
    empleados.filter(e => e.estado === "activo").forEach(e => {
      const r = calculateRol(e, nominaMonth, nominaYear);
      tN += r.neto;
      tF += r.totalFuera;
    });
    return { tN, tF, tTotal: tN + tF };
  }, [empleados, roles, nominaMonth, nominaYear, novedades, feriados]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      {/* Sub header for HR navigation */}
      <div className="glass" style={{ display: "flex", gap: "10px", padding: "10px 20px", borderBottom: "1px solid var(--border-light)", flexWrap: "wrap" }}>
        <button className="btn" style={{ backgroundColor: activeTab === "dashboard" ? "var(--purple-light)" : "transparent", color: activeTab === "dashboard" ? "var(--purple-dark)" : "var(--text-muted)" }} onClick={() => setActiveTab("dashboard")}>
          🏠 Dashboard
        </button>
        <button className="btn" style={{ backgroundColor: activeTab === "empleados" ? "var(--purple-light)" : "transparent", color: activeTab === "empleados" ? "var(--purple-dark)" : "var(--text-muted)" }} onClick={() => setActiveTab("empleados")}>
          👥 Empleados
        </button>
        <button className="btn" style={{ backgroundColor: activeTab === "marcaciones" ? "var(--purple-light)" : "transparent", color: activeTab === "marcaciones" ? "var(--purple-dark)" : "var(--text-muted)" }} onClick={() => setActiveTab("marcaciones")}>
          🗓️ Asistencia
        </button>
        <button className="btn" style={{ backgroundColor: activeTab === "nomina" ? "var(--purple-light)" : "transparent", color: activeTab === "nomina" ? "var(--purple-dark)" : "var(--text-muted)" }} onClick={() => setActiveTab("nomina")}>
          💰 Rol de Pagos
        </button>
        <button className="btn" style={{ backgroundColor: activeTab === "feriados" ? "var(--purple-light)" : "transparent", color: activeTab === "feriados" ? "var(--purple-dark)" : "var(--text-muted)" }} onClick={() => setActiveTab("feriados")}>
          📅 Feriados
        </button>
      </div>

      <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
        
        {/* --- 1. TAB: DASHBOARD --- */}
        {activeTab === "dashboard" && (
          <div className="fade-in">
            <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--purple-dark)", marginBottom: "4px" }}>Nómina y Asistencia</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>Resumen del personal de apoyo y administrativo de MERAKI.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <div className="glass" style={{ padding: "16px", borderRadius: "var(--radius-md)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Colaboradores Activos</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>{empleados.filter(e => e.estado === "activo").length}</div>
                <div style={{ color: "var(--purple-base)", fontSize: "0.75rem", marginTop: "2px" }}>De Meraki C.A.I.</div>
              </div>
              <div className="glass" style={{ padding: "16px", borderRadius: "var(--radius-md)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Planilla Mensual Base</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>${activeSueldoSum.toFixed(2)}</div>
                <div style={{ color: "var(--purple-base)", fontSize: "0.75rem", marginTop: "2px" }}>Suma de sueldos fijos</div>
              </div>
              <div className="glass" style={{ padding: "16px", borderRadius: "var(--radius-md)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Novedades Reportadas</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>{novedades.length}</div>
                <div style={{ color: "var(--purple-base)", fontSize: "0.75rem", marginTop: "2px" }}>Ausencias, permisos, etc.</div>
              </div>
              <div className="glass" style={{ padding: "16px", borderRadius: "var(--radius-md)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Feriados Nacionales</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>{feriados.length}</div>
                <div style={{ color: "var(--purple-base)", fontSize: "0.75rem", marginTop: "2px" }}>Configurados en sistema</div>
              </div>
            </div>

            <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)" }}>
              <h4 style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}><Users size={18} color="var(--purple-base)"/> Personal Administrativo Registrado</h4>
              <div className="responsive-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      <th style={{ padding: "8px" }}>COLABORADOR</th>
                      <th style={{ padding: "8px" }}>CARGO / PUESTO</th>
                      <th style={{ padding: "8px" }}>SUELDO BASE</th>
                      <th style={{ padding: "8px" }}>FECHA INGRESO</th>
                      <th style={{ padding: "8px" }}>ESTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empleados.map((emp) => (
                      <tr key={emp.id} style={{ borderBottom: "1px solid var(--border-soft)", fontSize: "0.85rem", height: "45px" }}>
                        <td style={{ padding: "8px" }}><strong>{emp.nombres}</strong><br/><span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>CI: {emp.cedula}</span></td>
                        <td style={{ padding: "8px", color: "var(--text-muted)" }}>{emp.cargo}</td>
                        <td style={{ padding: "8px", fontWeight: 500 }}>${parseFloat(emp.sueldo).toFixed(2)}</td>
                        <td style={{ padding: "8px", color: "var(--text-muted)" }}>{fmtDate(emp.ingreso)}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "10px", fontWeight: 600, backgroundColor: emp.estado === "activo" ? "var(--purple-light)" : "#FEE2E2", color: emp.estado === "activo" ? "var(--purple-dark)" : "#991B1B" }}>
                            {emp.estado?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {empleados.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No hay empleados registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- 2. TAB: EMPLEADOS --- */}
        {activeTab === "empleados" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--purple-dark)" }}>Directorio de Colaboradores</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Agregar o modificar datos salariales y cuentas bancarias.</p>
              </div>
              <button className="btn btn-primary" onClick={() => handleOpenEmpModal()}>
                <UserPlus size={16} /> Registrar Empleado
              </button>
            </div>

            <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)" }}>
              <div className="responsive-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      <th style={{ padding: "8px" }}>NOMBRE</th>
                      <th style={{ padding: "8px" }}>CÉDULA</th>
                      <th style={{ padding: "8px" }}>PUESTO</th>
                      <th style={{ padding: "8px" }}>SUELDO</th>
                      <th style={{ padding: "8px" }}>INGRESO</th>
                      <th style={{ padding: "8px" }}>FONDO RESERVA</th>
                      <th style={{ padding: "8px" }}>CUENTA BANCARIA</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empleados.map((emp) => (
                      <tr key={emp.id} style={{ borderBottom: "1px solid var(--border-soft)", fontSize: "0.85rem", height: "45px" }}>
                        <td style={{ padding: "8px" }}><strong>{emp.nombres}</strong></td>
                        <td style={{ padding: "8px" }}>{emp.cedula}</td>
                        <td style={{ padding: "8px", color: "var(--text-muted)" }}>{emp.cargo}</td>
                        <td style={{ padding: "8px", fontWeight: 500 }}>${parseFloat(emp.sueldo).toFixed(2)}</td>
                        <td style={{ padding: "8px", color: "var(--text-muted)" }}>{fmtDate(emp.ingreso)}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "10px", fontWeight: 600, backgroundColor: emp.fr === "SI" ? "var(--purple-light)" : "var(--border-soft)", color: emp.fr === "SI" ? "var(--purple-dark)" : "var(--text-muted)" }}>
                            {emp.fr === "SI" ? "Sí" : "No"}
                          </span>
                        </td>
                        <td style={{ padding: "8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {emp.cuenta ? `${emp.banco || "Banco"} - ${emp.cuenta}` : "—"}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--purple-dark)" }} onClick={() => handleOpenEmpModal(emp)} title="Editar"><Edit2 size={16}/></button>
                            <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--pink-dark)" }} onClick={() => handleDeleteEmp(emp.id)} title="Eliminar"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {empleados.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No hay colaboradores registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- 3. TAB: MARCACIONES (ASISTENCIA) --- */}
        {activeTab === "marcaciones" && (
          <div className="fade-in">
            <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--purple-dark)", marginBottom: "4px" }}>Marcaciones y Asistencia</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>Revisión del calendario mensual de asistencia laboral.</p>

            <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)", marginBottom: "20px" }}>
              <div className="responsive-flex" style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 2, minWidth: "200px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "6px" }}>Empleado</label>
                  <select className="input-field" value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}>
                    <option value="">Selecciona un colaborador...</option>
                    {empleados.filter(e => e.estado === "activo").map(e => (
                      <option key={e.id} value={e.id}>{e.nombres}</option>
                    ))}
                  </select>
                </div>
                <div style={{ width: "130px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "6px" }}>Mes</label>
                  <select className="input-field" value={filterMonth} onChange={(e) => setFilterMonth(parseInt(e.target.value))}>
                    {MN.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m}</option>)}
                  </select>
                </div>
                <div style={{ width: "110px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "6px" }}>Año</label>
                  <select className="input-field" value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))}>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
                {selectedEmpId && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn btn-secondary" onClick={() => handleOpenNovModal(selectedEmpId)}>
                      + Registrar Novedad
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                      const emp = empleados.find(e => e.id === selectedEmpId);
                      if (emp) {
                        const stats = getMarcacionesStats(selectedEmpId, filterMonth, filterYear);
                        const listHtml = stats.list.map(l => `
                          <tr style="height: 35px; border-bottom: 1px solid #cbd5e1; background: ${l.type === 'descanso' ? '#f8fafc' : l.type === 'feriado' ? '#fef3c7' : l.type === 'novedad' ? '#fee2e2' : 'white'}">
                            <td style="padding:6px; border:1px solid #cbd5e1;">${l.label}</td>
                            <td colspan="7" style="padding:6px; text-align:center; border:1px solid #cbd5e1; font-weight:500;">${l.detail}</td>
                          </tr>
                        `).join("");

                        const html = `
                          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 750px; margin: 0 auto; background: white;">
                            <div style="text-align: center; margin-bottom: 15px;">
                              <img src="/logo.png" style="width: 100px; height: auto;" alt="Meraki">
                              <h2 style="color:#7C3AED; font-weight:800; margin-top:10px;">HOJA DE ASISTENCIA Y CONTROL</h2>
                              <p style="color:#64748b; font-size:12px;">Colaborador: <strong>${emp.nombres}</strong> | Período: ${MN[filterMonth]} ${filterYear}</p>
                            </div>
                            <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-size:10px;">
                              <thead>
                                <tr style="background:#7C3AED; color:white;">
                                  <th style="padding:8px; border:1px solid #cbd5e1; width:220px; text-align:left;">Fecha</th>
                                  <th style="padding:8px; border:1px solid #cbd5e1;">H. Entrada</th>
                                  <th style="padding:8px; border:1px solid #cbd5e1;">Firma</th>
                                  <th style="padding:8px; border:1px solid #cbd5e1;">Almuerzo Salida</th>
                                  <th style="padding:8px; border:1px solid #cbd5e1;">Almuerzo Entrada</th>
                                  <th style="padding:8px; border:1px solid #cbd5e1;">Firma</th>
                                  <th style="padding:8px; border:1px solid #cbd5e1;">H. Salida</th>
                                  <th style="padding:8px; border:1px solid #cbd5e1;">Firma</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${listHtml}
                              </tbody>
                            </table>
                          </div>
                        `;
                        printPopup(html);
                      }
                    }}>
                      <Printer size={16} /> Imprimir Hoja
                    </button>
                  </div>
                )}
              </div>
            </div>

            {selectedEmpId ? (
              <div className="fade-in">
                <div style={{ display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap" }}>
                  <div className="glass" style={{ flex: 1, minWidth: "130px", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Días Trabajados</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--purple-dark)", marginTop: "4px" }}>{activeMarcStats.tr}</div>
                  </div>
                  <div className="glass" style={{ flex: 1, minWidth: "130px", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Feriados</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#b45309", marginTop: "4px" }}>{activeMarcStats.ff}</div>
                  </div>
                  <div className="glass" style={{ flex: 1, minWidth: "130px", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Novedades / Faltas</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#991B1B", marginTop: "4px" }}>{activeMarcStats.nv}</div>
                  </div>
                  <div className="glass" style={{ flex: 1, minWidth: "130px", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Fines de Semana</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-muted)", marginTop: "4px" }}>{activeMarcStats.dc}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }} className="responsive-grid">
                  {/* Calendar details */}
                  <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)" }}>
                    <h4 style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Detalle Diario</h4>
                    <div className="responsive-table-wrap" style={{ maxHeight: "400px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                            <th style={{ padding: "8px", textAlign: "left" }}>DÍA / FECHA</th>
                            <th style={{ padding: "8px", textAlign: "center" }}>ASISTENCIA / OBSERVACIÓN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeMarcStats.list.map((day, idx) => (
                            <tr key={idx} style={{ 
                              borderBottom: "1px solid var(--border-soft)", 
                              fontSize: "0.8rem", 
                              height: "38px",
                              backgroundColor: day.type === "descanso" ? "var(--bg-secondary)" : day.type === "feriado" ? "#FFFBEB" : day.type === "novedad" ? "#FEE2E2" : "transparent"
                            }}>
                              <td style={{ padding: "8px" }}><strong>{day.label}</strong></td>
                              <td style={{ padding: "8px", textAlign: "center", color: day.type === "novedad" ? "#991B1B" : day.type === "feriado" ? "#92400E" : "var(--text-main)", fontWeight: day.type !== "trabajo" ? "500" : "400" }}>
                                {day.detail}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Novelty side block */}
                  <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column" }}>
                    <h4 style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "12px" }}>Novedades en el Mes</h4>
                    <div style={{ flex: 1, overflowY: "auto", maxHeight: "350px" }}>
                      {novedades.filter(n => n.empId === selectedEmpId && (n.ini.includes(`${filterYear}-${pad(filterMonth)}`) || n.fin.includes(`${filterYear}-${pad(filterMonth)}`))).map(n => (
                        <div key={n.id} style={{ padding: "12px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", marginBottom: "10px", backgroundColor: "var(--bg-secondary)", position: "relative" }}>
                          <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold", backgroundColor: "#FEE2E2", color: "#991B1B", display: "inline-block", marginBottom: "6px" }}>
                            {n.type}
                          </span>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-main)" }}>
                            {fmtDate(n.ini)} → {fmtDate(n.fin)}
                          </div>
                          {n.obs && <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>{n.obs}</p>}
                          <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--pink-dark)", position: "absolute", top: "10px", right: "10px" }} onClick={() => handleDeleteNov(n.id)} title="Eliminar"><Trash2 size={14}/></button>
                        </div>
                      ))}
                      {novedades.filter(n => n.empId === selectedEmpId && (n.ini.includes(`${filterYear}-${pad(filterMonth)}`) || n.fin.includes(`${filterYear}-${pad(filterMonth)}`))).length === 0 && (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin incidencias o novedades registradas en este período.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", borderRadius: "var(--radius-md)" }}>
                <Info size={24} style={{ marginBottom: "8px", color: "var(--purple-base)" }} />
                <p>Por favor selecciona un colaborador para visualizar su planilla de asistencia.</p>
              </div>
            )}
          </div>
        )}

        {/* --- 4. TAB: ROL DE PAGOS --- */}
        {activeTab === "nomina" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--purple-dark)" }}>Cálculo y Roles de Pago</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Mes de Liquidación: <strong>{MN[nominaMonth]} {nominaYear}</strong></p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button className="btn btn-secondary" onClick={handlePrintResumen}>
                  🖨️ Imprimir Resumen
                </button>
                <button className="btn btn-secondary" onClick={() => handleExportExcel("c")}>
                  <FileSpreadsheet size={16} /> Excel Completo
                </button>
                <button className="btn btn-secondary" onClick={() => handleExportExcel("r")}>
                  <FileSpreadsheet size={16} /> Excel Rol Legal
                </button>
                <button className={`btn ${esMesCerrado(nominaMonth, nominaYear) ? 'btn-abrir' : 'btn-cerrar'}`} onClick={handleToggleCierreMes}>
                  {esMesCerrado(nominaMonth, nominaYear) ? <Unlock size={16}/> : <Lock size={16}/>}
                  {esMesCerrado(nominaMonth, nominaYear) ? "Abrir Mes" : "Cerrar Mes"}
                </button>
              </div>
            </div>

            {/* Banner info closed */}
            {esMesCerrado(nominaMonth, nominaYear) && (
              <div style={{ backgroundColor: "#FEE2E2", color: "#991B1B", padding: "12px 18px", borderRadius: "var(--radius-sm)", border: "1px solid var(--pink-pastel-soft)", marginBottom: "16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <Lock size={18} />
                <span><strong>MES CERRADO:</strong> La nómina de este período está bloqueada y no se pueden realizar modificaciones. Para realizar cambios, presiona el botón "Abrir Mes" superior.</span>
              </div>
            )}

            <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)", marginBottom: "20px" }}>
              <div className="responsive-flex" style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ width: "130px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "6px" }}>Seleccionar Mes</label>
                  <select className="input-field" value={nominaMonth} onChange={(e) => setNominaMonth(parseInt(e.target.value))}>
                    {MN.map((m, idx) => idx > 0 && <option key={idx} value={idx}>{m}</option>)}
                  </select>
                </div>
                <div style={{ width: "110px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "6px" }}>Seleccionar Año</label>
                  <select className="input-field" value={nominaYear} onChange={(e) => setNominaYear(parseInt(e.target.value))}>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summaries cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <div className="glass" style={{ padding: "16px", borderRadius: "var(--radius-md)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Cuenta Principal (Neto Rol)</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--purple-dark)", marginTop: "4px" }}>${activeRolTotalSum.tN.toFixed(2)}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>Nómina declarada</div>
              </div>
              <div className="glass" style={{ padding: "16px", borderRadius: "var(--radius-md)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Otra Cuenta (Fuera de Rol)</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#b45309", marginTop: "4px" }}>${activeRolTotalSum.tF.toFixed(2)}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>Bonificaciones y horas extras</div>
              </div>
              <div className="glass" style={{ padding: "16px", borderRadius: "var(--radius-md)", backgroundColor: "var(--purple-light)", borderLeft: "4px solid var(--purple-base)" }}>
                <div style={{ color: "var(--purple-dark)", fontSize: "0.8rem", fontWeight: 600 }}>Pago Total General</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--purple-dark)", marginTop: "4px" }}>${activeRolTotalSum.tTotal.toFixed(2)}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>Egreso acumulado de personal</div>
              </div>
            </div>

            {/* Grid list active employees */}
            <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h4 style={{ fontWeight: 600, color: "var(--text-main)" }}><Users size={18} color="var(--purple-base)"/> Planilla de Liquidación</h4>
                <button className="btn btn-primary bts" onClick={() => handlePrintAllRoles(nominaMonth, nominaYear)}>
                  🖨️ Imprimir Todos los Roles
                </button>
              </div>
              
              <div className="responsive-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      <th style={{ padding: "8px" }}>COLABORADOR</th>
                      <th style={{ padding: "8px" }}>ESTADO ROL</th>
                      <th style={{ padding: "8px" }}>SUELDO BASE</th>
                      <th style={{ padding: "8px" }}>NETO PRINCIPAL</th>
                      <th style={{ padding: "8px" }}>FUERA ROL</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empleados.filter(e => e.estado === "activo").map((emp) => {
                      const r = calculateRol(emp, nominaMonth, nominaYear);
                      const key = emp.id + "_" + nominaMonth + "_" + nominaYear;
                      const isSaved = roles.some(x => x.key === key);
                      return (
                        <tr key={emp.id} style={{ borderBottom: "1px solid var(--border-soft)", fontSize: "0.85rem", height: "48px" }}>
                          <td style={{ padding: "8px" }}><strong>{emp.nombres}</strong><br/><span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{emp.cargo}</span></td>
                          <td style={{ padding: "8px" }}>
                            <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold", backgroundColor: isSaved ? "var(--purple-light)" : "#FEF3C7", color: isSaved ? "var(--purple-dark)" : "#b45309" }}>
                              {isSaved ? "Calculado" : "Pendiente"}
                            </span>
                          </td>
                          <td style={{ padding: "8px" }}>${r.s.toFixed(2)}</td>
                          <td style={{ padding: "8px", fontWeight: 600, color: "var(--purple-dark)" }}>${r.neto.toFixed(2)}</td>
                          <td style={{ padding: "8px", fontWeight: 600, color: "#b45309" }}>{r.totalFuera > 0 ? `$${r.totalFuera.toFixed(2)}` : "—"}</td>
                          <td style={{ padding: "8px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "8px" }}>
                              {!esMesCerrado(nominaMonth, nominaYear) ? (
                                <button className="btn bts btn-secondary" onClick={() => handleOpenCalcModal(emp.id, nominaMonth, nominaYear)}>
                                  📝 Calcular
                                </button>
                              ) : (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "4px 8px" }}>🔒 Bloqueado</span>
                              )}
                              <button className="btn bts btn-primary" onClick={() => handlePrintSingleRol(emp, nominaMonth, nominaYear)}>
                                <Printer size={12} /> Imprimir Rol
                              </button>
                            </div>
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

        {/* --- 5. TAB: FERIADOS --- */}
        {activeTab === "feriados" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--purple-dark)" }}>Feriados y Descansos Especiales</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Registrar feriados locales o nacionales para el cálculo automático de marcaciones.</p>
              </div>
              <button className="btn btn-primary" onClick={handleOpenFerModal}>
                + Agregar Feriado
              </button>
            </div>

            <div className="glass" style={{ padding: "20px", borderRadius: "var(--radius-md)" }}>
              <div className="responsive-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      <th style={{ padding: "8px" }}>NOMBRE DEL FERIADO</th>
                      <th style={{ padding: "8px" }}>FECHA</th>
                      <th style={{ padding: "8px" }}>TIPO RECURRENCIA</th>
                      <th style={{ padding: "8px", textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {feriados.map((fer) => (
                      <tr key={fer.id} style={{ borderBottom: "1px solid var(--border-soft)", fontSize: "0.85rem", height: "45px" }}>
                        <td style={{ padding: "8px" }}><strong>{fer.nombre}</strong></td>
                        <td style={{ padding: "8px" }}>{fer.fecha}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold", backgroundColor: fer.rec === "si" ? "var(--purple-light)" : "var(--border-soft)", color: fer.rec === "si" ? "var(--purple-dark)" : "var(--text-muted)" }}>
                            {fer.rec === "si" ? "Anual (Recurrente)" : "Fecha Única"}
                          </span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--pink-dark)" }} onClick={() => handleDeleteFer(fer.id)} title="Eliminar"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                    {feriados.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No hay feriados configurados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --- PORTALS MODALS --- */}
      
      {/* 1. Modal: Empleado Add/Edit */}
      {showEmpModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div className="glass fade-in" style={{ backgroundColor: "white", padding: "24px", borderRadius: "var(--radius-lg)", width: "90%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}>
            <h4 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--purple-dark)", marginBottom: "16px" }}>
              {empForm.id ? "Editar Colaborador" : "Registrar Nuevo Colaborador"}
            </h4>
            <form onSubmit={handleSaveEmp}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Nombres Completos*</label>
                  <input type="text" required placeholder="APELLIDOS NOMBRES" className="input-field" value={empForm.nombres} onChange={(e) => setEmpForm({...empForm, nombres: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Cédula de Identidad*</label>
                  <input type="text" required maxLength={10} placeholder="Ej. 0102030405" className="input-field" value={empForm.cedula} onChange={(e) => setEmpForm({...empForm, cedula: e.target.value})} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Cargo / Puesto*</label>
                  <input type="text" required placeholder="Ej. Auxiliar General" className="input-field" value={empForm.cargo} onChange={(e) => setEmpForm({...empForm, cargo: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Sueldo Mensual Base ($)*</label>
                  <input type="number" step="0.01" min="0" required placeholder="Ej. 460" className="input-field" value={empForm.sueldo} onChange={(e) => setEmpForm({...empForm, sueldo: e.target.value})} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Fecha de Ingreso*</label>
                  <input type="date" required className="input-field" value={empForm.ingreso} onChange={(e) => setEmpForm({...empForm, ingreso: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Estado Laboral</label>
                  <select className="input-field" value={empForm.estado} onChange={(e) => setEmpForm({...empForm, estado: e.target.value})}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Nro. Cuenta Bancaria</label>
                  <input type="text" placeholder="Ej. 10203040" className="input-field" value={empForm.cuenta} onChange={(e) => setEmpForm({...empForm, cuenta: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Banco</label>
                  <input type="text" placeholder="Ej. Banco Pichincha" className="input-field" value={empForm.banco} onChange={(e) => setEmpForm({...empForm, banco: e.target.value})} />
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Fondo de Reserva</label>
                <select className="input-field" value={empForm.fr} onChange={(e) => setEmpForm({...empForm, fr: e.target.value})}>
                  <option value="SI">Aplica (Al cumplir 1 año)</option>
                  <option value="NO">No aplica</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEmpModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">💾 Guardar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Modal: Novedad Add */}
      {showNovModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div className="glass fade-in" style={{ backgroundColor: "white", padding: "24px", borderRadius: "var(--radius-lg)", width: "90%", maxWidth: "450px" }}>
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--purple-dark)", marginBottom: "16px" }}>Registrar Novedad Asistencia</h4>
            <form onSubmit={handleSaveNov}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Colaborador</label>
                  <select className="input-field" value={novForm.empId} onChange={(e) => setNovForm({...novForm, empId: e.target.value})}>
                    <option value="">Selecciona...</option>
                    {empleados.map(e => (
                      <option key={e.id} value={e.id}>{e.nombres}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Tipo Novedad</label>
                  <select className="input-field" value={novForm.tipo} onChange={(e) => setNovForm({...novForm, tipo: e.target.value})}>
                    <option value="PERMISO">Permiso</option>
                    <option value="FALTA">Falta injustificada</option>
                    <option value="ENFERMEDAD">Enfermedad</option>
                    <option value="VACACIONES">Vacaciones</option>
                    <option value="COMISION">Comisión</option>
                    <option value="CALAMIDAD">Calamidad doméstica</option>
                    <option value="MATERNIDAD">Maternidad</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Fecha Inicio</label>
                  <input type="date" required className="input-field" value={novForm.ini} onChange={(e) => setNovForm({...novForm, ini: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Fecha Fin</label>
                  <input type="date" required className="input-field" value={novForm.fin} onChange={(e) => setNovForm({...novForm, fin: e.target.value})} />
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Observación / Comentario</label>
                <input type="text" placeholder="Ej. Certificado médico adjunto" className="input-field" value={novForm.obs} onChange={(e) => setNovForm({...novForm, obs: e.target.value})} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNovModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">💾 Guardar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Modal: Feriado Add */}
      {showFerModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div className="glass fade-in" style={{ backgroundColor: "white", padding: "24px", borderRadius: "var(--radius-lg)", width: "90%", maxWidth: "420px" }}>
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--purple-dark)", marginBottom: "16px" }}>Agregar Feriado</h4>
            <form onSubmit={handleSaveFer}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Nombre del Feriado</label>
                <input type="text" required placeholder="Ej. Año Nuevo, Independencia" className="input-field" value={ferForm.nombre} onChange={(e) => setFerForm({...ferForm, nombre: e.target.value})} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Fecha</label>
                  <input type="date" required className="input-field" value={ferForm.fecha} onChange={(e) => setFerForm({...ferForm, fecha: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Recurrencia Anual</label>
                  <select className="input-field" value={ferForm.rec} onChange={(e) => setFerForm({...ferForm, rec: e.target.value})}>
                    <option value="no">Fecha Única</option>
                    <option value="si">Sí (Se repite cada año)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFerModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">💾 Guardar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 4. Modal: Payroll Calculator (Employee sheet edit) */}
      {showCalcModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div className="glass fade-in" style={{ backgroundColor: "white", padding: "24px", borderRadius: "var(--radius-lg)", width: "90%", maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}>
            <h4 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--purple-dark)", marginBottom: "16px" }}>
              Calcular Nómina - {empleados.find(e => e.id === calcForm.empId)?.nombres} ({MN[calcForm.mes]} {calcForm.anio})
            </h4>
            <form onSubmit={handleSaveCalc}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }} className="responsive-grid">
                
                {/* Column left - Within Roll */}
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: "bold", padding: "4px 8px", backgroundColor: "var(--purple-pastel-soft)", color: "var(--purple-dark)", borderRadius: "4px", marginBottom: "12px", textTransform: "uppercase" }}>
                    Dentro del Rol (Cuenta Principal)
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Días Trabajados (Vacio = cálculo auto)</label>
                    <input type="number" min="0" max="30" placeholder="Automático" className="input-field" value={calcForm.dtReal} onChange={(e) => setCalcForm({...calcForm, dtReal: e.target.value})} />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Préstamo Hipotecario ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={calcForm.ph} onChange={(e) => setCalcForm({...calcForm, ph: e.target.value})} />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Préstamo Quirografario ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={calcForm.pq} onChange={(e) => setCalcForm({...calcForm, pq: e.target.value})} />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Extensión Salud Cónyuge ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={calcForm.es} onChange={(e) => setCalcForm({...calcForm, es: e.target.value})} />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Impuesto a la Renta ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={calcForm.ir} onChange={(e) => setCalcForm({...calcForm, ir: e.target.value})} />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Otros Descuentos ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={calcForm.ot} onChange={(e) => setCalcForm({...calcForm, ot: e.target.value})} />
                  </div>
                </div>

                {/* Column right - Outside Roll */}
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: "bold", padding: "4px 8px", backgroundColor: "#FEF3C7", color: "#b45309", borderRadius: "4px", marginBottom: "12px", textTransform: "uppercase" }}>
                    Fuera del Rol (Otra Cuenta)
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Horas Suplementarias (1.5x - cant.)</label>
                    <input type="number" min="0" className="input-field" value={calcForm.hs} onChange={(e) => setCalcForm({...calcForm, hs: e.target.value})} />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Horas Extraordinarias (2.0x - cant.)</label>
                    <input type="number" min="0" className="input-field" value={calcForm.he} onChange={(e) => setCalcForm({...calcForm, he: e.target.value})} />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>Bonos Adicionales ($)</label>
                    <input type="number" step="0.01" min="0" className="input-field" value={calcForm.bo} onChange={(e) => setCalcForm({...calcForm, bo: e.target.value})} />
                  </div>

                  {/* Projections values */}
                  <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-light)", padding: "14px", borderRadius: "var(--radius-sm)", marginTop: "20px" }}>
                    <p style={{ fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px" }}>Previsualización en Tiempo Real</p>
                    {(() => {
                      const emp = empleados.find(e => e.id === calcForm.empId);
                      if (!emp) return null;
                      const dummyForm = { ...emp, id: emp.id };
                      // Inject dummy roles data to simulate recalculations
                      const s = parseFloat(emp.sueldo) || 0;
                      const pxh = s / 240;
                      const hs = parseFloat(calcForm.hs) || 0;
                      const he = parseFloat(calcForm.he) || 0;
                      const bo = parseFloat(calcForm.bo) || 0;
                      const vs = hs * pxh * 1.5;
                      const ve = he * pxh * 2;
                      const tf = vs + ve + bo;

                      const ph = parseFloat(calcForm.ph) || 0;
                      const pq = parseFloat(calcForm.pq) || 0;
                      const es = parseFloat(calcForm.es) || 0;
                      const ir = parseFloat(calcForm.ir) || 0;
                      const ot = parseFloat(calcForm.ot) || 0;

                      const dtManual = calcForm.dtReal !== "" ? parseInt(calcForm.dtReal) : null;
                      let sm = s;
                      if (dtManual !== null) {
                        sm = s * dtManual / 30;
                      } else {
                        const ingD = new Date(emp.ingreso + "T12:00:00");
                        const iniM = new Date(calcForm.anio, calcForm.mes - 1, 1);
                        if (ingD > iniM) sm = s * (new Date(calcForm.anio, calcForm.mes, 0).getDate() - ingD.getDate() + 1) / 30;
                      }
                      
                      const fr = calcFR(emp, calcForm.mes, calcForm.anio);
                      const baseIESS = sm;
                      const iess = baseIESS * 0.0945;
                      const totalI = sm + fr;
                      const totalE = iess + ph + pq + es + ir + ot;
                      const neto = totalI - totalE;

                      return (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-main)", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Sueldo Proporcional:</span><strong>${sm.toFixed(2)}</strong></div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fondo de Reserva:</span><strong>${fr.toFixed(2)}</strong></div>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#991B1B" }}><span>(-) IESS 9.45%:</span><strong>-${iess.toFixed(2)}</strong></div>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#991B1B" }}><span>(-) Total Descuentos:</span><strong>-${totalE.toFixed(2)}</strong></div>
                          <div style={{ borderTop: "1px solid var(--border-light)", margin: "4px 0" }}></div>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--purple-dark)", fontWeight: "bold" }}><span>💜 Neto Principal:</span><strong>${neto.toFixed(2)}</strong></div>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309", fontWeight: "bold" }}><span>🟡 Fuera del Rol:</span><strong>${tf.toFixed(2)}</strong></div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px", paddingTop: "12px", borderTop: "1px solid var(--border-light)" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCalcModal(false)}>Cerrar</button>
                <button type="submit" className="btn btn-primary">💾 Guardar Nómina</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
