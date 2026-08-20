// ==========================================
// SANCTUARY JHEV - APP.JS (UNIFICADO CORREGIDO)
// ==========================================

const STORAGE_KEYS = {
    FINANZAS: 'sanctuary_finanzas',
    ACTIVIDADES: 'sanctuary_actividades'
};

const CATEGORIAS = {
    ingreso: [
        'Música / Le Garbo',
        'Desarrollo Web / Freelance',
        'Servicios Técnicos / Mantenimiento',
        'Ventas / Eventos',
        'Otros Ingresos'
    ],
    gasto: [
        'Música / Equipo y Cuerdas',
        'Materiales / Insumos',
        'Hosting / Software / Herramientas',
        'Alimentación / Personal',
        'Hogar / Servicios',
        'Otros Gastos'
    ]
};

const formatoMoneda = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
});

function obtenerFechaHoy() {
    return new Date().toISOString().split('T')[0];
}

// ==========================================
// CONTROL DE DATOS (LOCALSTORAGE)
// ==========================================
function obtenerDatosFinanzas() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.FINANZAS);
        if (data) return JSON.parse(data);
    } catch (e) {
        console.error("Error al leer finanzas:", e);
    }
    return { totalIngresos: 0, totalGastos: 0, totalAcumulado: 0, movimientos: [] };
}

function guardarDatosFinanzas(datos) {
    let ingresos = 0;
    let gastos = 0;

    datos.movimientos.forEach(m => {
        const monto = parseFloat(m.monto) || 0;
        if (m.tipo === 'gasto') gastos += monto;
        else ingresos += monto;
    });

    datos.totalIngresos = ingresos;
    datos.totalGastos = gastos;
    datos.totalAcumulado = ingresos - gastos;

    localStorage.setItem(STORAGE_KEYS.FINANZAS, JSON.stringify(datos));
    return datos;
}

function obtenerDatosActividades() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.ACTIVIDADES);
        if (data) return JSON.parse(data);
    } catch (e) {
        console.error("Error al leer actividades:", e);
    }
    return [];
}

function guardarDatosActividades(actividades) {
    localStorage.setItem(STORAGE_KEYS.ACTIVIDADES, JSON.stringify(actividades));
}

// ==========================================
// FUNCIONES GLOBALES DE INTERACCIÓN DE PROYECTOS/RITUALES
// ==========================================
window.marcarDiaRitual = function(actIndex) {
    const actividades = obtenerDatosActividades();
    if (actividades[actIndex]) {
        actividades[actIndex].diasCompletados = (actividades[actIndex].diasCompletados || 0) + 1;
        guardarDatosActividades(actividades);
        if (typeof window.renderActividades === 'function') window.renderActividades();
    }
};

window.agregarTarea = function(actIndex) {
    const input = document.getElementById(`nueva-tarea-${actIndex}`);
    if (!input || !input.value.trim()) return;

    const actividades = obtenerDatosActividades();
    if (actividades[actIndex]) {
        if (!actividades[actIndex].tareas) actividades[actIndex].tareas = [];
        actividades[actIndex].tareas.push({ texto: input.value.trim(), completada: false });
        guardarDatosActividades(actividades);
        if (typeof window.renderActividades === 'function') window.renderActividades();
    }
};

window.toggleTarea = function(actIndex, tIndex) {
    const actividades = obtenerDatosActividades();
    if (actividades[actIndex] && actividades[actIndex].tareas[tIndex]) {
        actividades[actIndex].tareas[tIndex].completada = !actividades[actIndex].tareas[tIndex].completada;
        guardarDatosActividades(actividades);
        if (typeof window.renderActividades === 'function') window.renderActividades();
    }
};

window.eliminarTarea = function(actIndex, tIndex) {
    const actividades = obtenerDatosActividades();
    if (actividades[actIndex] && actividades[actIndex].tareas) {
        actividades[actIndex].tareas.splice(tIndex, 1);
        guardarDatosActividades(actividades);
        if (typeof window.renderActividades === 'function') window.renderActividades();
    }
};

window.eliminarActividad = function(actIndex) {
    if (confirm('¿Deseas eliminar este registro?')) {
        const actividades = obtenerDatosActividades();
        actividades.splice(actIndex, 1);
        guardarDatosActividades(actividades);
        if (typeof window.renderActividades === 'function') window.renderActividades();
    }
};

// ==========================================
// 1. VISTA: DASHBOARD (index.html)
// ==========================================
function cargarDashboard() {
    const finanzas = obtenerDatosFinanzas();
    const actividades = obtenerDatosActividades();

    const elementosTexto = document.querySelectorAll('div, p, span');
    const tarjetaAcumulado = Array.from(elementosTexto).find(el => el.textContent.includes('ACUMULADO FINANZAS'));
    
    if (tarjetaAcumulado) {
        const contenedorPadre = tarjetaAcumulado.closest('div');
        if (contenedorPadre) {
            const elMonto = Array.from(contenedorPadre.querySelectorAll('*')).find(el => 
                el.textContent.includes('$') || 
                el.classList.contains('text-2xl') || 
                el.classList.contains('text-3xl')
            );
            if (elMonto) {
                elMonto.textContent = formatoMoneda.format(finanzas.totalAcumulado);
            }
        }
    }

    const contenedorResumen = document.querySelector('#resumen-actividades');

    if (contenedorResumen) {
        if (actividades.length === 0) {
            contenedorResumen.innerHTML = `
                <div class="col-span-full p-8 rounded-2xl bg-[#1e1e1e] border border-white/5 text-center flex flex-col items-center justify-center">
                    <span class="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2">event_notes</span>
                    <p class="text-sm text-on-surface-variant/50">No hay proyectos ni rituales registrados en este momento.</p>
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
                avancePorcentaje = act.diasCompletados ? Math.round((act.diasCompletados / act.duracion) * 100) : 0;
            } else {
                const totalTareas = act.tareas ? act.tareas.length : 0;
                const completadas = act.tareas ? act.tareas.filter(t => t.completada).length : 0;
                avancePorcentaje = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0;
            }

            tarjeta.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${esRitual ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}">
                        ${esRitual ? 'Ritual' : 'Proyecto'}
                    </span>
                    <span class="text-[11px] text-white/50">${act.fecha}</span>
                </div>
                <h3 class="text-base font-bold text-white uppercase tracking-wide mt-1">${act.nombre}</h3>
                
                <div class="mt-2">
                    <div class="flex justify-between text-xs text-white/70 mb-1">
                        <span>Progreso</span>
                        <span class="font-bold text-amber-400">${avancePorcentaje}%</span>
                    </div>
                    <div class="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div class="bg-primary h-full transition-all duration-300" style="width: ${avancePorcentaje}%"></div>
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
function cargarVistaFinanzas() {
    const selectTipo = document.getElementById('select-tipo');
    const selectCategoria = document.getElementById('select-categoria');

    function actualizarCategorias() {
        if (!selectTipo || !selectCategoria) return;
        const tipoVal = selectTipo.value === 'ingreso' ? 'ingreso' : 'gasto';
        selectCategoria.innerHTML = '';

        CATEGORIAS[tipoVal].forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            selectCategoria.appendChild(option);
        });
    }

    if (selectTipo) {
        selectTipo.addEventListener('change', actualizarCategorias);
        actualizarCategorias();
    }

    function render() {
        const finanzas = obtenerDatosFinanzas();

        const elIngresos = document.getElementById('monto-ingresos');
        const elGastos = document.getElementById('monto-gastos');
        const elNeto = document.getElementById('monto-neto');

        if (elIngresos) elIngresos.textContent = formatoMoneda.format(finanzas.totalIngresos);
        if (elGastos) elGastos.textContent = formatoMoneda.format(finanzas.totalGastos);
        if (elNeto) elNeto.textContent = formatoMoneda.format(finanzas.totalAcumulado);

        const lista = document.getElementById('historial-movimientos');
        if (lista) {
            lista.innerHTML = '';

            if (finanzas.movimientos.length === 0) {
                lista.innerHTML = '<p class="text-sm text-on-surface-variant/50 text-center py-8">No hay transacciones registradas aún.</p>';
                return;
            }

            finanzas.movimientos.forEach(m => {
                const esGasto = m.tipo === 'gasto';
                const item = document.createElement('div');
                item.className = 'flex justify-between items-center p-3.5 rounded-xl bg-white/5 border border-white/5';
                
                item.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center ${esGasto ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}">
                            <span class="material-symbols-outlined text-sm">${esGasto ? 'arrow_downward' : 'arrow_upward'}</span>
                        </div>
                        <div>
                            <div class="text-sm font-semibold text-white">${m.concepto}</div>
                            <div class="text-[11px] text-white/50">${m.categoria} • ${m.fecha}</div>
                        </div>
                    </div>
                    <div class="font-bold text-sm ${esGasto ? 'text-red-400' : 'text-emerald-400'}">
                        ${esGasto ? '-' : '+'}${formatoMoneda.format(m.monto)}
                    </div>
                `;
                lista.appendChild(item);
            });
        }
    }

    render();

    const form = document.getElementById('form-finanzas');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const inputConcepto = document.getElementById('input-concepto');
            const inputMonto = document.getElementById('input-monto');
            const inputFecha = document.getElementById('input-fecha');

            const conceptoVal = inputConcepto ? inputConcepto.value.trim() : '';
            const montoVal = parseFloat(inputMonto ? inputMonto.value : 0);

            if (!conceptoVal || isNaN(montoVal) || montoVal <= 0) {
                alert('Por favor ingresa un concepto y un monto válido.');
                return;
            }

            const finanzas = obtenerDatosFinanzas();
            finanzas.movimientos.unshift({
                id: Date.now().toString(),
                tipo: selectTipo ? selectTipo.value : 'gasto',
                concepto: conceptoVal,
                monto: montoVal,
                categoria: selectCategoria ? selectCategoria.value : 'General',
                fecha: (inputFecha && inputFecha.value) ? inputFecha.value : obtenerFechaHoy()
            });

            guardarDatosFinanzas(finanzas);

            if (inputConcepto) inputConcepto.value = '';
            if (inputMonto) inputMonto.value = '';

            render();
        });
    }
}

// ==========================================
// 3. VISTA: RITUALES Y PROYECTOS (rituales.html)
// ==========================================
function cargarVistaRituales() {
    const selectTipoAct = document.getElementById('select-tipo-act');
    const camposRitual = document.getElementById('campos-ritual');
    const camposProyecto = document.getElementById('campos-proyecto');

    if (selectTipoAct) {
        selectTipoAct.addEventListener('change', () => {
            const esRitual = selectTipoAct.value === 'ritual';
            if (esRitual) {
                camposRitual.classList.remove('hidden');
                camposProyecto.classList.add('hidden');
            } else {
                camposRitual.classList.add('hidden');
                camposProyecto.classList.remove('hidden');
            }
        });
    }

    window.renderActividades = function() {
        const actividades = obtenerDatosActividades();
        const contenedor = document.getElementById('actividades-lista');

        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (actividades.length === 0) {
            contenedor.innerHTML = '<p class="text-sm text-on-surface-variant/50 text-center py-8">No hay rituales o proyectos registrados.</p>';
            return;
        }

        actividades.forEach((act, actIndex) => {
            const card = document.createElement('div');
            card.className = 'p-6 rounded-2xl bg-[#1e1e1e] border border-white/5 shadow-xl space-y-4';
            const esRitual = act.tipo === 'ritual';

            if (esRitual) {
                const duracion = act.duracion || 7;
                const completados = act.diasCompletados || 0;
                const pct = Math.round((completados / duracion) * 100);

                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
                                Ritual Magia
                            </span>
                            <h4 class="text-lg font-bold text-white mt-2">${act.nombre}</h4>
                            <p class="text-xs text-white/50 mt-0.5">${act.notas || 'Sin especificaciones.'}</p>
                        </div>
                        <span class="text-xs text-white/40">${act.fecha}</span>
                    </div>

                    <div>
                        <div class="flex justify-between text-xs text-white/70 mb-1">
                            <span>Días Completados: ${completados} / ${duracion}</span>
                            <span class="font-bold text-amber-400">${pct}%</span>
                        </div>
                        <div class="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                            <div class="bg-amber-500 h-full transition-all" style="width: ${pct}%"></div>
                        </div>
                    </div>

                    <div class="flex gap-2 pt-2">
                        <button onclick="marcarDiaRitual(${actIndex})" class="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-base">done</span>
                            <span>Marcar Día Cumplido (+1)</span>
                        </button>
                        <button onclick="eliminarActividad(${actIndex})" class="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition ml-auto">
                            Eliminar
                        </button>
                    </div>
                `;
            } else {
                const tareas = act.tareas || [];
                const completadas = tareas.filter(t => t.completada).length;
                const totalTareas = tareas.length;
                const pct = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0;

                let HTMLTareas = '';
                tareas.forEach((t, tIndex) => {
                    HTMLTareas += `
                        <div class="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-xs">
                            <label class="flex items-center gap-2.5 cursor-pointer flex-1">
                                <input type="checkbox" ${t.completada ? 'checked' : ''} onchange="toggleTarea(${actIndex}, ${tIndex})" class="accent-amber-500 w-4 h-4 rounded">
                                <span class="${t.completada ? 'line-through text-white/40' : 'text-white'}">${t.texto}</span>
                            </label>
                            <button onclick="eliminarTarea(${actIndex}, ${tIndex})" class="text-white/30 hover:text-red-400">
                                <span class="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                    `;
                });

                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300">
                                Proyecto
                            </span>
                            <h4 class="text-lg font-bold text-white mt-2">${act.nombre}</h4>
                            <p class="text-xs text-white/50 mt-0.5">${act.notas || 'Sin notas.'}</p>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            ${act.linkLive ? `<a href="${act.linkLive}" target="_blank" class="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1"><span class="material-symbols-outlined text-sm">launch</span> Live</a>` : ''}
                            ${act.linkRepo ? `<a href="${act.linkRepo}" target="_blank" class="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold flex items-center gap-1"><span class="material-symbols-outlined text-sm">code</span> Repo</a>` : ''}
                        </div>
                    </div>

                    <div>
                        <div class="flex justify-between text-xs text-white/70 mb-1">
                            <span>Avance Automático: ${completadas}/${totalTareas} Tareas</span>
                            <span class="font-bold text-blue-400">${pct}%</span>
                        </div>
                        <div class="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                            <div class="bg-blue-500 h-full transition-all duration-300" style="width: ${pct}%"></div>
                        </div>
                    </div>

                    <div class="pt-2 border-t border-white/5">
                        <span class="text-[11px] font-bold uppercase text-white/60 tracking-wider">Tareas Críticas & Especificaciones</span>
                        
                        <div class="space-y-1.5 mt-2 max-h-40 overflow-y-auto">
                            ${HTMLTareas || '<p class="text-xs text-white/30 italic">No hay tareas agregadas aún.</p>'}
                        </div>

                        <div class="flex gap-2 mt-3">
                            <input type="text" id="nueva-tarea-${actIndex}" placeholder="Nueva tarea o hito..." class="flex-1 bg-[#121212] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary">
                            <button type="button" onclick="agregarTarea(${actIndex})" class="px-4 py-1.5 bg-primary/20 hover:bg-primary/30 text-amber-300 border border-primary/30 text-xs font-bold rounded-xl transition">
                                Agregar
                            </button>
                        </div>
                    </div>

                    <div class="flex justify-end pt-2 border-t border-white/5">
                        <button onclick="eliminarActividad(${actIndex})" class="text-xs text-red-400/80 hover:text-red-400 font-semibold">
                            Eliminar Proyecto
                        </button>
                    </div>
                `;
            }

            contenedor.appendChild(card);
        });
    };

    window.renderActividades();

    const form = document.getElementById('form-rituales');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const inputNombre = document.getElementById('input-nombre-act');
            const inputFecha = document.getElementById('input-fecha-act');
            const inputNotas = document.getElementById('input-notas-act');
            const inputDuracion = document.getElementById('input-duracion');
            const inputLinkLive = document.getElementById('input-link-live');
            const inputLinkRepo = document.getElementById('input-link-repo');

            const nombreVal = inputNombre ? inputNombre.value.trim() : '';
            if (!nombreVal) return alert('Por favor ingresa un nombre.');

            const esRitual = selectTipoAct ? selectTipoAct.value === 'ritual' : false;

            const actividades = obtenerDatosActividades();
            const nuevaActividad = {
                id: Date.now().toString(),
                tipo: esRitual ? 'ritual' : 'proyecto',
                nombre: nombreVal,
                fecha: (inputFecha && inputFecha.value) ? inputFecha.value : obtenerFechaHoy(),
                notas: inputNotas ? inputNotas.value.trim() : '',
            };

            if (esRitual) {
                nuevaActividad.duracion = parseInt(inputDuracion ? inputDuracion.value : 7) || 7;
                nuevaActividad.diasCompletados = 0;
            } else {
                nuevaActividad.linkLive = inputLinkLive ? inputLinkLive.value.trim() : '';
                nuevaActividad.linkRepo = inputLinkRepo ? inputLinkRepo.value.trim() : '';
                nuevaActividad.tareas = [];
            }

            actividades.unshift(nuevaActividad);
            guardarDatosActividades(actividades);

            inputNombre.value = '';
            if (inputNotas) inputNotas.value = '';
            if (inputLinkLive) inputLinkLive.value = '';
            if (inputLinkRepo) inputLinkRepo.value = '';

            window.renderActividades();
        });
    }
}

// ==========================================
// DETECCIÓN DE PÁGINA Y EJECUCIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const ruta = window.location.pathname;

    if (ruta.includes('finanzas.html')) {
        cargarVistaFinanzas();
    } else if (ruta.includes('rituales.html')) {
        cargarVistaRituales();
    } else {
        cargarDashboard();
    }
});