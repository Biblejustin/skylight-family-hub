package org.familyhub.startup;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.provider.Settings;

final class StartupState {
    static final long DELAY_MS = 20_000L;
    static final String FULLY_PACKAGE = "de.ozerov.fully";
    static final ComponentName FULLY = new ComponentName(FULLY_PACKAGE, FULLY_PACKAGE + ".MainActivity");

    private StartupState() {}

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("startup", Context.MODE_PRIVATE);
    }

    static boolean enabled(Context context) {
        return preferences(context).getBoolean("enabled", false);
    }

    static void setEnabled(Context context, boolean enabled) {
        preferences(context).edit().putBoolean("enabled", enabled).apply();
    }

    static void record(Context context, String message) {
        preferences(context).edit().putString("status", message)
                .putLong("status_time", System.currentTimeMillis()).apply();
    }

    static boolean fullyAvailable(Context context) {
        try {
            ActivityInfo info = context.getPackageManager().getActivityInfo(FULLY, 0);
            return info.enabled && info.applicationInfo.enabled && info.exported;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    static String prerequisiteProblem(Context context) {
        if (!fullyAvailable(context)) return "Fully Kiosk is missing or its main activity is unavailable.";
        if (!Settings.canDrawOverlays(context)) return "Allow display over other apps before automatic startup.";
        return null;
    }

    static Intent fullyIntent() {
        return new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                .setComponent(FULLY).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
    }
}
