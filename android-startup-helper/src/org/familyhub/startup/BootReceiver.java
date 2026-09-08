package org.familyhub.startup;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || !StartupState.enabled(context)) return;
        String problem = StartupState.prerequisiteProblem(context);
        if (problem != null) {
            StartupState.record(context, "Boot skipped: " + problem);
            return;
        }
        try {
            context.startForegroundService(new Intent(context, StartupService.class)
                    .putExtra(StartupService.EXTRA_BOOT, true));
        } catch (RuntimeException e) {
            StartupState.record(context, "Boot service could not start: " + e.getClass().getSimpleName());
        }
    }
}
