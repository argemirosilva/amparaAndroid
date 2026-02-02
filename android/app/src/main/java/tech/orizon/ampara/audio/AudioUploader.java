package tech.orizon.ampara.audio;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;

/**
 * Native Audio Uploader
 * Uploads audio segments to API using multipart/form-data
 */
public class AudioUploader {
    private static final String TAG = "AudioUploader";
    private static final String API_URL = "https://ilikiajeduezvvanjejz.supabase.co/functions/v1/mobile-api";
    private static final int TIMEOUT_MS = 30000; // 30 seconds
    private static final int MAX_RETRIES = 3;
    
    private Context context;
    private String sessionToken;
    private String emailUsuario;
    private String deviceId;
    
    public interface UploadCallback {
        void onSuccess(int segmentIndex, String sessionId);
        void onFailure(int segmentIndex, String sessionId, String error);
    }
    
    public AudioUploader(Context context) {
        this.context = context;
        this.deviceId = getDeviceId();
    }
    
    /**
     * Set authentication credentials
     */
    public void setCredentials(String sessionToken, String emailUsuario) {
        this.sessionToken = sessionToken;
        this.emailUsuario = emailUsuario;
    }
    
    /**
     * Upload audio segment with retry
     */
    public void uploadSegment(
        String filePath, 
        int segmentIndex, 
        String sessionId,
        double latitude,
        double longitude,
        String origemGravacao,
        UploadCallback callback
    ) {
        new Thread(() -> {
            int retries = 0;
            String lastError = null;
            
            while (retries < MAX_RETRIES) {
                try {
                    boolean success = uploadSegmentInternal(
                        filePath, segmentIndex, sessionId, 
                        latitude, longitude, origemGravacao
                    );
                    
                    if (success) {
                        Log.i(TAG, String.format("Segment %d uploaded successfully (attempt %d)", 
                            segmentIndex, retries + 1));
                        
                        if (callback != null) {
                            callback.onSuccess(segmentIndex, sessionId);
                        }
                        return;
                    } else {
                        lastError = "Upload failed with non-200 response";
                    }
                    
                } catch (Exception e) {
                    lastError = e.getMessage();
                    Log.e(TAG, String.format("Upload attempt %d failed: %s", retries + 1, lastError));
                }
                
                retries++;
                if (retries < MAX_RETRIES) {
                    try {
                        Thread.sleep(2000 * retries); // Exponential backoff
                    } catch (InterruptedException e) {
                        break;
                    }
                }
            }
            
            // All retries failed
            Log.e(TAG, String.format("Segment %d upload failed after %d attempts", 
                segmentIndex, MAX_RETRIES));
            
            if (callback != null) {
                callback.onFailure(segmentIndex, sessionId, lastError);
            }
            
        }).start();
    }
    
    /**
     * Calculate audio file duration in seconds
     * Uses MediaMetadataRetriever to support multiple formats (OGG/Opus, WAV, MP3, etc)
     * 
     * IMPORTANT: NativeRecorder generates OGG/Opus files (.ogg), NOT WAV files
     */
    private double calculateAudioDuration(File audioFile) {
        android.media.MediaMetadataRetriever retriever = null;
        try {
            // Wait a bit to ensure file is fully written to disk
            Thread.sleep(200);
            
            retriever = new android.media.MediaMetadataRetriever();
            retriever.setDataSource(audioFile.getAbsolutePath());
            
            // Get duration in milliseconds
            String durationStr = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION);
            if (durationStr == null) {
                Log.w(TAG, "Could not extract duration from audio file");
                return 0.0;
            }
            
            long durationMs = Long.parseLong(durationStr);
            double durationSeconds = durationMs / 1000.0;
            
            Log.d(TAG, String.format("Audio duration calculated: %.2fs (size=%d bytes, format=OGG/Opus)",
                durationSeconds, audioFile.length()));
            
            return durationSeconds;
            
        } catch (Exception e) {
            Log.e(TAG, "Error calculating audio duration: " + e.getMessage());
            // Fallback: estimate based on file size
            // OGG/Opus has variable bitrate, but roughly 16-32 kbps for speech
            // Assume 24 kbps average = 3000 bytes/second
            long fileSize = audioFile.length();
            double estimatedDuration = (double) fileSize / 3000.0;
            Log.w(TAG, String.format("Using estimated duration: %.2fs", estimatedDuration));
            return estimatedDuration;
        } finally {
            if (retriever != null) {
                try {
                    retriever.release();
                } catch (Exception e) {
                    // Ignore
                }
            }
        }
    }
    
    /**
     * Internal upload implementation
     */
    private boolean uploadSegmentInternal(
        String filePath,
        int segmentIndex,
        String sessionId,
        double latitude,
        double longitude,
        String origemGravacao
    ) throws Exception {
        
        File audioFile = new File(filePath);
        if (!audioFile.exists()) {
            throw new Exception("Audio file not found: " + filePath);
        }
        
        // Calculate actual duration from audio file (OGG/Opus)
        double durationSeconds = calculateAudioDuration(audioFile);
        
        String boundary = "----Boundary" + System.currentTimeMillis();
        
        HttpURLConnection connection = (HttpURLConnection) new URL(API_URL).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setDoInput(true);
        connection.setUseCaches(false);
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
        
        DataOutputStream output = new DataOutputStream(connection.getOutputStream());
        
        // Add form fields
        addFormField(output, boundary, "action", "receberAudioMobile");
        addFormField(output, boundary, "session_token", sessionToken);
        addFormField(output, boundary, "device_id", deviceId);
        addFormField(output, boundary, "email_usuario", emailUsuario);
        addFormField(output, boundary, "segmento_idx", String.valueOf(segmentIndex));
        addFormField(output, boundary, "session_id", sessionId);
        addFormField(output, boundary, "duracao_segundos", String.valueOf(Math.round(durationSeconds)));
        addFormField(output, boundary, "origem_gravacao", origemGravacao);
        addFormField(output, boundary, "timestamp", String.valueOf(System.currentTimeMillis()));
        
        // Add location if available
        if (latitude != 0 && longitude != 0) {
            addFormField(output, boundary, "latitude", String.valueOf(latitude));
            addFormField(output, boundary, "longitude", String.valueOf(longitude));
        }
        
        // Add timezone
        try {
            java.util.TimeZone tz = java.util.TimeZone.getDefault();
            String timezone = tz.getID();
            int offsetMillis = tz.getRawOffset();
            int timezone_offset_minutes = offsetMillis / (1000 * 60);
            
            addFormField(output, boundary, "timezone", timezone);
            addFormField(output, boundary, "timezone_offset_minutes", String.valueOf(timezone_offset_minutes));
            
            Log.d(TAG, "[TZ] Attached to segment upload: " + timezone + ", offset: " + timezone_offset_minutes);
        } catch (Exception e) {
            Log.w(TAG, "Error adding timezone to segment upload", e);
        }
        
        // Add audio file
        addFileField(output, boundary, "audio", audioFile);
        
        // End of multipart
        output.writeBytes("--" + boundary + "--\r\n");
        output.flush();
        output.close();
        
        // Get response
        int responseCode = connection.getResponseCode();
        
        if (responseCode == HttpURLConnection.HTTP_OK) {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream())
            );
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();
            
            Log.d(TAG, "Upload response: " + response.toString());
            return true;
        } else {
            Log.e(TAG, "Upload failed with response code: " + responseCode);
            return false;
        }
    }
    
    /**
     * Add form field to multipart request
     */
    private void addFormField(DataOutputStream output, String boundary, String name, String value) 
        throws Exception {
        output.writeBytes("--" + boundary + "\r\n");
        output.writeBytes("Content-Disposition: form-data; name=\"" + name + "\"\r\n");
        output.writeBytes("\r\n");
        output.writeBytes(value + "\r\n");
    }
    
    /**
     * Add file field to multipart request
     */
    private void addFileField(DataOutputStream output, String boundary, String fieldName, File file) 
        throws Exception {
        output.writeBytes("--" + boundary + "\r\n");
        output.writeBytes("Content-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"" + 
            file.getName() + "\"\r\n");
        output.writeBytes("Content-Type: audio/ogg\r\n");
        output.writeBytes("\r\n");
        
        FileInputStream fileInputStream = new FileInputStream(file);
        byte[] buffer = new byte[4096];
        int bytesRead;
        while ((bytesRead = fileInputStream.read(buffer)) != -1) {
            output.write(buffer, 0, bytesRead);
        }
        fileInputStream.close();
        
        output.writeBytes("\r\n");
    }
    
    /**
     * Notify server that recording session has started
     */
    public void notifyRecordingStarted(String sessionId, String origemGravacao) {
        new Thread(() -> {
            try {
                Log.i(TAG, String.format("Notifying server: recording started - session=%s, origem=%s", 
                    sessionId, origemGravacao));
                Log.d(TAG, String.format("Credentials: token=%s, email=%s, deviceId=%s",
                    sessionToken != null ? "present" : "NULL",
                    emailUsuario != null ? emailUsuario : "NULL",
                    deviceId != null ? deviceId : "NULL"));
                
                JSONObject payload = new JSONObject();
                payload.put("action", "iniciarGravacao");
                payload.put("session_token", sessionToken);
                payload.put("device_id", deviceId);
                payload.put("email_usuario", emailUsuario);
                payload.put("status_gravacao", "iniciada");
                payload.put("session_id", sessionId);
                payload.put("origem_gravacao", origemGravacao);
                
                // Add timezone
                try {
                    java.util.TimeZone tz = java.util.TimeZone.getDefault();
                    String timezone = tz.getID();
                    int offsetMillis = tz.getRawOffset();
                    int timezone_offset_minutes = offsetMillis / (1000 * 60);
                    
                    payload.put("timezone", timezone);
                    payload.put("timezone_offset_minutes", timezone_offset_minutes);
                    
                    Log.d(TAG, "[TZ] Attached to iniciarGravacao: " + timezone + ", offset: " + timezone_offset_minutes);
                } catch (Exception e) {
                    Log.w(TAG, "Error adding timezone to iniciarGravacao", e);
                }
                
                Log.d(TAG, "Payload: " + payload.toString());
                
                HttpURLConnection connection = (HttpURLConnection) new URL(API_URL).openConnection();
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setDoInput(true);
                connection.setConnectTimeout(TIMEOUT_MS);
                connection.setReadTimeout(TIMEOUT_MS);
                connection.setRequestProperty("Content-Type", "application/json");
                
                DataOutputStream output = new DataOutputStream(connection.getOutputStream());
                output.writeBytes(payload.toString());
                output.flush();
                output.close();
                
                int responseCode = connection.getResponseCode();
                
                if (responseCode == 200) {
                    BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream())
                    );
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();
                    
                    Log.i(TAG, String.format("Recording start notified successfully: %s", 
                        response.toString()));
                } else {
                    // Read error response
                    try {
                        BufferedReader errorReader = new BufferedReader(
                            new InputStreamReader(connection.getErrorStream())
                        );
                        StringBuilder errorResponse = new StringBuilder();
                        String line;
                        while ((line = errorReader.readLine()) != null) {
                            errorResponse.append(line);
                        }
                        errorReader.close();
                        
                        Log.e(TAG, String.format("Failed to notify recording start: HTTP %d - %s", 
                            responseCode, errorResponse.toString()));
                    } catch (Exception e) {
                        Log.e(TAG, String.format("Failed to notify recording start: HTTP %d", 
                            responseCode));
                    }
                }
                
                connection.disconnect();
                
            } catch (Exception e) {
                Log.e(TAG, "Error notifying recording start", e);
            }
        }).start();
    }
    
    /**
     * Notify server that recording session is complete
     */
    public void notifyRecordingComplete(String sessionId, int totalSegments, String motivoParada) {
        new Thread(() -> {
            try {
                Log.i(TAG, String.format("Notifying server: recording complete - session=%s, segments=%d", 
                    sessionId, totalSegments));
                Log.d(TAG, String.format("Credentials: token=%s, email=%s, deviceId=%s",
                    sessionToken != null ? "present" : "NULL",
                    emailUsuario != null ? emailUsuario : "NULL",
                    deviceId != null ? deviceId : "NULL"));
                
                JSONObject payload = new JSONObject();
                payload.put("action", "finalizarGravacao");
                payload.put("session_token", sessionToken);
                payload.put("device_id", deviceId);
                payload.put("email_usuario", emailUsuario);
                payload.put("status_gravacao", "finalizada");
                payload.put("session_id", sessionId);
                payload.put("total_segments", totalSegments);
                payload.put("motivo_parada", motivoParada);
                
                // Add timezone
                try {
                    java.util.TimeZone tz = java.util.TimeZone.getDefault();
                    String timezone = tz.getID();
                    int offsetMillis = tz.getRawOffset();
                    int timezone_offset_minutes = offsetMillis / (1000 * 60);
                    
                    payload.put("timezone", timezone);
                    payload.put("timezone_offset_minutes", timezone_offset_minutes);
                    
                    Log.d(TAG, "[TZ] Attached to finalizarGravacao: " + timezone + ", offset: " + timezone_offset_minutes);
                } catch (Exception e) {
                    Log.w(TAG, "Error adding timezone to finalizarGravacao", e);
                }
                
                Log.d(TAG, "Payload: " + payload.toString());
                
                HttpURLConnection connection = (HttpURLConnection) new URL(API_URL).openConnection();
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setDoInput(true);
                connection.setConnectTimeout(TIMEOUT_MS);
                connection.setReadTimeout(TIMEOUT_MS);
                connection.setRequestProperty("Content-Type", "application/json");
                
                DataOutputStream output = new DataOutputStream(connection.getOutputStream());
                output.writeBytes(payload.toString());
                output.flush();
                output.close();
                
                int responseCode = connection.getResponseCode();
                
                if (responseCode == 200) {
                    BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream())
                    );
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();
                    
                    Log.i(TAG, String.format("Recording completion notified successfully: %s", 
                        response.toString()));
                } else {
                    // Read error response
                    try {
                        BufferedReader errorReader = new BufferedReader(
                            new InputStreamReader(connection.getErrorStream())
                        );
                        StringBuilder errorResponse = new StringBuilder();
                        String line;
                        while ((line = errorReader.readLine()) != null) {
                            errorResponse.append(line);
                        }
                        errorReader.close();
                        
                        Log.e(TAG, String.format("Failed to notify recording completion: HTTP %d - %s", 
                            responseCode, errorResponse.toString()));
                    } catch (Exception e) {
                        Log.e(TAG, String.format("Failed to notify recording completion: HTTP %d", 
                            responseCode));
                    }
                }
                
                connection.disconnect();
                
            } catch (Exception e) {
                Log.e(TAG, "Error notifying recording completion", e);
            }
        }).start();
    }
    
    /**
     * Get or generate device ID
     * CRITICAL: Must use same SharedPreferences as KeepAlivePlugin
     */
    private String getDeviceId() {
        // Use same SharedPreferences as KeepAlivePlugin
        android.content.SharedPreferences prefs = context.getSharedPreferences(
            "ampara_secure_storage", Context.MODE_PRIVATE
        );
        
        String deviceId = prefs.getString("ampara_device_id", null);
        if (deviceId == null) {
            // Fallback: generate new ID (should not happen if KeepAlive started first)
            deviceId = UUID.randomUUID().toString();
            prefs.edit().putString("ampara_device_id", deviceId).apply();
            Log.w(TAG, "Device ID not found, generated new: " + deviceId);
        }
        
        return deviceId;
    }
}
