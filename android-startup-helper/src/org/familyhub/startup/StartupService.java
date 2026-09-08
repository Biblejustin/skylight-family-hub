package org.familyhub.startup;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

public final class StartupService extends Service {
    static final String EXTRA_BOOT = "boot";
    private static final String CHANNEL = "startup";
    private static final int NOTIFICATION_ID = 1;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable pendingLaunch;

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (pendingLaunch != null) handler.removeCallbacks(pendingLaunch);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL,
                "Startup countdown", NotificationManager.IMPORTANCE_LOW));
        PendingIntent openHelper = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("Opening Family Hub")
                .setContentText("Fully Kiosk will open in 20 seconds. Tap for startup controls.")
                .setContentIntent(openHelper).setOngoing(true).setShowWhen(false).build();
        startForeground(NOTIFICATION_ID, notification);

        final boolean fromBoot = intent != null && intent.getBooleanExtra(EXTRA_BOOT, false);
        String problem = StartupState.prerequisiteProblem(this);
        if (problem != null || (fromBoot && !StartupState.enabled(this))) {
            StartupState.record(this, problem != null ? "Start skipped: " + problem : "Automatic startup disabled.");
            finish(startId);
            return START_NOT_STICKY;
        }

        StartupState.record(this, (fromBoot ? "Boot" : "Test") + " countdown started: 20 seconds.");
        pendingLaunch = () -> {
            String currentProblem = StartupState.prerequisiteProblem(this);
            if (currentProblem != null || (fromBoot && !StartupState.enabled(this))) {
                StartupState.record(this, currentProblem != null ? "Start skipped: " + currentProblem : "Automatic startup disabled.");
            } else {
                try {
                    startActivity(StartupState.fullyIntent());
                    // Android can silently reject a background start. Do not claim visual success.
                    StartupState.record(this, "Fully Kiosk launch requested. Confirm it appeared on screen.");
                } catch (RuntimeException e) {
                    StartupState.record(this, "Fully Kiosk launch failed: " + e.getClass().getSimpleName());
                }
            }
            finish(startId);
        };
        handler.postDelayed(pendingLaunch, StartupState.DELAY_MS);
        return START_NOT_STICKY;
    }

    private void finish(int startId) {
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelfResult(startId);
    }

    @Override public void onDestroy() {
        if (pendingLaunch != null) handler.removeCallbacks(pendingLaunch);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
