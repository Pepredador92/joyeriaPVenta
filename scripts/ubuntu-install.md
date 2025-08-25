# Instalación de Vangelico POS en Ubuntu

Requisitos mínimos
- Ubuntu 22.04 o 24.04 (x64)
- 2 GB RAM, 1 GB de disco libre

Opción 1: Descargar paquete listo
1) Desde una terminal, descarga el .deb o .AppImage generado por nosotros.
2) Instala el .deb:
   sudo apt install ./Vangelico-<version>-amd64.deb
   
   O ejecuta el .AppImage:
   chmod +x Vangelico-<version>-x86_64.AppImage
   ./Vangelico-<version>-x86_64.AppImage

Opción 2: Construir localmente
1) Instala Node.js 18+ y npm
   sudo apt update
   sudo apt install -y curl git build-essential
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

2) Clona el repositorio y entra a la carpeta
   git clone https://github.com/Pepredador92/joyeriaPVenta.git
   cd joyeriaPVenta

3) Instala dependencias y construye
   npm ci
   npm run build
   npm run build:linux

4) Paquetes generados
   release/ contiene:
   - Vangelico-<version>-amd64.deb (instalable en Ubuntu)
   - Vangelico-<version>-x86_64.AppImage (portable)

Notas
- Los datos se guardan en: ~/.config/Vangelico
- Para borrar ventas manualmente: edita ~/.config/Vangelico/sales.json
- Para ejecutar en desarrollo: npm run dev (requiere entorno gráfico)
