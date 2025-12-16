import Gtk from '@girs/gtk-4.0';

/**
 * InfoRow - A reusable atom component for displaying information rows
 * Shows title (with optional description) on the left and value on the right
 */
export class InfoRow {
  private row: Gtk.ListBoxRow;

  constructor(title: string, value: string, description?: string) {
    // Create main container box
    const mainBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
      margin_start: 40,
      margin_end: 12,
      margin_top: 8,
      margin_bottom: 8,
    });

    if (description) {
      // Left side: Title and description (vertically stacked)
      const leftBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
        hexpand: true,
        valign: Gtk.Align.CENTER,
      });

      const titleLabel = new Gtk.Label({
        label: title,
        xalign: 0,
        wrap: false,
        ellipsize: 3, // Pango.EllipsizeMode.END
      });
      // Don't add title-4 class to keep title not bold

      const descriptionLabel = new Gtk.Label({
        label: description,
        xalign: 0,
        wrap: false,
        ellipsize: 3, // Pango.EllipsizeMode.END
      });
      descriptionLabel.add_css_class('dim-label');
      descriptionLabel.add_css_class('caption');

      leftBox.append(titleLabel);
      leftBox.append(descriptionLabel);
      mainBox.append(leftBox);
    } else {
      // No description: Title centered vertically on the left
      const titleLabel = new Gtk.Label({
        label: title,
        xalign: 0,
        wrap: false,
        ellipsize: 3, // Pango.EllipsizeMode.END
        hexpand: true,
        valign: Gtk.Align.CENTER,
      });
      // Don't add title-4 class to keep title not bold
      
      mainBox.append(titleLabel);
    }

    // Right side: Value
    const valueLabel = new Gtk.Label({
      label: value,
      xalign: 1,
      wrap: false,
      ellipsize: 3, // Pango.EllipsizeMode.END
      valign: Gtk.Align.CENTER,
    });
    valueLabel.add_css_class('monospace');

    mainBox.append(valueLabel);

    // Create list box row to contain our custom layout
    this.row = new Gtk.ListBoxRow({
      child: mainBox,
      activatable: false,
    });
  }

  public getWidget(): Gtk.ListBoxRow {
    return this.row;
  }
}
