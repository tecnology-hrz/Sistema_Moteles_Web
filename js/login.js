const loginContainer = document.getElementById('loginContainer');
const registroContainer = document.getElementById('registroContainer');
const loginForm = document.getElementById('loginForm');
const registroForm = document.getElementById('registroForm');
const messageDiv = document.getElementById('message');
const messageRegistroDiv = document.getElementById('messageRegistro');
const passwordInput = document.getElementById('regPassword');
const passwordStrengthBar = document.getElementById('passwordStrengthBar');

// Prevenir espacios en campos de usuario
document.getElementById('username').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\s/g, '');
});

document.getElementById('regUsername').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\s/g, '');
});

// Prevenir pegar texto con espacios en campos de usuario
document.getElementById('username').addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    e.target.value = text.replace(/\s/g, '');
});

document.getElementById('regUsername').addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    e.target.value = text.replace(/\s/g, '');
});

// Función para mostrar/ocultar contraseña
function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    
    if (!input || !icon) {
        console.error('Input o icono no encontrado:', inputId, iconId);
        return;
    }
    
    if (input.type === 'password') {
        input.type = 'text';
        // Cambiar a ojo tachado
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        input.type = 'password';
        // Cambiar a ojo normal
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

// Hacer la función global para que funcione con onclick
window.togglePasswordVisibility = togglePasswordVisibility;

// Funciones para cambiar entre login y registro
function mostrarLogin() {
    loginContainer.classList.remove('hidden');
    registroContainer.classList.add('hidden');
    registroForm.reset();
    passwordStrengthBar.className = 'password-strength-bar';
}

function mostrarRegistro() {
    loginContainer.classList.add('hidden');
    registroContainer.classList.remove('hidden');
    loginForm.reset();
}

function mostrarMensaje(texto, tipo, esRegistro = false) {
    // Usar modal en lugar de mensaje inline
    if (tipo === 'success') {
        mostrarModal('success', '¡Éxito!', texto);
    } else if (tipo === 'error') {
        mostrarModal('error', 'Error', texto);
    }
}

// Verificar si ya hay sesión activa al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    const sesion = localStorage.getItem('sesionActiva');
    if (sesion) {
        const datos = JSON.parse(sesion);
        window.location.href = 'dasboard-admin.html';
    }
});

// LOGIN FORM
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        mostrarMensaje('Por favor complete todos los campos', 'error');
        return;
    }
    
    // Validar que no haya espacios en el usuario
    if (/\s/.test(username)) {
        mostrarMensaje('El usuario no puede contener espacios', 'error');
        return;
    }
    
    try {
        const resultado = await pywebview.api.login(username, password, null);
        
        if (resultado.success) {
            // Guardar sesión en localStorage con permisos
            const datosSesion = {
                username: username,
                rol: resultado.rol,
                permisos: resultado.permisos || {},
                timestamp: new Date().getTime()
            };
            localStorage.setItem('sesionActiva', JSON.stringify(datosSesion));
            
            mostrarModal('success', '¡Éxito!', resultado.message);
            
            // Todos van al mismo dashboard
            setTimeout(() => {
                window.location.href = 'dasboard-admin.html';
            }, 1000);
        } else {
            mostrarMensaje(resultado.message, 'error');
        }
    } catch (error) {
        mostrarMensaje('Error al iniciar sesión', 'error');
        console.error(error);
    }
});

// REGISTRO FORM
// Validar fuerza de contraseña
passwordInput.addEventListener('input', (e) => {
    const password = e.target.value;
    const strengthText = document.getElementById('passwordStrengthText');
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    
    passwordStrengthBar.className = 'password-strength-bar';
    
    if (password.length === 0) {
        strengthText.textContent = 'Mínimo 8 caracteres';
        strengthText.style.color = '#888888';
    } else if (strength <= 2) {
        passwordStrengthBar.classList.add('weak');
        strengthText.textContent = 'Contraseña débil';
        strengthText.style.color = '#f44336';
    } else if (strength <= 3) {
        passwordStrengthBar.classList.add('medium');
        strengthText.textContent = 'Contraseña media';
        strengthText.style.color = '#ff9800';
    } else {
        passwordStrengthBar.classList.add('strong');
        strengthText.textContent = 'Contraseña fuerte';
        strengthText.style.color = '#4caf50';
    }
});

// Cargar sede cuando se muestra el formulario de registro
function mostrarRegistro() {
    loginContainer.classList.add('hidden');
    registroContainer.classList.remove('hidden');
    loginForm.reset();
    cargarSedeRegistro();
}

// Cargar la sede actual configurada para el registro
async function cargarSedeRegistro() {
    try {
        const resultado = await pywebview.api.obtener_sede_actual();
        const sedeInput = document.getElementById('regSede');
        const sedeInfo = document.getElementById('regSedeInfo');
        
        if (resultado.success && resultado.sede) {
            sedeInput.value = `${resultado.sede.nombre} - ${resultado.sede.ciudad || 'Sin ciudad'}`;
            sedeInfo.textContent = 'Serás registrado como empleado de esta sede';
            sedeInfo.style.color = '#4caf50';
        } else {
            sedeInput.value = 'Sin sede configurada';
            sedeInfo.textContent = 'No hay sede configurada. Contacta al administrador.';
            sedeInfo.style.color = '#c62828';
            
            // Deshabilitar el formulario si no hay sede
            document.getElementById('regUsername').disabled = true;
            document.getElementById('regPassword').disabled = true;
            document.getElementById('regConfirmPassword').disabled = true;
            registroForm.querySelector('button[type="submit"]').disabled = true;
        }
    } catch (error) {
        console.error('Error al cargar sede:', error);
        const sedeInput = document.getElementById('regSede');
        const sedeInfo = document.getElementById('regSedeInfo');
        sedeInput.value = 'Error al cargar sede';
        sedeInfo.textContent = 'No se pudo cargar la información de la sede';
        sedeInfo.style.color = '#c62828';
    }
}

registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const rol = 'empleado'; // Siempre será empleado
    
    // Validaciones
    if (!username || !password || !confirmPassword) {
        mostrarMensaje('Por favor complete todos los campos', 'error', true);
        return;
    }
    
    // Validar que no haya espacios en el usuario
    if (/\s/.test(username)) {
        mostrarMensaje('El usuario no puede contener espacios', 'error', true);
        return;
    }
    
    if (username.length < 4) {
        mostrarMensaje('El usuario debe tener al menos 4 caracteres', 'error', true);
        return;
    }
    
    if (password.length < 8) {
        mostrarMensaje('La contraseña debe tener al menos 8 caracteres', 'error', true);
        return;
    }
    
    if (password !== confirmPassword) {
        mostrarMensaje('Las contraseñas no coinciden', 'error', true);
        return;
    }
    
    try {
        const resultado = await pywebview.api.registro(username, password, rol);
        
        if (resultado.success) {
            mostrarMensaje(resultado.message, 'success', true);
            
            // Limpiar formulario
            registroForm.reset();
            passwordStrengthBar.className = 'password-strength-bar';
            
            // Recargar sede
            await cargarSedeRegistro();
            
            // Redirigir al login después de 2 segundos
            setTimeout(() => {
                mostrarLogin();
            }, 2000);
        } else {
            mostrarMensaje(resultado.message, 'error', true);
        }
    } catch (error) {
        mostrarMensaje('Error al registrar usuario', 'error', true);
        console.error(error);
    }
});

// CONFIGURACIÓN DE SEDE
function mostrarModalConfigPassword() {
    const modal = document.getElementById('modalConfigPassword');
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.getElementById('configPassword').value = '';
    document.getElementById('configPassword').focus();
}

function cerrarModalConfigPassword() {
    const modal = document.getElementById('modalConfigPassword');
    modal.style.display = 'none';
    modal.classList.remove('active');
}

window.mostrarModalConfigPassword = mostrarModalConfigPassword;
window.cerrarModalConfigPassword = cerrarModalConfigPassword;

// Formulario de contraseña de configuración
document.getElementById('formConfigPassword').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('configPassword').value;
    
    if (password === 'ANDRES-HRZ') {
        cerrarModalConfigPassword();
        window.location.href = 'configuracion-sede.html';
    } else {
        mostrarModal('error', 'Acceso Denegado', 'Contraseña incorrecta');
        document.getElementById('configPassword').value = '';
    }
});
