// Sidebar mobile toggle
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        // Crear botón hamburguesa si no existe
        let btn = document.querySelector('.sidebar-toggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.className = 'sidebar-toggle';
            btn.innerHTML = '<i class="fas fa-bars"></i>';
            btn.setAttribute('aria-label', 'Abrir menú');
            document.body.appendChild(btn);
        }

        // Crear overlay oscuro si no existe
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        // Crear botón X blanco exterior si no existe
        let btnClose = document.querySelector('.sidebar-close-outer');
        if (!btnClose) {
            btnClose = document.createElement('button');
            btnClose.className = 'sidebar-close-outer';
            btnClose.innerHTML = '<i class="fas fa-times"></i>';
            btnClose.setAttribute('aria-label', 'Cerrar menú');
            document.body.appendChild(btnClose);
        }

        function abrirSidebar() {
            sidebar.classList.add('open');
            overlay.classList.add('active');
            btnClose.classList.add('visible');
            btn.style.display = 'none'; // ocultar hamburguesa mientras está abierto
        }

        function cerrarSidebar() {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            btnClose.classList.remove('visible');
            btn.style.display = ''; // restaurar hamburguesa
        }

        btn.addEventListener('click', abrirSidebar);
        btnClose.addEventListener('click', cerrarSidebar);
        overlay.addEventListener('click', cerrarSidebar);
    });
})();
