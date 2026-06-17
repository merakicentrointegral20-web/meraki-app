import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { subscribeToCollection, addDocument, updateDocument, getCollection, deleteDocument, registrarLog } from "../db";
import { useAuth } from "../context/AuthContext";
import { DollarSign, CheckCircle2, AlertTriangle, Search, FileText, Check, Copy, Upload, ArrowUpRight, Trash2, Plus, Wallet, ChevronLeft, ChevronRight, Calendar as CalendarIcon, MessageCircle, Send } from "lucide-react";

const getLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
};

const parseLocalDateStr = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const cleanAndFormatIdentificacion = (val) => {
  if (!val) return "";
  let clean = String(val).trim().split('.')[0];
  if (/^\d+$/.test(clean)) {
    if (clean.length === 9) {
      return "0" + clean;
    }
    if (clean.length === 12) {
      return "0" + clean;
    }
  }
  return clean;
};

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
  const [viewMode, setViewMode] = useState("dia"); // 'dia' | 'semana'
  const dateInputRefCaja = useRef(null);

  const sendWhatsApp = (telefono, mensaje) => {
    if (!telefono) {
      alert("⚠️ No se encontró número de teléfono registrado.");
      return;
    }
    const formattedPhone = telefono.replace(/[^0-9]/g, "").replace(/^0/, '593');
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  };

  const getWeekRangeForDate = (dateStr) => {
    if (!dateStr) return { start: "", end: "" };
    const date = parseLocalDateStr(dateStr);
    const weekday = date.getDay();
    
    // Find Monday (adjust when Sunday)
    const diffToMonday = date.getDate() - weekday + (weekday === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diffToMonday));
    const mondayStr = getLocalDateStr(monday);
    
    // Find Sunday (Monday + 6 days)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = getLocalDateStr(sunday);
    
    return { start: mondayStr, end: sundayStr };
  };

  const getWeekRangeLabelCaja = (dateStr) => {
    if (!dateStr) return "";
    const { start, end } = getWeekRangeForDate(dateStr);
    const formatDayMonth = (str) => {
      const [y, m, d] = str.split("-");
      const shortYear = y.substring(2);
      return `${d}/${m}/${shortYear}`;
    };
    return `Del ${formatDayMonth(start)} al ${formatDayMonth(end)}`;
  };

  const handlePrevDay = () => {
    if (!targetDate) return;
    const date = parseLocalDateStr(targetDate);
    date.setDate(date.getDate() - 1);
    setTargetDate(getLocalDateStr(date));
  };

  const handleNextDay = () => {
    if (!targetDate) return;
    const date = parseLocalDateStr(targetDate);
    date.setDate(date.getDate() + 1);
    setTargetDate(getLocalDateStr(date));
  };

  const handlePrevWeekCaja = () => {
    if (!targetDate) return;
    const date = parseLocalDateStr(targetDate);
    date.setDate(date.getDate() - 7);
    setTargetDate(getLocalDateStr(date));
  };

  const handleNextWeekCaja = () => {
    if (!targetDate) return;
    const date = parseLocalDateStr(targetDate);
    date.setDate(date.getDate() + 7);
    setTargetDate(getLocalDateStr(date));
  };

  const getFmtRowDate = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const weekdaysShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const dayName = weekdaysShort[dateObj.getDay()];
    return `${dayName} ${d}/${m}`;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGastoCategory, setSelectedGastoCategory] = useState("todas");
  
  // Dynamic lists
  const [bancosList, setBancosList] = useState([]);
  const [tarjetasList, setTarjetasList] = useState([]);

  // Anticipo/credit state
  const [showAnticipoModal, setShowAnticipoModal] = useState(false);
  const [anticipoForm, setAnticipoForm] = useState({
    pacienteId: "",
    monto: "",
    tipo: "efectivo",
    banco: "",
    comprobante: "",
    observaciones: ""
  });

  // Expenses filter and form state
  const [gastosMonth, setGastosMonth] = useState("");
  const [gForm, setGForm] = useState({
    fecha: getLocalDateStr(new Date()),
    monto: "",
    categoria: "Caja Chica",
    descripcion: "",
    metodoPago: "Efectivo",
    banco: "",
    tarjeta: ""
  });
  
  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    monto: 20, tipo: "efectivo", banco: "", comprobante: "",
    verificado: false, facturado: false, observaciones: ""
  });

  // Abono modal for Cuentas por Cobrar
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [selectedDeuda, setSelectedDeuda] = useState(null);
  const [abonoForm, setAbonoForm] = useState({
    monto: "", tipo: "efectivo", banco: "", comprobante: "",
    verificado: false, facturado: false, observaciones: ""
  });

  useEffect(() => {
    const today = new Date();
    setTargetDate(getLocalDateStr(today));
    
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    setGastosMonth(`${y}-${m}`);
  }, []);

  useEffect(() => {
    const unsubCitas = subscribeToCollection("citas", setCitas);
    const unsubPacientes = subscribeToCollection("pacientes", setPacientes);
    const unsubTransacciones = subscribeToCollection("transacciones", setTransacciones);
    const unsubGastos = subscribeToCollection("gastos", setGastos);

    const unsubBancos = subscribeToCollection("bancos", async (data) => {
      if (data.length === 0) {
        const defaultBanks = ["Pichincha", "Guayaquil", "Pacífico", "Jardín Azuayo", "Bolivariano", "JEP"];
        for (let b of defaultBanks) {
          await addDocument("bancos", { nombre: b });
        }
      } else {
        setBancosList(data.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })));
      }
    });

    const unsubTarjetas = subscribeToCollection("tarjetas", async (data) => {
      if (data.length === 0) {
        const defaultCards = ["Visa Pichincha", "Mastercard Guayaquil", "Diners Club", "Visa Produbanco"];
        for (let t of defaultCards) {
          await addDocument("tarjetas", { nombre: t });
        }
      } else {
        setTarjetasList(data.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })));
      }
    });

    return () => {
      unsubCitas();
      unsubPacientes();
      unsubTransacciones();
      unsubGastos();
      unsubBancos();
      unsubTarjetas();
    };
  }, []);

  const getCobrosHoy = () => {
    if (viewMode === "dia") {
      return citas.filter(c => c.fecha === targetDate && c.cobrada === true);
    } else {
      const { start, end } = getWeekRangeForDate(targetDate);
      return citas.filter(c => c.fecha >= start && c.fecha <= end && c.cobrada === true);
    }
  };

  const getDeudasRep = () => {
    const deudas = {};
    
    citas.forEach(c => {
      if (c.cobrada && c.estadoAsistencia !== "pendiente" && c.estadoAsistencia !== "falto_justificado") {
        const patient = pacientes.find(p => p.id === c.pacienteId);
        if (!patient) return;
        
        const repName = patient.representante || "Representante";
        const repId = cleanAndFormatIdentificacion(patient.cedulaRepresentante || patient.id);

        if (!deudas[repId]) {
          deudas[repId] = {
            repId,
            representante: repName,
            pacienteNombre: patient.nombre,
            telefono: patient.telefono,
            totalCargos: 0,
            totalAbonado: 0
          };
        }
        deudas[repId].totalCargos += Number(c.costo);
      }
    });

    transacciones.forEach(t => {
      if (t.tipo === "descuento_anticipo") return;
      const repId = cleanAndFormatIdentificacion(t.representanteId);
      if (!deudas[repId]) {
        const patient = pacientes.find(p => cleanAndFormatIdentificacion(p.cedulaRepresentante || p.id) === repId);
        deudas[repId] = {
          repId,
          representante: patient?.representante || t.pacienteNombre || "Representante",
          pacienteNombre: patient?.nombre || t.pacienteNombre || "Paciente",
          telefono: patient?.telefono || "",
          totalCargos: 0,
          totalAbonado: 0
        };
      }
      deudas[repId].totalAbonado += Number(t.monto);
    });

    return Object.values(deudas)
      .map(d => ({
        ...d,
        saldoDebe: d.totalCargos - d.totalAbonado
      }))
      .filter(d => d.saldoDebe > 0);
  };

  const getAnticiposRep = () => {
    const deudas = {};
    
    citas.forEach(c => {
      if (c.cobrada && c.estadoAsistencia !== "pendiente" && c.estadoAsistencia !== "falto_justificado") {
        const patient = pacientes.find(p => p.id === c.pacienteId);
        if (!patient) return;
        
        const repName = patient.representante || "Representante";
        const repId = cleanAndFormatIdentificacion(patient.cedulaRepresentante || patient.id);

        if (!deudas[repId]) {
          deudas[repId] = {
            repId,
            representante: repName,
            pacienteNombre: patient.nombre,
            telefono: patient.telefono,
            totalCargos: 0,
            totalAbonado: 0
          };
        }
        deudas[repId].totalCargos += Number(c.costo);
      }
    });

    transacciones.forEach(t => {
      if (t.tipo === "descuento_anticipo") return;
      const repId = cleanAndFormatIdentificacion(t.representanteId);
      if (!deudas[repId]) {
        const patient = pacientes.find(p => cleanAndFormatIdentificacion(p.cedulaRepresentante || p.id) === repId);
        deudas[repId] = {
          repId,
          representante: patient?.representante || t.pacienteNombre || "Representante",
          pacienteNombre: patient?.nombre || t.pacienteNombre || "Paciente",
          telefono: patient?.telefono || "",
          totalCargos: 0,
          totalAbonado: 0
        };
      }
      deudas[repId].totalAbonado += Number(t.monto);
    });

    return Object.values(deudas)
      .map(d => ({
        ...d,
        saldoFavor: d.totalAbonado - d.totalCargos
      }))
      .filter(d => d.saldoFavor > 0);
  };

  const handleOpenPayModal = (cita, pendingVal) => {
    const patient = pacientes.find(p => p.id === cita.pacienteId);
    setSelectedCita(cita);
    setPaymentForm({
      monto: pendingVal !== undefined ? pendingVal : Number(cita.costo),
      tipo: "efectivo",
      banco: "",
      comprobante: "",
      verificado: false,
      facturado: false,
      observaciones: ""
    });
    setShowPayModal(true);
  };

  const handleRegisterPayment = async (e) => {
    e.preventDefault();
    if (!selectedCita) return;

    const patient = pacientes.find(p => p.id === selectedCita.pacienteId);
    const repId = cleanAndFormatIdentificacion(patient?.cedulaRepresentante || patient?.id || "Desconocido");

    if (paymentForm.tipo === "descuento_anticipo") {
      const repAnticipos = getAnticiposRep();
      const myAnticipo = repAnticipos.find(a => a.repId === repId);
      const availableCredit = myAnticipo ? myAnticipo.saldoFavor : 0;
      if (availableCredit < Number(paymentForm.monto)) {
        alert(`Crédito insuficiente. Saldo a favor disponible: $${availableCredit}`);
        return;
      }
    }

    try {
      const transData = {
        representanteId: repId,
        pacienteId: selectedCita.pacienteId,
        pacienteNombre: selectedCita.pacienteNombre,
        citaId: selectedCita.id,
        monto: Number(paymentForm.monto),
        tipo: paymentForm.tipo,
        banco: (paymentForm.tipo !== "efectivo" && paymentForm.tipo !== "descuento_anticipo") ? paymentForm.banco : "",
        comprobante: (paymentForm.tipo !== "efectivo" && paymentForm.tipo !== "descuento_anticipo") ? paymentForm.comprobante : "",
        fechaRegistro: new Date().toISOString(),
        verificado: true,
        facturado: paymentForm.facturado,
        observaciones: paymentForm.observaciones || ""
      };
      
      await addDocument("transacciones", transData);
      await registrarLog(
        currentUser,
        "Caja (Cobro Cita)",
        `Cobró la sesión de ${selectedCita.pacienteNombre} por $${transData.monto} (Método: ${transData.tipo})`
      );

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
      facturado: false,
      observaciones: ""
    });
    setShowAbonoModal(true);
  };

  const handleRegisterAbono = async (e) => {
    e.preventDefault();
    if (!selectedDeuda) return;

    try {
      const transData = {
        representanteId: cleanAndFormatIdentificacion(selectedDeuda.repId),
        pacienteNombre: selectedDeuda.pacienteNombre,
        monto: Number(abonoForm.monto),
        tipo: abonoForm.tipo,
        banco: abonoForm.tipo !== "efectivo" ? abonoForm.banco : "",
        comprobante: abonoForm.tipo !== "efectivo" ? abonoForm.comprobante : "",
        fechaRegistro: new Date().toISOString(),
        verificado: true,
        facturado: abonoForm.facturado,
        observaciones: abonoForm.observaciones || ""
      };

      await addDocument("transacciones", transData);
      await registrarLog(
        currentUser,
        "Caja (Abono)",
        `Registró abono para el paciente ${transData.pacienteNombre} por $${transData.monto} (Método: ${transData.tipo})`
      );
      setShowAbonoModal(false);
      alert("Abono / Pago registrado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al registrar el abono/pago.");
    }
  };

  const handleRegisterAnticipo = async (e) => {
    e.preventDefault();
    if (!anticipoForm.pacienteId || !anticipoForm.monto) {
      alert("Seleccione paciente y monto.");
      return;
    }
    const patient = pacientes.find(p => p.id === anticipoForm.pacienteId);
    const repId = cleanAndFormatIdentificacion(patient?.cedulaRepresentante || patient?.id || "Desconocido");

    try {
      const transData = {
        representanteId: repId,
        pacienteId: patient.id,
        pacienteNombre: patient.nombre,
        monto: Number(anticipoForm.monto),
        tipo: anticipoForm.tipo,
        banco: anticipoForm.tipo !== "efectivo" ? anticipoForm.banco : "",
        comprobante: anticipoForm.tipo !== "efectivo" ? anticipoForm.comprobante : "",
        fechaRegistro: new Date().toISOString(),
        verificado: true,
        facturado: false,
        observaciones: anticipoForm.observaciones || ""
      };

      await addDocument("transacciones", transData);
      await registrarLog(
        currentUser,
        "Caja (Anticipo)",
        `Registró anticipo de $${transData.monto} para el paciente ${transData.pacienteNombre} (Método: ${transData.tipo})`
      );

      setShowAnticipoModal(false);
      setAnticipoForm({
        pacienteId: "",
        monto: "",
        tipo: "efectivo",
        banco: "",
        comprobante: "",
        observaciones: ""
      });
      alert("Anticipo registrado con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al registrar anticipo.");
    }
  };

  const handleAddNuevoBanco = async (onSuccess) => {
    const name = prompt("Ingrese el nombre del nuevo banco:");
    if (name && name.trim()) {
      const cleanName = name.trim();
      const duplicate = bancosList.some(b => b.nombre.toLowerCase() === cleanName.toLowerCase());
      if (duplicate) {
        alert("Ese banco ya existe.");
        return;
      }
      try {
        await addDocument("bancos", { nombre: cleanName });
        await registrarLog(currentUser, "Caja (Nuevo Banco)", `Agregó el banco ${cleanName}`);
        if (onSuccess) {
          onSuccess(cleanName.toLowerCase());
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddNuevaTarjeta = async (onSuccess) => {
    const name = prompt("Ingrese el nombre de la nueva tarjeta:");
    if (name && name.trim()) {
      const cleanName = name.trim();
      const duplicate = tarjetasList.some(t => t.nombre.toLowerCase() === cleanName.toLowerCase());
      if (duplicate) {
        alert("Esa tarjeta ya existe.");
        return;
      }
      try {
        await addDocument("tarjetas", { nombre: cleanName });
        await registrarLog(currentUser, "Caja (Nueva Tarjeta)", `Agregó la tarjeta ${cleanName}`);
        if (onSuccess) {
          onSuccess(cleanName.toLowerCase());
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleClearDebt = async (deuda) => {
    if (confirm(`¿Estás seguro de eliminar la deuda pendiente de $${deuda.saldoDebe} de ${deuda.representante}? Esto registrará un ajuste contable para saldar la cuenta.`)) {
      try {
        await addDocument("transacciones", {
          representanteId: cleanAndFormatIdentificacion(deuda.repId),
          pacienteNombre: deuda.pacienteNombre,
          monto: Number(deuda.saldoDebe),
          tipo: "ajuste_saldo",
          motivo: "Depuración / Eliminación de deudas viejas",
          fechaRegistro: new Date().toISOString(),
          verificado: true,
          facturado: false
        });
        await registrarLog(
          currentUser,
          "Caja (Ajuste Deuda)",
          `Eliminó y saldó la deuda de $${deuda.saldoDebe} de ${deuda.representante} (${deuda.pacienteNombre})`
        );
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
      const t = transacciones.find(tx => tx.id === transId);
      await updateDocument("transacciones", transId, { verificado: true });
      await registrarLog(
        currentUser,
        "Caja (Verificación Transferencia)",
        `Verificó transferencia de $${t?.monto || ""} del paciente ${t?.pacienteNombre || ""}`
      );
      alert("Transferencia bancaria verificada e ingresada a caja con éxito.");
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Datos copiados al portapapeles.");
  };

  const exportGastosToCSV = () => {
    if (filteredGastosList.length === 0) {
      alert("No hay gastos para exportar.");
      return;
    }
    const headers = ["Fecha", "Categoría", "Descripción", "Método de Pago", "Registrado Por", "Monto"];
    const rows = filteredGastosList.map(g => [
      g.fecha,
      g.categoria || "",
      g.descripcion || "",
      g.metodoPago || "",
      g.registradoPor || "Sistema",
      g.monto
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Add BOM for Excel UTF-8 support
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gastos_meraki_${gastosMonth}_${getLocalDateStr(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToCSV = () => {
    if (verifiList.length === 0) {
      alert("No hay transferencias para exportar.");
      return;
    }
    const headers = ["Fecha y Hora", "Paciente", "Banco", "Referencia", "Monto"];
    const rows = verifiList.map(t => [
      new Date(t.fechaRegistro).toLocaleString("es-ES"),
      t.pacienteNombre || "",
      t.banco?.toUpperCase() || "",
      t.comprobante || "",
      t.monto
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Add BOM for Excel UTF-8 support
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transferencias_meraki_${getLocalDateStr(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        banco: gForm.metodoPago === "Transferencia" ? (gForm.banco || "") : "",
        tarjeta: gForm.metodoPago === "Tarjeta" ? (gForm.tarjeta || "") : "",
        registradoPor: currentUser.nombre
      });
      await registrarLog(
        currentUser,
        "Caja (Gasto Registrado)",
        `Registró un gasto de $${gForm.monto} en concepto de "${gForm.descripcion}" (Categoría: ${gForm.categoria}, Método: ${gForm.metodoPago})`
      );
      setGForm({
        fecha: getLocalDateStr(new Date()),
        monto: "",
        categoria: "Caja Chica",
        descripcion: "",
        metodoPago: "Efectivo",
        banco: "",
        tarjeta: ""
      });
      alert("Gasto registrado con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al registrar gasto: " + err.message);
    }
  };

  const handleDeleteGasto = async (gastoId) => {
    if (!isAdmin) {
      alert("Acceso denegado. Solo un Administrador puede eliminar gastos.");
      return;
    }
    if (confirm("¿Estás seguro de eliminar este gasto permanentemente?")) {
      try {
        const g = gastos.find(x => x.id === gastoId);
        await deleteDocument("gastos", gastoId);
        await registrarLog(
          currentUser,
          "Caja (Gasto Eliminado)",
          `Eliminó el gasto de $${g?.monto || ""} con descripción "${g?.descripcion || ""}"`
        );
        alert("Gasto eliminado correctamente.");
      } catch (err) {
        console.error(err);
        alert("Error al eliminar gasto.");
      }
    }
  };

  const handleDeleteTransaction = async (transId) => {
    const t = transacciones.find(tx => tx.id === transId);
    if (!t) return;
    
    if (confirm(`¿Estás seguro de eliminar permanentemente esta transacción de $${t.monto} del paciente ${t.pacienteNombre}? Esto revertirá el cobro.`)) {
      try {
        await deleteDocument("transacciones", transId);
        await registrarLog(
          currentUser,
          "Caja (Transacción Eliminada)",
          `Eliminó la transacción de $${t.monto} de ${t.pacienteNombre} (Método: ${t.tipo || ""})`
        );
        alert("Transacción de pago eliminada correctamente. La cita asociada vuelve a estar sin pagar.");
      } catch (err) {
        console.error(err);
        alert("Error al eliminar la transacción.");
      }
    }
  };

  const handleDeleteCitaFromCaja = async (cita) => {
    if (confirm(`¿Estás seguro de eliminar permanentemente la cita de ${cita.pacienteNombre} del ${getFmtRowDate(cita.fecha)} a las ${cita.horaInicio}? Esto la borrará de la agenda y de las cuentas por cobrar.`)) {
      try {
        await deleteDocument("citas", cita.id);
        
        const txs = transacciones.filter(t => t.citaId === cita.id);
        for (const tx of txs) {
          await deleteDocument("transacciones", tx.id);
        }
        
        await registrarLog(
          currentUser,
          "Caja (Cita Eliminada)",
          `Eliminó la cita de ${cita.pacienteNombre} del ${cita.fecha} ${cita.horaInicio} desde Caja`
        );
        alert("Cita eliminada correctamente.");
      } catch (err) {
        console.error(err);
        alert("Error al eliminar la cita.");
      }
    }
  };

  const cobrosHoy = getCobrosHoy();
  const deudasRep = getDeudasRep();
  
  // Calculate today's cash totals
  const totalEsperadoHoy = cobrosHoy.reduce((acc, c) => acc + Number(c.costo), 0);
  
  // Count how much of today's appointments have been paid
  // A cita today is paid if there is a transaction matching the citaId
  const getCitaTransactions = (citaId) => {
    return transacciones.filter(t => t.citaId === citaId);
  };

  const getCitaTotalPaid = (citaId) => {
    return transacciones
      .filter(t => t.citaId === citaId)
      .reduce((sum, t) => sum + Number(t.monto), 0);
  };

  const totalCobradoHoy = cobrosHoy.reduce((acc, c) => {
    return acc + getCitaTotalPaid(c.id);
  }, 0);

  const pendientesCobroHoy = cobrosHoy.filter(c => getCitaTotalPaid(c.id) < Number(c.costo));
  const verifiList = transacciones.filter(t => {
    if (t.tipo === "efectivo" || t.tipo === "ajuste_saldo") return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const dateStr = t.fechaRegistro ? new Date(t.fechaRegistro).toLocaleString("es-ES").toLowerCase() : "";
      return (
        t.pacienteNombre?.toLowerCase().includes(term) ||
        t.banco?.toLowerCase().includes(term) ||
        t.comprobante?.toLowerCase().includes(term) ||
        dateStr.includes(term)
      );
    }
    return true;
  });

  const filteredGastosList = gastos.filter(g => {
    const monthMatch = g.fecha.startsWith(gastosMonth);
    const categoryMatch = selectedGastoCategory === "todas" || g.categoria === selectedGastoCategory;
    return monthMatch && categoryMatch;
  });

  const totalGastosMes = filteredGastosList
    .filter(g => g.categoria !== "Reposición de Caja Chica")
    .reduce((acc, g) => acc + Number(g.monto), 0);

  const patientForPayModal = selectedCita ? pacientes.find(p => p.id === selectedCita.pacienteId) : null;
  const repIdForPayModal = patientForPayModal ? cleanAndFormatIdentificacion(patientForPayModal.cedulaRepresentante || patientForPayModal.id) : "Desconocido";
  const myAnticipoForPayModal = getAnticiposRep().find(a => a.repId === repIdForPayModal);
  const availableCreditForPayModal = myAnticipoForPayModal ? myAnticipoForPayModal.saldoFavor : 0;

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div className="responsive-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--purple-dark)", fontWeight: 600 }}>Caja y Cobros Diarios</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Control de recaudación diaria y conciliación bancaria.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {activeTab === "cobros_hoy" && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {/* Toggle Día / Semana */}
              <div style={{ display: "flex", backgroundColor: "var(--border-light)", borderRadius: "var(--radius-sm)", padding: "2px" }}>
                <button 
                  type="button"
                  onClick={() => setViewMode("dia")}
                  style={{
                    padding: "6px 12px", border: "none", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                    backgroundColor: viewMode === "dia" ? "white" : "transparent",
                    color: viewMode === "dia" ? "var(--purple-dark)" : "var(--text-muted)",
                    boxShadow: viewMode === "dia" ? "var(--shadow-xs)" : "none",
                    outline: "none",
                    transition: "all 0.2s"
                  }}
                >
                  Día
                </button>
                <button 
                  type="button"
                  onClick={() => setViewMode("semana")}
                  style={{
                    padding: "6px 12px", border: "none", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                    backgroundColor: viewMode === "semana" ? "white" : "transparent",
                    color: viewMode === "semana" ? "var(--purple-dark)" : "var(--text-muted)",
                    boxShadow: viewMode === "semana" ? "var(--shadow-xs)" : "none",
                    outline: "none",
                    transition: "all 0.2s"
                  }}
                >
                  Semana
                </button>
              </div>

              {/* Date Navigator */}
              {viewMode === "dia" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "6px 10px" }}
                    onClick={handlePrevDay}
                    title="Día Anterior"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <input 
                    type="date" 
                    className="input-field" 
                    style={{ width: "140px", padding: "6px 8px", fontSize: "0.85rem" }}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "6px 10px" }}
                    onClick={handleNextDay}
                    title="Día Siguiente"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "6px 10px" }}
                    onClick={handlePrevWeekCaja}
                    title="Semana Anterior"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", padding: "0 10px", whiteSpace: "nowrap", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", backgroundColor: "white", height: "34px", display: "inline-flex", alignItems: "center" }}>
                    {getWeekRangeLabelCaja(targetDate)}
                  </span>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "6px 10px" }}
                    onClick={handleNextWeekCaja}
                    title="Semana Siguiente"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "6px 10px", color: "var(--purple-base)" }}
                    onClick={() => dateInputRefCaja.current && dateInputRefCaja.current.showPicker()}
                    title="Elegir Fecha en Calendario"
                  >
                    <CalendarIcon size={14} />
                  </button>
                  <input 
                    type="date" 
                    ref={dateInputRefCaja}
                    style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
                    value={targetDate}
                    onChange={(e) => {
                      if (e.target.value) setTargetDate(e.target.value);
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {activeTab === "conciliacion" && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Buscar por niño, banco, ref, fecha..." 
                style={{ width: "250px" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button 
                className="btn btn-secondary" 
                onClick={exportToCSV}
                style={{ padding: "8px 14px", fontSize: "0.85rem", backgroundColor: "#E0F2FE", color: "#0369A1", border: "1px solid #BAE6FD" }}
              >
                Exportar CSV
              </button>
            </div>
          )}
          {activeTab === "gastos" && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select 
                className="input-field" 
                style={{ width: "150px" }}
                value={selectedGastoCategory}
                onChange={(e) => setSelectedGastoCategory(e.target.value)}
              >
                <option value="todas">Todas Categorías</option>
                <option value="Caja Chica">Caja Chica</option>
                <option value="Reposición de Caja Chica">Reposición Caja Chica</option>
                <option value="Alquiler">Alquiler</option>
                <option value="Servicios Públicos">Servicios Públicos</option>
                <option value="Materiales y Papelería">Materiales y Papelería</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Otros">Otros</option>
              </select>
              <input 
                type="month" 
                className="input-field" 
                style={{ width: "140px" }}
                value={gastosMonth}
                onChange={(e) => setGastosMonth(e.target.value)}
              />
              <button 
                className="btn btn-secondary" 
                onClick={exportGastosToCSV}
                style={{ padding: "8px 14px", fontSize: "0.85rem", backgroundColor: "#FDF2F2", color: "#9B1C1C", border: "1px solid #FCD3D3" }}
              >
                Exportar CSV
              </button>
            </div>
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
          Cobros Registrados (Día / Semana)
        </button>
        <button 
          onClick={() => setActiveTab("conciliacion")}
          style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 500, cursor: "pointer",
            borderBottom: activeTab === "conciliacion" ? "3px solid var(--purple-base)" : "3px solid transparent",
            color: activeTab === "conciliacion" ? "var(--purple-dark)" : "var(--text-muted)"
          }}
        >
          Registro de Transferencias ({verifiList.length})
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
          {/* Daily/Weekly cash status */}
          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Total Esperado {viewMode === "dia" ? "Hoy" : "Semana"}</span>
              <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--text-main)" }}>${totalEsperadoHoy}</span>
            </div>
            <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px", borderLeft: "4px solid #10B981" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Total Recaudado {viewMode === "dia" ? "Hoy" : "Semana"}</span>
              <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "#10B981" }}>${totalCobradoHoy}</span>
            </div>
            <div className="glass" style={{ borderRadius: "var(--radius-sm)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px", borderLeft: "4px solid var(--pink-base)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Pendiente por Cobrar {viewMode === "dia" ? "Hoy" : "Semana"}</span>
              <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--pink-base)" }}>${totalEsperadoHoy - totalCobradoHoy}</span>
            </div>
          </div>

          {/* List of collections */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>
              {viewMode === "dia" ? "Sesiones Agendadas de Hoy" : "Sesiones Agendadas de la Semana"}
            </h3>
            <div className="responsive-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  <th style={{ padding: "12px 8px" }}>FECHA</th>
                  <th style={{ padding: "12px 8px" }}>HORA</th>
                  <th style={{ padding: "12px 8px" }}>NINO / PACIENTE</th>
                  <th style={{ padding: "12px 8px" }}>TERAPIA</th>
                  <th style={{ padding: "12px 8px" }}>COSTO</th>
                  <th style={{ padding: "12px 8px" }}>PAGADO</th>
                  <th style={{ padding: "12px 8px" }}>PENDIENTE</th>
                  <th style={{ padding: "12px 8px" }}>ESTADO DE ASISTENCIA</th>
                  <th style={{ padding: "12px 8px" }}>ESTADO PAGO</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {cobrosHoy
                  .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
                  .map((c) => {
                    const txs = getCitaTransactions(c.id);
                    const pagado = getCitaTotalPaid(c.id);
                    const pendiente = Number(c.costo) - pagado;
                    const patient = pacientes.find(p => p.id === c.pacienteId);
                    const requiresInvoice = patient?.requiereFactura;
                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "55px" }}>
                        <td style={{ padding: "12px 8px", fontWeight: 600, color: "var(--text-muted)" }}>{getFmtRowDate(c.fecha)}</td>
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
                        <td style={{ padding: "12px 8px", fontWeight: 500, color: "#10B981" }}>${pagado}</td>
                        <td style={{ padding: "12px 8px", fontWeight: 600, color: pendiente > 0 ? "var(--pink-base)" : "var(--text-muted)" }}>${pendiente}</td>
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
                          {txs.length === 0 ? (
                            <span style={{ padding: "4px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: "#FEE2E2", color: "#991B1B", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <AlertTriangle size={12} /> SIN PAGAR
                            </span>
                          ) : pendiente === 0 ? (
                            <span style={{ padding: "4px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: "#D1FAE5", color: "#065F46", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={12} /> PAGADO
                            </span>
                          ) : (
                            <span style={{ padding: "4px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: "#FEF3C7", color: "#D97706", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <AlertTriangle size={12} /> ABONADO
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", justifyContent: "flex-end" }}>
                            {c.estadoAsistencia === "falto_injustificado" && (
                              <button 
                                className="btn"
                                style={{ padding: "6px 10px", fontSize: "0.8rem", backgroundColor: "#FCE8E6", color: "#A8200D", border: "1px solid #F3A094", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                onClick={() => {
                                  const msg = `Buen día estimada/o ya se ha cumplido el tiempo máximo de espera de 15 minutos y lastimosamente debemos comunicarle que en este momento su turno queda como perdido con la obligación de pagarnos sin la oportunidad de regendar.`;
                                  sendWhatsApp(patient?.telefono, msg);
                                }}
                                title="Enviar aviso de inasistencia (turno perdido) por WhatsApp"
                              >
                                <AlertTriangle size={14} /> Turno Perdido
                              </button>
                            )}
                            
                            {pendiente > 0 ? (
                              <>
                                <button 
                                  className="btn btn-primary"
                                  style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                  onClick={() => handleOpenPayModal(c, pendiente)}
                                >
                                  Cobrar
                                </button>
                                <button 
                                  className="btn"
                                  style={{ padding: "6px 10px", fontSize: "0.8rem", backgroundColor: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  onClick={() => {
                                    const repName = patient?.representante || "estimado/a";
                                    const isUpcoming = c.estadoAsistencia === "pendiente" || c.fecha > new Date().toISOString().split('T')[0];
                                    const msg = isUpcoming
                                      ? `¡Hola, ${repName}! Buen día. Le escribimos de MERAKI para recordarle que tiene una sesión programada para el ${getFmtRowDate(c.fecha)} a las ${c.horaInicio}. Le recordamos amablemente que los pagos de las sesiones deben cancelarse por adelantado o al momento de la atención. Agradecemos nos comparta la foto del comprobante para registrar su pago. ¡Muchas gracias, quedamos atentos!`
                                      : `¡Hola, ${repName}! Buen día. Le escribimos de MERAKI porque registramos un saldo pendiente de $${pendiente} de la sesión del día ${getFmtRowDate(c.fecha)}. Le recordamos amablemente que no manejamos pagos posteriores a la atención y es necesario que todos los valores estén saldados para poder mantener sus próximos turnos programados. Agradecemos nos comparta la foto del comprobante para registrarlo. ¡Muchas gracias, quedamos atentos!`;
                                    sendWhatsApp(patient?.telefono, msg);
                                  }}
                                  title="Enviar aviso de pago pendiente por WhatsApp"
                                >
                                  <MessageCircle size={14} /> Recordar
                                </button>
                              </>
                            ) : (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                  {txs.map(t => t.tipo?.toUpperCase()).join(", ")}
                                </span>
                                <button 
                                  className="btn"
                                  style={{ padding: "4px 8px", fontSize: "0.75rem", backgroundColor: "#D1FAE5", color: "#065F46", border: "1px solid #A7F3D0", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  onClick={() => {
                                    const msg = `¡Hola! 👋 Desde MERAKI te confirmamos que hemos registrado tu pago exitosamente. Gracias por confiar en nuestro Centro de Atención Integral. Si tienes alguna duda o necesitas información adicional, no dudes en escribirnos. ¡Estamos para apoyarte! 🌿`;
                                    sendWhatsApp(patient?.telefono, msg);
                                  }}
                                  title="Enviar confirmación de pago exitoso por WhatsApp"
                                >
                                  <Send size={12} /> Confirmar
                                </button>
                              </div>
                            )}
                            
                            {txs.map(tx => (
                              <button
                                key={tx.id}
                                onClick={() => handleDeleteTransaction(tx.id)}
                                style={{ border: "none", background: "none", cursor: "pointer", color: "#EF4444", padding: "2px", display: "inline-flex", alignItems: "center" }}
                                title={`Revertir Pago de $${tx.monto} (${tx.tipo})`}
                              >
                                <Trash2 size={12} />
                              </button>
                            ))}
                            
                            <button
                              onClick={() => handleDeleteCitaFromCaja(c)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: "#EF4444", padding: "2px", display: "inline-flex", alignItems: "center" }}
                              title="Eliminar Cita de la Agenda"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {cobrosHoy.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                      {viewMode === "dia" ? "No hay terapias programadas sujetas a cobro para hoy." : "No hay terapias programadas sujetas a cobro para esta semana."}
                    </td>
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
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Buzón de Transferencias Registradas (Auxiliar Perseo)</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>Consulta, filtra y copia las transferencias registradas en Meraki para cruzarlas con tu conciliación en Perseo.</p>
          <div className="responsive-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                <th style={{ padding: "12px 8px" }}>NINO / PACIENTE</th>
                <th style={{ padding: "12px 8px" }}>BANCO</th>
                <th style={{ padding: "12px 8px" }}>COMPROBANTE</th>
                <th style={{ padding: "12px 8px" }}>MONTO</th>
                <th style={{ padding: "12px 8px" }}>REGISTRADO EN</th>
                <th style={{ padding: "12px 8px", textAlign: "right" }}>ACCIÓN (PERSEO)</th>
              </tr>
            </thead>
            <tbody>
              {verifiList.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "55px" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 500 }}>{t.pacienteNombre}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{t.banco?.toUpperCase()}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <span>{t.comprobante}</span>
                      <button 
                        onClick={() => copyToClipboard(t.comprobante)}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--purple-base)", padding: "2px" }}
                        title="Copiar Comprobante"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "12px 8px", fontWeight: 600, color: "var(--purple-dark)" }}>${t.monto}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.8rem" }}>{new Date(t.fechaRegistro).toLocaleString("es-ES")}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        onClick={() => copyToClipboard(`${t.banco?.toUpperCase()} - Ref: ${t.comprobante} - $${t.monto}`)}
                      >
                        <Copy size={12} /> Copiar Datos
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "#EF4444", padding: "6px", display: "inline-flex", alignItems: "center" }}
                        title="Eliminar Transacción"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {verifiList.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>No se encontraron transferencias registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {activeTab === "deudas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Cuentas por Cobrar Section */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)" }}>Cuentas por Cobrar (Clientes en Mora)</h3>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => setShowAnticipoModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Plus size={16} /> Registrar Anticipo
              </button>
            </div>
            
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
                      <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{cleanAndFormatIdentificacion(d.repId)}</td>
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
                            type="button"
                            className="btn"
                            style={{ padding: "6px 10px", fontSize: "0.8rem", backgroundColor: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            onClick={() => {
                              const repName = d.representante || "estimado/a";
                              const msg = `¡Hola, ${repName}! Buen día. Le escribimos de MERAKI porque registramos un saldo pendiente acumulado de $${d.saldoDebe}. Le recordamos amablemente que los pagos deben cancelarse por adelantado o al momento de la sesión, ya que no manejamos pagos posteriores a la atención. Para poder agendar nuevos turnos, es necesario saldar los valores previamente. Agradecemos nos comparta la foto del comprobante para registrarlo. ¡Muchas gracias, quedamos atentos!`;
                              sendWhatsApp(d.telefono, msg);
                            }}
                            title="Enviar recordatorio de pago pendiente por WhatsApp"
                          >
                            <MessageCircle size={14} /> Recordar
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

          {/* Saldos a Favor Section */}
          <div className="glass" style={{ borderRadius: "var(--radius-md)", padding: "20px", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#065F46", marginBottom: "16px" }}>Saldos a Favor (Anticipos Disponibles)</h3>
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
                    <th style={{ padding: "12px 8px" }}>SALDO A FAVOR</th>
                  </tr>
                </thead>
                <tbody>
                  {getAnticiposRep().map((d) => (
                    <tr key={d.repId} style={{ borderBottom: "1px solid var(--border-soft)", height: "55px", fontSize: "0.85rem" }}>
                      <td style={{ padding: "12px 8px", fontWeight: 500, color: "#065F46" }}>{d.representante}</td>
                      <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{cleanAndFormatIdentificacion(d.repId)}</td>
                      <td style={{ padding: "12px 8px" }}>{d.pacienteNombre}</td>
                      <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{d.telefono}</td>
                      <td style={{ padding: "12px 8px" }}>${d.totalCargos}</td>
                      <td style={{ padding: "12px 8px" }}>${d.totalAbonado}</td>
                      <td style={{ padding: "12px 8px", fontWeight: 600, color: "#10B981" }}>${d.saldoFavor}</td>
                    </tr>
                  ))}
                  {getAnticiposRep().length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>No hay anticipos o saldos a favor registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                  <option value="Reposición de Caja Chica">Reposición de Caja Chica (Ingreso)</option>
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

              {gForm.metodoPago === "Transferencia" && (
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Banco*</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select 
                      required 
                      className="input-field" 
                      value={gForm.banco || ""} 
                      onChange={(e) => setGForm({...gForm, banco: e.target.value})}
                    >
                      <option value="">Seleccione...</option>
                      {bancosList.map(b => (
                        <option key={b.id} value={b.nombre.toLowerCase()}>{b.nombre}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ padding: "0 8px" }} 
                      onClick={() => handleAddNuevoBanco((newBank) => setGForm(prev => ({ ...prev, banco: newBank })))}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {gForm.metodoPago === "Tarjeta" && (
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Tarjeta*</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select 
                      required 
                      className="input-field" 
                      value={gForm.tarjeta || ""} 
                      onChange={(e) => setGForm({...gForm, tarjeta: e.target.value})}
                    >
                      <option value="">Seleccione...</option>
                      {tarjetasList.map(t => (
                        <option key={t.id} value={t.nombre.toLowerCase()}>{t.nombre}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ padding: "0 8px" }} 
                      onClick={() => handleAddNuevaTarjeta((newCard) => setGForm(prev => ({ ...prev, tarjeta: newCard })))}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

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
                Total Mes: ${totalGastosMes.toFixed(2)}
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
                {filteredGastosList
                  .sort((a, b) => b.fecha.localeCompare(a.fecha))
                  .map((g) => (
                    <tr key={g.id} style={{ borderBottom: "1px solid var(--border-soft)", height: "50px", fontSize: "0.85rem" }}>
                      <td style={{ padding: "8px", fontWeight: 500 }}>{g.fecha}</td>
                      <td style={{ padding: "8px" }}>
                        <span style={{ 
                          padding: "2px 6px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 600,
                          backgroundColor: g.categoria === "Caja Chica" ? "#FEF3C7" : g.categoria === "Reposición de Caja Chica" ? "#D1FAE5" : g.categoria === "Alquiler" ? "#F5F3FF" : g.categoria === "Servicios Públicos" ? "#E0F2FE" : "#F3F4F6",
                          color: g.categoria === "Caja Chica" ? "#D97706" : g.categoria === "Reposición de Caja Chica" ? "#065F46" : g.categoria === "Alquiler" ? "var(--purple-dark)" : g.categoria === "Servicios Públicos" ? "#0369A1" : "var(--text-muted)"
                        }}>
                          {g.categoria}
                        </span>
                      </td>
                      <td style={{ padding: "8px", color: "var(--text-muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.descripcion}>
                        {g.descripcion}
                      </td>
                      <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                        {g.metodoPago}
                        {g.metodoPago === "Transferencia" && g.banco && ` (${g.banco.toUpperCase()})`}
                        {g.metodoPago === "Tarjeta" && g.tarjeta && ` (${g.tarjeta.toUpperCase()})`}
                      </td>
                      <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.75rem" }}>{g.registradoPor || "Sistema"}</td>
                      <td style={{ padding: "8px", fontWeight: 600, color: g.categoria === "Reposición de Caja Chica" ? "#10B981" : "var(--pink-dark)" }}>
                        {g.categoria === "Reposición de Caja Chica" ? `+ $${Number(g.monto).toFixed(2)}` : `$${Number(g.monto).toFixed(2)}`}</td>
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
                {filteredGastosList.length === 0 && (
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
                  {availableCreditForPayModal > 0 && (
                    <option value="descuento_anticipo">Descontar de Anticipo (${availableCreditForPayModal.toFixed(2)} disp.)</option>
                  )}
                </select>
              </div>

              {(paymentForm.tipo !== "efectivo" && paymentForm.tipo !== "descuento_anticipo") && (
                <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Banco*</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <select required className="input-field" value={paymentForm.banco} onChange={(e) => setPaymentForm({...paymentForm, banco: e.target.value})}>
                        <option value="">Seleccione...</option>
                        {bancosList.map(b => (
                          <option key={b.id} value={b.nombre.toLowerCase()}>{b.nombre}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: "0 8px" }} 
                        onClick={() => handleAddNuevoBanco((newBank) => setPaymentForm(prev => ({ ...prev, banco: newBank })))}
                      >
                        +
                      </button>
                    </div>
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
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Observaciones / Notas</label>
                <textarea 
                  className="input-field" 
                  rows="2" 
                  placeholder="Observaciones sobre este cobro..." 
                  value={paymentForm.observaciones || ""} 
                  onChange={(e) => setPaymentForm({...paymentForm, observaciones: e.target.value})} 
                  style={{ resize: "none" }}
                />
              </div>

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
                    <div style={{ display: "flex", gap: "6px" }}>
                      <select required className="input-field" value={abonoForm.banco} onChange={(e) => setAbonoForm({...abonoForm, banco: e.target.value})}>
                        <option value="">Seleccione...</option>
                        {bancosList.map(b => (
                          <option key={b.id} value={b.nombre.toLowerCase()}>{b.nombre}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: "0 8px" }} 
                        onClick={() => handleAddNuevoBanco((newBank) => setAbonoForm(prev => ({ ...prev, banco: newBank })))}
                      >
                        +
                      </button>
                    </div>
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
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Observaciones / Notas</label>
                <textarea 
                  className="input-field" 
                  rows="2" 
                  placeholder="Observaciones sobre este abono..." 
                  value={abonoForm.observaciones || ""} 
                  onChange={(e) => setAbonoForm({...abonoForm, observaciones: e.target.value})} 
                  style={{ resize: "none" }}
                />
              </div>

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

      {showAnticipoModal && createPortal(
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="glass fade-in" style={{ padding: "24px", borderRadius: "var(--radius-md)", width: "480px", maxWidth: "90%", boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontWeight: 600, color: "var(--purple-dark)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Wallet size={20} /> Registrar Anticipo / Saldo a Favor
            </h3>
            
            <form onSubmit={handleRegisterAnticipo} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Paciente Asociado*</label>
                <select 
                  required 
                  className="input-field" 
                  value={anticipoForm.pacienteId} 
                  onChange={(e) => setAnticipoForm({...anticipoForm, pacienteId: e.target.value})}
                >
                  <option value="">Seleccione un paciente...</option>
                  {pacientes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.representante || "Representante"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Monto del Anticipo ($)*</label>
                <input 
                  type="number" 
                  required 
                  min="0.01" 
                  step="0.01" 
                  className="input-field" 
                  placeholder="Ej. 100.00"
                  value={anticipoForm.monto} 
                  onChange={(e) => setAnticipoForm({...anticipoForm, monto: e.target.value})} 
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Método de Pago*</label>
                <select className="input-field" value={anticipoForm.tipo} onChange={(e) => setAnticipoForm({...anticipoForm, tipo: e.target.value})}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="deposito">Depósito Bancario</option>
                </select>
              </div>

              {anticipoForm.tipo !== "efectivo" && (
                <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Banco*</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <select required className="input-field" value={anticipoForm.banco} onChange={(e) => setAnticipoForm({...anticipoForm, banco: e.target.value})}>
                        <option value="">Seleccione...</option>
                        {bancosList.map(b => (
                          <option key={b.id} value={b.nombre.toLowerCase()}>{b.nombre}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: "0 8px" }} 
                        onClick={() => handleAddNuevoBanco((newBank) => setAnticipoForm(prev => ({ ...prev, banco: newBank })))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Nro Comprobante*</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ej. 7335470" 
                      className="input-field" 
                      value={anticipoForm.comprobante} 
                      onChange={(e) => setAnticipoForm({...anticipoForm, comprobante: e.target.value})} 
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Observaciones / Notas</label>
                <textarea 
                  className="input-field" 
                  rows="2" 
                  placeholder="Ej. Abono por adelantado para paquete de 5 sesiones" 
                  value={anticipoForm.observaciones} 
                  onChange={(e) => setAnticipoForm({...anticipoForm, observaciones: e.target.value})} 
                  style={{ resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAnticipoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Anticipo</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
