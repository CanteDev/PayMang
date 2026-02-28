# 📘 Manual de Usuario Maestro: EcoBomb - Gestion comisiones
Este manual proporciona una guía técnica y operativa exhaustiva para la gestión de alumnos, ventas, comisiones y configuración del sistema. Diseñado para ofrecer claridad absoluta a cada rol (Admin, Closer, Coach, Setter).

---

## 📌 Índice de Contenidos
1. [👑 ADMINISTRADOR: Configuración y Gestión Maestra](#1-administrador)
   - [Configuración de Negocio y Pasarelas](#configuracion-de-negocio)
   - [Sincronización y Gestión de Packs](#gestion-de-packs)
   - [Gestión de Alumnos y Asignación de Packs (Finanzas)](#gestion-de-alumnos)
2. [🚀 CLOSER: Generación de Ventas](#2-closer)
   - [Uso del Generador de Links Unificado](#generador-de-links)
3. [🎓 COACH: Gestión de Alumnos y Validación](#3-coach)
   - [Visibilidad y Validación de Comisiones](#validacion-coach)
4. [🎯 SETTER: Atribución de Ventas](#4-setter)
5. [🛠️ Solución de Problemas (FAQ)](#5-faq)

---

## 1. 👑 ADMINISTRADOR: Configuración y Gestión Maestra <a name="1-administrador"></a>

### A. Configuración de Negocio y Pasarelas <a name="configuracion-de-negocio"></a>
El administrador define las reglas del juego. En el panel de **Configuración**, se gestionan los porcentajes de comisión base y la conectividad con Stripe/Hotmart.

![Configuración de Comisiones](manual_assets/admin_settings_business_commissions_1772263238017.png)
*Pantalla de configuración de porcentajes por rol.*

![Conexión de Pasarelas](manual_assets/admin_settings_gateways_sync_1772263245593.png)
*Panel de sincronización con Stripe y Hotmart.*

### B. Sincronización y Gestión de Packs <a name="gestion-de-packs"></a>
Los packs **no se crean manualmente**; se sincronizan directamente desde las pasarelas para asegurar la integridad de los precios.
- **Acción:** Haga clic en `Sincronizar Productos` para importar las últimas ofertas.
- **Ofertas:** Puede cambiar el `Offer ID` o `Price ID` de un pack existente para ajustar promociones.

![Lista de Packs Sincronizados](manual_assets/admin_packs_list_1772263254076.png)
*Vista general de packs activos en el sistema.*

### C. Gestión de Alumnos y Asignación de Packs (Finanzas) <a name="gestion-de-alumnos"></a>
#### I. Añadir Alumno con Pack Inicial
Al crear un alumno, puede asignar su primer pack en la sección "Configuración de Venta Inicial".

![Nuevo Alumno con Pack](manual_assets/admin_new_student_modal_with_pack_1772263369026.png)

#### II. Añadir Pack a Alumno Existente (Botón Finanzas)
Si un alumno ya existe y desea añadirle un nuevo programa de mentoría, debe usar el botón **Finanzas** en la lista de alumnos.

![Vista Finanzas - Añadir Pack](manual_assets/admin_student_finance_add_pack_filled_1772280418251.png)
*Proceso de asignación manual de un segundo pack a un alumno.*

---

## 2. 🚀 CLOSER: Generación de Ventas <a name="2-closer"></a>

### Uso del Generador de Links Unificado <a name="generador-de-links"></a>
El Closer es responsable de cerrar las ventas utilizando el **Generador de Links**.
1. Seleccione el **Alumno** (debe tener un pack asignado previamente por Admin).
2. Seleccione el **Pack** correspondiente.
3. Elija la **Pasarela** (Stripe/Hotmart).
4. El sistema generará un enlace único y un QR para el cliente.


![Generador Vacío](manual_assets/closer_dashboard_link_generator_empty_1772280468240.png)
<!-- slide -->
![Generador Completado](manual_assets/closer_dashboard_link_generator_filled_1772280500545.png)
<!-- slide -->
![Link Generado con Éxito](manual_assets/closer_dashboard_link_generated_success_1772280519833.png)


---

## 3. 🎓 COACH: Gestión de Alumnos y Validación <a name="3-coach"></a>

### Visibilidad y Validación de Comisiones <a name="validacion-coach"></a>
El Coach solo visualiza a los alumnos que tiene asignados (Segregación de datos). Su tarea crítica es **validar el hito de mentoría** para desbloquear su comisión.

![Dashboard de Coach](manual_assets/coach_dashboard_summary_1772280547552.png)
*Vista restringida del Coach.*

![Validación de Comisiones](manual_assets/coach_commissions_validation_1772280562709.png)
*Botones de acción para validar o reportar incidencias en comisiones pendientes.*

---

## 4. 🎯 SETTER: Atribución de Ventas <a name="4-setter"></a>
El Setter tiene una vista centrada en su rendimiento. En su dashboard, puede ver qué ventas se le han atribuido y el estado de sus comisiones (normalmente el 1% del total).

---

## 5. 🛠️ Solución de Problemas (FAQ) <a name="5-faq"></a>

- **¿Por qué no puedo generar un link?** Asegúrese de que el alumno tenga al menos un pack asignado (vía Botón Finanzas).
- **El Dashboard no muestra datos nuevos:** Verifique la sincronización en `Configuración > Pasarelas`. El sistema procesa webhooks en tiempo real, pero la sincronización de productos es manual.
- **Error al logear con otro rol:** Recuerde siempre **Cerrar Sesión** completamente. El navegador puede recordar credenciales previas; limpie los campos antes de escribir los nuevos.

---
