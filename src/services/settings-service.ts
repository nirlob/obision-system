import Gio from '@girs/gio-2.0';

export class SettingsService {
  private static _instance: SettingsService;
  private settings: Gio.Settings;

  private constructor() {
    this.settings = new Gio.Settings({
      schema_id: 'com.obision.app.system',
    });
  }

  public static get instance(): SettingsService {
    if (!SettingsService._instance) {
      SettingsService._instance = new SettingsService();
    }
    return SettingsService._instance;
  }

  // Window state
  public getWindowWidth(): number {
    return this.settings.get_int('window-width');
  }

  public setWindowWidth(width: number): void {
    this.settings.set_int('window-width', width);
  }

  public getWindowHeight(): number {
    return this.settings.get_int('window-height');
  }

  public setWindowHeight(height: number): void {
    this.settings.set_int('window-height', height);
  }

  public getWindowX(): number {
    return this.settings.get_int('window-x');
  }

  public setWindowX(x: number): void {
    this.settings.set_int('window-x', x);
  }

  public getWindowY(): number {
    return this.settings.get_int('window-y');
  }

  public setWindowY(y: number): void {
    this.settings.set_int('window-y', y);
  }

  public getWindowMaximized(): boolean {
    return this.settings.get_boolean('window-maximized');
  }

  public setWindowMaximized(maximized: boolean): void {
    this.settings.set_boolean('window-maximized', maximized);
  }

  // Refresh interval
  public getRefreshInterval(): number {
    return this.settings.get_int('refresh-interval');
  }

  public setRefreshInterval(interval: number): void {
    this.settings.set_int('refresh-interval', interval);
  }

  // Last selected menu
  public getLastSelectedMenu(): number {
    return this.settings.get_int('last-selected-menu');
  }

  public setLastSelectedMenu(index: number): void {
    this.settings.set_int('last-selected-menu', index);
  }

  // Connect to changes
  public connectRefreshIntervalChanged(callback: (interval: number) => void): number {
    return this.settings.connect('changed::refresh-interval', () => {
      callback(this.getRefreshInterval());
    });
  }

  public disconnect(handlerId: number): void {
    this.settings.disconnect(handlerId);
  }
}
