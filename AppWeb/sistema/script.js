const loginForm = document.getElementById("loginForm");
const mensaje = document.getElementById("mensaje");

//Manejo de inicio de sesion y consultas

// Manejar el inicio de sesión
loginForm.addEventListener("submit", (event) => {
  event.preventDefault(); // Evita que la página se recargue

  const password = document.getElementById("password").value;

  // Enviar la contraseña al servidor para validación
  fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }), // Envía la contraseña al servidor
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) throw new Error("Contraseña incorrecta.");
        throw new Error("Ocurrió un error al iniciar sesión.");
      }
      return response.json();
    })
    .then((data) => {
      // Guardar el token en localStorage
      localStorage.setItem("token", data.token);
      const tokenGuardado = localStorage.getItem("token");
      if (!tokenGuardado) {
        throw new Error("Error al guardar el token en localStorage.");
      }

      // Mostrar mensaje de éxito
      mensaje.textContent = "Inicio de sesión exitoso. 🎉";
      mensaje.style.color = "green";

      // Redirigir después de iniciar sesión exitosamente
      setTimeout(() => {
        window.location.href = "./Vista/operaciones.html"; // Redirige al área protegida
      }, 1000);
    })
    .catch((error) => {
      console.error("Error en el inicio de sesión:", error.message);
      mensaje.textContent = error.message;
      mensaje.style.color = "red";
    });
});

// Manejar la consulta de clientes
document.getElementById("formConsulta").addEventListener("submit", function (event) {
  event.preventDefault();

  const formData = new FormData(event.target);

  const data = {
    idCliente: formData.get("idCliente"),
    nombre: formData.get("nombre"),
    apellidoPaterno: formData.get("apellidoPaterno"),
    apellidoMaterno: formData.get("apellidoMaterno"),
    listaNegra: formData.get("listaNegra"),
    estadoCliente: formData.get("estadoCliente"),
    celular: formData.get("celular")
  };

  // Recuperar el token del localStorage
  let token = null;
  if (typeof localStorage !== "undefined") {
    token = localStorage.getItem("token");
  }

  // Verificar si el token está disponible
  if (!token) {
    alert("Debe iniciar sesión para realizar esta operación.");
    return;
  }

  // Hacer la solicitud POST al servidor con el token
  fetch("/consultar-clientes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`, // Incluye el token en los encabezados
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) throw new Error("No autorizado. Inicie sesión nuevamente.");
        if (response.status === 403) throw new Error("Acceso denegado. Token inválido o expirado.");
        throw new Error("Ocurrió un error al consultar los datos.");
      }
      return response.json();
    })
    .then((results) => {
      // Construir la tabla de resultados
      let html =
        '<table><tr><th>ID Cliente</th><th>Nombre</th><th>Estado</th><th>Lista Negra</th></tr>';
      results.forEach((row) => {
        html += `<tr><td>${row.idcliente}</td><td>${row.nombre} ${row.apellidopaterno} ${row.apellidomaterno}</td><td>${row.estado_cliente}</td><td>${row.lista_negra}</td></tr>`;
      });
      html += "</table>";
      document.getElementById("resultados").innerHTML = html;
    })
    .catch((error) => {
      console.error("Error al consultar clientes:", error.message);
      alert(error.message);
    });
});
