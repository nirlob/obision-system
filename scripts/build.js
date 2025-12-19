#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = 'builddir';

console.log('🚀 Building GNOME App...');

// Clean directories
if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true });
}

// Create directories
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Compile TypeScript
console.log('🔨 Compiling TypeScript...');
try {
    execSync('npx tsc --outDir builddir --rootDir src', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ TypeScript compilation failed');
    process.exit(1);
}

console.log('🔄 Converting for GJS...');

// Function to clean CommonJS/TypeScript artifacts from generated JS
function cleanJSContent(content) {
    return content
        // Remove CommonJS exports
        .replace(/exports\.\w+\s*=.*?;?\n?/g, '')
        .replace(/Object\.defineProperty\(exports,.*?\n/g, '')
        .replace(/exports\s*=\s*void 0;\s*\n?/g, '')
        .replace(/"use strict";\s*\n?/g, '')
        .replace(/var __importDefault.*?\n/g, '')
        .replace(/this && this\.__importDefault.*?\n/g, '')
        .replace(/return \(mod && mod\.__esModule\).*?\n/g, '')

        // Remove require statements and imports
        .replace(/const.*?require\(.*?\).*?;\s*\n?/g, '')
        .replace(/const.*?__importDefault.*?;\s*\n?/g, '')

        // Replace TypeScript generated references
        .replace(/gtk_4_0_1\.default\./g, 'Gtk.')
        .replace(/gdk_4_0_1\.default\./g, 'Gdk.')
        .replace(/gio_2_0_1\.default\./g, 'Gio.')
        .replace(/glib_2_0_1\.default\./g, 'GLib.')
        .replace(/pango_1_0_1\.default\./g, 'Pango.')
        .replace(/adw_1_1\.default\./g, 'Adw.')

        // Replace service references
        .replace(/utils_service_1\.UtilsService/g, 'UtilsService')
        .replace(/auth_service_1\.AuthService/g, 'AuthService')
        .replace(/settings_service_1\.SettingsService/g, 'SettingsService')
        .replace(/data_service_1\.DataService/g, 'DataService')
        .replace(/resume_service_1\.ResumeService/g, 'ResumeService')
        .replace(/network_service_1\.NetworkService/g, 'NetworkService')
        .replace(/processes_service_1\.ProcessesService/g, 'ProcessesService')
        .replace(/logs_service_1\.LogsService/g, 'LogsService')

        // Replace atom component references
        .replace(/top_processes_list_1\.TopProcessesList/g, 'TopProcessesList')
        .replace(/top_processes_list_1\./g, '')
        .replace(/info_row_1\.InfoRow/g, 'InfoRow')
        .replace(/info_row_1\./g, '')

        // Remove other artifacts
        .replace(/\s*void 0;\s*\n?/g, '')
        .replace(/^\s*\n/gm, '') // Remove empty lines
        .trim();
}

// GJS header
const gjsHeader = `#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

const { Gio } = imports.gi;
const { Gtk } = imports.gi;
const { Gdk } = imports.gi;
const { Adw } = imports.gi;
const { GLib } = imports.gi;
const { Pango } = imports.gi;

`;

// Read and process the components
let combinedContent = gjsHeader;

// Add interfaces (TypeScript interfaces are removed during transpilation, but we process them for consistency)
const interfaceFiles = ['application', 'category', 'resume', 'network', 'processes', 'logs'];
for (const interfaceName of interfaceFiles) {
    const interfaceFile = path.join(BUILD_DIR, 'interfaces', `${interfaceName}.js`);
    if (fs.existsSync(interfaceFile)) {
        console.log(`📋 Processing ${interfaceName} interface...`);
        // Interfaces are stripped during transpilation, so we just check they exist
    }
}

// Add SettingsService service
const settingsServiceFile = path.join(BUILD_DIR, 'services', 'settings-service.js');
if (fs.existsSync(settingsServiceFile)) {
    console.log('📋 Adding SettingsService service...');
    let settingsServiceContent = fs.readFileSync(settingsServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = settingsServiceContent.indexOf('class SettingsService {');
    if (classStartIndex !== -1) {
        settingsServiceContent = settingsServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    settingsServiceContent = cleanJSContent(settingsServiceContent);

    combinedContent += settingsServiceContent + '\n';
}

// Add UtilsService service
const utilsServiceFile = path.join(BUILD_DIR, 'services', 'utils-service.js');
if (fs.existsSync(utilsServiceFile)) {
    console.log('📋 Adding UtilsService service...');
    let utilsServiceContent = fs.readFileSync(utilsServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = utilsServiceContent.indexOf('class UtilsService {');
    if (classStartIndex !== -1) {
        utilsServiceContent = utilsServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    utilsServiceContent = cleanJSContent(utilsServiceContent);

    combinedContent += utilsServiceContent + '\n';
}

// Add ResumeService service
const resumeServiceFile = path.join(BUILD_DIR, 'services', 'resume-service.js');
if (fs.existsSync(resumeServiceFile)) {
    console.log('📋 Adding ResumeService service...');
    let resumeServiceContent = fs.readFileSync(resumeServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = resumeServiceContent.indexOf('class ResumeService {');
    if (classStartIndex !== -1) {
        resumeServiceContent = resumeServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    resumeServiceContent = cleanJSContent(resumeServiceContent);

    combinedContent += resumeServiceContent + '\n';
}

// Add NetworkService service
const networkServiceFile = path.join(BUILD_DIR, 'services', 'network-service.js');
if (fs.existsSync(networkServiceFile)) {
    console.log('📋 Adding NetworkService service...');
    let networkServiceContent = fs.readFileSync(networkServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = networkServiceContent.indexOf('class NetworkService {');
    if (classStartIndex !== -1) {
        networkServiceContent = networkServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    networkServiceContent = cleanJSContent(networkServiceContent);

    combinedContent += networkServiceContent + '\n';
}

// Add ProcessesService service
const processesServiceFile = path.join(BUILD_DIR, 'services', 'processes-service.js');
if (fs.existsSync(processesServiceFile)) {
    console.log('📋 Adding ProcessesService service...');
    let processesServiceContent = fs.readFileSync(processesServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = processesServiceContent.indexOf('class ProcessesService {');
    if (classStartIndex !== -1) {
        processesServiceContent = processesServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    processesServiceContent = cleanJSContent(processesServiceContent);

    combinedContent += processesServiceContent + '\n';
}

// Add LogsService service
const logsServiceFile = path.join(BUILD_DIR, 'services', 'logs-service.js');
if (fs.existsSync(logsServiceFile)) {
    console.log('📋 Adding LogsService service...');
    let logsServiceContent = fs.readFileSync(logsServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = logsServiceContent.indexOf('class LogsService {');
    if (classStartIndex !== -1) {
        logsServiceContent = logsServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    logsServiceContent = cleanJSContent(logsServiceContent);

    combinedContent += logsServiceContent + '\n';
}

// Add DataService service
const dataServiceFile = path.join(BUILD_DIR, 'services', 'data-service.js');
if (fs.existsSync(dataServiceFile)) {
    console.log('📋 Adding DataService service...');
    let dataServiceContent = fs.readFileSync(dataServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = dataServiceContent.indexOf('class DataService {');
    if (classStartIndex !== -1) {
        dataServiceContent = dataServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    dataServiceContent = cleanJSContent(dataServiceContent);

    combinedContent += dataServiceContent + '\n';
}

// Add InfoRow atom component
const infoRowFile = path.join(BUILD_DIR, 'components', 'atoms', 'info-row.js');
if (fs.existsSync(infoRowFile)) {
    console.log('📋 Adding InfoRow atom...');
    let infoRowContent = fs.readFileSync(infoRowFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = infoRowContent.indexOf('class InfoRow {');
    if (classStartIndex !== -1) {
        infoRowContent = infoRowContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    infoRowContent = cleanJSContent(infoRowContent);

    combinedContent += infoRowContent + '\n';
}

// Add TopProcessesList atom component
const topProcessesListFile = path.join(BUILD_DIR, 'components', 'atoms', 'top-processes-list.js');
if (fs.existsSync(topProcessesListFile)) {
    console.log('📋 Adding TopProcessesList atom...');
    let topProcessesListContent = fs.readFileSync(topProcessesListFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = topProcessesListContent.indexOf('class TopProcessesList {');
    if (classStartIndex !== -1) {
        topProcessesListContent = topProcessesListContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    topProcessesListContent = cleanJSContent(topProcessesListContent)
        .replace(/utils_service_1\./g, '');

    combinedContent += topProcessesListContent + '\n';
}

// Add InstallDialog component
const installDialogFile = path.join(BUILD_DIR, 'components', 'install-dialog.js');
if (fs.existsSync(installDialogFile)) {
    let installDialogContent = fs.readFileSync(installDialogFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = installDialogContent.indexOf('class InstallDialog {');
    if (classStartIndex !== -1) {
        installDialogContent = installDialogContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    installDialogContent = cleanJSContent(installDialogContent)
        .replace(/data_service_1\./g, '')
        .replace(/utils_service_1\./g, ''); // Additional cleanup for this component

    combinedContent += installDialogContent + '\n';
}

// Add ApplicationInfoDialog component
const applicationInfoDialogFile = path.join(BUILD_DIR, 'components', 'application-info-dialog.js');
if (fs.existsSync(applicationInfoDialogFile)) {
    console.log('📋 Adding ApplicationInfoDialog component...');
    let applicationInfoDialogContent = fs.readFileSync(applicationInfoDialogFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = applicationInfoDialogContent.indexOf('class ApplicationInfoDialog {');
    if (classStartIndex !== -1) {
        applicationInfoDialogContent = applicationInfoDialogContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    applicationInfoDialogContent = cleanJSContent(applicationInfoDialogContent)
        .replace(/utils_service_1\./g, ''); // Additional cleanup for this component

    combinedContent += applicationInfoDialogContent + '\n';
}

// Add Resume component
const resumeComponentFile = path.join(BUILD_DIR, 'components', 'resume.js');
if (fs.existsSync(resumeComponentFile)) {
    console.log('📋 Adding ResumeComponent...');
    let resumeContent = fs.readFileSync(resumeComponentFile, 'utf8');

    const classStartIndex = resumeContent.indexOf('class ResumeComponent {');
    if (classStartIndex !== -1) {
        resumeContent = resumeContent.substring(classStartIndex);
    }

    resumeContent = cleanJSContent(resumeContent)
        .replace(/utils_service_1\./g, '')
        .replace(/data_service_1\./g, '');
    combinedContent += resumeContent + '\n';
}

// Add CPU component
const cpuComponentFile = path.join(BUILD_DIR, 'components', 'cpu.js');
if (fs.existsSync(cpuComponentFile)) {
    console.log('📋 Adding CpuComponent...');
    let cpuContent = fs.readFileSync(cpuComponentFile, 'utf8');

    const classStartIndex = cpuContent.indexOf('class CpuComponent {');
    if (classStartIndex !== -1) {
        cpuContent = cpuContent.substring(classStartIndex);
    }

    cpuContent = cleanJSContent(cpuContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += cpuContent + '\n';
}

// Add GPU component
const gpuComponentFile = path.join(BUILD_DIR, 'components', 'gpu.js');
if (fs.existsSync(gpuComponentFile)) {
    console.log('📋 Adding GpuComponent...');
    let gpuContent = fs.readFileSync(gpuComponentFile, 'utf8');

    const classStartIndex = gpuContent.indexOf('class GpuComponent {');
    if (classStartIndex !== -1) {
        gpuContent = gpuContent.substring(classStartIndex);
    }

    gpuContent = cleanJSContent(gpuContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += gpuContent + '\n';
}

// Add Memory component
const memoryComponentFile = path.join(BUILD_DIR, 'components', 'memory.js');
if (fs.existsSync(memoryComponentFile)) {
    console.log('📋 Adding MemoryComponent...');
    let memoryContent = fs.readFileSync(memoryComponentFile, 'utf8');

    const classStartIndex = memoryContent.indexOf('class MemoryComponent {');
    if (classStartIndex !== -1) {
        memoryContent = memoryContent.substring(classStartIndex);
    }

    memoryContent = cleanJSContent(memoryContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += memoryContent + '\n';
}

// Add Disk component
const diskComponentFile = path.join(BUILD_DIR, 'components', 'disk.js');
if (fs.existsSync(diskComponentFile)) {
    console.log('📋 Adding DiskComponent...');
    let diskContent = fs.readFileSync(diskComponentFile, 'utf8');

    const classStartIndex = diskContent.indexOf('class DiskComponent {');
    if (classStartIndex !== -1) {
        diskContent = diskContent.substring(classStartIndex);
    }

    diskContent = cleanJSContent(diskContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += diskContent + '\n';
}

// Add Network component
const networkComponentFile = path.join(BUILD_DIR, 'components', 'network.js');
if (fs.existsSync(networkComponentFile)) {
    console.log('📋 Adding NetworkComponent...');
    let networkContent = fs.readFileSync(networkComponentFile, 'utf8');

    const classStartIndex = networkContent.indexOf('class NetworkComponent {');
    if (classStartIndex !== -1) {
        networkContent = networkContent.substring(classStartIndex);
    }

    networkContent = cleanJSContent(networkContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += networkContent + '\n';
}

// Add SystemInfo component
const systemInfoComponentFile = path.join(BUILD_DIR, 'components', 'system-info.js');
if (fs.existsSync(systemInfoComponentFile)) {
    console.log('📋 Adding SystemInfoComponent...');
    let systemInfoContent = fs.readFileSync(systemInfoComponentFile, 'utf8');

    const classStartIndex = systemInfoContent.indexOf('class SystemInfoComponent {');
    if (classStartIndex !== -1) {
        systemInfoContent = systemInfoContent.substring(classStartIndex);
    }

    systemInfoContent = cleanJSContent(systemInfoContent)
        .replace(/utils_service_1\./g, '')
        .replace(/info_row_1\.InfoRow/g, 'InfoRow')
        .replace(/info_row_1\./g, '');
    combinedContent += systemInfoContent + '\n';
}

// Add Battery component
const batteryComponentFile = path.join(BUILD_DIR, 'components', 'battery.js');
if (fs.existsSync(batteryComponentFile)) {
    console.log('📋 Adding BatteryComponent...');
    let batteryContent = fs.readFileSync(batteryComponentFile, 'utf8');

    const classStartIndex = batteryContent.indexOf('class BatteryComponent {');
    if (classStartIndex !== -1) {
        batteryContent = batteryContent.substring(classStartIndex);
    }

    batteryContent = cleanJSContent(batteryContent)
        .replace(/utils_service_1\./g, '')
        .replace(/data_service_1\./g, '')
        .replace(/gtk_4_0_1\./g, 'Gtk.')
        .replace(/glib_2_0_1\./g, 'GLib.');
    combinedContent += batteryContent + '\n';
}

// Add Resources component
const resourcesComponentFile = path.join(BUILD_DIR, 'components', 'resources.js');
if (fs.existsSync(resourcesComponentFile)) {
    console.log('📋 Adding ResourcesComponent...');
    let resourcesContent = fs.readFileSync(resourcesComponentFile, 'utf8');

    const classStartIndex = resourcesContent.indexOf('class ResourcesComponent {');
    if (classStartIndex !== -1) {
        resourcesContent = resourcesContent.substring(classStartIndex);
    }

    resourcesContent = cleanJSContent(resourcesContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += resourcesContent + '\n';
}

// Add Processes component
const processesComponentFile = path.join(BUILD_DIR, 'components', 'processes.js');
if (fs.existsSync(processesComponentFile)) {
    console.log('📋 Adding ProcessesComponent...');
    let processesContent = fs.readFileSync(processesComponentFile, 'utf8');

    const classStartIndex = processesContent.indexOf('class ProcessesComponent {');
    if (classStartIndex !== -1) {
        processesContent = processesContent.substring(classStartIndex);
    }

    processesContent = cleanJSContent(processesContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += processesContent + '\n';
}

// Add Services component
const servicesComponentFile = path.join(BUILD_DIR, 'components', 'services.js');
if (fs.existsSync(servicesComponentFile)) {
    console.log('📋 Adding ServicesComponent...');
    let servicesContent = fs.readFileSync(servicesComponentFile, 'utf8');

    const classStartIndex = servicesContent.indexOf('class ServicesComponent {');
    if (classStartIndex !== -1) {
        servicesContent = servicesContent.substring(classStartIndex);
    }

    servicesContent = cleanJSContent(servicesContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += servicesContent + '\n';
}

// Add Drivers component
const driversComponentFile = path.join(BUILD_DIR, 'components', 'drivers.js');
if (fs.existsSync(driversComponentFile)) {
    console.log('📋 Adding DriversComponent...');
    let driversContent = fs.readFileSync(driversComponentFile, 'utf8');

    const classStartIndex = driversContent.indexOf('class DriversComponent {');
    if (classStartIndex !== -1) {
        driversContent = driversContent.substring(classStartIndex);
    }

    driversContent = cleanJSContent(driversContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += driversContent + '\n';
}

// Add UserLogs component
const userLogsComponentFile = path.join(BUILD_DIR, 'components', 'user-logs.js');
if (fs.existsSync(userLogsComponentFile)) {
    console.log('📋 Adding UserLogsComponent...');
    let userLogsContent = fs.readFileSync(userLogsComponentFile, 'utf8');

    const classStartIndex = userLogsContent.indexOf('class UserLogsComponent {');
    if (classStartIndex !== -1) {
        userLogsContent = userLogsContent.substring(classStartIndex);
    }

    userLogsContent = cleanJSContent(userLogsContent)
        .replace(/utils_service_1\./g, '');
    combinedContent += userLogsContent + '\n';
}

// Add ApplicationsList component
const applicationsListFile = path.join(BUILD_DIR, 'components', 'applications-list.js');
if (fs.existsSync(applicationsListFile)) {
    console.log('📋 Adding ApplicationsList component...');
    let applicationsContent = fs.readFileSync(applicationsListFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = applicationsContent.indexOf('class ApplicationsList {');
    if (classStartIndex !== -1) {
        applicationsContent = applicationsContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    applicationsContent = cleanJSContent(applicationsContent)
        .replace(/InstallPackageDialog_js_1\./g, '')
        .replace(/PackageInfoDialog_js_1\./g, '')
        .replace(/utils_service_js_1\./g, '')
        .replace(/application_info_dialog_js_1\./g, '')
        .replace(/data_service_js_1\./g, '');

    combinedContent += applicationsContent + '\n';
}

// Add main application
const mainJsFile = path.join(BUILD_DIR, 'main.js');
if (fs.existsSync(mainJsFile)) {
    console.log('📋 Adding main application...');
    let mainContent = fs.readFileSync(mainJsFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = mainContent.indexOf('class ObisionStatusApplication {');
    if (classStartIndex !== -1) {
        mainContent = mainContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    mainContent = cleanJSContent(mainContent)
        .replace(/resume_1\./g, '')
        .replace(/cpu_1\./g, '')
        .replace(/gpu_1\./g, '')
        .replace(/memory_1\./g, '')
        .replace(/disk_1\./g, '')
        .replace(/network_1\./g, '')
        .replace(/system_info_1\./g, '')
        .replace(/battery_1\./g, '')
        .replace(/resources_1\./g, '')
        .replace(/processes_1\./g, '')
        .replace(/services_1\./g, '')
        .replace(/drivers_1\./g, '')
        .replace(/user_logs_1\./g, '')
        .replace(/applications_list_js_1\.ApplicationsList/g, 'ApplicationsList')
        .replace(/applications_list_js_1\./g, '')
        .replace(/install_dialog_js_1\./g, '')
        .replace(/data_service_js_1\./g, '');

    combinedContent += mainContent + '\n';
}

// Write the final combined file (overwrite main.js)
const appFile = path.join(BUILD_DIR, 'main.js');
fs.writeFileSync(appFile, combinedContent);
fs.chmodSync(appFile, 0o755);

// Copy resources
console.log('📁 Copying resources...');
const dataUiSrc = 'data/ui';
const dataJsonSrc = 'data/applications.json';
const dataUiDest = path.join(BUILD_DIR, 'data/ui');
const dataJsonDest = path.join(BUILD_DIR, 'data/applications.json');
const dataIconsSrc = 'data/icons';
const dataIconsDest = path.join(BUILD_DIR, 'data/icons');
const dataStylesSrc = 'data/styles.css';
const dataStylesDest = path.join(BUILD_DIR, 'data/styles.css');

// Copy styles.css
if (fs.existsSync(dataStylesSrc)) {
    execSync(`cp ${dataStylesSrc} ${dataStylesDest}`, { stdio: 'pipe' });
}

// Copy icons if they exist
if (fs.existsSync(dataIconsSrc)) {
    execSync(`mkdir -p ${path.dirname(dataIconsDest)} && cp -r ${dataIconsSrc} ${path.dirname(dataIconsDest)}/`, { stdio: 'pipe' });
}

if (fs.existsSync(dataUiSrc)) {
    execSync(`mkdir -p ${path.dirname(dataUiDest)} && cp -r ${dataUiSrc} ${path.dirname(dataUiDest)}/`, { stdio: 'pipe' });
}

if (fs.existsSync(dataJsonSrc)) {
    execSync(`cp ${dataJsonSrc} ${dataJsonDest}`, { stdio: 'pipe' });
}

// Copy and compile GSettings schema
const schemaFile = 'data/com.obision.app.system.gschema.xml';
const schemaDestDir = path.join(BUILD_DIR, 'data');
const schemaDest = path.join(schemaDestDir, 'com.obision.app.system.gschema.xml');

if (fs.existsSync(schemaFile)) {
    execSync(`mkdir -p ${schemaDestDir} && cp ${schemaFile} ${schemaDest}`, { stdio: 'pipe' });
    try {
        execSync(`glib-compile-schemas ${schemaDestDir}`, { stdio: 'pipe' });
    } catch (e) {
        console.log('⚠️  Warning: Failed to compile GSettings schema');
    }
}

console.log('✅ Build completed successfully!');
console.log(`📦 Application built to: ${appFile}`);
console.log('🚀 Run with: ./builddir/main.js');