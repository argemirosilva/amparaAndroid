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
        addFormField(output, boundary, "segment_index", String.valueOf(segmentIndex));
        addFormField(output, boundary, "session_id", sessionId);
        addFormField(output, boundary, "duration_seconds", "30");
        addFormField(output, boundary, "origem_gravacao", origemGravacao);
        addFormField(output, boundary, "timestamp", String.valueOf(System.currentTimeMillis()));
        
        // Add location if available
        if (latitude != 0 && longitude != 0) {
            addFormField(output, boundary, "latitude", String.valueOf(latitude));
            addFormField(output, boundary, "longitude", String.valueOf(longitude));
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
        output.writeBytes("Content-Type: audio/mp4\r\n");
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
