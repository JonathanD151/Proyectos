const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleLogin, authenticateToken } = require('./auth.js'); // Importar las funciones de autenticación
const db = require('./database/conexion.js'); // Conexión a la base de datos
const mysql = require('mysql2'); // Biblioteca MySQL
const { exec } = require('child_process'); // Importa child_process para ejecutar comandos del sistema

const PORT = 3000;
//Mensaje de error si no se conecta a la base de datos


const server = http.createServer((req, res) => {
    // Manejar login
    if (req.url === '/login' && req.method === 'POST') {
        handleLogin(req, res);
        return;
    }

    // Endpoint protegido: registrar cliente
    if (req.url === '/registrarCliente' && req.method === 'POST') {
        authenticateToken(req, res, () => handleRegistro(req, res));
        return;
    }

    if (req.url === '/actualizarCliente' && req.method === 'PUT') {
        authenticateToken(req, res, () => handleActualizar(req, res));
        return;
    }

    // Endpoint protegido: consultar clientes
    if (req.url.startsWith('/consultarClientes')) {
        authenticateToken(req, res, () => handleConsultas(req, res));
        return;
    }

    // Endpoint protegido: eliminar pacientes
    if (req.url === '/eliminarPacientes' && req.method === 'POST') {
        authenticateToken(req, res, () => handleEliminarPacientes(req, res));
        return;
    }

    // Servir archivos estáticos
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './Vista/index.html'; // Página principal
    filePath = filePath.replace('/vista/', '/Vista/');

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile('./404.html', (error, content404) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content404, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end(`Sorry, there was an error: ${err.code} ..\n`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

function handleRegistro(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        let data;
        try {
            data = JSON.parse(body);
            console.log(data); // Verifica los datos recibidos
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Datos no válidos' }));
        }

        // Extraer datos y manejar valores opcionales
        const {
            nombre = null,
            apellidoPaterno = null,
            apellidoMaterno = null,
            fecha_ingreso = null,
            fecha_alta = null,
            fecha_registro = null,
            observaciones = null,
            lista_negra = null,
            estado_cliente = null,
            correo = null,
            celular = null,
            facebook = null,
            direccion = null
        } = data;

        const verificarYRegistrar = () => {
            db.beginTransaction(err => {
                if (err) {
                    console.error('Error iniciando transacción:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Error en el servidor' }));
                }

                ///// Insertar en la tabla cliente/////
                const clienteQuery = `
                    INSERT INTO cliente (nombre, apellidopaterno, apellidomaterno, fecha_ingreso, fecha_alta, fecha_registro, observaciones)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                const clienteValues = [nombre, apellidoPaterno, apellidoMaterno, fecha_ingreso, fecha_alta, fecha_registro, observaciones];

                db.query(clienteQuery, clienteValues, (err, clienteResult) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error al registrar cliente:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Error al registrar cliente' }));
                        });
                    }

                    const idCliente = clienteResult.insertId;
                    ////Insercion en la tabla lista negra///
                    const listaNegraQuery = `
                    INSERT INTO lista_negra (idcliente, lista_negra)
                    VALUES (?, ?)
                `;
                
                const listaNegraValues = [idCliente, lista_negra]; // listaNegra será 'si' o 'no'
                
                db.query(listaNegraQuery, listaNegraValues, err => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error al registrar en la lista negra:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Error al registrar en la lista negra' }));
                        });
                    }
                });
                    const estadoClienteQuery = `
                        INSERT INTO estado_cliente (idcliente, estado_cliente)
                        VALUES (?, ?)
                    `;

                    const estadoClienteValues = [idCliente, estado_cliente]; // estadoCliente será 'activo', 'inactivo', etc.
                        db.query(estadoClienteQuery, estadoClienteValues, err => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error('Error al registrar estado del cliente:', err);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'Error al registrar estado del cliente' }));
                                });
                            }
                        });
                        
                    ///// Insertar en la tabla contacto///////
                    const contactoQuery = `
                        INSERT INTO contacto (idcliente, celular, correo, facebook, direccion)
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    const contactoValues = [idCliente, celular, correo, facebook, direccion];

                    db.query(contactoQuery, contactoValues, err => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Error al registrar contacto:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Error al registrar contacto' }));
                            });
                        }

                        // Continuar con las inserciones restantes (estado_cliente, lista_negra) como en tu código original...

                        db.commit(err => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error('Error al confirmar transacción:', err);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'Error al confirmar transacción' }));
                                });
                            }

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                message: 'Registro exitoso',
                                datos: {
                                    idCliente,
                                    nombre,
                                    apellidoPaterno,
                                    apellidoMaterno,
                                    fecha_ingreso,
                                    fecha_alta,
                                    fecha_registro,
                                    observaciones,
                                    lista_negra,
                                    estado_cliente,
                                    correo,
                                    celular,
                                    facebook
                                }
                            }));
                        });
                    });
                });
            });
        };

        // Si el número de celular está definido, verificar duplicados
        if (celular) {
            const verificarCelularQuery = `
                SELECT COUNT(*) AS count FROM contacto WHERE celular = ?
            `;

            db.query(verificarCelularQuery, [celular], (err, results) => {
                if (err) {
                    console.error('Error verificando número de celular:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Error en el servidor' }));
                }

                if (results[0].count > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'El número de celular ya está registrado' }));
                }

                // Si no está duplicado, continuar con el registro
                verificarYRegistrar();
            });
        } else {
            // Si no hay celular, continuar con el registro sin verificación
            verificarYRegistrar();
        }
    });
}



function handleActualizar(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        let data;
        try {
            data = JSON.parse(body);
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Datos no válidos' }));
        }

        const {
            idCliente,
            nombre,
            apellidoPaterno,
            apellidoMaterno,
            fecha_ingreso,
            fecha_alta,
            fecha_registro,
            observaciones,
            lista_negra,
            estado_cliente,
            correo,
            celular,
            facebook,
            direccion
        } = data;

        if (!idCliente) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'El ID del cliente es obligatorio para actualizar' }));
        }

        const verificarYActualizar = () => {
            db.beginTransaction(err => {
                if (err) {
                    console.error('Error iniciando transacción:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Error en el servidor' }));
                }

                // Construir dinámicamente la consulta para la tabla cliente
                const clienteUpdates = [];
                const clienteValues = [];

                if (nombre) {
                    clienteUpdates.push('nombre = ?');
                    clienteValues.push(nombre);
                }
                if (apellidoPaterno) {
                    clienteUpdates.push('apellidopaterno = ?');
                    clienteValues.push(apellidoPaterno);
                }
                if (apellidoMaterno) {
                    clienteUpdates.push('apellidomaterno = ?');
                    clienteValues.push(apellidoMaterno);
                }
                if (fecha_ingreso) {
                    clienteUpdates.push('fecha_ingreso = ?');
                    clienteValues.push(fecha_ingreso);
                }
                if (fecha_alta) {
                    clienteUpdates.push('fecha_alta = ?');
                    clienteValues.push(fecha_alta);
                }
                if (fecha_registro) {
                    clienteUpdates.push('fecha_registro = ?');
                    clienteValues.push(fecha_registro);
                }
                if (observaciones) {
                    clienteUpdates.push('observaciones = ?');
                    clienteValues.push(observaciones);
                }

                // Actualizar tabla cliente
                if (clienteUpdates.length > 0) {
                    clienteValues.push(idCliente);
                    const clienteQuery = `
                        UPDATE cliente
                        SET ${clienteUpdates.join(', ')}
                        WHERE idcliente = ?
                    `;
                    db.query(clienteQuery, clienteValues, (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Error al actualizar cliente:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Error al actualizar cliente' }));
                            });
                        }
                    });
                }

                // Construir dinámicamente la consulta para la tabla contacto
                const contactoUpdates = [];
                const contactoValues = [];

                if (celular) {
                    contactoUpdates.push('celular = ?');
                    contactoValues.push(celular);
                }
                if (correo) {
                    contactoUpdates.push('correo = ?');
                    contactoValues.push(correo);
                }
                if (facebook) {
                    contactoUpdates.push('facebook = ?');
                    contactoValues.push(facebook);
                }
                if (direccion) {
                    contactoUpdates.push('direccion = ?');
                    contactoValues.push(direccion);
                }

                if (contactoUpdates.length > 0) {
                    contactoValues.push(idCliente);
                    const contactoQuery = `
                        UPDATE contacto
                        SET ${contactoUpdates.join(', ')}
                        WHERE idcliente = ?
                    `;
                    db.query(contactoQuery, contactoValues, (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Error al actualizar contacto:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Error al actualizar contacto' }));
                            });
                        }
                    });
                }

                // Actualizar lista_negra y estado_cliente
                if (estado_cliente) {
                    const estadoQuery = `
                        UPDATE estado_cliente
                        SET estado_cliente = ?
                        WHERE idcliente = ?
                    `;
                    db.query(estadoQuery, [estado_cliente, idCliente], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Error al actualizar estado cliente:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Error al actualizar estado cliente' }));
                            });
                        }
                    });
                }

                if (lista_negra) {
                    const listaNegraQuery = `
                        UPDATE lista_negra
                        SET lista_negra = ?
                        WHERE idcliente = ?
                    `;
                    db.query(listaNegraQuery, [lista_negra, idCliente], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Error al actualizar lista negra:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Error al actualizar lista negra' }));
                            });
                        }
                    });
                }

                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error al confirmar transacción:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Error al confirmar transacción' }));
                        });
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Actualización exitosa' }));
                });
            });
        };

        // Verificar si el celular ya existe
        if (celular) {
            const verificarCelularQuery = `
                SELECT COUNT(*) AS count FROM contacto WHERE celular = ? AND idcliente != ?
            `;
            db.query(verificarCelularQuery, [celular, idCliente], (err, results) => {
                if (err) {
                    console.error('Error verificando número de celular:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Error en el servidor' }));
                }

                if (results[0].count > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'El número de celular ya está registrado por otro cliente' }));
                }

                verificarYActualizar();
            });
        } else {
            verificarYActualizar();
        }
    });
}




function handleConsultas(req, res) {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);

    let query = `
    SELECT 
    cliente.idcliente, 
    cliente.nombre, 
    cliente.apellidopaterno, 
    cliente.apellidomaterno, 
    NULLIF(cliente.fecha_ingreso, '0000-00-00') AS fecha_ingreso, 
    NULLIF(cliente.fecha_alta, '0000-00-00') AS fecha_alta, 
    NULLIF(cliente.fecha_registro, '0000-00-00') AS fecha_registro, 
    cliente.observaciones,
    contacto.celular, 
    contacto.correo, 
    contacto.facebook, 
    contacto.direccion, 
    estado_cliente.estado_cliente, 
    lista_negra.lista_negra
    FROM cliente
    INNER JOIN contacto ON cliente.idcliente = contacto.idcliente
    LEFT JOIN estado_cliente ON cliente.idcliente = estado_cliente.idcliente
    LEFT JOIN lista_negra ON cliente.idcliente = lista_negra.idcliente
    WHERE 1=1
    `;

    // Filtros dinámicos
    if (urlParams.has('idCliente') && urlParams.get('idCliente') !== '') {
        query += ` AND cliente.idcliente = ${mysql.escape(urlParams.get('idCliente'))}`;
    }
    if (urlParams.has('nombre') && urlParams.get('nombre') !== '') {
        query += ` AND cliente.nombre LIKE ${mysql.escape('%' + urlParams.get('nombre') + '%')}`;
    }
    if (urlParams.has('apellidoPaterno') && urlParams.get('apellidoPaterno') !== '') {
        query += ` AND cliente.apellidopaterno LIKE ${mysql.escape('%' + urlParams.get('apellidoPaterno') + '%')}`;
    }
    if (urlParams.has('apellidoMaterno') && urlParams.get('apellidoMaterno') !== '') {
        query += ` AND cliente.apellidomaterno LIKE ${mysql.escape('%' + urlParams.get('apellidoMaterno') + '%')}`;
    }
    if (urlParams.has('listaNegra') && urlParams.get('listaNegra') !== '') {
        query += ` AND (lista_negra.lista_negra = ${mysql.escape(urlParams.get('listaNegra'))} OR lista_negra.lista_negra IS NULL)`;
    }
    if (urlParams.has('estadoCliente') && urlParams.get('estadoCliente') !== '') {
        query += ` AND (estado_cliente.estado_cliente = ${mysql.escape(urlParams.get('estadoCliente'))} OR estado_cliente.estado_cliente IS NULL)`;
    }
    if (urlParams.has('celular') && urlParams.get('celular') !== '') {
        query += ` AND contacto.celular LIKE ${mysql.escape('%' + urlParams.get('celular') + '%')}`;
    }

    console.log('Consulta generada:', query);

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error en la consulta de la base de datos' }));
            return;
        }
    
        // Formatear las fechas antes de enviar los resultados
        const formattedResults = results.map(row => {
            // Función para manejar fechas inválidas
            const formatDate = (dateString) => {
                if (!dateString || dateString === '0000-00-00') {
                    return null; // O puedes devolver 'N/A' o cualquier otro valor predeterminado
                }
                // Convertir a objeto Date y luego a formato ISO
                return new Date(dateString).toISOString().split('T')[0];
            };
        
            return {
                ...row,
                fecha_ingreso: formatDate(row.fecha_ingreso),
                fecha_alta: formatDate(row.fecha_alta),
                fecha_registro: formatDate(row.fecha_registro),
            };
        });
    
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formattedResults));
    });
}


function handleEliminarPacientes(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { ids } = JSON.parse(body);

            // Validar que se hayan proporcionado IDs
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'No se proporcionaron IDs para eliminar.' }));
            }

            // Iniciar una transacción para garantizar consistencia
            db.beginTransaction(err => {
                if (err) {
                    console.error('Error al iniciar la transacción:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Error al iniciar la transacción.' }));
                }

                // Eliminar filas relacionadas en la tabla lista_negra
                const deleteListaNegraQuery = 'DELETE FROM lista_negra WHERE idcliente IN (?)';
                db.query(deleteListaNegraQuery, [ids], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error al eliminar de lista_negra:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Error al eliminar de lista_negra.' }));
                        });
                    }

                    // Eliminar filas relacionadas en la tabla estado_cliente
                    const deleteEstadoClienteQuery = 'DELETE FROM estado_cliente WHERE idcliente IN (?)';
                    db.query(deleteEstadoClienteQuery, [ids], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Error al eliminar de estado_cliente:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Error al eliminar de estado_cliente.' }));
                            });
                        }

                        // Eliminar filas relacionadas en la tabla contacto
                        const deleteContactoQuery = 'DELETE FROM contacto WHERE idcliente IN (?)';
                        db.query(deleteContactoQuery, [ids], (err, result) => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error('Error al eliminar de contacto:', err);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'Error al eliminar de contacto.' }));
                                });
                            }

                            // Finalmente, eliminar filas en la tabla cliente
                            const deleteClienteQuery = 'DELETE FROM cliente WHERE idcliente IN (?)';
                            db.query(deleteClienteQuery, [ids], (err, result) => {
                                if (err) {
                                    return db.rollback(() => {
                                        console.error('Error al eliminar de cliente:', err);
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ error: 'Error al eliminar de cliente.' }));
                                    });
                                }

                                // Confirmar la transacción
                                db.commit(err => {
                                    if (err) {
                                        return db.rollback(() => {
                                            console.error('Error al confirmar la transacción:', err);
                                            res.writeHead(500, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({ error: 'Error al confirmar la transacción.' }));
                                        });
                                    }

                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ message: `${result.affectedRows} pacientes eliminados correctamente.` }));
                                });
                            });
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Error procesando la solicitud:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Datos no válidos.' }));
        }
    });
}




server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    const url = `http://localhost:${PORT}`; // Asegúrate de que sea una URL válida
    if (process.platform === 'win32') {
        exec(`start ${url}`); // Windows
    } else if (process.platform === 'darwin') {
        exec(`open ${url}`); // macOS
    } else if (process.platform === 'linux') {
        exec(`xdg-open ${url}`); // Linux
    }
});
