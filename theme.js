// // js.js
// // =================== CAMBIO DE TEMA ===================
// const html = document.documentElement;
// const btnTheme = document.getElementById("btn-theme");

// // Clave de LS
// const THEME_KEY = "cp_theme";

// // Detectar tema guardado o sistema
// function getPreferredTheme() {
//   return localStorage.getItem(THEME_KEY) || "light";
// }

// function setTheme(theme) {
//   if (theme === "dark") {
//     html.setAttribute("data-bs-theme", "dark");
//     btnTheme.innerHTML = '<i class="bi bi-moon"></i> Claro';
//   } else {
//     html.setAttribute("data-bs-theme", "light");
//     btnTheme.innerHTML = '<i class="bi bi-sun"></i> Oscuro';
//   }
//   localStorage.setItem(THEME_KEY, theme);
// }

// // Inicializar
// document.addEventListener("DOMContentLoaded", () => {
//   setTheme(getPreferredTheme());

//   btnTheme.addEventListener("click", () => {
//     const current = html.getAttribute("data-bs-theme");
//     const next = current === "dark" ? "light" : "dark";
//     setTheme(next);
//   });
// });
