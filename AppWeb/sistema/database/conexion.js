const mysql = require('mysql2');

// Configuración de la conexión
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'equilibratusemociones'
});

// Conexión a la base de datos
connection.connect((err) => {
  if (err) {
    console.error('Error de conexión, por favor inicia el servidor de la base de datos: ' + err.stack);
    return;
  }
  console.log('Conectado a la base de datos con ID ' + connection.threadId);
});

// Exportar la conexión
module.exports = connection;
