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

// First, add the interfaces from interfaces file if it exists
const applicationInterfaceFile = path.join(BUILD_DIR, 'interfaces', 'application.js');
if (fs.existsSync(applicationInterfaceFile)) {
    let applicationInterfaceContent = fs.readFileSync(applicationInterfaceFile, 'utf8');
    // Extract interface definitions (they will be removed by transpilation)
    console.log('📋 Adding interfaces...');
}

// First, add the interfaces from interfaces file if it exists
const categoryInterfaceFile = path.join(BUILD_DIR, 'interfaces', 'category.js');
if (fs.existsSync(categoryInterfaceFile)) {
    let categoryInterfaceContent = fs.readFileSync(categoryInterfaceFile, 'utf8');
    // Extract interface definitions (they will be removed by transpilation)
    console.log('📋 Adding interfaces...');
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
        .replace(/utils_service_1\./g, '');
    combinedContent += resumeContent + '\n';
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
        .replace(/utils_service_1\./g, '');
    combinedContent += systemInfoContent + '\n';
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

    resourcesContent = cleanJSContent(resourcesContent);
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
        .replace(/system_info_1\./g, '')
        .replace(/resources_1\./g, '')
        .replace(/processes_1\./g, '')
        .replace(/services_1\./g, '')
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

console.log('✅ Build completed successfully!');
console.log(`📦 Application built to: ${appFile}`);
console.log('🚀 Run with: ./builddir/main.js');