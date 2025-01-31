const jwt = require('jsonwebtoken');
const SECRET_KEY = 'password_seguro'; // Cambia esta clave a algo más seguro y único

// Función para manejar el login
function handleLogin(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        const { password } = JSON.parse(body);

        // Simula la validación de credenciales
        if (password === 'password123') {
            const token = jwt.sign({ user: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
            console.log("Token generado:", token); // Depuración
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token }));
        } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Credenciales incorrectas' }));
        }
    });
}

// Middleware para autenticar con token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log("Token recibido:", token); // Verifica si el token se envía correctamente

    if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Token requerido' }));
        return;
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error("Error al verificar token:", err); // Muestra el error si falla la verificación
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Token inválido' }));
            return;
        }
        req.user = user;
        next();
    });
}

// Exportar las funciones
module.exports = {
    handleLogin,
    authenticateToken
};
