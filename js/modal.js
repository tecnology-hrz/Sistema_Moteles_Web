// Sistema de ventanas emergentes (modales)

function mostrarModal(tipo, titulo, mensaje, esConfirmacion = false, callbackConfirmar = null) {
    // Crear el overlay si no existe
    let overlay = document.getElementById('modalOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalOverlay';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
    }
    
    // Determinar el icono según el tipo
    let icono = '';
    switch(tipo) {
        case 'success':
            icono = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icono = '<i class="fas fa-times-circle"></i>';
            break;
        case 'warning':
            icono = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        case 'info':
            icono = '<i class="fas fa-info-circle"></i>';
            break;
        default:
            icono = '<i class="fas fa-info-circle"></i>';
    }
    
    // Crear botones según si es confirmación o no
    let botones = '';
    if (esConfirmacion) {
        botones = `
            <div class="modal-buttons">
                <button class="modal-button modal-button-secondary" onclick="cerrarModal()">Cancelar</button>
                <button class="modal-button" onclick="confirmarModalAccion()">Aceptar</button>
            </div>
        `;
        // Guardar el callback en el overlay
        overlay.dataset.callback = 'pendiente';
        window.modalCallbackConfirmar = callbackConfirmar;
    } else {
        botones = '<button class="modal-button" onclick="cerrarModal()">Aceptar</button>';
    }
    
    // Crear el contenido del modal
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-icon ${tipo}">
                ${icono}
            </div>
            <h2 class="modal-title">${titulo}</h2>
            <p class="modal-message">${mensaje}</p>
            ${botones}
        </div>
    `;
    
    // Mostrar el modal
    overlay.classList.add('active');
    
    // Cerrar al hacer clic fuera del modal solo si no es confirmación
    if (!esConfirmacion) {
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                cerrarModal();
            }
        };
    } else {
        overlay.onclick = null;
    }
}

function confirmarModalAccion() {
    if (window.modalCallbackConfirmar && typeof window.modalCallbackConfirmar === 'function') {
        window.modalCallbackConfirmar();
        window.modalCallbackConfirmar = null;
    }
    cerrarModal();
}

function cerrarModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        window.modalCallbackConfirmar = null;
    }
}

// Hacer las funciones globales
window.mostrarModal = mostrarModal;
window.cerrarModal = cerrarModal;
window.confirmarModalAccion = confirmarModalAccion;
