// Función para volver al login
function volverLogin() {
    window.location.href = 'index.html';
}

window.volverLogin = volverLogin;

// Esperar a que pywebview esté listo
function esperarPywebview() {
    return new Promise((resolve) => {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            console.log('pywebview ya está disponible');
            resolve();
        } else {
            console.log('Esperando evento pywebviewready...');
            window.addEventListener('pywebviewready', () => {
                console.log('pywebviewready recibido');
                resolve();
            });
        }
    });
}

// Cargar información al iniciar
window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM cargado, esperando pywebview...');
    await esperarPywebview();
    console.log('pywebview listo, cargando datos...');
    await cargarSedeActual();
    await cargarSedes();
});

// Cargar sede actual configurada
async function cargarSedeActual() {
    try {
        console.log('Llamando a obtener_sede_actual...');
        const resultado = await pywebview.api.obtener_sede_actual();
        console.log('Resultado obtener_sede_actual:', resultado);
        const container = document.getElementById('sedeActualInfo');
        
        if (resultado.success && resultado.sede) {
            container.innerHTML = `
                <div class="sede-icon">
                    <i class="fas fa-building"></i>
                </div>
                <h3>${resultado.sede.nombre}</h3>
                <p>${resultado.sede.ciudad || resultado.sede.direccion || 'Sin ubicación'}</p>
            `;
        } else {
            container.classList.add('no-sede');
            container.innerHTML = `
                <div class="sede-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Sin Sede Configurada</h3>
                <p>Selecciona una sede de la lista para configurar el sistema</p>
            `;
        }
    } catch (error) {
        console.error('Error al cargar sede actual:', error);
        console.error('Stack trace:', error.stack);
        document.getElementById('sedeActualInfo').innerHTML = `
            <div class="sede-icon">
                <i class="fas fa-times-circle"></i>
            </div>
            <h3>Error al cargar</h3>
            <p>No se pudo obtener la información de la sede actual</p>
        `;
    }
}

// Cargar todas las sedes disponibles
async function cargarSedes() {
    try {
        console.log('Llamando a obtener_sedes...');
        const resultado = await pywebview.api.obtener_sedes();
        console.log('Resultado obtener_sedes:', resultado);
        const container = document.getElementById('sedesLista');
        
        if (resultado && resultado.success && resultado.sedes && resultado.sedes.length > 0) {
            const sedeActualId = resultado.sede_actual_id;
            console.log('Sede actual ID:', sedeActualId);
            console.log('Total sedes:', resultado.sedes.length);
            
            container.innerHTML = resultado.sedes.map(sede => `
                <div class="sede-card ${sede._id === sedeActualId ? 'activa' : ''}" 
                     onclick="seleccionarSede('${sede._id}', '${sede.nombre}')">
                    <h3>${sede.nombre}</h3>
                    <p>${sede.ciudad || sede.direccion || 'Sin ubicación especificada'}</p>
                    <div class="sede-info">
                        <div class="sede-info-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${sede.ciudad || 'Sin ciudad'}</span>
                        </div>
                        <div class="sede-info-item">
                            <i class="fas fa-calendar"></i>
                            <span>${sede.fecha_creacion || 'Sin fecha'}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            console.log('No hay sedes o resultado no exitoso');
            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-inbox"></i>
                    <p>No hay sedes disponibles en el sistema</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error al cargar sedes:', error);
        console.error('Stack trace:', error.stack);
        document.getElementById('sedesLista').innerHTML = `
            <div class="loading">
                <i class="fas fa-times-circle"></i>
                <p>Error al cargar las sedes</p>
            </div>
        `;
    }
}

// Seleccionar una sede
async function seleccionarSede(sedeId, sedeNombre) {
    try {
        const resultado = await pywebview.api.configurar_sede_sistema(sedeId);
        
        if (resultado.success) {
            mostrarModal('success', '¡Sede Configurada!', 
                `La sede "${sedeNombre}" ha sido configurada correctamente. Todos los nuevos registros pertenecerán a esta sede.`);
            
            // Recargar información
            await cargarSedeActual();
            await cargarSedes();
        } else {
            mostrarModal('error', 'Error', resultado.message || 'No se pudo configurar la sede');
        }
    } catch (error) {
        console.error('Error al configurar sede:', error);
        mostrarModal('error', 'Error', 'Ocurrió un error al configurar la sede');
    }
}

window.seleccionarSede = seleccionarSede;
