package com.taqyeed.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "BackgroundAudio", permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notification", strings = { "android.permission.POST_NOTIFICATIONS" })
})
public class BackgroundAudioPlugin extends Plugin {

    private static final String TAG = "BackgroundAudioPlugin";

    // Stored MediaProjection consent result for starting native recording
    private int projectionResultCode = 0;
    private Intent projectionResultData = null;

    // ─────────────────────────── Existing Methods (Mic-Only Service)
    // ───────────────────────────

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), AudioForegroundService.class);
            serviceIntent.setAction(AudioForegroundService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start foreground recording service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), AudioForegroundService.class);
            serviceIntent.setAction(AudioForegroundService.ACTION_STOP);
            getContext().startService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop foreground recording service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void minimizeApp(PluginCall call) {
        try {
            if (getActivity() != null) {
                getActivity().runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        boolean moved = getActivity().moveTaskToBack(true);
                        JSObject ret = new JSObject();
                        ret.put("success", moved);
                        call.resolve(ret);
                    }
                });
            } else {
                call.reject("Activity is not available");
            }
        } catch (Exception e) {
            call.reject("Failed to minimize app: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isServiceRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isRunning", AudioForegroundService.isRunning || NativeAudioCaptureService.isRunning);
        call.resolve(ret);
    }

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        try {
            boolean isIgnored = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    isIgnored = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                }
            }
            JSObject ret = new JSObject();
            ret.put("isIgnored", isIgnored);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check battery optimization: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                    Intent intent = new Intent();
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception fallbackEx) {
                call.reject("Failed to request battery optimization exemption: " + e.getMessage(), fallbackEx);
            }
        }
    }

    // ─────────────────────────── MediaProjection + Native Recording
    // ───────────────────────────

    /**
     * Launches the system MediaProjection consent dialog.
     * The result is captured in the ActivityCallback and stored for
     * startNativeRecording().
     */
    @PluginMethod
    public void requestMediaProjection(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                // AudioPlaybackCapture not available before Android 10
                JSObject ret = new JSObject();
                ret.put("granted", false);
                ret.put("reason", "Android 10+ required for system audio capture");
                call.resolve(ret);
                return;
            }

            android.media.projection.MediaProjectionManager mgr = (android.media.projection.MediaProjectionManager) getContext()
                    .getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            Intent intent = mgr.createScreenCaptureIntent();
            startActivityForResult(call, intent, "mediaProjectionResult");
        } catch (Exception e) {
            call.reject("Failed to request MediaProjection: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void mediaProjectionResult(PluginCall call, ActivityResult result) {
        if (call == null)
            return;

        JSObject ret = new JSObject();
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            projectionResultCode = result.getResultCode();
            projectionResultData = result.getData();
            ret.put("granted", true);
        } else {
            projectionResultCode = 0;
            projectionResultData = null;
            ret.put("granted", false);
        }
        call.resolve(ret);
    }

    /**
     * Starts the NativeAudioCaptureService which records mic + system audio.
     * Must call requestMediaProjection() first to obtain the consent token.
     */
    @PluginMethod
    public void startNativeRecording(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), NativeAudioCaptureService.class);
            serviceIntent.setAction(NativeAudioCaptureService.ACTION_START);

            if (projectionResultData != null) {
                serviceIntent.putExtra(NativeAudioCaptureService.EXTRA_RESULT_CODE, projectionResultCode);
                serviceIntent.putExtra(NativeAudioCaptureService.EXTRA_RESULT_DATA, projectionResultData);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start native recording: " + e.getMessage(), e);
        }
    }

    /**
     * Stops the NativeAudioCaptureService and returns the recorded file info.
     */
    @PluginMethod
    public void stopNativeRecording(PluginCall call) {
        try {
            String filePath = NativeAudioCaptureService.outputFilePath;
            long durationMs = NativeAudioCaptureService.recordedDurationMs;

            Intent serviceIntent = new Intent(getContext(), NativeAudioCaptureService.class);
            serviceIntent.setAction(NativeAudioCaptureService.ACTION_STOP);
            getContext().startService(serviceIntent);

            // Clear stored projection data
            projectionResultCode = 0;
            projectionResultData = null;

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filePath", filePath != null ? filePath : "");
            ret.put("durationSeconds", Math.max(1, (int) (durationMs / 1000)));
            ret.put("mimeType", "audio/mp4");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop native recording: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void pauseNativeRecording(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), NativeAudioCaptureService.class);
            serviceIntent.setAction(NativeAudioCaptureService.ACTION_PAUSE);
            getContext().startService(serviceIntent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to pause native recording: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void resumeNativeRecording(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), NativeAudioCaptureService.class);
            serviceIntent.setAction(NativeAudioCaptureService.ACTION_RESUME);
            getContext().startService(serviceIntent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to resume native recording: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isNativeRecordingRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isRunning", NativeAudioCaptureService.isRunning);
        ret.put("isPaused", NativeAudioCaptureService.isPaused);
        ret.put("durationSeconds", (int) (NativeAudioCaptureService.recordedDurationMs / 1000));
        call.resolve(ret);
    }

    // ─────────────────────────── MediaStore: Public Storage
    // ───────────────────────────

    /**
     * Saves an audio file to the public Music/Taqyeed AI/ folder via MediaStore.
     * Accepts either a base64-encoded blob OR a file path to copy from.
     * Returns the content URI and display path.
     */
    @PluginMethod
    public void saveToMediaStore(PluginCall call) {
        try {
            String fileName = call.getString("fileName", "recording.m4a");
            String mimeType = call.getString("mimeType", "audio/mp4");
            String base64Data = call.getString("base64Data");
            String sourceFilePath = call.getString("sourceFilePath");

            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Audio.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Audio.Media.MIME_TYPE, mimeType);
            values.put(MediaStore.Audio.Media.IS_PENDING, 1);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Audio.Media.RELATIVE_PATH, "Music/Taqyeed AI");
            }

            Uri collection;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            } else {
                collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            }

            Uri itemUri = resolver.insert(collection, values);
            if (itemUri == null) {
                call.reject("Failed to create MediaStore entry");
                return;
            }

            // Write the data
            OutputStream os = resolver.openOutputStream(itemUri);
            if (os == null) {
                call.reject("Failed to open output stream for MediaStore entry");
                return;
            }

            try {
                if (sourceFilePath != null && !sourceFilePath.isEmpty()) {
                    // Copy from file
                    File source = new File(sourceFilePath);
                    FileInputStream fis = new FileInputStream(source);
                    byte[] buf = new byte[8192];
                    int read;
                    while ((read = fis.read(buf)) != -1) {
                        os.write(buf, 0, read);
                    }
                    fis.close();
                } else if (base64Data != null && !base64Data.isEmpty()) {
                    // Decode base64 and write
                    byte[] decoded = Base64.decode(base64Data, Base64.DEFAULT);
                    os.write(decoded);
                } else {
                    os.close();
                    resolver.delete(itemUri, null, null);
                    call.reject("No data provided (need base64Data or sourceFilePath)");
                    return;
                }
            } finally {
                os.close();
            }

            // Mark as not pending
            values.clear();
            values.put(MediaStore.Audio.Media.IS_PENDING, 0);
            resolver.update(itemUri, values, null, null);

            // Get the actual file path for display
            String displayPath = "Music/Taqyeed AI/" + fileName;

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("contentUri", itemUri.toString());
            ret.put("displayPath", displayPath);
            ret.put("fileName", fileName);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "saveToMediaStore failed: " + e.getMessage(), e);
            call.reject("Failed to save to MediaStore: " + e.getMessage(), e);
        }
    }

    /**
     * Deletes an audio file from MediaStore by its display file name or content
     * URI.
     * Also attempts direct file deletion as a fallback.
     */
    @PluginMethod
    public void deleteFromMediaStore(PluginCall call) {
        try {
            String fileName = call.getString("fileName");
            String contentUri = call.getString("contentUri");
            String filePath = call.getString("filePath");

            ContentResolver resolver = getContext().getContentResolver();
            boolean deleted = false;

            // 1. Try deleting by content URI
            if (contentUri != null && !contentUri.isEmpty()) {
                try {
                    Uri uri = Uri.parse(contentUri);
                    int rows = resolver.delete(uri, null, null);
                    deleted = rows > 0;
                } catch (Exception e) {
                    Log.w(TAG, "Delete by contentUri failed: " + e.getMessage());
                }
            }

            // 2. Try deleting by file name from MediaStore
            if (!deleted && fileName != null && !fileName.isEmpty()) {
                try {
                    Uri collection;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    } else {
                        collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                    }

                    String selection = MediaStore.Audio.Media.DISPLAY_NAME + "=?";
                    String[] args = new String[] { fileName };
                    int rows = resolver.delete(collection, selection, args);
                    deleted = rows > 0;
                } catch (Exception e) {
                    Log.w(TAG, "Delete by fileName failed: " + e.getMessage());
                }
            }

            // 3. Fallback: try direct file deletion
            if (!deleted && filePath != null && !filePath.isEmpty()) {
                try {
                    File f = new File(filePath);
                    if (f.exists()) {
                        deleted = f.delete();
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Direct file delete failed: " + e.getMessage());
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", deleted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to delete from MediaStore: " + e.getMessage(), e);
        }
    }
}
