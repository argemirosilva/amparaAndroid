package tech.orizon.ampara.audio;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

/**
 * Location Manager for background GPS tracking
 */
public class LocationManager {
    private static final String TAG = "LocationManager";
    private static final long UPDATE_INTERVAL_MS = 30000; // 30 seconds
    private static final long FASTEST_INTERVAL_MS = 10000; // 10 seconds
    
    private Context context;
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Location lastLocation;
    private boolean isTracking = false;
    
    public LocationManager(Context context) {
        this.context = context;
        this.fusedLocationClient = LocationServices.getFusedLocationProviderClient(context);
    }
    
    /**
     * Start location tracking
     */
    public void startTracking() {
        if (isTracking) {
            Log.w(TAG, "Already tracking location");
            return;
        }
        
        if (!hasLocationPermission()) {
            Log.e(TAG, "Location permission not granted");
            return;
        }
        
        LocationRequest locationRequest = new LocationRequest.Builder(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            UPDATE_INTERVAL_MS
        )
        .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
        .build();
        
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                
                for (Location location : locationResult.getLocations()) {
                    lastLocation = location;
                    Log.d(TAG, String.format("Location updated: %.6f, %.6f (accuracy: %.1fm)",
                        location.getLatitude(), location.getLongitude(), location.getAccuracy()));
                }
            }
        };
        
        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            );
            
            isTracking = true;
            Log.i(TAG, "Location tracking started");
            
        } catch (SecurityException e) {
            Log.e(TAG, "Security exception starting location tracking", e);
        }
    }
    
    /**
     * Stop location tracking
     */
    public void stopTracking() {
        if (!isTracking) return;
        
        if (locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }
        
        isTracking = false;
        Log.i(TAG, "Location tracking stopped");
    }
    
    /**
     * Get last known location
     */
    public Location getLastLocation() {
        return lastLocation;
    }
    
    /**
     * Get latitude (0 if no location)
     */
    public double getLatitude() {
        return lastLocation != null ? lastLocation.getLatitude() : 0;
    }
    
    /**
     * Get longitude (0 if no location)
     */
    public double getLongitude() {
        return lastLocation != null ? lastLocation.getLongitude() : 0;
    }
    
    /**
     * Check if location permission is granted
     */
    private boolean hasLocationPermission() {
        return ActivityCompat.checkSelfPermission(context, 
            Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ActivityCompat.checkSelfPermission(context, 
            Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    
    /**
     * Check if currently tracking
     */
    public boolean isTracking() {
        return isTracking;
    }
}
