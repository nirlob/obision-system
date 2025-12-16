# Atom Components

Los componentes "atom" son widgets reutilizables de bajo nivel que se utilizan en múltiples lugares de la aplicación.

## InfoRow

Componente reutilizable para mostrar información en formato de fila con título, valor y descripción opcional.

### Características

- **Diseño consistente**: Layout de tres columnas con alineación profesional
- **Título y descripción**: Alineados a la izquierda en su panel
- **Valor**: Alineado a la derecha con separación visual clara
- **Sin negrita en títulos**: Tipografía limpia y moderna
- **Centrado inteligente**: Centra verticalmente el título cuando no hay descripción
- **Descripciones contextuales**: Texto explicativo opcional para cada campo

### Uso

```typescript
import { InfoRow } from './atoms/info-row';

// Con descripción
const row = new InfoRow('CPU Usage', '45%', 'Current processor utilization').getWidget();
expanderRow.add_row(row as any);

// Sin descripción (se centrará verticalmente)
const simpleRow = new InfoRow('Temperature', '45°C').getWidget();
expanderRow.add_row(simpleRow as any);

// Para actualizar el valor dinámicamente
const row = new InfoRow('IP Address', '-').getWidget();
const valueLabel = (row.get_child() as Gtk.Box).get_last_child() as Gtk.Label;
// Luego actualizar el valor:
valueLabel.set_label('192.168.1.100');
```

### Dónde se usa

El componente InfoRow se utiliza en las siguientes secciones:

#### System Information (system-info.ts)
- **Hardware**: Display, CPU, GPU, Memory
- **Storage**: Disk mount points, swap, physical drives, partitions
- **Power**: Battery details (model, capacity, status, etc.)
- **Network**: Interfaces (IPv4, IPv6, MAC, MTU, RX/TX)
- **Connectivity**: WiFi, Ethernet, DNS, VPN, Firewall
- **Total**: ~66 filas de información

#### Component Views
- **CPU Component** (cpu.ts): Detalles de información de CPU
- **GPU Component** (gpu.ts): Detalles de información de GPU
- **Memory Component** (memory.ts): Detalles de información de memoria
- **Disk Component** (disk.ts): 
  - Filesystems: tipo, tamaño, espacio usado/disponible (4 filas por filesystem)
  - Physical drives: tipo, tamaño, operaciones R/W, SMART health, temperatura (6 filas por disco)
- **Network Component** (network.ts):
  - Network interfaces: IP, MAC, velocidad, bytes recibidos/transmitidos (5 filas por interfaz)
- **Battery Component** (battery.ts): Detalles de información de batería

### Ventajas

1. **Consistencia**: Todas las filas de información tienen el mismo aspecto
2. **Mantenibilidad**: Cambios de diseño se aplican automáticamente en toda la app
3. **Legibilidad**: Layout optimizado para presentar información de forma clara
4. **Reutilización**: Un solo componente para múltiples casos de uso
5. **Flexibilidad**: Con o sin descripción según las necesidades

## TopProcessesList

Componente reutilizable para mostrar una lista de los procesos principales con mayor uso de CPU y memoria.

### Características

- Lista de procesos ordenados por uso de recursos
- Actualización dinámica de datos
- Formato consistente para nombre de proceso y uso de recursos

### Uso

```typescript
import { TopProcessesList, ProcessInfo } from './atoms/top-processes-list';

const topProcessesList = new TopProcessesList(5); // Top 5 procesos
const widget = topProcessesList.getWidget();
someContainer.append(widget);

// Actualizar procesos
const processes: ProcessInfo[] = [
  { name: 'firefox', cpu: 25.5, memory: 1024000 },
  { name: 'code', cpu: 15.2, memory: 512000 }
];
topProcessesList.updateProcesses(processes);
```

### Dónde se usa

- Resume Component (resumen de procesos principales)
- CPU Component (procesos con mayor uso de CPU)
- Memory Component (procesos con mayor uso de memoria)
- Disk Component (procesos con mayor actividad de disco)
- Network Component (procesos con mayor tráfico de red)
