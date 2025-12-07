import Gtk from "@girs/gtk-4.0";
import { UtilsService } from "../services/utils-service";
import { LogsService } from "../services/logs-service";
import { LogsData } from "../interfaces/logs";

export class LogsComponent {
    private container: Gtk.Box;
    private notebook: Gtk.Notebook;
    private refreshButton: Gtk.Button;
    private utils: UtilsService;
    private logsService: LogsService;
    private dataCallback!: (data: LogsData) => void;

    // System logs tab
    private systemLogsTextView!: Gtk.TextView;
    private systemLogsBuffer!: Gtk.TextBuffer;
    private systemLogFilterDropdown!: Gtk.DropDown;
    private systemPriorityDropdown!: Gtk.DropDown;
    private systemLinesSpinner!: Gtk.SpinButton;
    private systemAuthenticateButton!: Gtk.Button;

    // User logs tab
    private userLogsTextView!: Gtk.TextView;
    private userLogsBuffer!: Gtk.TextBuffer;
    private userLogFilterDropdown!: Gtk.DropDown;
    private userPriorityDropdown!: Gtk.DropDown;
    private userLinesSpinner!: Gtk.SpinButton;

    constructor() {
        this.utils = UtilsService.instance;
        this.logsService = LogsService.instance;

        const builder = Gtk.Builder.new();
        try {
            builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/logs.ui');
        } catch (e) {
            builder.add_from_file('data/ui/logs.ui');
        }

        this.container = builder.get_object('logs_container') as Gtk.Box;
        this.notebook = builder.get_object('notebook') as Gtk.Notebook;
        this.refreshButton = builder.get_object('refresh_button') as Gtk.Button;

        this.setupTabs();
        this.setupEventHandlers();
        
        // Subscribe to logs service
        this.dataCallback = this.onDataUpdate.bind(this);
        this.logsService.subscribeToUpdates(this.dataCallback);
    }

    private setupTabs(): void {
        // Create System Logs tab
        const systemTabContent = this.createTabContent(true);
        const systemTabLabel = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
        });
        systemTabLabel.append(new Gtk.Image({ icon_name: 'computer-symbolic' }));
        systemTabLabel.append(new Gtk.Label({ label: 'System Logs' }));
        this.notebook.append_page(systemTabContent, systemTabLabel);
        this.notebook.set_tab_reorderable(systemTabContent, false);
        this.notebook.set_tab_detachable(systemTabContent, false);

        // Create User Logs tab
        const userTabContent = this.createTabContent(false);
        const userTabLabel = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
        });
        userTabLabel.append(new Gtk.Image({ icon_name: 'user-available-symbolic' }));
        userTabLabel.append(new Gtk.Label({ label: 'User Logs' }));
        this.notebook.append_page(userTabContent, userTabLabel);
        this.notebook.set_tab_reorderable(userTabContent, false);
        this.notebook.set_tab_detachable(userTabContent, false);
    }

    private createTabContent(isSystemTab: boolean): Gtk.Box {
        const tabBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        // Filter controls
        const filterBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });

        filterBox.append(new Gtk.Label({ label: 'Filter:' }));

        const filterDropdown = new Gtk.DropDown();
        if (isSystemTab) {
            const filterModel = Gtk.StringList.new([
                'All Logs',
                'Kernel Logs',
                'Boot Logs',
                'System Services',
                'Authentication',
                'Cron Jobs',
                'Network Manager',
                'Bluetooth',
                'USB Events'
            ]);
            filterDropdown.set_model(filterModel);
            this.systemLogFilterDropdown = filterDropdown;
        } else {
            const filterModel = Gtk.StringList.new([
                'All User Logs',
                'User Services',
                'Desktop Session',
                'Applications',
                'Shell',
            ]);
            filterDropdown.set_model(filterModel);
            this.userLogFilterDropdown = filterDropdown;
        }
        filterDropdown.set_selected(0);
        filterBox.append(filterDropdown);

        filterBox.append(new Gtk.Label({ label: 'Priority:' }));

        const priorityDropdown = new Gtk.DropDown();
        const priorityModel = Gtk.StringList.new([
            'All Priorities',
            'Emergency',
            'Alert',
            'Critical',
            'Error',
            'Warning',
            'Notice',
            'Info',
            'Debug'
        ]);
        priorityDropdown.set_model(priorityModel);
        priorityDropdown.set_selected(0);
        filterBox.append(priorityDropdown);

        if (isSystemTab) {
            this.systemPriorityDropdown = priorityDropdown;
        } else {
            this.userPriorityDropdown = priorityDropdown;
        }

        filterBox.append(new Gtk.Label({ label: 'Lines:' }));

        const linesAdjustment = new Gtk.Adjustment({
            lower: 50,
            upper: 1000,
            step_increment: 50,
            page_increment: 100,
            value: 200,
        });
        const linesSpinner = new Gtk.SpinButton({
            adjustment: linesAdjustment,
        });
        filterBox.append(linesSpinner);

        if (isSystemTab) {
            this.systemLinesSpinner = linesSpinner;
            
            // Add authenticate button for system logs
            const authenticateButton = new Gtk.Button({
                label: 'Authenticate',
                tooltip_text: 'Authenticate to view all system logs',
            });
            filterBox.append(authenticateButton);
            this.systemAuthenticateButton = authenticateButton;
        } else {
            this.userLinesSpinner = linesSpinner;
        }

        tabBox.append(filterBox);

        // Logs display
        const scrolledWindow = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
        });

        const textView = new Gtk.TextView({
            editable: false,
            monospace: true,
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        if (isSystemTab) {
            this.systemLogsTextView = textView;
            this.systemLogsBuffer = textView.get_buffer();
        } else {
            this.userLogsTextView = textView;
            this.userLogsBuffer = textView.get_buffer();
        }

        scrolledWindow.set_child(textView);
        tabBox.append(scrolledWindow);

        return tabBox;
    }

    private onDataUpdate(data: LogsData): void {
        this.systemLogsBuffer.set_text(data.systemLogs, -1);
        this.userLogsBuffer.set_text(data.userLogs, -1);
    }

    private setupEventHandlers(): void {
        this.refreshButton.connect('clicked', () => {
            const isEnabled = this.logsService.toggleAutoRefresh();
            this.refreshButton.set_icon_name(isEnabled ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic');
            this.refreshButton.set_tooltip_text(isEnabled ? 'Disable Auto-refresh' : 'Enable Auto-refresh');
        });

        // System logs handlers
        this.systemLogFilterDropdown.connect('notify::selected', () => {
            const selectedFilter = this.systemLogFilterDropdown.get_selected();
            const selectedPriority = this.systemPriorityDropdown.get_selected();
            const numLines = this.systemLinesSpinner.get_value_as_int();
            this.logsService.setSystemLogFilter(selectedFilter, selectedPriority, numLines);
        });

        this.systemPriorityDropdown.connect('notify::selected', () => {
            const selectedFilter = this.systemLogFilterDropdown.get_selected();
            const selectedPriority = this.systemPriorityDropdown.get_selected();
            const numLines = this.systemLinesSpinner.get_value_as_int();
            this.logsService.setSystemLogFilter(selectedFilter, selectedPriority, numLines);
        });

        this.systemLinesSpinner.connect('value-changed', () => {
            const selectedFilter = this.systemLogFilterDropdown.get_selected();
            const selectedPriority = this.systemPriorityDropdown.get_selected();
            const numLines = this.systemLinesSpinner.get_value_as_int();
            this.logsService.setSystemLogFilter(selectedFilter, selectedPriority, numLines);
        });

        this.systemAuthenticateButton.connect('clicked', () => {
            this.logsService.loadSystemLogsWithSudo();
        });

        // User logs handlers
        this.userLogFilterDropdown.connect('notify::selected', () => {
            const selectedFilter = this.userLogFilterDropdown.get_selected();
            const selectedPriority = this.userPriorityDropdown.get_selected();
            const numLines = this.userLinesSpinner.get_value_as_int();
            this.logsService.setUserLogFilter(selectedFilter, selectedPriority, numLines);
        });

        this.userPriorityDropdown.connect('notify::selected', () => {
            const selectedFilter = this.userLogFilterDropdown.get_selected();
            const selectedPriority = this.userPriorityDropdown.get_selected();
            const numLines = this.userLinesSpinner.get_value_as_int();
            this.logsService.setUserLogFilter(selectedFilter, selectedPriority, numLines);
        });

        this.userLinesSpinner.connect('value-changed', () => {
            const selectedFilter = this.userLogFilterDropdown.get_selected();
            const selectedPriority = this.userPriorityDropdown.get_selected();
            const numLines = this.userLinesSpinner.get_value_as_int();
            this.logsService.setUserLogFilter(selectedFilter, selectedPriority, numLines);
        });
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }

    public destroy(): void {
        this.logsService.unsubscribe(this.dataCallback);
    }
}

