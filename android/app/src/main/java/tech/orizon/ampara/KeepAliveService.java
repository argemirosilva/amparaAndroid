package tech.orizon.ampara;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import android.location.Location;
import android.location.LocationManager;
import androidx.core.app.ActivityCompat;
import android.content.pm.PackageManager;

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
    
    // Tempo máximo de vida do service antes de restart (5 minutos para evitar timeout do dataSync)
    private static final long MAX_SERVICE_LIFETIME_MS = 5 * 60 * 1000; // 5 minutos
    private long serviceStartTime;
    
    // Nome das SharedPreferences usado pelo SecureStoragePlugin
    private static final String PREFS_NAME = "ampara_secure_storage";
    private static final String API_URL = "https://ilikiajeduezvvanjejz.supabase.co/functions/v1/mobile-api";
    
    private PowerManager.WakeLock wakeLock;
    private ExecutorService executorService;
    private AlarmManager alarmManager;
    private PendingIntent alarmIntent;
    private PanicManager panicManager;
    
    // Para aguardar atualização de GPS
    private volatile Location freshLocation = null;
    private java.util.concurrent.CountDownLatch locationLatch;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");
        executorService = Executors.newSingleThreadExecutor();
        alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        panicManager = new PanicManager(this);
        serviceStartTime = System.currentTimeMillis();
        
        createNotificationChannel();
        acquireWakeLock();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        Log.d(TAG, "Service started with action: " + action);
        
        Notification notification = createNotification();
        
        // Android 14+ (API 34+) requer tipo de foreground service
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, 
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            Log.d(TAG, "Foreground service started with type DATA_SYNC");
        } else {
            startForeground(NOTIFICATION_ID, notification);
            Log.d(TAG, "Foreground service started");
        }
        
        // Se é a primeira vez (sem action) ou se é um alarme, executa ping e agenda próximo
        if (action == null || "ACTION_EXECUTE_PING".equals(action)) {
            executeNativePing();
            scheduleNextPing();
        }
        
        return START_STICKY;
    }
    
    private void scheduleNextPing() {
        // Usa BroadcastReceiver ao invés de reiniciar o serviço
        Intent intent = new Intent(this, KeepAliveAlarmReceiver.class);
        intent.setAction("tech.orizon.ampara.KEEPALIVE_ALARM");
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        alarmIntent = PendingIntent.getBroadcast(this, 0, intent, flags);
        
        // Ajustar intervalo baseado no modo pânico
        boolean isPanicActive = panicManager.isPanicActive();
        long intervalMillis = isPanicActive ? 10000 : 30000; // 10s durante pânico, 30s normal
        long triggerAtMillis = System.currentTimeMillis() + intervalMillis;
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // setExactAndAllowWhileIdle é crucial para Doze Mode
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, alarmIntent);
                Log.d(TAG, "Next ping scheduled in " + (intervalMillis/1000) + "s (ExactAndAllowWhileIdle, panic=" + isPanicActive + ")");
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, alarmIntent);
                Log.d(TAG, "Next ping scheduled in " + (intervalMillis/1000) + "s (Exact, panic=" + isPanicActive + ")");
            }
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

                // Coletar informações do dispositivo
                JSONObject deviceInfo = collectDeviceInfo();
                
                JSONObject payload = new JSONObject();
                payload.put("action", "pingMobile");
                payload.put("session_token", token);
                payload.put("device_id", deviceId);
                if (email != null) {
                    payload.put("email_usuario", email);
                }
                
                // Adicionar informações do dispositivo
                payload.put("device_model", deviceInfo.getString("device_model"));
                payload.put("battery_level", deviceInfo.getInt("battery_level"));
                payload.put("is_charging", deviceInfo.getBoolean("is_charging"));
                payload.put("android_version", deviceInfo.getString("android_version"));
                payload.put("app_version", deviceInfo.getString("app_version"));
                payload.put("is_ignoring_battery_optimization", deviceInfo.getBoolean("is_ignoring_battery_optimization"));
                payload.put("connection_type", deviceInfo.getString("connection_type"));
                if (!deviceInfo.isNull("wifi_signal_strength")) {
                    payload.put("wifi_signal_strength", deviceInfo.getInt("wifi_signal_strength"));
                }
                
                // Adicionar localização GPS
                Location location = getLastLocation();
                if (location != null) {
                    payload.put("latitude", location.getLatitude());
                    payload.put("longitude", location.getLongitude());
                    payload.put("location_accuracy", location.getAccuracy());
                    payload.put("location_timestamp", location.getTime());
                    Log.d(TAG, "Sending location with ping: " + location.getLatitude() + ", " + location.getLongitude());
                } else {
                    Log.w(TAG, "No location available to send with ping");
                }

                String jsonInputString = payload.toString();
                Log.d(TAG, "Ping payload: " + jsonInputString);
                
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
                                Log.e(TAG, "Session expired confirmed! Notifying JavaScript to refresh token...");
                                notifyJavaScriptSessionExpired();
                                // NÃO para o serviço - aguarda JavaScript fazer refresh
                                // O próximo ping usará o novo token do storage
                                return;
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error parsing 401 response: " + e.getMessage());
                        }
                    }
                } else if (code == 200) {
                    // Log successful response
                    try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                        StringBuilder response = new StringBuilder();
                        String responseLine;
                        while ((responseLine = br.readLine()) != null) {
                            response.append(responseLine.trim());
                        }
                        Log.d(TAG, "Ping response (200): " + response.toString());
                    }
                } else {
                    // Log error response
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
     * Coleta informações do dispositivo para enviar no ping
     */
    private JSONObject collectDeviceInfo() {
        JSONObject info = new JSONObject();
        try {
            // Nome do modelo do dispositivo
            String deviceModel = Build.MANUFACTURER + " " + Build.MODEL;
            info.put("device_model", deviceModel);
            
            // Informações de bateria
            BatteryManager batteryManager = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
            int batteryLevel = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            info.put("battery_level", batteryLevel);
            
            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent batteryStatus = registerReceiver(null, ifilter);
            int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                                status == BatteryManager.BATTERY_STATUS_FULL;
            info.put("is_charging", isCharging);
            
            // Versão do Android
            info.put("android_version", Build.VERSION.RELEASE);
            
            // Versão do app
            try {
                String appVersion = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).versionName;
                info.put("app_version", appVersion);
            } catch (Exception e) {
                info.put("app_version", "unknown");
            }
            
            // Status de otimização de bateria
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            boolean isIgnoringBatteryOptimization = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                isIgnoringBatteryOptimization = powerManager.isIgnoringBatteryOptimizations(getPackageName());
            }
            info.put("is_ignoring_battery_optimization", isIgnoringBatteryOptimization);
            
            // Tipo de conexão e força do sinal
            String connectionType = "none";
            Integer wifiSignalStrength = null;
            
            try {
                ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkInfo activeNetwork = connectivityManager.getActiveNetworkInfo();
                
                if (activeNetwork != null && activeNetwork.isConnected()) {
                    int type = activeNetwork.getType();
                    if (type == ConnectivityManager.TYPE_WIFI) {
                        connectionType = "wifi";
                        
                        // Obter força do sinal WiFi
                        try {
                            WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                            WifiInfo wifiInfo = wifiManager.getConnectionInfo();
                            int rssi = wifiInfo.getRssi();
                            
                            // Converter RSSI para porcentagem (0-100)
                            wifiSignalStrength = Math.max(0, Math.min(100, (rssi + 100) * 2));
                        } catch (SecurityException e) {
                            Log.w(TAG, "WiFi signal strength unavailable (permission denied)");
                        }
                    } else if (type == ConnectivityManager.TYPE_MOBILE) {
                        connectionType = "cellular";
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Error getting connection type", e);
            }
            
            info.put("connection_type", connectionType);
            if (wifiSignalStrength != null) {
                info.put("wifi_signal_strength", wifiSignalStrength);
            } else {
                info.put("wifi_signal_strength", JSONObject.NULL);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error collecting device info", e);
        }
        return info;
    }
    
    /**
     * Obtém a última localização conhecida do dispositivo
     * Retorna null se não houver permissão ou localização disponível
     */
    private Location getLastLocation() {
        try {
            // Verificar permissões
            if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "Location permission not granted");
                return null;
            }
            
            LocationManager locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) {
                Log.w(TAG, "LocationManager not available");
                return null;
            }
            
            // Tentar GPS primeiro, depois Network
            Location location = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (location == null) {
                location = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            
            // Se não tem localização ou está muito antiga (>5min), solicitar atualização
            if (location == null || (System.currentTimeMillis() - location.getTime()) > 300000) {
                Log.d(TAG, "Location cache empty or stale, requesting fresh location update");
                
                // Reset latch e fresh location
                freshLocation = null;
                locationLatch = new java.util.concurrent.CountDownLatch(1);
                
                requestSingleLocationUpdate(locationManager);
                
                // Aguardar até 3 segundos pela atualização de GPS
                try {
                    Log.d(TAG, "Waiting up to 3s for GPS update...");
                    boolean received = locationLatch.await(3, java.util.concurrent.TimeUnit.SECONDS);
                    if (received && freshLocation != null) {
                        Log.d(TAG, "Fresh GPS received within timeout");
                        location = freshLocation;
                    } else {
                        Log.w(TAG, "GPS timeout, using last known location");
                        // Tentar cache novamente
                        location = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                        if (location == null) {
                            location = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                        }
                    }
                } catch (InterruptedException e) {
                    Log.w(TAG, "GPS wait interrupted", e);
                }
            }
            
            if (location != null) {
                Log.d(TAG, "Location obtained: " + location.getLatitude() + ", " + location.getLongitude());
            } else {
                Log.w(TAG, "No location available");
            }
            
            return location;
        } catch (Exception e) {
            Log.e(TAG, "Error getting location", e);
            return null;
        }
    }
    
    /**
     * Solicita uma única atualização de localização para atualizar o cache
     */
    private void requestSingleLocationUpdate(LocationManager locationManager) {
        try {
            // Verificar se GPS está habilitado
            boolean gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            boolean networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            
            if (!gpsEnabled && !networkEnabled) {
                Log.w(TAG, "No location providers enabled");
                return;
            }
            
            // Solicitar atualização única do provedor disponível
            String provider = gpsEnabled ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
            
            if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                
                // requestSingleUpdate needs to run on main looper
                new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                    try {
                        locationManager.requestSingleUpdate(provider, new android.location.LocationListener() {
                            @Override
                            public void onLocationChanged(Location location) {
                                Log.d(TAG, "Fresh location update received: " + location.getLatitude() + ", " + location.getLongitude());
                                freshLocation = location;
                                if (locationLatch != null) {
                                    locationLatch.countDown();
                                }
                            }
                            
                            @Override
                            public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}
                            
                            @Override
                            public void onProviderEnabled(String provider) {}
                            
                            @Override
                            public void onProviderDisabled(String provider) {}
                        }, null);
                    } catch (SecurityException e) {
                        Log.e(TAG, "Location permission denied during requestSingleUpdate", e);
                    }
                });
                
                Log.d(TAG, "Single location update requested from " + provider);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error requesting single location update", e);
        }
    }
    
    /**
     * Notifica o JavaScript que a sessão expirou via Broadcast global
     */
    private void notifyJavaScriptSessionExpired() {
        try {
            // Notificar diretamente via MainActivity (mais confiável que broadcast)
            tech.orizon.ampara.MainActivity.notifySessionExpired("native-ping");
            Log.d(TAG, "Session expired notification sent directly to MainActivity");
        } catch (Exception e) {
            Log.e(TAG, "Error sending session expired notification", e);
        }
    }
}
