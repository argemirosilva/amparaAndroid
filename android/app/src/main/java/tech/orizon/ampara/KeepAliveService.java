package tech.orizon.ampara;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Serviço de foreground para manter o app ativo em Doze Mode profundo.
 * Implementa ping nativo e usa AlarmManager para acordar a rede.
 */
public class KeepAliveService extends Service {
    
    private static final String TAG = "KeepAliveService";
    private static final String CHANNEL_ID = "ampara_keepalive";
    private static final int NOTIFICATION_ID = 9999;
    private static final String WAKELOCK_TAG = "Ampara::KeepAliveLock";
    
    // Nome das SharedPreferences usado pelo SecureStoragePlugin
    private static final String PREFS_NAME = "ampara_secure_storage";
    private static final String API_URL = "https://ilikiajeduezvvanjejz.supabase.co/functions/v1/mobile-api";
    
    private PowerManager.WakeLock wakeLock;
    private ExecutorService executorService;
    private AlarmManager alarmManager;
    private PendingIntent alarmIntent;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");
        executorService = Executors.newSingleThreadExecutor();
        alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        
        createNotificationChannel();
        acquireWakeLock();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service started");
        
        Notification notification = createNotification();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, 
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        
        // Se o intent veio do alarme, executa o ping
        if (intent != null && "ACTION_PING".equals(intent.getAction())) {
            executeNativePing();
        }
        
        // Agenda o próximo ping
        scheduleNextPing();
        
        return START_STICKY;
    }
    
    private void scheduleNextPing() {
        Intent intent = new Intent(this, KeepAliveService.class);
        intent.setAction("ACTION_PING");
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        alarmIntent = PendingIntent.getService(this, 0, intent, flags);
        
        long triggerAtMillis = System.currentTimeMillis() + 30000; // 30 segundos
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // setExactAndAllowWhileIdle é crucial para Doze Mode
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, alarmIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, alarmIntent);
            }
            Log.d(TAG, "Next ping scheduled in 30s (ExactAndAllowWhileIdle)");
        } catch (SecurityException e) {
            // Fallback se a permissão de alarme exato não foi concedida (Android 12+)
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, alarmIntent);
            Log.w(TAG, "Exact alarm permission not granted, using inexact alarm");
        }
    }
    
    private void executeNativePing() {
        executorService.execute(() -> {
            Log.d(TAG, "Executing native ping...");
            
            // Garantir que o WakeLock está ativo durante o ping
            acquireWakeLock();
            
            HttpURLConnection conn = null;
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String token = prefs.getString("ampara_token", null);
                String userJson = prefs.getString("ampara_user", null);
                String deviceId = prefs.getString("ampara_device_id", "native-android-fallback");
                
                String email = null;
                if (userJson != null) {
                    try {
                        JSONObject userObj = new JSONObject(userJson);
                        email = userObj.getString("email");
                    } catch (Exception e) {
                        Log.e(TAG, "Error parsing user JSON: " + e.getMessage());
                    }
                }

                if (token == null) {
                    Log.w(TAG, "No token found in SecureStorage, skipping native ping");
                    return;
                }

                URL url = new URL(API_URL);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);

                JSONObject payload = new JSONObject();
                payload.put("action", "pingMobile");
                payload.put("session_token", token);
                payload.put("device_id", deviceId);
                if (email != null) {
                    payload.put("email_usuario", email);
                }

                String jsonInputString = payload.toString();
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int code = conn.getResponseCode();
                Log.d(TAG, "Native ping response code: " + code);
                
                // Tratamento especial para HTTP 401 (Sessão Expirada)
                if (code == 401) {
                    try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8))) {
                        StringBuilder response = new StringBuilder();
                        String responseLine;
                        while ((responseLine = br.readLine()) != null) {
                            response.append(responseLine.trim());
                        }
                        String errorBody = response.toString();
                        Log.e(TAG, "Session expired (401): " + errorBody);
                        
                        // Verificar se é realmente session_expired
                        try {
                            JSONObject errorJson = new JSONObject(errorBody);
                            if (errorJson.optBoolean("session_expired", false)) {
                                Log.e(TAG, "Session expired confirmed! Notifying JavaScript and stopping service...");
                                notifyJavaScriptSessionExpired();
                                stopSelf(); // Para o serviço
                                return;
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error parsing 401 response: " + e.getMessage());
                        }
                    }
                } else if (code != 200) {
                    try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8))) {
                        StringBuilder response = new StringBuilder();
                        String responseLine;
                        while ((responseLine = br.readLine()) != null) {
                            response.append(responseLine.trim());
                        }
                        Log.e(TAG, "Native ping error response: " + response.toString());
                    }
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Error in native ping: " + e.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Service destroyed");
        if (alarmManager != null && alarmIntent != null) {
            alarmManager.cancel(alarmIntent);
        }
        if (executorService != null) {
            executorService.shutdown();
        }
        releaseWakeLock();
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Sistema",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Processamento interno do sistema");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
    
    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, flags);
        
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sistema")
            .setContentText("Processamento em execução")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }
    
    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null && (wakeLock == null || !wakeLock.isHeld())) {
                if (wakeLock == null) {
                    wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        WAKELOCK_TAG
                    );
                }
                wakeLock.acquire();
                Log.d(TAG, "WakeLock acquired and held: " + wakeLock.isHeld());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring WakeLock", e);
        }
    }
    
    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
                Log.d(TAG, "WakeLock released");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error releasing WakeLock", e);
        }
    }
    
    /**
     * Notifica o JavaScript que a sessão expirou via Broadcast global
     */
    private void notifyJavaScriptSessionExpired() {
        try {
            Intent intent = new Intent("tech.orizon.ampara.SESSION_EXPIRED");
            intent.putExtra("source", "native-ping");
            intent.setPackage(getPackageName()); // Garante que só o próprio app receba
            sendBroadcast(intent);
            Log.d(TAG, "Session expired broadcast sent to JavaScript");
        } catch (Exception e) {
            Log.e(TAG, "Error sending session expired broadcast", e);
        }
    }
}
