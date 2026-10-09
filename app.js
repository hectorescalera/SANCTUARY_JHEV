const SUPABASE_URL = 'https://pgcgcyilqgkzdpzpunjb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t3V8gkAZREY805mqv7n3PQ_0fZA8xyR';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ==========================================
// CONFIGURACIÓN GLOBAL Y UTILIDADES
// ==========================================
const STORAGE_KEYS = {
    ACTIVIDADES: 'sanctuary_actividades_v2'
};

const CATEGORIAS_DEFAULT = {
    gasto: ['Servicios', 'Gasolina', 'Alimentación', 'Gaby', 'Héctor', 'David', 'Personal', 'Otros'],
    ingreso: ['Misas / Eventos LeGarbo', 'Nomina', 'Clases / Asesorias', 'Otros / Extras', 'Desarrollo Web / Proyectos']
};

const formatoMoneda = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
});

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

function obtenerEnlaceSeguro(valor) {
    try {
        const enlace = new URL(valor);
        return enlace.protocol === 'http:' || enlace.protocol === 'https:'
            ? escaparHTML(enlace.href)
            : '';
    } catch {
        return '';
    }
}

function obtenerFechaHoy() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

let graficoInstancia = null;
let errorMigracionActividadesNotificado = false;
let errorCargaFinanzas = false;
let errorCargaActividades = false;

// ==========================================
// MANEJO DE SUPABASE (FINANZAS)
// ==========================================
async function obtenerDatosFinanzas() {
    if (!supabaseClient) {
        errorCargaFinanzas = true;
        console.error('No está disponible el cliente de Supabase para cargar finanzas.');
        return [];
    }

    const { data, error } = await supabaseClient
        .from('finanzas')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) {
        errorCargaFinanzas = true;
        console.error('Error al obtener finanzas de Supabase:', error);
        return [];
    }

    errorCargaFinanzas = false;
    return data || [];
}

async function obtenerMovimientosCompletosParaExportar(actualizarEstado) {
    if (!supabaseClient) {
        throw new Error('Supabase no está disponible.');
    }

    const { count, error: errorConteo } = await supabaseClient
        .from('finanzas')
        .select('*', { count: 'exact', head: true });

    if (errorConteo) throw errorConteo;
    if (count === null) throw new Error('Supabase no devolvió el total de movimientos.');

    const movimientos = [];
    const tamanoPagina = 500;

    while (movimientos.length < count) {
        const desde = movimientos.length;
        const hasta = desde + tamanoPagina - 1;
        const { data, error } = await supabaseClient
            .from('finanzas')
            .select('*')
            .order('fecha', { ascending: true })
            .order('id', { ascending: true })
            .range(desde, hasta);

        if (error) {
            throw new Error(`Exportación incompleta: se recuperaron ${movimientos.length} de ${count} movimientos. ${error.message || 'Falló una página de datos.'}`);
        }
        if (!data || data.length === 0) break;

        movimientos.push(...data);
        actualizarEstado(`Descargando movimientos: ${movimientos.length} de ${count}…`);
    }

    const { count: totalFinal, error: errorConteoFinal } = await supabaseClient
        .from('finanzas')
        .select('*', { count: 'exact', head: true });

    if (errorConteoFinal) {
        throw new Error(`Se recuperaron ${movimientos.length} de ${count} movimientos, pero no se pudo verificar el total final. ${errorConteoFinal.message || ''}`.trim());
    }
    if (totalFinal === null || movimientos.length !== count || totalFinal !== count) {
        throw new Error(`Exportación incompleta: se recuperaron ${movimientos.length} de ${totalFinal ?? count} movimientos.`);
    }

    return movimientos;
}

function crearLibroFinanzas(movimientos) {
    const porMes = new Map();
    const porCategoria = new Map();

    movimientos.forEach(movimiento => {
        const mes = movimiento.fecha ? movimiento.fecha.slice(0, 7) : 'Sin fecha';
        const monto = Number(movimiento.monto) || 0;

        if (!porMes.has(mes)) porMes.set(mes, { ingresos: 0, gastos: 0 });
        const resumenMes = porMes.get(mes);
        if (movimiento.tipo === 'ingreso') resumenMes.ingresos += monto;
        else resumenMes.gastos += monto;

        const categoria = movimiento.categoria || 'Sin categoría';
        const claveCategoria = JSON.stringify([mes, movimiento.tipo, categoria]);
        porCategoria.set(claveCategoria, (porCategoria.get(claveCategoria) || 0) + monto);
    });

    const detalle = movimientos.map(movimiento => ({
        Fecha: movimiento.fecha || '',
        Mes: movimiento.fecha ? movimiento.fecha.slice(0, 7) : '',
        Tipo: movimiento.tipo,
        Categoría: movimiento.categoria || '',
        Concepto: movimiento.concepto || '',
        Monto: Number(movimiento.monto) || 0
    }));

    const resumenMensual = Array.from(porMes, ([mes, totales]) => ({
        Mes: mes,
        Ingresos: totales.ingresos,
        Gastos: totales.gastos,
        Neto: totales.ingresos - totales.gastos
    })).sort((a, b) => a.Mes.localeCompare(b.Mes));

    const resumenCategorias = Array.from(porCategoria, ([clave, total]) => {
        const [mes, tipo, categoria] = JSON.parse(clave);
        return { Mes: mes, Tipo: tipo, Categoría: categoria, Total: total };
    }).sort((a, b) => a.Mes.localeCompare(b.Mes) || a.Tipo.localeCompare(b.Tipo) || a.Categoría.localeCompare(b.Categoría));

    const libro = window.XLSX.utils.book_new();
    const hojas = [
        ['Movimientos', ['Fecha', 'Mes', 'Tipo', 'Categoría', 'Concepto', 'Monto'], detalle],
        ['Resumen mensual', ['Mes', 'Ingresos', 'Gastos', 'Neto'], resumenMensual],
        ['Resumen por categoría', ['Mes', 'Tipo', 'Categoría', 'Total'], resumenCategorias]
    ];

    hojas.forEach(([nombre, encabezados, filas]) => {
        const hoja = window.XLSX.utils.aoa_to_sheet([
            encabezados,
            ...filas.map(fila => encabezados.map(encabezado => fila[encabezado]))
        ]);
        window.XLSX.utils.book_append_sheet(libro, hoja, nombre);
    });

    return libro;
}

async function exportarFinanzasExcel() {
    const boton = document.getElementById('exportar-finanzas');
    const estado = document.getElementById('estado-exportacion');

    if (!boton || !estado) return;
    if (!window.XLSX) {
        estado.textContent = 'No se pudo cargar la herramienta para crear Excel. Revisa tu conexión e inténtalo de nuevo.';
        console.error('No está disponible la librería SheetJS para exportar finanzas.');
        return;
    }

    boton.disabled = true;
    estado.textContent = 'Verificando el total de movimientos…';

    try {
        const movimientos = await obtenerMovimientosCompletosParaExportar(mensaje => {
            estado.textContent = mensaje;
        });
        const libro = crearLibroFinanzas(movimientos);
        const fechaArchivo = obtenerFechaHoy();
        window.XLSX.writeFile(libro, `sanctuary-finanzas-${fechaArchivo}.xlsx`);
        estado.textContent = `Exportación completa: ${movimientos.length} de ${movimientos.length} movimientos.`;
    } catch (error) {
        console.error('No se pudo completar la exportación de finanzas:', error);
        estado.textContent = error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : 'No se pudo completar la exportación. No se descargó ningún archivo.';
    } finally {
        boton.disabled = false;
    }
}

async function guardarRegistroFinanzas(concepto, monto, categoria, tipo, fecha) {
    if (!supabaseClient) {
        console.error('No está disponible el cliente de Supabase para guardar finanzas.');
        alert('No se pudo guardar el movimiento porque Supabase no está disponible.');
        return null;
    }

    const { data, error } = await supabaseClient
        .from('finanzas')
        .insert([
            { concepto, monto: parseFloat(monto), categoria, tipo, fecha }
        ])
        .select();

    if (error) {
        console.error('Error al guardar en Supabase:', error);
        alert('Ocurrió un error al guardar el registro.');
        return null;
    }

    return data;
}

async function eliminarRegistroFinanzas(id) {
    if (!supabaseClient) {
        console.error('No está disponible el cliente de Supabase para eliminar finanzas.');
        alert('No se pudo eliminar el movimiento porque Supabase no está disponible.');
        return false;
    }

    const { error } = await supabaseClient
        .from('finanzas')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar en Supabase:', error);
        alert('Ocurrió un error al eliminar el registro.');
        return false;
    }

    return true;
}

// ==========================================
// MANEJO DE SUPABASE (ACTIVIDADES)
// ==========================================
function mapearActividadDesdeSupabase(actividad) {
    return {
        ...actividad,
        registroDias: actividad.registro_dias || {},
        diasCompletados: actividad.dias_completados || 0,
        linkLive: actividad.link_live || '',
        linkRepo: actividad.link_repo || '',
        tareas: actividad.tareas || []
    };
}

function mapearActividadParaSupabase(actividad) {
    return {
        id: actividad.id,
        tipo: actividad.tipo,
        nombre: actividad.nombre,
        fecha: actividad.fecha,
        notas: actividad.notas || '',
        duracion: actividad.duracion || null,
        registro_dias: actividad.registroDias || {},
        dias_completados: actividad.diasCompletados || 0,
        link_live: actividad.linkLive || '',
        link_repo: actividad.linkRepo || '',
        tareas: actividad.tareas || []
    };
}

function actividadCompletada(actividad) {
    if (actividad.tipo === 'ritual') {
        const duracion = actividad.duracion || 7;
        const diasCompletados = actividad.registroDias
            ? Object.keys(actividad.registroDias).length
            : (actividad.diasCompletados || 0);
        return diasCompletados >= duracion;
    }

    const tareas = actividad.tareas || [];
    return tareas.length > 0 && tareas.every(tarea => tarea.completada);
}

async function obtenerDatosActividades() {
    if (!supabaseClient) {
        errorCargaActividades = true;
        console.error('No está disponible el cliente de Supabase para cargar actividades.');
        return [];
    }

    const { data, error } = await supabaseClient
        .from('actividades')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        errorCargaActividades = true;
        console.error('Error al obtener actividades de Supabase:', error);
        return [];
    }

    errorCargaActividades = false;
    const actividades = (data || []).map(mapearActividadDesdeSupabase);
    const datosLocales = localStorage.getItem(STORAGE_KEYS.ACTIVIDADES);

    if (actividades.length === 0 && datosLocales) {
        let actividadesLocales;
        try {
            actividadesLocales = JSON.parse(datosLocales);
            if (!Array.isArray(actividadesLocales)) {
                throw new TypeError('Los datos locales de actividades no tienen el formato esperado.');
            }
        } catch (error) {
            console.error('No se pudieron leer las actividades locales para migrarlas:', error);
            if (!errorMigracionActividadesNotificado) {
                alert('No se pudieron leer las actividades guardadas en este navegador. Los datos originales se conservaron y no se eliminaron.');
                errorMigracionActividadesNotificado = true;
            }
            return [];
        }

        const migracionExitosa = await guardarDatosActividades(actividadesLocales);
        if (migracionExitosa) localStorage.removeItem(STORAGE_KEYS.ACTIVIDADES);
        return migracionExitosa ? actividadesLocales : [];
    }

    return actividades;
}

async function guardarDatosActividades(data) {
    if (!supabaseClient) {
        console.error('No está disponible el cliente de Supabase para guardar actividades.');
        alert('No se pudo guardar la actividad porque Supabase no está disponible.');
        return false;
    }

    const { error } = await supabaseClient
        .from('actividades')
        .upsert(data.map(mapearActividadParaSupabase));

    if (error) {
        console.error('Error al guardar actividades en Supabase:', error);
        alert('Ocurrió un error al guardar la actividad. Verifica la configuración de Supabase.');
        return false;
    }

    return true;
}

async function eliminarActividadDeSupabase(id) {
    if (!supabaseClient) {
        console.error('No está disponible el cliente de Supabase para eliminar actividades.');
        alert('No se pudo eliminar la actividad porque Supabase no está disponible.');
        return false;
    }

    const { error } = await supabaseClient
        .from('actividades')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar actividad de Supabase:', error);
        alert('Ocurrió un error al eliminar la actividad.');
        return false;
    }

    return true;
}

// ==========================================
// 1. VISTA: DASHBOARD (index.html) - SOLO LECTURA
// ==========================================
async function cargarDashboard() {
    const movimientos = await obtenerDatosFinanzas();
    const actividades = (await obtenerDatosActividades()).filter(actividad => !actividadCompletada(actividad));

    let totalIngresos = 0;
    let totalGastos = 0;

    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') totalIngresos += Number(m.monto) || 0;
        else totalGastos += Number(m.monto) || 0;
    });

    const balanceGlobalReal = totalIngresos - totalGastos;

    const elMontoAcumulado = document.getElementById('monto-acumulado') || document.getElementById('total-acumulado');
    if (elMontoAcumulado && errorCargaFinanzas) {
        elMontoAcumulado.textContent = 'No disponible';
    } else if (elMontoAcumulado) {
        elMontoAcumulado.textContent = formatoMoneda.format(balanceGlobalReal);
    }

    const contenedorResumen = document.querySelector('#resumen-actividades');

    if (contenedorResumen) {
        if (errorCargaActividades) {
            contenedorResumen.innerHTML = `
                <div class="col-span-full p-8 rounded-2xl bg-[#1e1e1e] border border-white/5 text-center">
                    <p class="text-sm text-amber-300">No se pudieron cargar las actividades. Revisa la conexión y los permisos de Supabase.</p>
                </div>`;
        } else if (actividades.length === 0) {
            contenedorResumen.innerHTML = `
                <div class="col-span-full p-8 rounded-2xl bg-[#1e1e1e] border border-white/5 text-center flex flex-col items-center justify-center">
                    <span class="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2">event_notes</span>
                    <p class="text-sm text-on-surface-variant/50">No hay proyectos ni rituales activos en este momento.</p>
                </div>`;
            return;
        }

        contenedorResumen.innerHTML = '';

        actividades.forEach(act => {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'p-5 rounded-2xl bg-[#1e1e1e] border border-white/5 flex flex-col justify-between gap-3 shadow-md';
            const esRitual = act.tipo === 'ritual';

            let avancePorcentaje = 0;

            if (esRitual) {
                const duracion = act.duracion || 7;
                const completados = act.registroDias ? Object.keys(act.registroDias).length : (act.diasCompletados || 0);
                avancePorcentaje = Math.min(100, Math.round((completados / duracion) * 100));
            } else {
                const totalTareas = act.tareas ? act.tareas.length : 0;
                const completadas = act.tareas ? act.tareas.filter(t => t.completada).length : 0;
                avancePorcentaje = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0;
            }

            tarjeta.innerHTML = `
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${esRitual ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}">
                            ${esRitual ? 'Ritual' : 'Proyecto'}
                        </span>
                        <span class="text-[11px] text-white/40">${escaparHTML(act.fecha)}</span>
                    </div>
                    <h3 class="text-base font-bold text-white uppercase tracking-wide">${escaparHTML(act.nombre)}</h3>
                </div>
                
                <div class="mt-2">
                    <div class="flex justify-between text-xs text-white/70 mb-1">
                        <span>Progreso</span>
                        <span class="font-bold text-amber-400">${avancePorcentaje}%</span>
                    </div>
                    <div class="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div class="${esRitual ? 'bg-amber-500' : 'bg-blue-500'} h-full transition-all duration-300" style="width: ${avancePorcentaje}%"></div>
                    </div>
                </div>
            `;
            contenedorResumen.appendChild(tarjeta);
        });
    }
}

// ==========================================
// 2. VISTA: FINANZAS (finanzas.html)
// ==========================================
async function inicializarFinanzas() {
    const formFinanzas = document.getElementById('form-finanzas');
    const selectTipo = document.getElementById('select-tipo');
    const selectCategoria = document.getElementById('select-categoria');
    const inputFecha = document.getElementById('input-fecha');
    const selectMesFiltro = document.getElementById('select-mes-filtro');

    if (!formFinanzas) return;

    const botonExportar = document.getElementById('exportar-finanzas');
    if (botonExportar) {
        botonExportar.addEventListener('click', exportarFinanzasExcel);
    }

    if (inputFecha && !inputFecha.value) {
        inputFecha.value = obtenerFechaHoy();
    }

    function actualizarCategorias() {
        const tipo = selectTipo.value;
        selectCategoria.innerHTML = '';
        CATEGORIAS_DEFAULT[tipo].forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            selectCategoria.appendChild(option);
        });
    }

    selectTipo.addEventListener('change', actualizarCategorias);
    actualizarCategorias();

    if (selectMesFiltro) {
        selectMesFiltro.addEventListener('change', () => {
            renderizarFinanzas(selectMesFiltro.value);
        });
    }

    formFinanzas.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tipo = selectTipo.value;
        const concepto = document.getElementById('input-concepto').value.trim();
        const monto = parseFloat(document.getElementById('input-monto').value);
        const categoria = selectCategoria.value;
        const fecha = inputFecha.value || obtenerFechaHoy();

        if (!concepto || isNaN(monto) || monto <= 0) return;

        const resultado = await guardarRegistroFinanzas(concepto, monto, categoria, tipo, fecha);

        if (resultado) {
            formFinanzas.reset();
            if (inputFecha) inputFecha.value = obtenerFechaHoy();
            actualizarCategorias();
            await poblarOpcionesMeses();
            await renderizarFinanzas();
        }
    });

    await poblarOpcionesMeses();
    await renderizarFinanzas();
}

async function poblarOpcionesMeses() {
    const selectMesFiltro = document.getElementById('select-mes-filtro');
    if (!selectMesFiltro) return;

    const movimientos = await obtenerDatosFinanzas();
    if (errorCargaFinanzas) {
        selectMesFiltro.innerHTML = '<option value="">Datos no disponibles</option>';
        return;
    }

    const mesesSet = new Set();

    const mesActual = obtenerFechaHoy().slice(0, 7);
    mesesSet.add(mesActual);

    movimientos.forEach(m => {
        if (m.fecha) {
            mesesSet.add(m.fecha.slice(0, 7));
        }
    });

    const valorSeleccionado = selectMesFiltro.value || mesActual;
    if (valorSeleccionado !== 'todos' && /^\d{4}-\d{2}$/.test(valorSeleccionado)) {
        mesesSet.add(valorSeleccionado);
    }

    const mesesOrdenados = Array.from(mesesSet).sort().reverse();

    selectMesFiltro.innerHTML = '<option value="todos">Todos los meses</option>';
    mesesOrdenados.forEach(mes => {
        const option = document.createElement('option');
        option.value = mes;
        option.textContent = mes;
        selectMesFiltro.appendChild(option);
    });

    selectMesFiltro.value = valorSeleccionado;
}

async function renderizarFinanzas(filtroMes = null) {
    const movimientos = await obtenerDatosFinanzas();
    const selectMesFiltro = document.getElementById('select-mes-filtro');
    const elIngresos = document.getElementById('monto-ingresos');
    const elGastos = document.getElementById('monto-gastos');
    const elNeto = document.getElementById('monto-neto');
    const elHistorial = document.getElementById('historial-movimientos');

    if (errorCargaFinanzas) {
        if (elIngresos) elIngresos.textContent = 'No disponible';
        if (elGastos) elGastos.textContent = 'No disponible';
        if (elNeto) elNeto.textContent = 'No disponible';
        if (elHistorial) {
            elHistorial.innerHTML = '<p class="text-sm text-amber-300 text-center py-8">No se pudieron cargar las transacciones. Revisa la conexión y los permisos de Supabase.</p>';
        }
        if (graficoInstancia) {
            graficoInstancia.destroy();
            graficoInstancia = null;
        }
        return;
    }

    const mesActivo = filtroMes || (selectMesFiltro ? selectMesFiltro.value : 'todos');

    const movimientosFiltrados = movimientos.filter(m => {
        if (!mesActivo || mesActivo === 'todos') return true;
        return m.fecha && m.fecha.startsWith(mesActivo);
    });

    let ingresosPeriodo = 0;
    let gastosPeriodo = 0;

    movimientosFiltrados.forEach(m => {
        if (m.tipo === 'ingreso') ingresosPeriodo += Number(m.monto);
        else gastosPeriodo += Number(m.monto);
    });

    if (elIngresos) elIngresos.textContent = formatoMoneda.format(ingresosPeriodo);
    if (elGastos) elGastos.textContent = formatoMoneda.format(gastosPeriodo);
    if (elNeto) elNeto.textContent = formatoMoneda.format(ingresosPeriodo - gastosPeriodo);

    if (elHistorial) {
        if (movimientosFiltrados.length === 0) {
            elHistorial.innerHTML = '<p class="text-sm text-on-surface-variant/50 text-center py-8">No hay transacciones registradas en este periodo.</p>';
        } else {
            elHistorial.innerHTML = '';
            movimientosFiltrados.forEach(mov => {
                const item = document.createElement('div');
                item.className = 'p-4 rounded-xl bg-[#121212] border border-white/5 flex items-center justify-between gap-4';
                const esIngreso = mov.tipo === 'ingreso';

                item.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl ${esIngreso ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined">${esIngreso ? 'arrow_upward' : 'arrow_downward'}</span>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-white">${escaparHTML(mov.concepto)}</h4>
                            <p class="text-xs text-on-surface-variant/60">${escaparHTML(mov.categoria)} • ${escaparHTML(mov.fecha)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-sm font-black ${esIngreso ? 'text-emerald-400' : 'text-red-400'}">
                            ${esIngreso ? '+' : '-'}${formatoMoneda.format(mov.monto)}
                        </span>
                        <button onclick="eliminarMovimiento('${mov.id}')" class="text-on-surface-variant/40 hover:text-red-400 transition">
                            <span class="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                `;
                elHistorial.appendChild(item);
            });
        }
    }

    renderizarGrafico(ingresosPeriodo, gastosPeriodo);
}

function renderizarGrafico(ingresos, gastos) {
    const canvas = document.getElementById('graficoFinanzas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (graficoInstancia) {
        graficoInstancia.destroy();
    }

    const ctx = canvas.getContext('2d');
    graficoInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [ingresos, gastos],
                backgroundColor: ['#10b981', '#ef4444'],
                borderRadius: 8,
                barThickness: 28
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#a3a3a3', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#a3a3a3', font: { size: 10 } }
                }
            }
        }
    });
}

async function eliminarMovimiento(id) {
    const exito = await eliminarRegistroFinanzas(id);
    if (exito) {
        await poblarOpcionesMeses();
        await renderizarFinanzas();
    }
}

// ==========================================
// 3. VISTA: RITUALES Y PROYECTOS (rituales.html)
// ==========================================
function inicializarRituales() {
    const formRituales = document.getElementById('form-rituales');
    const selectTipoAct = document.getElementById('select-tipo-act');
    const camposRitual = document.getElementById('campos-ritual');
    const camposProyecto = document.getElementById('campos-proyecto');
    const inputFechaAct = document.getElementById('input-fecha-act');

    if (!formRituales) return;

    if (inputFechaAct && !inputFechaAct.value) {
        inputFechaAct.value = obtenerFechaHoy();
    }

    selectTipoAct.addEventListener('change', () => {
        if (selectTipoAct.value === 'ritual') {
            camposRitual.classList.remove('hidden');
            camposProyecto.classList.add('hidden');
        } else {
            camposRitual.classList.add('hidden');
            camposProyecto.classList.remove('hidden');
        }
    });

    formRituales.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tipo = selectTipoAct.value;
        const nombre = document.getElementById('input-nombre-act').value.trim();
        const fecha = inputFechaAct.value || obtenerFechaHoy();
        const notas = document.getElementById('input-notas-act').value.trim();

        if (!nombre) return;

        const actividades = await obtenerDatosActividades();
        const nuevaActividad = {
            id: Date.now(),
            tipo,
            nombre,
            fecha,
            notas
        };

        if (tipo === 'ritual') {
            nuevaActividad.duracion = parseInt(document.getElementById('input-duracion').value) || 7;
            nuevaActividad.registroDias = {};
            nuevaActividad.diasCompletados = 0;
        } else {
            nuevaActividad.linkLive = document.getElementById('input-link-live').value.trim();
            nuevaActividad.linkRepo = document.getElementById('input-link-repo').value.trim();
            nuevaActividad.tareas = [];
        }

        actividades.unshift(nuevaActividad);
        const guardado = await guardarDatosActividades(actividades);
        if (!guardado) return;

        formRituales.reset();
        if (inputFechaAct) inputFechaAct.value = obtenerFechaHoy();
        selectTipoAct.dispatchEvent(new Event('change'));
        await renderizarActividades();
    });

    renderizarActividades();
}

async function toggleDiaRitual(id, numeroDia) {
    const actividades = await obtenerDatosActividades();
    const act = actividades.find(a => a.id === id);

    if (act && act.tipo === 'ritual') {
        if (!act.registroDias) act.registroDias = {};

        if (act.registroDias[numeroDia]) {
            const fechaRegistrada = act.registroDias[numeroDia];
            const confirmar = confirm(`El Día ${numeroDia} fue marcado el:\n${fechaRegistrada}\n\n¿Estás seguro de que deseas desmarcar este día?`);

            if (confirmar) {
                delete act.registroDias[numeroDia];
            } else {
                return;
            }
        } else {
            act.registroDias[numeroDia] = new Date().toLocaleString('es-MX', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        }

        act.diasCompletados = Object.keys(act.registroDias).length;

        await guardarDatosActividades(actividades);
        await renderizarActividades();
    }
}

function crearContenidoActividad(act, { interactivo = true } = {}) {
    const esRitual = act.tipo === 'ritual';

    if (esRitual) {
        const duracion = act.duracion || 7;
        const registroDias = act.registroDias || {};
        const completadosCount = Object.keys(registroDias).length;

        let cuadritosHTML = '<div class="grid grid-cols-7 gap-2 mt-3">';
        for (let i = 1; i <= duracion; i++) {
            const estaCompletado = !!registroDias[i];
            const infoHora = estaCompletado ? `Completado el: ${registroDias[i]}` : `Día ${i}`;

            if (interactivo) {
                cuadritosHTML += `
                    <button 
                        onclick="toggleDiaRitual(${act.id}, ${i})" 
                        title="${escaparHTML(infoHora)}"
                        class="h-10 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all duration-200 border ${
                            estaCompletado
                                ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/10 scale-95'
                                : 'bg-[#121212] text-white/50 border-white/10 hover:border-amber-500/50 hover:text-white'
                        }">
                        <span>${i}</span>
                    </button>
                `;
            } else {
                cuadritosHTML += `
                    <div 
                        title="${escaparHTML(infoHora)}"
                        class="h-10 rounded-xl font-bold text-xs flex flex-col items-center justify-center border ${
                            estaCompletado
                                ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/10'
                                : 'bg-[#121212] text-white/20 border-white/5'
                        }">
                        <span>${i}</span>
                    </div>
                `;
            }
        }
        cuadritosHTML += '</div>';

        return `
            <div class="space-y-2">
                <div class="flex justify-between items-center text-xs">
                    <span class="text-white/70 font-medium">Progreso: <b class="text-amber-400">${completadosCount}</b> de <b>${duracion}</b> días</span>
                    <span class="text-[10px] text-amber-300/60 uppercase font-bold tracking-wider">${interactivo ? 'Toca el día para marcar' : 'Rastro del ritual'}</span>
                </div>
                ${cuadritosHTML}
            </div>
        `;
    }

    const totalTareas = act.tareas ? act.tareas.length : 0;
    const completadas = act.tareas ? act.tareas.filter(t => t.completada).length : 0;
    const avance = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0;

    let tareasHTML = (act.tareas || []).map((t, idx) => {
        if (interactivo) {
            return `
                <div class="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-white/5">
                    <label class="flex items-center gap-2 cursor-pointer text-white/80 ${t.completada ? 'line-through text-white/40' : ''}">
                        <input type="checkbox" ${t.completada ? 'checked' : ''} onchange="toggleTarea(${act.id}, ${idx})" class="rounded border-white/20 text-primary focus:ring-0">
                        <span>${escaparHTML(t.texto)}</span>
                    </label>
                    <button onclick="eliminarTarea(${act.id}, ${idx})" class="text-white/30 hover:text-red-400 transition">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            `;
        }

        return `
            <div class="flex items-center gap-2 text-xs py-1.5 border-b border-white/5">
                <span class="material-symbols-outlined text-[14px] ${t.completada ? 'text-emerald-400' : 'text-white/30'}">${t.completada ? 'check_box' : 'check_box_outline_blank'}</span>
                <span class="${t.completada ? 'line-through text-white/40' : 'text-white/80'}">${escaparHTML(t.texto)}</span>
            </div>
        `;
    }).join('');

    const linkLiveSeguro = obtenerEnlaceSeguro(act.linkLive);
    const linkRepoSeguro = obtenerEnlaceSeguro(act.linkRepo);

    return `
        <div class="space-y-3">
            <div class="flex gap-3 text-xs">
                ${linkLiveSeguro ? `<a href="${linkLiveSeguro}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline flex items-center gap-1"><span class="material-symbols-outlined text-sm">open_in_new</span> Ver Live</a>` : ''}
                ${linkRepoSeguro ? `<a href="${linkRepoSeguro}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline flex items-center gap-1"><span class="material-symbols-outlined text-sm">code</span> Repositorio</a>` : ''}
            </div>

            <div class="space-y-1.5">
                <div class="flex justify-between text-xs text-white/70">
                    <span>Tareas (${completadas}/${totalTareas})</span>
                    <span class="font-bold text-amber-400">${avance}%</span>
                </div>
                <div class="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div class="bg-blue-500 h-full transition-all duration-300" style="width: ${avance}%"></div>
                </div>
            </div>

            <div class="space-y-1 pt-1">
                ${tareasHTML}
            </div>

            ${interactivo ? `
                <form onsubmit="agregarTarea(event, ${act.id})" class="flex gap-2 pt-2">
                    <input type="text" placeholder="Nueva tarea..." class="input-tarea flex-1 bg-[#121212] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary">
                    <button type="submit" class="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition">Añadir</button>
                </form>
            ` : ''}
        </div>
    `;
}

async function renderizarActividades() {
    const actividades = await obtenerDatosActividades();
    const elLista = document.getElementById('actividades-lista');
    const elArchivadas = document.getElementById('actividades-archivadas');

    if (!elLista) return;

    if (errorCargaActividades) {
        elLista.innerHTML = `
            <div class="p-8 rounded-2xl bg-[#1e1e1e] border border-white/5 text-center">
                <p class="text-sm text-amber-300">No se pudieron cargar las actividades. Revisa la conexión y los permisos de Supabase.</p>
            </div>`;
        if (elArchivadas) {
            elArchivadas.innerHTML = '<p class="text-sm text-amber-300">No se pudieron cargar las actividades.</p>';
        }
        return;
    }

    const activas = actividades.filter(actividad => !actividadCompletada(actividad));
    const archivadas = actividades.filter(actividad => actividadCompletada(actividad));

    if (activas.length === 0) {
        elLista.innerHTML = `
            <div class="p-8 rounded-2xl bg-[#1e1e1e] border border-white/5 text-center flex flex-col items-center justify-center">
                <span class="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2">auto_awesome</span>
                <p class="text-sm text-on-surface-variant/50">No hay proyectos ni rituales activos registrados.</p>
            </div>`;
    } else {
        elLista.innerHTML = '';

        activas.forEach(act => {
            const tarjeta = document.createElement('div');
            const esRitual = act.tipo === 'ritual';
            tarjeta.className = 'p-6 rounded-2xl bg-[#1e1e1e] border border-white/5 shadow-xl space-y-4';
            tarjeta.innerHTML = `
                <div class="flex items-start justify-between">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${esRitual ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}">
                                ${esRitual ? 'Ritual' : 'Proyecto'}
                            </span>
                            <span class="text-xs text-white/40">${escaparHTML(act.fecha)}</span>
                        </div>
                        <h4 class="text-base font-bold text-white uppercase tracking-wide">${escaparHTML(act.nombre)}</h4>
                        ${act.notas ? `<p class="text-xs text-on-surface-variant/70 mt-1">${escaparHTML(act.notas)}</p>` : ''}
                    </div>
                    <button onclick="eliminarActividad(${act.id})" class="text-on-surface-variant/40 hover:text-red-400 transition">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
                ${crearContenidoActividad(act, { interactivo: true })}
            `;

            elLista.appendChild(tarjeta);
        });
    }

    if (elArchivadas) {
        elArchivadas.innerHTML = archivadas.length === 0
            ? '<p class="text-sm text-white/40">Todavía no hay actividades completadas.</p>'
            : archivadas.map(act => {
                const esRitual = act.tipo === 'ritual';
                return `
                    <details open class="group p-5 rounded-2xl bg-[#161616] border border-white/5 shadow-xl">
                        <summary class="list-none cursor-pointer">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${esRitual ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}">${esRitual ? 'Ritual' : 'Proyecto'}</span>
                                        <span class="text-xs text-white/40">${escaparHTML(act.fecha)}</span>
                                    </div>
                                    <h4 class="text-sm font-bold text-white uppercase tracking-wide">${escaparHTML(act.nombre)}</h4>
                                    ${act.notas ? `<p class="text-xs text-on-surface-variant/70 mt-1 max-w-xl">${escaparHTML(act.notas)}</p>` : ''}
                                </div>
                                <div class="flex items-center gap-2 text-emerald-400 shrink-0">
                                    <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">Completado</span>
                                    <span class="material-symbols-outlined text-lg">task_alt</span>
                                </div>
                            </div>
                        </summary>
                        <div class="mt-4 border-t border-white/5 pt-4">
                            ${crearContenidoActividad(act, { interactivo: false })}
                        </div>
                    </details>
                `;
            }).join('');
    }
}

async function agregarTarea(e, id) {
    e.preventDefault();
    const input = e.target.querySelector('.input-tarea');
    const texto = input.value.trim();
    if (!texto) return;

    const actividades = await obtenerDatosActividades();
    const act = actividades.find(a => a.id === id);
    if (act) {
        if (!act.tareas) act.tareas = [];
        act.tareas.push({ texto, completada: false });
        await guardarDatosActividades(actividades);
        await renderizarActividades();
    }
}

async function toggleTarea(actId, tareaIdx) {
    const actividades = await obtenerDatosActividades();
    const act = actividades.find(a => a.id === actId);
    if (act && act.tareas[tareaIdx]) {
        act.tareas[tareaIdx].completada = !act.tareas[tareaIdx].completada;
        await guardarDatosActividades(actividades);
        await renderizarActividades();
    }
}

async function eliminarTarea(actId, tareaIdx) {
    const actividades = await obtenerDatosActividades();
    const act = actividades.find(a => a.id === actId);
    if (act && act.tareas) {
        act.tareas.splice(tareaIdx, 1);
        await guardarDatosActividades(actividades);
        await renderizarActividades();
    }
}

async function eliminarActividad(id) {
    const eliminado = await eliminarActividadDeSupabase(id);
    if (eliminado) await renderizarActividades();
}

// ==========================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDashboard();
    await inicializarFinanzas();
    inicializarRituales();
});