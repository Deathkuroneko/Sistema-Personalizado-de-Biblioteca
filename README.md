# DevSnippets

DevSnippets es una aplicación modular para organizar snippets de código, documentación técnica y conocimiento de desarrollo de forma estructurada y visual.

El proyecto comenzó como una aplicación web local construida únicamente con HTML, CSS y JavaScript, evolucionando posteriormente hacia una aplicación de escritorio multiplataforma utilizando Tauri + Rust.

---

# 🌐 Versión Web (HTML + CSS + JavaScript)

La versión original funciona completamente offline y no requiere instalación.

Ubicación principal:

```id="web-path"
📁 /dist
```

Para usarla:

1. Abrir:

```id="open-html"
dist/index.html
```

2. El navegador cargará automáticamente toda la interfaz.

---

# ✨ Características principales

* Gestión jerárquica de:

  * Títulos
  * Categorías
  * Subtítulos
  * Snippets

* Sistema de asociaciones entre subtítulos:

  * Principal
  * Secundario
  * Múltiples asociaciones

* Editor inline sin ventanas emergentes

* Búsqueda global avanzada en tiempo real

* Drag & Drop con SortableJS

* Resaltado de sintaxis offline con Highlight.js

* Sidebar dinámico

* Tema oscuro / claro

* Persistencia local automática

* Importación y exportación JSON

* Funciona completamente offline

---

# 📁 Estructura Frontend

```id="frontend-structure"
dist/
├── index.html
├── css/
├── js/
├── libs/
└── data/
```

---

# 📚 Librerías Integradas (Offline)

| Librería     | Uso                   |
| ------------ | --------------------- |
| Highlight.js | Resaltado de sintaxis |
| SortableJS   | Drag & Drop           |
| Lucide Icons | Íconos SVG modernos   |

Todas las librerías fueron integradas localmente para evitar dependencia de internet.

---
⚙️ Requisitos para Desarrollo
# ⚙️ Requisitos para Desarrollo

Para ejecutar o compilar DevSnippets desde el código fuente se necesitan las siguientes herramientas:

## Requisitos

### Node.js
Descargar:
https://nodejs.org/

Verificar instalación:
```bash
node -v
npm -v
```
Rust

Instalar desde:
https://www.rust-lang.org/tools/install

Verificar:
```bash
rustc --version
cargo --version
Windows Build Tools
```
Tauri requiere las herramientas de compilación de Visual Studio.

Instalar:

Visual Studio Build Tools
O Visual Studio Community

Seleccionar:

Desktop development with C++
Microsoft WebView2

Windows 10/11 normalmente ya lo incluye.

Verificar:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

Instalar:

Evergreen Bootstrapper (recomendado)

---


# 💻 Evolución a Aplicación Desktop (Tauri)

Posteriormente el proyecto fue migrado a Tauri para convertir DevSnippets en una aplicación de escritorio real con:

* Instalador Windows
* Persistencia en disco
* Acceso al sistema de archivos
* Ejecutable standalone
* Integración nativa con Windows

La configuración desktop se encuentra en:

```id="tauri-folder"
📁 /src-tauri
```

---

# 🚀 Ejecutar en modo desarrollo

```bash id="run-dev"
npm install
npx tauri dev
```

---

# 📦 Generar build desktop

```bash id="build-desktop"
npx tauri build
```

Los instaladores generados aparecerán en:

```id="build-output"
src-tauri/target/release/bundle/
```

---

# 🗂️ Persistencia de Datos

La aplicación desktop guarda automáticamente la información en:

```id="documents-path"
Documentos/DevSnippets/snippets.json
```

---

# 🛠️ Tecnologías Utilizadas

* HTML5
* CSS3
* JavaScript Vanilla
* Tauri v2
* Rust
* NSIS Installer

---

# 📌 Estado del Proyecto

Versión actual:

```id="version"
v1.0.0
```

Características completadas:

* ✔ Arquitectura modular
* ✔ Persistencia híbrida
* ✔ Sistema de asociaciones
* ✔ Drag & Drop
* ✔ Desktop App
* ✔ Instalador Windows
* ✔ Offline-first
