let todosLosUsuarios = [];
let todasLasSedes = [];
let filtroActual = 'todos';

// Esperar a que pywebview esté listo
function esperarPywebview() {
    return new Promise((resolve) => {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            resolve();
        } else {
            window.addEventListener('pywebviewready', () => {
                resolve();
            });
        }
    });
}

// Cargar usuarios al iniciar
window.addEventListener('DOMContentLoaded', async () => {
    await esperarPywebview();
    
    try {
        const sesion = await pywebview.api.cargar_sesion();
        if (sesion) {
            const userRoleEl = document.querySelector('.user-role');
            if (userRoleEl) userRoleEl.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
            localStorage.setItem('sesionActiva', JSON.stringify(sesion));
            
            if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_usuarios) {
                window.location.href = 'dasboard-admin.html';
                return;
            }
            
            if (typeof inicializarPermisos === 'function') inicializarPermisos();
            
            if (!tienePermiso('crear_usuarios')) {
                document.querySelectorAll('[onclick*="abrirModalNuevoUsuario"]').forEach(function(el) { el.style.display = 'none'; });
            }
            
            // Ocultar filtro de sedes para empleados
            if (sesion.rol !== 'admin') {
                var sedeFilter = document.getElementById('sedeFilter');
                if (sedeFilter) {
                    var sedeContainer = sedeFilter.closest('.sede-filter') || sedeFilter.parentElement;
                    if (sedeContainer) sedeContainer.style.display = 'none';
                }
            }
        }
    } catch (e) { console.error(e); }
    
    await cargarSedes();
    cargarUsuarios();
});

async function cargarSedes() {
    try {
        const resultado = await pywebview.api.obtener_sedes();
        const sedes = resultado.sedes || [];
        todasLasSedes = sedes;
        
        // Llenar el selector de sedes
        const sedeFilter = document.getElementById('sedeFilter');
        sedeFilter.innerHTML = '<option value="todas">Todas las sedes</option>';
        sedes.forEach(sede => {
            sedeFilter.innerHTML += `<option value="${sede._id}">${sede.nombre} - ${sede.ciudad}</option>`;
        });
    } catch (error) {
        console.error('Error al cargar sedes:', error);
    }
}

async function cargarUsuarios() {
    try {
        const usuarios = await pywebview.api.obtener_usuarios();
        todosLosUsuarios = usuarios;
        mostrarUsuarios(usuarios);
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        mostrarModal('error', 'Error', 'Error al cargar los usuarios');
    }
}

function mostrarUsuarios(usuarios) {
    const tbody = document.getElementById('usuariosTableBody');
    
    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No hay usuarios registrados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = usuarios.map(usuario => {
        const iniciales = usuario.username.substring(0, 2).toUpperCase();
        const fechaRegistro = (typeof fechaColombia === 'function' ? fechaColombia(usuario.fecha_registro) : new Date(usuario.fecha_registro)).toLocaleDateString('es-ES');
        const estadoClass = usuario.activo ? 'activo' : 'inactivo';
        const estadoTexto = usuario.activo ? 'Activo' : 'Inactivo';
        const estadoIcon = usuario.activo ? 'fa-circle' : 'fa-circle';
        const sedesInfo = usuario.sedes_info || [];
        let sedeDisplay = '';
        if (sedesInfo.length === 0) {
            sedeDisplay = 'Sin asignar';
        } else if (sedesInfo.length === 1 && sedesInfo[0].id === 'TODAS') {
            // Solo mostrar "Todas las sedes" si explícitamente tiene 'TODAS'
            sedeDisplay = '<strong>Todas las sedes</strong>';
        } else {
            // Mostrar las sedes específicas asignadas
            sedeDisplay = sedesInfo.map(s => `${s.nombre}${s.ciudad ? ' - ' + s.ciudad : ''}`).join('<br>');
        }
        const filaClass = !usuario.activo ? 'usuario-inactivo' : '';
        
        return `
            <tr data-rol="${usuario.rol}" data-username="${usuario.username.toLowerCase()}" class="${filaClass}">
                <td>
                    <div class="usuario-info">
                        <div class="usuario-avatar">${iniciales}</div>
                        <span class="usuario-nombre">${usuario.username}</span>
                    </div>
                </td>
                <td>
                    <span class="rol-badge ${usuario.rol}">${usuario.rol === 'admin' ? 'Administrador' : 'Empleado'}</span>
                </td>
                <td>
                    <div class="sede-info">
                        <i class="fas fa-map-marker-alt" style="color: #999; margin-right: 5px;"></i>
                        <span>${sedeDisplay}</span>
                    </div>
                </td>
                <td>
                    ${(() => {
                        if (usuario.rol === 'admin') {
                            return '<span class="permisos-badge completos"><i class="fas fa-shield-alt"></i> Todos</span>';
                        }
                        const permisos = usuario.permisos || {};
                        const totalPermisos = Object.keys(permisos).length;
                        const permisosActivos = Object.values(permisos).filter(v => v === true).length;
                        if (permisosActivos === totalPermisos && totalPermisos > 0) {
                            return '<span class="permisos-badge completos"><i class="fas fa-check-circle"></i> Completos</span>';
                        }
                        return '<span class="permisos-badge personalizados"><i class="fas fa-sliders-h"></i> ' + permisosActivos + '/' + totalPermisos + '</span>';
                    })()}
                </td>
                <td>
                    <span class="password-field">
                        <span class="password-hidden" id="pass-${usuario._id}">••••••••</span>
                        <button class="toggle-password-btn" onclick="togglePassword('${usuario._id}', '${usuario.password}')">
                            <i class="fas fa-eye" id="eye-${usuario._id}"></i>
                        </button>
                        <button class="copy-password-btn" onclick="copiarPasswordTabla('${usuario._id}', '${usuario.password}')" title="Copiar contraseña" style="display: none;" id="copy-${usuario._id}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </span>
                </td>
                <td>${fechaRegistro}</td>
                <td>
                    <span class="estado-badge ${estadoClass}">
                        <i class="fas ${estadoIcon}"></i>
                        ${estadoTexto}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${tienePermiso('editar_usuarios') ? `<button class="action-btn edit" onclick="editarUsuario('${usuario._id}')">
                            <i class="fas fa-edit"></i>
                        </button>` : ''}
                        ${tienePermiso('cambiar_estado_usuarios') ? `<button class="action-btn toggle" onclick="toggleEstadoUsuario('${usuario._id}', ${usuario.activo})">
                            <i class="fas fa-${usuario.activo ? 'ban' : 'check'}"></i>
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarUsuarios() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sedeSeleccionada = document.getElementById('sedeFilter').value;
    
    const usuariosFiltrados = todosLosUsuarios.filter(usuario => {
        const coincideBusqueda = usuario.username.toLowerCase().includes(searchTerm);
        const coincideRol = filtroActual === 'todos' || usuario.rol === filtroActual;
        const sedes = usuario.sedes || [];
        const coincideSede = sedeSeleccionada === 'todas' ||
                            sedes.includes('TODAS') ||
                            sedes.includes(sedeSeleccionada);
        return coincideBusqueda && coincideRol && coincideSede;
    });
    
    mostrarUsuarios(usuariosFiltrados);
}

function filtrarPorRol(rol) {
    filtroActual = rol;
    
    // Actualizar botones activos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    filtrarUsuarios();
}

function abrirModalNuevoUsuario() {
    // Crear checkboxes de sedes
    const checkboxesSedes = todasLasSedes.map(sede => 
        `<label class="sede-checkbox-label">
            <input type="checkbox" class="new-sede-check" value="${sede._id}">
            <span>${sede.nombre} - ${sede.ciudad}</span>
        </label>`
    ).join('');
    
    // Crear modal de nuevo usuario
    const modalHTML = `
        <div class="modal-overlay-edit" id="newUserModal" style="display: flex;">
            <div class="modal-content-edit" style="max-width: 500px;">
                <div class="modal-header-edit">
                    <h2><i class="fas fa-user-plus"></i> Nuevo Usuario</h2>
                    <button class="modal-close-edit" type="button" onclick="cerrarModalNuevoUsuario()">&times;</button>
                </div>
                <form id="newUserForm">
                    <div class="form-group-edit">
                        <label>Usuario</label>
                        <input type="text" id="newUsername" placeholder="Mínimo 4 caracteres" required minlength="4" style="text-transform: uppercase;" pattern="[^\\s]+" title="No se permiten espacios">
                        <small style="color: #999; font-size: 12px;">Mínimo 4 caracteres, sin espacios</small>
                    </div>
                    <div class="form-group-edit">
                        <label>Sedes asignadas</label>
                        <label class="sede-checkbox-label" style="margin-bottom:6px;">
                            <input type="checkbox" id="newSedeTodasCheck" onchange="toggleTodasSedesNew(this)">
                            <span><strong>Todas las sedes</strong></span>
                        </label>
                        <div id="newSedesContainer" style="display:flex; flex-direction:column; gap:4px; max-height:140px; overflow-y:auto; padding:4px 0;">
                            ${checkboxesSedes}
                        </div>
                    </div>
                    <div class="form-group-edit">
                        <label>Contraseña</label>
                        <div style="position: relative;">
                            <input type="password" id="newPassword" placeholder="Mínimo 8 caracteres" required minlength="8" style="padding-right: 80px;">
                            <div style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: flex; gap: 5px;">
                                <button type="button" class="toggle-password-btn" onclick="togglePasswordNewModal()">
                                    <i class="fas fa-eye" id="eyeNewPassword"></i>
                                </button>
                                <button type="button" class="copy-password-btn" onclick="copiarPassword('newPassword')" title="Copiar contraseña">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <small style="color: #999; font-size: 12px;">Mínimo 8 caracteres</small>
                    </div>
                    <div class="form-group-edit">
                        <label>Confirmar Contraseña</label>
                        <div style="position: relative;">
                            <input type="password" id="newConfirmPassword" placeholder="Repite la contraseña" required minlength="8" style="padding-right: 80px;">
                            <div style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: flex; gap: 5px;">
                                <button type="button" class="toggle-password-btn" onclick="togglePasswordConfirmModal()">
                                    <i class="fas fa-eye" id="eyeNewConfirmPassword"></i>
                                </button>
                                <button type="button" class="copy-password-btn" onclick="copiarPassword('newConfirmPassword')" title="Copiar contraseña">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="form-group-edit">
                        <label>Rol</label>
                        <select id="newRol" required onchange="toggleSedeOptionsNew(); actualizarPermisosNuevoUsuario();">
                            <option value="">Selecciona un rol</option>
                            <option value="admin">Administrador</option>
                            <option value="empleado">Empleado</option>
                        </select>
                    </div>
                    <div class="modal-actions-edit">
                        <button type="button" class="btn-cancel-edit" onclick="cerrarModalNuevoUsuario()">Cancelar</button>
                        <button type="button" class="btn-save-edit" onclick="abrirModalPermisosNuevo()">Siguiente: Permisos</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Agregar evento para convertir a mayúsculas y prevenir espacios
    const usernameInput = document.getElementById('newUsername');
    if (usernameInput) {
        usernameInput.addEventListener('input', function(e) {
            this.value = this.value.toUpperCase().replace(/\s/g, '');
        });
        usernameInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            this.value = text.toUpperCase().replace(/\s/g, '');
        });
    }
}

function toggleTodasSedesNew(checkbox) {
    const container = document.getElementById('newSedesContainer');
    if (container) {
        container.querySelectorAll('.new-sede-check').forEach(cb => {
            cb.disabled = checkbox.checked;
            if (checkbox.checked) cb.checked = false;
        });
    }
}

function getSedesSeleccionadasNew() {
    const todasCheck = document.getElementById('newSedeTodasCheck');
    if (todasCheck && todasCheck.checked) return ['TODAS'];
    const checks = document.querySelectorAll('.new-sede-check:checked');
    return Array.from(checks).map(cb => cb.value);
}

// Variable para almacenar permisos temporales
let permisosTemporales = {};

function actualizarPermisosNuevoUsuario() {
    const rol = document.getElementById('newRol').value;
    if (rol) {
        // Cargar permisos por defecto del rol
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            pywebview.api.obtener_permisos_por_rol(rol).then(function(permisos) {
                permisosTemporales = permisos;
            });
        }
    }
}

function generarHTMLPermisos(permisos, deshabilitado) {
    let html = '';
    const def = window.DEFINICION_PERMISOS || {};
    for (const categoria in def) {
        html += '<div class="permisos-categoria">';
        html += '<div class="permisos-categoria-titulo">' + categoria + '</div>';
        html += '<div class="permisos-lista">';
        for (const key in def[categoria]) {
            const checked = permisos[key] ? 'checked' : '';
            const disabled = deshabilitado ? 'disabled' : '';
            html += '<label class="permiso-item">';
            html += '<input type="checkbox" name="permiso_' + key + '" value="' + key + '" ' + checked + ' ' + disabled + '>';
            html += '<span>' + def[categoria][key] + '</span>';
            html += '</label>';
        }
        html += '</div></div>';
    }
    return html;
}

function abrirModalPermisosNuevo() {
    // Validar campos antes de abrir permisos
    const username = document.getElementById('newUsername').value.trim().toUpperCase();
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('newConfirmPassword').value;
    const rol = document.getElementById('newRol').value;
    
    // Obtener sedes seleccionadas
    const todasCheck = document.getElementById('newSedeTodasCheck');
    const sedesChecks = document.querySelectorAll('.new-sede-check:checked');
    const sedesSeleccionadas = todasCheck && todasCheck.checked ? ['TODAS'] : Array.from(sedesChecks).map(cb => cb.value);
    
    if (!username || !password || !confirmPassword || !rol) {
        mostrarModal('error', 'Error', 'Por favor complete todos los campos');
        return;
    }
    
    if (sedesSeleccionadas.length === 0) {
        mostrarModal('error', 'Error', 'Por favor seleccione al menos una sede');
        return;
    }
    
    if (/\s/.test(username)) {
        mostrarModal('error', 'Error', 'El usuario no puede contener espacios');
        return;
    }
    if (username.length < 4) {
        mostrarModal('error', 'Error', 'El usuario debe tener al menos 4 caracteres');
        return;
    }
    if (password.length < 8) {
        mostrarModal('error', 'Error', 'La contraseña debe tener al menos 8 caracteres');
        return;
    }
    if (password !== confirmPassword) {
        mostrarModal('error', 'Error', 'Las contraseñas no coinciden');
        return;
    }
    
    const esAdmin = rol === 'admin';
    
    // Si no hay permisos temporales, cargar por defecto
    if (Object.keys(permisosTemporales).length === 0) {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            pywebview.api.obtener_permisos_por_rol(rol).then(function(permisos) {
                permisosTemporales = permisos;
                mostrarModalPermisos(esAdmin, 'nuevo');
            });
            return;
        }
    }
    
    mostrarModalPermisos(esAdmin, 'nuevo');
}

function mostrarModalPermisos(esAdmin, modo) {
    // Eliminar modal anterior si existe
    const existente = document.getElementById('permisosModal');
    if (existente) existente.remove();
    
    const titulo = modo === 'nuevo' ? 'Permisos del Nuevo Usuario' : 'Editar Permisos del Usuario';
    const btnTexto = modo === 'nuevo' ? 'Crear Usuario' : 'Guardar Cambios';
    const btnOnclick = modo === 'nuevo' ? 'guardarNuevoUsuarioConPermisos()' : 'guardarEdicionConPermisos()';
    const nota = esAdmin ? '<div style="background: #e8f5e9; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 13px; color: #2e7d32;"><i class="fas fa-shield-alt"></i> Los administradores tienen todos los permisos habilitados por defecto.</div>' : '';
    
    const modalHTML = `
        <div class="modal-overlay-edit" id="permisosModal" style="display: flex; z-index: 10001;">
            <div class="modal-content-edit modal-permisos-profesional">
                <div class="modal-header-edit modal-header-fixed">
                    <h2><i class="fas fa-key"></i> ${titulo}</h2>
                    <button class="modal-close-edit" type="button" onclick="cerrarModalPermisos()">&times;</button>
                </div>
                <div class="modal-body-permisos">
                    ${nota}
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button type="button" class="btn-save-edit" style="font-size: 12px; padding: 6px 12px;" onclick="seleccionarTodosPermisos(true)" ${esAdmin ? 'disabled' : ''}>
                            <i class="fas fa-check-double"></i> Seleccionar todos
                        </button>
                        <button type="button" class="btn-cancel-edit" style="font-size: 12px; padding: 6px 12px;" onclick="seleccionarTodosPermisos(false)" ${esAdmin ? 'disabled' : ''}>
                            <i class="fas fa-times"></i> Deseleccionar todos
                        </button>
                    </div>
                    <div id="permisosContainer">
                        ${generarHTMLPermisos(permisosTemporales, esAdmin)}
                    </div>
                </div>
                <div class="modal-actions-edit modal-footer-fixed">
                    <button type="button" class="btn-cancel-edit" onclick="cerrarModalPermisos()">Cancelar</button>
                    <button type="button" class="btn-save-edit" onclick="${btnOnclick}">${btnTexto}</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function seleccionarTodosPermisos(seleccionar) {
    document.querySelectorAll('#permisosContainer input[type="checkbox"]').forEach(function(cb) {
        if (!cb.disabled) cb.checked = seleccionar;
    });
}

function recogerPermisosDelModal() {
    const permisos = {};
    document.querySelectorAll('#permisosContainer input[type="checkbox"]').forEach(function(cb) {
        const key = cb.value;
        permisos[key] = cb.checked;
    });
    return permisos;
}

function cerrarModalPermisos() {
    const modal = document.getElementById('permisosModal');
    if (modal) modal.remove();
    // Limpiar variables temporales
    window._sedesTemporales = null;
}

async function guardarNuevoUsuarioConPermisos() {
    const username = document.getElementById('newUsername').value.trim().toUpperCase();
    const password = document.getElementById('newPassword').value;
    const rol = document.getElementById('newRol').value;
    const sedes = getSedesSeleccionadasNew();
    const permisos = recogerPermisosDelModal();
    
    try {
        const resultado = await pywebview.api.crear_usuario_admin(username, password, rol, sedes, permisos);
        
        if (resultado.success) {
            cerrarModalPermisos();
            cerrarModalNuevoUsuario();
            permisosTemporales = {};
            mostrarModal('success', '¡Éxito!', 'Usuario creado correctamente');
            setTimeout(() => {
                cargarUsuarios();
            }, 1000);
        } else {
            mostrarModal('error', 'Error', resultado.message || 'Error al crear el usuario');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarModal('error', 'Error', 'Error al crear el usuario');
    }
}

function cerrarModalNuevoUsuario() {
    const modal = document.getElementById('newUserModal');
    if (modal) {
        modal.remove();
    }
}

function togglePasswordNewModal() {
    const passInput = document.getElementById('newPassword');
    const eyeIcon = document.getElementById('eyeNewPassword');
    
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

function togglePasswordConfirmModal() {
    const passInput = document.getElementById('newConfirmPassword');
    const eyeIcon = document.getElementById('eyeNewConfirmPassword');
    
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

function toggleSedeOptionsNew() {
    const rol = document.getElementById('newRol') ? document.getElementById('newRol').value : '';
    const todasLabel = document.getElementById('newSedeTodasCheck') ? document.getElementById('newSedeTodasCheck').closest('label') : null;
    const todasCheck = document.getElementById('newSedeTodasCheck');
    if (todasLabel) {
        if (rol === 'empleado') {
            todasLabel.style.display = 'none';
            if (todasCheck && todasCheck.checked) {
                todasCheck.checked = false;
                toggleTodasSedesNew(todasCheck);
            }
        } else {
            todasLabel.style.display = 'flex';
        }
    }
}

async function guardarNuevoUsuario() {
    // Esta función ya no se usa directamente, se usa guardarNuevoUsuarioConPermisos
    abrirModalPermisosNuevo();
}

async function editarUsuario(userId) {
    console.log('Editando usuario:', userId);
    
    if (typeof pywebview === 'undefined' || !pywebview.api) {
        mostrarModal('error', 'Error', 'La API no está disponible');
        return;
    }
    
    try {
        const usuario = await pywebview.api.obtener_usuario(userId);
        const resultado = await pywebview.api.obtener_sedes();
        const sedes = resultado.sedes || [];
        
        if (!usuario) {
            mostrarModal('error', 'Error', 'Usuario no encontrado');
            return;
        }
        
        permisosTemporales = usuario.permisos || {};
        window._editUserId = userId;
        
        const sedesUsuario = usuario.sedes || [];
        const tieneTodas = sedesUsuario.includes('TODAS');

        // Crear checkboxes de sedes con estado actual
        const checkboxesSedes = sedes.map(sede => 
            `<label class="sede-checkbox-label">
                <input type="checkbox" class="edit-sede-check" value="${sede._id}" ${!tieneTodas && sedesUsuario.includes(sede._id) ? 'checked' : ''} ${tieneTodas ? 'disabled' : ''}>
                <span>${sede.nombre} - ${sede.ciudad}</span>
            </label>`
        ).join('');
        
        const modalHTML = `
            <div class="modal-overlay-edit" id="editModal" style="display: flex;">
                <div class="modal-content-edit" style="max-width: 500px;">
                    <div class="modal-header-edit">
                        <h2><i class="fas fa-user-edit"></i> Editar Usuario</h2>
                        <button class="modal-close-edit" type="button" onclick="cerrarModalEditar()">&times;</button>
                    </div>
                    <form id="editForm">
                        <div class="form-group-edit">
                            <label>Usuario</label>
                            <input type="text" id="editUsername" value="${usuario.username}" required minlength="4" style="text-transform: uppercase;">
                        </div>
                        <div class="form-group-edit">
                            <label>Sedes asignadas</label>
                            <label class="sede-checkbox-label" style="margin-bottom:6px;">
                                <input type="checkbox" id="editSedeTodasCheck" ${tieneTodas ? 'checked' : ''} onchange="toggleTodasSedesEdit(this)">
                                <span><strong>Todas las sedes</strong></span>
                            </label>
                            <div id="editSedesContainer" style="display:flex; flex-direction:column; gap:4px; max-height:140px; overflow-y:auto; padding:4px 0;">
                                ${checkboxesSedes}
                            </div>
                        </div>
                        <div class="form-group-edit">
                            <label>Contraseña</label>
                            <div style="position: relative;">
                                <input type="password" id="editPassword" value="${usuario.password}" required minlength="1" style="padding-right: 80px;">
                                <div style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: flex; gap: 5px;">
                                    <button type="button" class="toggle-password-btn" onclick="togglePasswordModal()">
                                        <i class="fas fa-eye" id="eyeEditPassword"></i>
                                    </button>
                                    <button type="button" class="copy-password-btn" onclick="copiarPassword('editPassword')" title="Copiar contraseña">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                            <small style="color: #999; font-size: 12px;">Modifica la contraseña o déjala como está</small>
                        </div>
                        <div class="form-group-edit">
                            <label>Rol</label>
                            <select id="editRol" required onchange="toggleSedeOptions()">
                                <option value="admin" ${usuario.rol === 'admin' ? 'selected' : ''}>Administrador</option>
                                <option value="empleado" ${usuario.rol === 'empleado' ? 'selected' : ''}>Empleado</option>
                            </select>
                        </div>
                        <div class="modal-actions-edit">
                            <button type="button" class="btn-save-edit" style="background: #1565c0;" onclick="abrirModalPermisosEditar('${userId}')"><i class="fas fa-key"></i> Editar Permisos</button>
                            <button type="button" class="btn-save-edit" onclick="guardarEdicionClick('${userId}')">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const usernameInput = document.getElementById('editUsername');
        if (usernameInput) {
            usernameInput.addEventListener('input', function(e) {
                this.value = this.value.toUpperCase();
            });
        }
        
        toggleSedeOptions();
    } catch (error) {
        console.error('Error completo:', error);
        mostrarModal('error', 'Error', 'Error al cargar datos del usuario: ' + error.message);
    }
}

function toggleTodasSedesEdit(checkbox) {
    const container = document.getElementById('editSedesContainer');
    if (container) {
        container.querySelectorAll('.edit-sede-check').forEach(cb => {
            cb.disabled = checkbox.checked;
            if (checkbox.checked) cb.checked = false;
        });
    }
}

function getSedesSeleccionadasEdit() {
    const todasCheck = document.getElementById('editSedeTodasCheck');
    if (todasCheck && todasCheck.checked) return ['TODAS'];
    const checks = document.querySelectorAll('.edit-sede-check:checked');
    return Array.from(checks).map(cb => cb.value);
}

function abrirModalPermisosEditar(userId) {
    // Validar que se haya seleccionado al menos una sede antes de abrir permisos
    const sedes = getSedesSeleccionadasEdit();
    
    if (!sedes || sedes.length === 0) {
        mostrarModal('error', 'Error', 'Debe seleccionar al menos una sede antes de editar permisos');
        return;
    }
    
    // Guardar las sedes seleccionadas temporalmente
    window._sedesTemporales = sedes;
    
    const rol = document.getElementById('editRol').value;
    const esAdmin = rol === 'admin';
    window._editUserId = userId;
    mostrarModalPermisos(esAdmin, 'editar');
}

async function guardarEdicionConPermisos() {
    const userId = window._editUserId;
    const username = document.getElementById('editUsername').value.toUpperCase();
    const password = document.getElementById('editPassword').value;
    const rol = document.getElementById('editRol').value;
    
    // Usar las sedes guardadas temporalmente
    const sedes = window._sedesTemporales || [];
    const permisos = recogerPermisosDelModal();
    
    if (!password || password.trim() === '') {
        mostrarModal('error', 'Error', 'La contraseña no puede estar vacía');
        return;
    }
    
    if (!sedes || sedes.length === 0) {
        mostrarModal('error', 'Error', 'Debe seleccionar al menos una sede');
        return;
    }
    
    try {
        const resultado = await pywebview.api.actualizar_usuario(userId, username, password, rol, sedes, permisos);
        
        if (resultado.success) {
            cerrarModalPermisos();
            cerrarModalEditar();
            permisosTemporales = {};
            window._sedesTemporales = null;
            mostrarModal('success', '¡Éxito!', 'Usuario actualizado correctamente');
            setTimeout(() => {
                cargarUsuarios();
            }, 1000);
        } else {
            mostrarModal('error', 'Error', resultado.message || 'Error al actualizar el usuario');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarModal('error', 'Error', 'Error al actualizar el usuario');
    }
}

async function guardarEdicionClick(userId) {
    const username = document.getElementById('editUsername').value.toUpperCase();
    const password = document.getElementById('editPassword').value;
    const rol = document.getElementById('editRol').value;
    const sedes = getSedesSeleccionadasEdit();
    
    if (!password || password.trim() === '') {
        mostrarModal('error', 'Error', 'La contraseña no puede estar vacía');
        return;
    }
    
    try {
        const permisos = Object.keys(permisosTemporales).length > 0 ? permisosTemporales : null;
        const resultado = await pywebview.api.actualizar_usuario(userId, username, password, rol, sedes, permisos);
        
        if (resultado.success) {
            cerrarModalEditar();
            permisosTemporales = {};
            mostrarModal('success', '¡Éxito!', 'Usuario actualizado correctamente');
            setTimeout(() => {
                cargarUsuarios();
            }, 1000);
        } else {
            mostrarModal('error', 'Error', resultado.message || 'Error al actualizar el usuario');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarModal('error', 'Error', 'Error al actualizar el usuario');
    }
}

function cerrarModalEditar() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.remove();
    }
}

function togglePassword(userId, password) {
    const passElement = document.getElementById(`pass-${userId}`);
    const eyeIcon = document.getElementById(`eye-${userId}`);
    const copyBtn = document.getElementById(`copy-${userId}`);
    
    if (passElement.textContent === '••••••••') {
        passElement.textContent = password;
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
        if (copyBtn) copyBtn.style.display = 'inline-block';
    } else {
        passElement.textContent = '••••••••';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
        if (copyBtn) copyBtn.style.display = 'none';
    }
}

function togglePasswordModal() {
    const passInput = document.getElementById('editPassword');
    const eyeIcon = document.getElementById('eyeEditPassword');
    
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

function copiarPassword(inputId) {
    const input = document.getElementById(inputId);
    
    // Validar que el campo no esté vacío
    if (!input.value || input.value.trim() === '') {
        mostrarModal('error', 'Error', 'No hay contraseña para copiar');
        return;
    }
    
    // Seleccionar y copiar
    input.select();
    input.setSelectionRange(0, 99999); // Para móviles
    
    try {
        document.execCommand('copy');
        mostrarModal('success', '¡Copiado!', 'Contraseña copiada al portapapeles');
    } catch (err) {
        // Fallback para navegadores modernos
        navigator.clipboard.writeText(input.value).then(() => {
            mostrarModal('success', '¡Copiado!', 'Contraseña copiada al portapapeles');
        }).catch(() => {
            mostrarModal('error', 'Error', 'No se pudo copiar la contraseña');
        });
    }
}

function copiarPasswordTabla(userId, password) {
    // Validar que la contraseña no esté vacía
    if (!password || password.trim() === '') {
        mostrarModal('error', 'Error', 'No hay contraseña para copiar');
        return;
    }
    
    try {
        // Crear un input temporal
        const tempInput = document.createElement('input');
        tempInput.value = password;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        mostrarModal('success', '¡Copiado!', 'Contraseña copiada al portapapeles');
    } catch (err) {
        // Fallback para navegadores modernos
        navigator.clipboard.writeText(password).then(() => {
            mostrarModal('success', '¡Copiado!', 'Contraseña copiada al portapapeles');
        }).catch(() => {
            mostrarModal('error', 'Error', 'No se pudo copiar la contraseña');
        });
    }
}

async function toggleEstadoUsuario(userId, estadoActual) {
    const nuevoEstado = !estadoActual;
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    
    mostrarModalConfirmacion(
        `¿Está seguro de ${accion} este usuario?`,
        async () => {
            try {
                const resultado = await pywebview.api.cambiar_estado_usuario(userId, nuevoEstado);
                
                if (resultado.success) {
                    mostrarModal('success', '¡Éxito!', `Usuario ${accion === 'activar' ? 'activado' : 'desactivado'} correctamente`);
                    setTimeout(() => {
                        cargarUsuarios();
                    }, 1000);
                } else {
                    mostrarModal('error', 'Error', resultado.message || 'Error al cambiar el estado del usuario');
                }
            } catch (error) {
                console.error('Error:', error);
                mostrarModal('error', 'Error', 'Error al cambiar el estado del usuario');
            }
        }
    );
}

function mostrarModalConfirmacion(mensaje, onConfirm) {
    const modalHTML = `
        <div class="modal-overlay-confirm" id="confirmModal" style="display: flex;">
            <div class="modal-content-confirm">
                <div class="modal-icon-confirm">
                    <i class="fas fa-question-circle"></i>
                </div>
                <h2 class="modal-title-confirm">Confirmación</h2>
                <p class="modal-message-confirm">${mensaje}</p>
                <div class="modal-buttons-confirm">
                    <button class="btn-cancel-confirm" onclick="cerrarModalConfirmacion()">Cancelar</button>
                    <button class="btn-confirm" onclick="confirmarAccion()">Aceptar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Guardar la función de confirmación
    window.accionConfirmada = onConfirm;
}

function cerrarModalConfirmacion() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.remove();
    }
    window.accionConfirmada = null;
}

async function confirmarAccion() {
    if (window.accionConfirmada) {
        await window.accionConfirmada();
    }
    cerrarModalConfirmacion();
}

function toggleSedeOptions() {
    const rolEl = document.getElementById('editRol');
    const rol = rolEl ? rolEl.value : '';
    const todasCheck = document.getElementById('editSedeTodasCheck');
    const todasLabel = todasCheck ? todasCheck.closest('label') : null;
    if (todasLabel) {
        if (rol === 'empleado') {
            todasLabel.style.display = 'none';
            if (todasCheck && todasCheck.checked) {
                todasCheck.checked = false;
                toggleTodasSedesEdit(todasCheck);
            }
        } else {
            todasLabel.style.display = 'flex';
        }
    }
}

function cerrarSesion() {
    mostrarModalConfirmacion(
        '¿Estás seguro de que deseas cerrar sesión?',
        () => {
            localStorage.removeItem('sesionActiva');
            
            if (typeof pywebview !== 'undefined' && pywebview.api) {
                pywebview.api.cerrar_sesion().then(() => {
                    window.location.href = 'index.html';
                });
            } else {
                window.location.href = 'index.html';
            }
        }
    );
}
