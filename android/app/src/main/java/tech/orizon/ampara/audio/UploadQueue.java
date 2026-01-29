package tech.orizon.ampara.audio;

import android.content.Context;
import android.util.Log;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Upload Queue with retry mechanism
 * Manages pending uploads and retries failed ones
 */
public class UploadQueue {
    private static final String TAG = "UploadQueue";
    
    private Context context;
    private AudioUploader uploader;
    private BlockingQueue<UploadTask> queue;
    private Thread workerThread;
    private volatile boolean isRunning = false;
    private AtomicInteger pendingCount = new AtomicInteger(0);
    private AtomicInteger successCount = new AtomicInteger(0);
    private AtomicInteger failureCount = new AtomicInteger(0);
    
    public interface UploadProgressCallback {
        void onProgress(int pending, int success, int failure);
    }
    
    private UploadProgressCallback progressCallback;
    
    public static class UploadTask {
        String filePath;
        int segmentIndex;
        String sessionId;
        double latitude;
        double longitude;
        String origemGravacao;
        
        public UploadTask(String filePath, int segmentIndex, String sessionId,
                         double latitude, double longitude, String origemGravacao) {
            this.filePath = filePath;
            this.segmentIndex = segmentIndex;
            this.sessionId = sessionId;
            this.latitude = latitude;
            this.longitude = longitude;
            this.origemGravacao = origemGravacao;
        }
    }
    
    public UploadQueue(Context context, AudioUploader uploader) {
        this.context = context;
        this.uploader = uploader;
        this.queue = new LinkedBlockingQueue<>();
    }
    
    /**
     * Set progress callback
     */
    public void setProgressCallback(UploadProgressCallback callback) {
        this.progressCallback = callback;
    }
    
    /**
     * Start upload worker
     */
    public void start() {
        if (isRunning) {
            Log.w(TAG, "Upload queue already running");
            return;
        }
        
        isRunning = true;
        workerThread = new Thread(this::processQueue);
        workerThread.start();
        
        Log.i(TAG, "Upload queue started");
    }
    
    /**
     * Stop upload worker
     */
    public void stop() {
        if (!isRunning) return;
        
        isRunning = false;
        if (workerThread != null) {
            workerThread.interrupt();
            try {
                workerThread.join(5000);
            } catch (InterruptedException e) {
                Log.e(TAG, "Error stopping worker thread", e);
            }
        }
        
        Log.i(TAG, "Upload queue stopped");
    }
    
    /**
     * Add upload task to queue
     */
    public void enqueue(UploadTask task) {
        try {
            queue.put(task);
            pendingCount.incrementAndGet();
            notifyProgress();
            
            Log.d(TAG, String.format("Task enqueued: segment %d, queue size: %d", 
                task.segmentIndex, queue.size()));
                
        } catch (InterruptedException e) {
            Log.e(TAG, "Error enqueueing task", e);
        }
    }
    
    /**
     * Process upload queue
     */
    private void processQueue() {
        while (isRunning) {
            try {
                UploadTask task = queue.take();
                
                Log.d(TAG, String.format("Processing upload: segment %d", task.segmentIndex));
                
                uploader.uploadSegment(
                    task.filePath,
                    task.segmentIndex,
                    task.sessionId,
                    task.latitude,
                    task.longitude,
                    task.origemGravacao,
                    new AudioUploader.UploadCallback() {
                        @Override
                        public void onSuccess(int segmentIndex, String sessionId) {
                            pendingCount.decrementAndGet();
                            successCount.incrementAndGet();
                            notifyProgress();
                            
                            Log.i(TAG, String.format("Upload successful: segment %d", segmentIndex));
                        }
                        
                        @Override
                        public void onFailure(int segmentIndex, String sessionId, String error) {
                            pendingCount.decrementAndGet();
                            failureCount.incrementAndGet();
                            notifyProgress();
                            
                            Log.e(TAG, String.format("Upload failed: segment %d - %s", 
                                segmentIndex, error));
                        }
                    }
                );
                
            } catch (InterruptedException e) {
                if (!isRunning) break;
                Log.e(TAG, "Queue processing interrupted", e);
            }
        }
    }
    
    /**
     * Notify progress callback
     */
    private void notifyProgress() {
        if (progressCallback != null) {
            progressCallback.onProgress(
                pendingCount.get(),
                successCount.get(),
                failureCount.get()
            );
        }
    }
    
    /**
     * Get queue statistics
     */
    public int getPendingCount() {
        return pendingCount.get();
    }
    
    public int getSuccessCount() {
        return successCount.get();
    }
    
    public int getFailureCount() {
        return failureCount.get();
    }
    
    /**
     * Reset statistics
     */
    public void resetStats() {
        successCount.set(0);
        failureCount.set(0);
    }
}
