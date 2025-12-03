// cargar-footer.js
document.addEventListener('DOMContentLoaded', () => {
    const footerPlaceholder = document.getElementById('footer-placeholder');

    if (footerPlaceholder) {
        // Obtenemos la ruta actual
        const path = window.location.pathname;
        
        // Contamos cuántos niveles de profundidad hay (ej. /pages/perfil/perfil.html tiene profundidad 3)
        // Esto asume que tu estructura de archivos es consistente.
        const pathSegments = path.split('/').filter(segment => segment.length > 0);
        
        // Si el archivo está en la raíz (index.html), pathSegments.length es 1 (solo el nombre del archivo)
        // Si está en /pages/auth/login.html, pathSegments.length es 3
        
        let basePath;
        
        if (pathSegments.length === 1 && pathSegments[0] === 'index.html') {
             // Si estamos en index.html, la ruta del footer es './assets/components/footer.html'
             // Ajusta la ruta a donde tengas realmente guardado el footer.html
             basePath = './assets/components/footer.html'; 
        } else if (pathSegments.includes('pages')) {
            // Si estamos en una subcarpeta como /pages/perfil/perfil.html
            // Necesitamos subir uno o dos niveles para llegar a la raíz.
            
            // Si tu estructura es: [raiz] -> [pages] -> [carpeta_modulo] -> [archivo.html]
            // Entonces necesitamos '../../'
            const levelsUp = pathSegments.length - 2; 
            const relativePath = '../'.repeat(levelsUp > 0 ? levelsUp : 0);
            
            // Ajusta la ruta a donde tengas realmente guardado el footer.html
            basePath = relativePath + 'assets/components/footer.html'; 
            
        } else {
            // Caso por defecto (p. ej. archivos directamente en la raíz)
            basePath = './assets/components/footer.html';
        }

        fetch(basePath)
            .then(response => {
                if (!response.ok) {
                    // Muestra en la consola si la ruta falla
                    console.error(`Error al cargar el footer. Ruta intentada: ${basePath}`);
                    throw new Error(`Error al cargar el footer: ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                footerPlaceholder.innerHTML = data;
            })
            .catch(error => {
                console.error('Fallo al inyectar el pie de página:', error);
                footerPlaceholder.innerHTML = '<footer class="text-center py-3 bg-danger text-white">Error al cargar el pie de página. Revise la ruta en cargar-footer.js.</footer>';
            });
    }
});