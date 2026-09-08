package org.familyhub.startup;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;
import java.text.DateFormat;
import java.util.Date;

public final class MainActivity extends Activity implements SharedPreferences.OnSharedPreferenceChangeListener {
    private TextView status;
    private Switch startup;
    private boolean refreshing;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding, padding, padding);
        content.setBackgroundColor(Color.rgb(246, 248, 245));
        scroll.addView(content);
        TextView title = new TextView(this);
        title.setText("Family Hub Startup"); title.setTextSize(28);
        content.addView(title);
        TextView description = new TextView(this);
        description.setText("Open Fully Kiosk once, 20 seconds after Android finishes booting. Existing Skylight apps stay installed. No overlay is drawn; Android 13 uses this permission to allow the delayed app launch.");
        description.setTextSize(17); description.setPadding(0, 16, 0, 16);
        content.addView(description);
        status = new TextView(this); status.setTextSize(16);
        content.addView(status);
        addButton(content, "Allow display over other apps", v -> {
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName())));
            } catch (RuntimeException e) { showMessage("Android could not open overlay permission settings."); }
        });
        startup = new Switch(this);
        startup.setText("Open Fully Kiosk after reboot"); startup.setTextSize(18);
        content.addView(startup);
        startup.setOnCheckedChangeListener((button, checked) -> {
            if (refreshing) return;
            String problem = checked ? StartupState.prerequisiteProblem(this) : null;
            if (problem != null) { showMessage(problem); refresh(); return; }
            StartupState.setEnabled(this, checked);
            if (!checked) stopService(new Intent(this, StartupService.class));
            StartupState.record(this, checked ? "Automatic startup enabled." : "Automatic startup disabled; pending countdown canceled.");
            refresh();
        });
        addButton(content, "Test delayed start (20 seconds)", v -> {
            String problem = StartupState.prerequisiteProblem(this);
            if (problem != null) { showMessage(problem); return; }
            try {
                startForegroundService(new Intent(this, StartupService.class));
                showMessage("Countdown started. Leave this app to test background launch.");
            } catch (RuntimeException e) { StartupState.record(this, "Test could not start: " + e.getClass().getSimpleName()); }
        });
        addButton(content, "Cancel pending start", v -> {
            stopService(new Intent(this, StartupService.class));
            StartupState.record(this, "Pending countdown canceled.");
        });
        addButton(content, "Open Fully Kiosk now", v -> {
            try { startActivity(StartupState.fullyIntent()); }
            catch (RuntimeException e) { showMessage("Fully Kiosk could not open: " + e.getClass().getSimpleName()); }
        });
        TextView footer = new TextView(this);
        footer.setText("To remove: turn startup off, then uninstall Family Hub Startup from Android app settings. This helper cannot access the internet, calendar, photos, contacts, or shared storage.");
        footer.setTextSize(15); footer.setPadding(0, 16, 0, 0); content.addView(footer);
        setContentView(scroll);
    }

    private void addButton(LinearLayout content, String label, View.OnClickListener action) {
        Button button = new Button(this); button.setText(label); button.setAllCaps(false);
        button.setOnClickListener(action); content.addView(button);
    }

    private void showMessage(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }

    private void refresh() {
        refreshing = true;
        startup.setChecked(StartupState.enabled(this));
        SharedPreferences prefs = StartupState.preferences(this);
        long last = prefs.getLong("status_time", 0);
        String timestamp = last == 0 ? "" : "\n" + DateFormat.getDateTimeInstance().format(new Date(last));
        boolean notifications = getSystemService(NotificationManager.class).areNotificationsEnabled();
        status.setText("Fully Kiosk: " + (StartupState.fullyAvailable(this) ? "available" : "unavailable")
                + "\nDisplay-over-apps permission: " + (Settings.canDrawOverlays(this) ? "allowed" : "needed")
                + "\nNotification drawer: " + (notifications ? "allowed" : "not allowed; Android still lists the active service")
                + "\n\n" + prefs.getString("status", "Startup is off. Allow permission, then enable startup.") + timestamp);
        refreshing = false;
    }

    @Override protected void onResume() {
        super.onResume(); StartupState.preferences(this).registerOnSharedPreferenceChangeListener(this); refresh();
    }

    @Override protected void onPause() {
        StartupState.preferences(this).unregisterOnSharedPreferenceChangeListener(this); super.onPause();
    }

    @Override public void onSharedPreferenceChanged(SharedPreferences prefs, String key) { refresh(); }
}
