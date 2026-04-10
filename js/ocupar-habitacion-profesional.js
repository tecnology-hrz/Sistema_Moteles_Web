// Color Picker Profesional para Ocupar Habitación

// Paleta de colores completa (similar a htmlcolorcodes.com)
const paletaColores = [
    // Blancos y grises
    ['#FFFFFF', '#F5F5F5', '#E8E8E8', '#D3D3D3', '#C0C0C0', '#A9A9A9', '#808080', '#696969', '#505050', '#2F2F2F', '#000000'],
    // Rojos
    ['#FFE5E5', '#FFCCCC', '#FFB3B3', '#FF9999', '#FF8080', '#FF6666', '#FF4D4D', '#FF3333', '#FF1A1A', '#FF0000', '#CC0000'],
    // Naranjas
    ['#FFF0E5', '#FFE0CC', '#FFD1B3', '#FFC299', '#FFB380', '#FFA366', '#FF944D', '#FF8533', '#FF751A', '#FF6600', '#CC5200'],
    // Amarillos
    ['#FFFFCC', '#FFFFB3', '#FFFF99', '#FFFF80', '#FFFF66', '#FFFF4D', '#FFFF33', '#FFFF1A', '#FFFF00', '#E6E600', '#CCCC00'],
    // Verdes claros
    ['#E5FFE5', '#CCFFCC', '#B3FFB3', '#99FF99', '#80FF80', '#66FF66', '#4DFF4D', '#33FF33', '#1AFF1A', '#00FF00', '#00CC00'],
    // Verdes
    ['#E5F5E5', '#CCE6CC', '#B3D9B3', '#99CC99', '#80BF80', '#66B366', '#4DA64D', '#339933', '#1A8C1A', '#008000', '#006600'],
    // Azules claros
    ['#E5F5FF', '#CCE6FF', '#B3D9FF', '#99CCFF', '#80BFFF', '#66B3FF', '#4DA6FF', '#3399FF', '#1A8CFF', '#0080FF', '#0066CC'],
    // Azules
    ['#E5E5FF', '#CCCCFF', '#B3B3FF', '#9999FF', '#8080FF', '#6666FF', '#4D4DFF', '#3333FF', '#1A1AFF', '#0000FF', '#0000CC'],
    // Morados
    ['#F0E5FF', '#E0CCFF', '#D1B3FF', '#C299FF', '#B380FF', '#A366FF', '#944DFF', '#8533FF', '#751AFF', '#6600FF', '#5200CC'],
    // Rosas
    ['#FFE5F0', '#FFCCE0', '#FFB3D1', '#FF99C2', '#FF80B3', '#FF66A3', '#FF4D94', '#FF3385', '#FF1A75', '#FF0066', '#CC0052'],
    // Cafés
    ['#F5E5D9', '#E6CCBF', '#D9B3A6', '#CC998C', '#BF8073', '#B36659', '#A64D40', '#993326', '#8C1A0D', '#800000', '#660000']
];

// Crear el modal de color picker
function crearColorPicker(onColorSelect) {
    const modalHTML = `
        <div class="color-picker-overlay" id="colorPickerOverlay">
            <div class="color-picker-modal">
                <div class="color-picker-header">
                    <h3><i class="fas fa-palette"></i> Seleccionar Color</h3>
                    <button class="color-picker-close" onclick="cerrarColorPicker()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="color-picker-body">
                    <div class="color-picker-custom-section">
                        <button class="btn-custom-color" onclick="seleccionarColorPersonalizado()">
                            <i class="fas fa-keyboard"></i>
                            <span>Escribir color manualmente</span>
                        </button>
                    </div>
                    <div class="color-picker-grid" id="colorPickerGrid">
                        ${generarPaletaHTML()}
                    </div>
                </div>
                <div class="color-picker-footer">
                    <button class="btn-cancel-color" onclick="cerrarColorPicker()">Cancelar</button>
                    <button class="btn-confirm-color" onclick="confirmarColorSeleccionado()">Seleccionar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Guardar callback
    window.colorPickerCallback = onColorSelect;
    
    // Agregar listeners a los colores
    document.querySelectorAll('.color-cell').forEach(cell => {
        cell.addEventListener('click', function() {
            const color = this.dataset.color;
            seleccionarColor(color);
        });
    });
}

function generarPaletaHTML() {
    return paletaColores.map(fila => {
        return `<div class="color-row">${fila.map(color => 
            `<div class="color-cell" data-color="${color}" style="background: ${color};" title="${color}"></div>`
        ).join('')}</div>`;
    }).join('');
}

function seleccionarColor(color) {
    // Marcar como seleccionado
    document.querySelectorAll('.color-cell').forEach(cell => {
        cell.classList.remove('selected');
    });
    document.querySelector(`[data-color="${color}"]`).classList.add('selected');
    
    // Obtener nombre del color
    const nombreColor = obtenerNombreColor(color);
    
    // Guardar selección actual
    window.colorSeleccionado = { hex: color, nombre: nombreColor };
}

function seleccionarColorPersonalizado() {
    cerrarColorPicker();
    
    // Mostrar el campo de "Otro Color"
    const contenedorOtroColor = document.getElementById('contenedorOtroColor');
    if (contenedorOtroColor) {
        contenedorOtroColor.style.display = 'block';
    }
    
    // Enfocar el campo de "Otro Color"
    const campoOtroColor = document.getElementById('colorPersonalizadoMejorado');
    if (campoOtroColor) {
        campoOtroColor.focus();
        
        // Limpiar la selección del color picker
        window.colorVehiculoSeleccionado = null;
        document.getElementById('colorPreviewCircle').style.background = '#FFFFFF';
        document.getElementById('colorSelectedText').textContent = 'Seleccionar color';
    }
}

function manejarCambioOtroColor() {
    const campoOtroColor = document.getElementById('colorPersonalizadoMejorado');
    if (campoOtroColor && campoOtroColor.value.trim() !== '') {
        // Si el usuario escribe algo, limpiar la selección de la paleta
        window.colorVehiculoSeleccionado = null;
        document.getElementById('colorPreviewCircle').style.background = '#FFFFFF';
        document.getElementById('colorSelectedText').textContent = 'Seleccionar color';
    }
}

function obtenerNombreColor(hex) {
    const hexUpper = hex.toUpperCase();
    
    const coloresNombres = {
        // Blancos y grises
        '#FFFFFF': 'Blanco', '#F5F5F5': 'Blanco', '#E8E8E8': 'Gris Claro',
        '#D3D3D3': 'Gris Claro', '#C0C0C0': 'Gris', '#A9A9A9': 'Gris',
        '#808080': 'Gris', '#696969': 'Gris Oscuro', '#505050': 'Gris Oscuro',
        '#2F2F2F': 'Gris Oscuro', '#000000': 'Negro',
        
        // Rojos
        '#FFE5E5': 'Rojo Claro', '#FFCCCC': 'Rojo Claro', '#FFB3B3': 'Rojo Claro',
        '#FF9999': 'Rojo Claro', '#FF8080': 'Rojo', '#FF6666': 'Rojo',
        '#FF4D4D': 'Rojo', '#FF3333': 'Rojo', '#FF1A1A': 'Rojo',
        '#FF0000': 'Rojo', '#CC0000': 'Rojo Oscuro',
        
        // Naranjas
        '#FFF0E5': 'Naranja Claro', '#FFE0CC': 'Naranja Claro', '#FFD1B3': 'Naranja Claro',
        '#FFC299': 'Naranja Claro', '#FFB380': 'Naranja', '#FFA366': 'Naranja',
        '#FF944D': 'Naranja', '#FF8533': 'Naranja', '#FF751A': 'Naranja',
        '#FF6600': 'Naranja', '#CC5200': 'Naranja Oscuro',
        
        // Amarillos
        '#FFFFCC': 'Amarillo Claro', '#FFFFB3': 'Amarillo Claro', '#FFFF99': 'Amarillo Claro',
        '#FFFF80': 'Amarillo', '#FFFF66': 'Amarillo', '#FFFF4D': 'Amarillo',
        '#FFFF33': 'Amarillo', '#FFFF1A': 'Amarillo', '#FFFF00': 'Amarillo',
        '#E6E600': 'Amarillo Oscuro', '#CCCC00': 'Amarillo Oscuro',
        
        // Verdes claros
        '#E5FFE5': 'Verde Claro', '#CCFFCC': 'Verde Claro', '#B3FFB3': 'Verde Claro',
        '#99FF99': 'Verde Claro', '#80FF80': 'Verde Claro', '#66FF66': 'Verde',
        '#4DFF4D': 'Verde', '#33FF33': 'Verde', '#1AFF1A': 'Verde',
        '#00FF00': 'Verde', '#00CC00': 'Verde Oscuro',
        
        // Verdes
        '#E5F5E5': 'Verde Claro', '#CCE6CC': 'Verde Claro', '#B3D9B3': 'Verde Claro',
        '#99CC99': 'Verde', '#80BF80': 'Verde', '#66B366': 'Verde',
        '#4DA64D': 'Verde', '#339933': 'Verde', '#1A8C1A': 'Verde Oscuro',
        '#008000': 'Verde Oscuro', '#006600': 'Verde Oscuro',
        
        // Azules claros
        '#E5F5FF': 'Azul Claro', '#CCE6FF': 'Azul Claro', '#B3D9FF': 'Azul Claro',
        '#99CCFF': 'Azul Claro', '#80BFFF': 'Azul Claro', '#66B3FF': 'Azul',
        '#4DA6FF': 'Azul', '#3399FF': 'Azul', '#1A8CFF': 'Azul',
        '#0080FF': 'Azul', '#0066CC': 'Azul Oscuro',
        
        // Azules
        '#E5E5FF': 'Azul Claro', '#CCCCFF': 'Azul Claro', '#B3B3FF': 'Azul Claro',
        '#9999FF': 'Azul', '#8080FF': 'Azul', '#6666FF': 'Azul',
        '#4D4DFF': 'Azul', '#3333FF': 'Azul', '#1A1AFF': 'Azul Oscuro',
        '#0000FF': 'Azul Oscuro', '#0000CC': 'Azul Oscuro',
        
        // Morados
        '#F0E5FF': 'Morado Claro', '#E0CCFF': 'Morado Claro', '#D1B3FF': 'Morado Claro',
        '#C299FF': 'Morado', '#B380FF': 'Morado', '#A366FF': 'Morado',
        '#944DFF': 'Morado', '#8533FF': 'Morado', '#751AFF': 'Morado',
        '#6600FF': 'Morado Oscuro', '#5200CC': 'Morado Oscuro',
        
        // Rosas
        '#FFE5F0': 'Rosa Claro', '#FFCCE0': 'Rosa Claro', '#FFB3D1': 'Rosa Claro',
        '#FF99C2': 'Rosa', '#FF80B3': 'Rosa', '#FF66A3': 'Rosa',
        '#FF4D94': 'Rosa', '#FF3385': 'Rosa', '#FF1A75': 'Rosa',
        '#FF0066': 'Rosa Oscuro', '#CC0052': 'Rosa Oscuro',
        
        // Cafés
        '#F5E5D9': 'Café Claro', '#E6CCBF': 'Café Claro', '#D9B3A6': 'Café Claro',
        '#CC998C': 'Café', '#BF8073': 'Café', '#B36659': 'Café',
        '#A64D40': 'Café', '#993326': 'Café', '#8C1A0D': 'Café Oscuro',
        '#800000': 'Café Oscuro', '#660000': 'Café Oscuro'
    };
    
    return coloresNombres[hexUpper] || hexUpper;
}

function cerrarColorPicker() {
    const modal = document.getElementById('colorPickerOverlay');
    if (modal) modal.remove();
    window.colorPickerCallback = null;
    window.colorSeleccionado = null;
}

function confirmarColorSeleccionado() {
    if (window.colorSeleccionado && window.colorPickerCallback) {
        window.colorPickerCallback(window.colorSeleccionado);
    }
    cerrarColorPicker();
}

// Modal mejorado para ocupar habitación
function abrirModalOcuparMejorado(habitacion, esReserva) {
    // Guardar datos de habitación globalmente
    window.habitacionActual = habitacion;
    window.modoReserva = !!esReserva;
    
    const tituloModal = esReserva ? 'Reservar Habitación' : 'Ocupar Habitación';
    const iconoModal = esReserva ? 'fa-calendar-check' : 'fa-user';
    const textoBoton = esReserva ? 'Reservar' : 'Ocupar';
    
    const camposReserva = esReserva ? `
                        <div class="form-row-ocupar">
                            <div class="form-group-ocupar form-group-half">
                                <label><i class="fas fa-calendar-day"></i> Fecha de llegada</label>
                                <input type="date" id="fechaReserva" class="select-estancia" required onclick="this.showPicker()" style="cursor:pointer;">
                            </div>
                            <div class="form-group-ocupar form-group-half">
                                <label><i class="fas fa-clock"></i> Hora de llegada</label>
                                <button type="button" class="color-selector-btn" id="btnEscogerHora" onclick="abrirSelectorHora()">
                                    <i class="fas fa-clock" style="color:#856404"></i>
                                    <span id="horaSeleccionadaTexto">Escoger hora</span>
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>
    ` : '';
    
    const modalHTML = `
        <div class="modal-overlay-ocupar" id="ocuparModalMejorado">
            <div class="modal-ocupar-container">
                <div class="modal-ocupar-header">
                    <h2>
                        <i class="fas ${iconoModal}"></i>
                        <span>${tituloModal}</span>
                        <span class="habitacion-numero">${habitacion.nombre}</span>
                    </h2>
                </div>
                
                <div class="modal-ocupar-body">
                    <form id="formOcuparMejorado">
                        <!-- Fila 1: Tipo de Vehículo (toda la fila) -->
                        <div class="form-row-ocupar">
                            <div class="form-group-ocupar">
                                <label><i class="fas fa-car"></i> Tipo de Vehículo</label>
                                <div class="tipo-vehiculo-selector">
                                    <button type="button" class="tipo-vehiculo-btn active" data-tipo="carro" onclick="seleccionarTipoVehiculo('carro')">
                                        <i class="fas fa-car"></i>
                                        <span>Carro</span>
                                    </button>
                                    <button type="button" class="tipo-vehiculo-btn" data-tipo="moto" onclick="seleccionarTipoVehiculo('moto')">
                                        <i class="fas fa-motorcycle"></i>
                                        <span>Moto</span>
                                    </button>
                                    <button type="button" class="tipo-vehiculo-btn" data-tipo="taxi" onclick="seleccionarTipoVehiculo('taxi')">
                                        <i class="fas fa-taxi"></i>
                                        <span>Taxi</span>
                                    </button>
                                    <button type="button" class="tipo-vehiculo-btn" data-tipo="otro" onclick="seleccionarTipoVehiculo('otro')">
                                        <i class="fas fa-question"></i>
                                        <span>Otro</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Fila 2: Color del Vehículo y Tiempo de Estancia -->
                        <div class="form-row-ocupar" id="contenedorColor">
                            <div class="form-group-ocupar form-group-half">
                                <label><i class="fas fa-palette"></i> Color del Vehículo</label>
                                <button type="button" class="color-selector-btn" id="colorSelectorBtn" onclick="abrirSelectorColor()">
                                    <div class="color-preview-circle" id="colorPreviewCircle" style="background: #FFFFFF;"></div>
                                    <span id="colorSelectedText">Seleccionar color</span>
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Fila 2b: Tiempo de Estancia (siempre visible) -->
                        <div class="form-row-ocupar">
                            <div class="form-group-ocupar">
                                <label><i class="fas fa-clock"></i> Tiempo de Estancia</label>
                                <select id="tiempoEstanciaSelect" onchange="cambiarTiempoEstancia()" class="select-estancia" size="1">
                                    <option value="estandar">Estándar (${habitacion.horas_base || 4}h) - ${formatearPrecioTarjeta(habitacion.precio_horas || 0)}</option>
                                    <option value="noche">Noche (12h) - ${formatearPrecioTarjeta(habitacion.precio_noche || 0)}</option>
                                    <option value="dia">Día (24h) - ${formatearPrecioTarjeta(habitacion.precio_dia || 0)}</option>
                                    <option value="varios_dias">Varios Días</option>
                                    <option value="personalizado">Precio Personalizado</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Opciones para varios días (oculto por defecto) -->
                        <div id="opcionesVariosDias" style="display: none;">
                            <div class="form-row-ocupar">
                                <div class="form-group-ocupar form-group-half">
                                    <label><i class="fas fa-calendar-alt"></i> Cantidad de Días</label>
                                    <input type="number" id="numeroDias" min="2" value="2" placeholder="Ej: 3" oninput="calcularPrecioVariosDias()">
                                </div>
                                <div class="form-group-ocupar form-group-half">
                                    <label><i class="fas fa-calculator"></i> Cálculo de Precio</label>
                                    <select id="tipoPrecioVariosDias" onchange="calcularPrecioVariosDias()" class="select-estancia">
                                        <option value="automatico">Automático</option>
                                        <option value="personalizado">Personalizado</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group-ocupar">
                                <label><i class="fas fa-dollar-sign"></i> Precio Total</label>
                                <input type="text" id="precioTotalVariosDias" placeholder="0" oninput="formatearPrecioInput(this)" class="input-precio-total">
                                <small id="detalleCalculo" style="color: #666; margin-top: 5px; display: block;"></small>
                            </div>
                        </div>
                        
                        <!-- Opciones para precio personalizado (oculto por defecto) -->
                        <div id="opcionesPersonalizado" style="display: none;">
                            <div class="form-row-ocupar">
                                <div class="form-group-ocupar form-group-half">
                                    <label><i class="fas fa-clock"></i> Tipo de Tiempo</label>
                                    <select id="tipoTiempoPersonalizado" onchange="actualizarCampoTiempo()" class="select-estancia">
                                        <option value="horas">Horas</option>
                                        <option value="dias">Días</option>
                                    </select>
                                </div>
                                <div class="form-group-ocupar form-group-half">
                                    <label><i class="fas fa-hourglass-half"></i> Cantidad</label>
                                    <input type="number" id="cantidadTiempoPersonalizado" min="1" value="4" placeholder="Ej: 4">
                                </div>
                            </div>
                            <div class="form-row-ocupar">
                                <div class="form-group-ocupar form-group-half">
                                    <label><i class="fas fa-tag"></i> Tipo Base</label>
                                    <select id="tipoBasePersonalizado" onchange="actualizarPrecioSugerido()" class="select-estancia">
                                        <option value="estandar">Estándar (${habitacion.horas_base || 4}h) - ${formatearPrecioTarjeta(habitacion.precio_horas || 0)}</option>
                                        <option value="noche">Noche (12h) - ${formatearPrecioTarjeta(habitacion.precio_noche || 0)}</option>
                                        <option value="dia">Día (24h) - ${formatearPrecioTarjeta(habitacion.precio_dia || 0)}</option>
                                    </select>
                                </div>
                                <div class="form-group-ocupar form-group-half">
                                    <label><i class="fas fa-dollar-sign"></i> Precio Acordado</label>
                                    <input type="text" id="precioPersonalizado" placeholder="0" oninput="formatearPrecioInput(this)" class="input-precio-total">
                                </div>
                            </div>
                            <div class="form-group-ocupar">
                                <small id="precioSugerido" style="color: #666; margin-top: 5px; display: block;"></small>
                            </div>
                        </div>
                        
                        <!-- Fila 3: Placa y Otro Color -->
                        <div class="form-row-ocupar">
                            <div class="form-group-ocupar form-group-half" id="contenedorPlaca">
                                <label><i class="fas fa-id-card"></i> Placa del Vehículo</label>
                                <input type="text" id="placaVehiculoMejorado" placeholder="EJ: ABC123" maxlength="10" style="text-transform: uppercase;" oninput="this.value = this.value.toUpperCase()">
                            </div>
                            
                            <div class="form-group-ocupar form-group-half" id="contenedorOtroColor" style="display: none;">
                                <label><i class="fas fa-edit"></i> Otro Color</label>
                                <input type="text" id="colorPersonalizadoMejorado" placeholder="Escribe otro color" oninput="manejarCambioOtroColor()">
                            </div>
                        </div>
                        
                        <!-- Fila 3: Descripción -->
                        ${camposReserva}
                        <div class="form-group-ocupar">
                            <label><i class="fas fa-comment-alt"></i> Descripción (Opcional)</label>
                            <textarea id="descripcionOcupacionMejorado" rows="2" placeholder="Detalles adicionales, observaciones..."></textarea>
                        </div>
                    </form>
                </div>
                
                <div class="modal-ocupar-footer">
                    <button class="btn-ocupar-cancelar" onclick="cerrarModalOcuparMejorado()">Cancelar</button>
                    <button class="btn-ocupar-confirmar" onclick="confirmarOcupacionMejorada('${habitacion._id}')">
                        <i class="fas fa-check"></i> ${textoBoton}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Inicializar valores por defecto
    window.tipoVehiculoSeleccionado = 'carro';
    window.colorVehiculoSeleccionado = null;
}

function cambiarTiempoEstancia() {
    const select = document.getElementById('tiempoEstanciaSelect');
    const opcionesVariosDias = document.getElementById('opcionesVariosDias');
    const opcionesPersonalizado = document.getElementById('opcionesPersonalizado');
    
    // Ocultar todas las opciones primero
    opcionesVariosDias.style.display = 'none';
    opcionesPersonalizado.style.display = 'none';
    
    if (select.value === 'varios_dias') {
        opcionesVariosDias.style.display = 'block';
        calcularPrecioVariosDias();
    } else if (select.value === 'personalizado') {
        opcionesPersonalizado.style.display = 'block';
        actualizarPrecioSugerido();
    }
}

function calcularPrecioVariosDias() {
    const numeroDias = parseInt(document.getElementById('numeroDias').value) || 2;
    const tipoPrecio = document.getElementById('tipoPrecioVariosDias').value;
    const inputPrecio = document.getElementById('precioTotalVariosDias');
    const detalleCalculo = document.getElementById('detalleCalculo');
    
    if (tipoPrecio === 'automatico') {
        const precioDia = window.habitacionActual.precio_dia || 0;
        const precioTotal = precioDia * numeroDias;
        inputPrecio.value = formatearNumero(precioTotal);
        inputPrecio.readOnly = true;
        inputPrecio.style.background = '#f5f5f5';
        detalleCalculo.textContent = `${formatearPrecioTarjeta(precioDia)} x ${numeroDias} día${numeroDias > 1 ? 's' : ''} = ${formatearPrecioTarjeta(precioTotal)}`;
    } else {
        inputPrecio.readOnly = false;
        inputPrecio.style.background = '#fff';
        detalleCalculo.textContent = 'Ingresa el precio total acordado';
    }
}

function formatearPrecioInput(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor === '') {
        input.value = '';
        return;
    }
    let numero = parseInt(valor);
    input.value = numero.toLocaleString('en-US');
}

function actualizarCampoTiempo() {
    const tipoTiempo = document.getElementById('tipoTiempoPersonalizado').value;
    const cantidadInput = document.getElementById('cantidadTiempoPersonalizado');
    
    if (tipoTiempo === 'horas') {
        cantidadInput.min = 1;
        cantidadInput.value = 4;
        cantidadInput.placeholder = 'Ej: 4';
    } else {
        cantidadInput.min = 1;
        cantidadInput.value = 1;
        cantidadInput.placeholder = 'Ej: 1';
    }
}

function actualizarPrecioSugerido() {
    const habitacion = window.habitacionActual;
    const tipoBase = document.getElementById('tipoBasePersonalizado').value;
    const precioSugeridoElement = document.getElementById('precioSugerido');
    
    let precioBase = 0;
    let descripcionBase = '';
    
    if (tipoBase === 'estandar') {
        precioBase = habitacion.precio_horas || 0;
        descripcionBase = `Estándar (${habitacion.horas_base || 4}h)`;
    } else if (tipoBase === 'noche') {
        precioBase = habitacion.precio_noche || 0;
        descripcionBase = 'Noche (12h)';
    } else if (tipoBase === 'dia') {
        precioBase = habitacion.precio_dia || 0;
        descripcionBase = 'Día (24h)';
    }
    
    precioSugeridoElement.innerHTML = `<i class="fas fa-info-circle"></i> Precio base ${descripcionBase}: ${formatearPrecioTarjeta(precioBase)}. Puedes ajustar el precio según el acuerdo con el cliente.`;
}

function seleccionarTipoVehiculo(tipo) {
    window.tipoVehiculoSeleccionado = tipo;
    
    document.querySelectorAll('.tipo-vehiculo-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelector(`[data-tipo="${tipo}"]`).classList.add('active');
    
    // Mostrar u ocultar el campo de placa según el tipo de vehículo
    const contenedorPlaca = document.getElementById('contenedorPlaca');
    const inputPlaca = document.getElementById('placaVehiculoMejorado');
    
    // Mostrar u ocultar el campo de color según el tipo de vehículo
    const contenedorColor = document.getElementById('contenedorColor');
    const contenedorOtroColor = document.getElementById('contenedorOtroColor');
    
    if (tipo === 'taxi' || tipo === 'otro') {
        // Ocultar campo de placa y color para taxi y otro
        if (contenedorPlaca) {
            contenedorPlaca.style.display = 'none';
            inputPlaca.value = '';
            inputPlaca.removeAttribute('required');
        }
        
        contenedorColor.style.display = 'none';
        if (contenedorOtroColor) {
            contenedorOtroColor.style.display = 'none';
        }
        
        // Limpiar selección de color
        window.colorVehiculoSeleccionado = null;
        document.getElementById('colorPreviewCircle').style.background = '#FFFFFF';
        document.getElementById('colorSelectedText').textContent = 'Seleccionar color';
        if (document.getElementById('colorPersonalizadoMejorado')) {
            document.getElementById('colorPersonalizadoMejorado').value = '';
        }
    } else {
        // Mostrar campo de placa y color para carro y moto
        if (contenedorPlaca) {
            contenedorPlaca.style.display = 'block';
            inputPlaca.setAttribute('required', 'required');
        }
        
        contenedorColor.style.display = 'flex';
    }
}

function abrirSelectorColor() {
    crearColorPicker((colorData) => {
        window.colorVehiculoSeleccionado = colorData;
        
        // Actualizar UI
        document.getElementById('colorPreviewCircle').style.background = colorData.hex;
        document.getElementById('colorSelectedText').textContent = colorData.nombre;
        document.getElementById('colorPersonalizadoMejorado').value = '';
        
        // Ocultar el campo "Otro Color" porque ya se seleccionó un color de la paleta
        document.getElementById('contenedorOtroColor').style.display = 'none';
    });
}

function cerrarModalOcuparMejorado() {
    const modal = document.getElementById('ocuparModalMejorado');
    if (modal) modal.remove();
    const tp = document.getElementById('timepickerOverlay');
    if (tp) tp.remove();
}

// ── Selector de hora tipo reloj ──
window._horaReservaSeleccionada = null;

function abrirSelectorHora() {
    const existente = document.getElementById('timepickerOverlay');
    if (existente) existente.remove();

    let h = 12, m = 0, ampm = 'PM';
    if (window._horaReservaSeleccionada) {
        h = window._horaReservaSeleccionada.h;
        m = window._horaReservaSeleccionada.m;
        ampm = window._horaReservaSeleccionada.ampm;
    }

    const horasOpts = Array.from({length:12}, (_,i) => i+1).map(v =>
        `<option value="${v}" ${v===h?'selected':''}>${String(v).padStart(2,'0')}</option>`
    ).join('');
    const minsOpts = Array.from({length:60}, (_,i) => i).map(v =>
        `<option value="${v}" ${v===m?'selected':''}>${String(v).padStart(2,'0')}</option>`
    ).join('');

    const ov = document.createElement('div');
    ov.id = 'timepickerOverlay';
    ov.className = 'color-picker-overlay';
    ov.innerHTML = `
        <div class="color-picker-modal" style="max-width:320px;">
            <div class="color-picker-header">
                <h3><i class="fas fa-clock"></i> Escoger hora</h3>
                <button class="color-picker-close" onclick="cerrarTimePicker()"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding:24px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:28px;font-weight:700;">
                <select id="tpHora" style="font-size:28px;font-weight:700;border:2px solid #000;border-radius:10px;padding:8px 4px;text-align:center;width:70px;appearance:none;-webkit-appearance:none;background:#fff;">${horasOpts}</select>
                <span>:</span>
                <select id="tpMinuto" style="font-size:28px;font-weight:700;border:2px solid #000;border-radius:10px;padding:8px 4px;text-align:center;width:70px;appearance:none;-webkit-appearance:none;background:#fff;">${minsOpts}</select>
                <div style="display:flex;flex-direction:column;gap:4px;margin-left:8px;">
                    <button type="button" id="tpAM" class="tp-ampm-btn ${ampm==='AM'?'tp-ampm-activo':''}" onclick="selTpAmPm('AM')">AM</button>
                    <button type="button" id="tpPM" class="tp-ampm-btn ${ampm==='PM'?'tp-ampm-activo':''}" onclick="selTpAmPm('PM')">PM</button>
                </div>
            </div>
            <div class="color-picker-footer">
                <button class="btn-cancel-color" onclick="cerrarTimePicker()">Cancelar</button>
                <button class="btn-confirm-color" onclick="confirmarTimePicker()">Aceptar</button>
            </div>
        </div>
    `;
    document.body.appendChild(ov);
}

function selTpAmPm(val) {
    document.getElementById('tpAM').classList.toggle('tp-ampm-activo', val==='AM');
    document.getElementById('tpPM').classList.toggle('tp-ampm-activo', val==='PM');
}

function cerrarTimePicker() {
    const ov = document.getElementById('timepickerOverlay');
    if (ov) ov.remove();
}

function confirmarTimePicker() {
    const h = parseInt(document.getElementById('tpHora').value);
    const m = parseInt(document.getElementById('tpMinuto').value);
    const ampm = document.getElementById('tpAM').classList.contains('tp-ampm-activo') ? 'AM' : 'PM';
    window._horaReservaSeleccionada = { h, m, ampm };
    const txt = document.getElementById('horaSeleccionadaTexto');
    if (txt) txt.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
    cerrarTimePicker();
}

async function confirmarOcupacionMejorada(habitacionId) {
    const placa = document.getElementById('placaVehiculoMejorado').value.trim().toUpperCase();
    const colorPersonalizado = document.getElementById('colorPersonalizadoMejorado').value.trim();
    const descripcion = document.getElementById('descripcionOcupacionMejorado').value.trim();
    
    // Determinar el color final y el código hexadecimal
    let colorFinal, colorHex;
    
    if (colorPersonalizado) {
        colorFinal = colorPersonalizado;
        colorHex = null;
    } else if (window.colorVehiculoSeleccionado) {
        colorFinal = window.colorVehiculoSeleccionado.nombre;
        colorHex = window.colorVehiculoSeleccionado.hex;
    } else {
        colorFinal = '';
        colorHex = null;
    }
    
    // Validar placa solo si el tipo de vehículo no es taxi ni otro
    if ((window.tipoVehiculoSeleccionado !== 'taxi' && window.tipoVehiculoSeleccionado !== 'otro') && !placa) {
        mostrarModalConfirmacion('Por favor ingresa la placa del vehículo', null, true);
        return;
    }
    
    // Validar color solo si el tipo de vehículo no es taxi ni otro
    if ((window.tipoVehiculoSeleccionado !== 'taxi' && window.tipoVehiculoSeleccionado !== 'otro') && !colorFinal) {
        mostrarModalConfirmacion('Por favor selecciona o escribe el color del vehículo', null, true);
        return;
    }
    
    // Obtener tipo de estancia seleccionado
    const tiempoEstancia = document.getElementById('tiempoEstanciaSelect').value;
    const habitacion = window.habitacionActual;
    
    let tipoOcupacion, precioFinal, duracionFinal, diasPersonalizados = null;
    
    if (tiempoEstancia === 'estandar') {
        tipoOcupacion = 'horas';
        precioFinal = habitacion.precio_horas || 0;
        duracionFinal = habitacion.horas_base || 4;
    } else if (tiempoEstancia === 'noche') {
        tipoOcupacion = 'noche';
        precioFinal = habitacion.precio_noche || 0;
        duracionFinal = 12;
    } else if (tiempoEstancia === 'dia') {
        tipoOcupacion = 'dia';
        precioFinal = habitacion.precio_dia || 0;
        duracionFinal = 24;
    } else if (tiempoEstancia === 'varios_dias') {
        const numeroDias = parseInt(document.getElementById('numeroDias').value);
        const precioInput = document.getElementById('precioTotalVariosDias').value;
        
        if (!numeroDias || numeroDias < 2) {
            mostrarModalConfirmacion('Por favor ingresa un número de días válido (mínimo 2)', null, true);
            return;
        }
        
        if (!precioInput) {
            mostrarModalConfirmacion('Por favor ingresa el precio total', null, true);
            return;
        }
        
        tipoOcupacion = 'varios_dias';
        diasPersonalizados = numeroDias;
        precioFinal = parseInt(precioInput.replace(/,/g, ''));
        duracionFinal = numeroDias * 24;
    } else if (tiempoEstancia === 'personalizado') {
        const tipoTiempo = document.getElementById('tipoTiempoPersonalizado').value;
        const cantidad = parseInt(document.getElementById('cantidadTiempoPersonalizado').value);
        const tipoBase = document.getElementById('tipoBasePersonalizado').value;
        const precioInput = document.getElementById('precioPersonalizado').value;
        
        if (!cantidad || cantidad < 1) {
            mostrarModalConfirmacion('Por favor ingresa una cantidad válida', null, true);
            return;
        }
        
        if (!precioInput) {
            mostrarModalConfirmacion('Por favor ingresa el precio acordado', null, true);
            return;
        }
        
        // Determinar el tipo de ocupación basado en el tipo base seleccionado
        tipoOcupacion = 'personalizado_' + tipoBase;
        precioFinal = parseInt(precioInput.replace(/,/g, ''));
        
        // Calcular duración en horas
        if (tipoTiempo === 'horas') {
            duracionFinal = cantidad;
        } else {
            duracionFinal = cantidad * 24;
        }
        
        // Guardar información adicional para el registro
        diasPersonalizados = tipoTiempo === 'dias' ? cantidad : null;
    }
    
    try {
        let resultado;
        if (window.modoReserva) {
            const fechaReserva = document.getElementById('fechaReserva') ? document.getElementById('fechaReserva').value : '';
            if (!fechaReserva) {
                mostrarModalConfirmacion('Por favor selecciona la fecha de llegada', null, true);
                return;
            }
            if (!window._horaReservaSeleccionada) {
                mostrarModalConfirmacion('Por favor escoge la hora de llegada', null, true);
                return;
            }
            const hs = window._horaReservaSeleccionada;
            let hora24 = hs.h;
            if (hs.ampm === 'PM' && hora24 < 12) hora24 += 12;
            if (hs.ampm === 'AM' && hora24 === 12) hora24 = 0;
            const horaReserva = `${String(hora24).padStart(2,'0')}:${String(hs.m).padStart(2,'0')}`;

            resultado = await pywebview.api.reservar_habitacion(habitacionId, {
                tipo_vehiculo: window.tipoVehiculoSeleccionado,
                placa: placa || 'N/A',
                color: colorFinal || 'N/A',
                color_vehiculo: colorHex || colorFinal || 'N/A',
                descripcion: descripcion,
                tipo_ocupacion: tipoOcupacion,
                precio_acordado: precioFinal,
                duracion_horas: duracionFinal,
                dias_personalizados: diasPersonalizados,
                fecha_reserva: fechaReserva,
                hora_reserva: horaReserva
            });
        } else {
            resultado = await pywebview.api.ocupar_habitacion(habitacionId, {
                tipo_vehiculo: window.tipoVehiculoSeleccionado,
                placa: placa || 'N/A',
                color: colorFinal || 'N/A',
                color_vehiculo: colorHex || colorFinal || 'N/A',
                descripcion: descripcion,
                tipo_ocupacion: tipoOcupacion,
                precio_acordado: precioFinal,
                duracion_horas: duracionFinal,
                dias_personalizados: diasPersonalizados
            });
        }
        
        if (resultado.success) {
            cerrarModalOcuparMejorado();
            mostrarModalConfirmacion(resultado.message, null, true);
            
            const sedeFiltro = document.getElementById('sedeFilter').value;
            if (sedeFiltro) {
                await cargarHabitaciones();
            } else {
                await cargarTodasHabitaciones();
            }
        } else {
            mostrarModalConfirmacion(resultado.message, null, true);
        }
    } catch (error) {
        console.error('Error al ocupar habitación:', error);
        mostrarModalConfirmacion('Error al ocupar la habitación', null, true);
    }
}
