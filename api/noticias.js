const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const noticiasPath = path.join(__dirname, "..", "data", "noticias.json");

// Leer archivo JSON
function getNoticias() {
    if (!fs.existsSync(noticiasPath)) {
        fs.writeFileSync(noticiasPath, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(noticiasPath, "utf8"));
}

// Guardar archivo JSON
function saveNoticias(noticias) {
    fs.writeFileSync(noticiasPath, JSON.stringify(noticias, null, 2));
}

// =======================
// OBTENER TODAS LAS NOTICIAS
// =======================
router.get("/", (req, res) => {
    const noticias = getNoticias();
    res.json(noticias);
});

// =======================
// CREAR NOTICIA
// =======================
router.post("/", (req, res) => {
    const noticias = getNoticias();
    const { titulo, contenido } = req.body;

    if (!titulo || !contenido) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    const nueva = {
        id: Date.now(),
        titulo,
        contenido,
        fecha: new Date().toISOString()
    };

    noticias.push(nueva);
    saveNoticias(noticias);

    res.json({ message: "Noticia creada", noticia: nueva });
});

// =======================
// EDITAR NOTICIA
// =======================
router.put("/:id", (req, res) => {
    const noticias = getNoticias();
    const id = parseInt(req.params.id);

    const { titulo, contenido } = req.body;

    const noticia = noticias.find(n => n.id === id);
    if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });

    noticia.titulo = titulo;
    noticia.contenido = contenido;
    noticia.fecha = new Date().toISOString();

    saveNoticias(noticias);

    res.json({ message: "Noticia actualizada", noticia });
});

// =======================
// ELIMINAR NOTICIA
// =======================
router.delete("/:id", (req, res) => {
    let noticias = getNoticias();
    const id = parseInt(req.params.id);

    noticias = noticias.filter(n => n.id !== id);
    saveNoticias(noticias);

    res.json({ message: "Noticia eliminada" });
});

module.exports = router;
