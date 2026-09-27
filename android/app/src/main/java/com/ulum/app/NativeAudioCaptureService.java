package com.taqyeed.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioPlaybackCaptureConfiguration;
import android.media.AudioRecord;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * NativeAudioCaptureService — Records mic + system (internal) audio
 * simultaneously.
 *
 * Strategy ("Smart Auto"):
 * 1. Always captures the device microphone via AudioRecord(MIC).
 * 2. On Android 10+ with a valid MediaProjection token, additionally captures
 * internal/system audio via AudioPlaybackCapture.
 * 3. Mixes both PCM streams in real time with a clipping guard.
 * 4. Encodes the mixed stream to AAC and writes an M4A file via MediaCodec +
 * MediaMuxer.
 *
 * Fallback: If an app opts out of AudioPlaybackCapture, the mic naturally picks
 * up
 * whatever comes out of the device speakers — so the recording still contains
 * the other app's audio acoustically.
 */
public class NativeAudioCaptureService extends Service {

    private static final String TAG = "NativeAudioCapture";
    private static final int NOTIFICATION_ID = 9022;
    private static final String CHANNEL_ID = "taqyeed_native_capture";

    // Audio parameters — 44.1 kHz mono 16-bit PCM, 128 kbps AAC
    private static final int SAMPLE_RATE = 44100;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_ENCODING = AudioFormat.ENCODING_PCM_16BIT;
    private static final int AAC_BIT_RATE = 128_000;

    // Actions for onStartCommand
    public static final String ACTION_START = "ACTION_START_NATIVE";
    public static final String ACTION_STOP = "ACTION_STOP_NATIVE";
    public static final String ACTION_PAUSE = "ACTION_PAUSE_NATIVE";
    public static final String ACTION_RESUME = "ACTION_RESUME_NATIVE";

    // Intent extras
    public static final String EXTRA_RESULT_CODE = "projResultCode";
    public static final String EXTRA_RESULT_DATA = "projResultData";

    // Observable state (volatile for thread-safe reads from plugin)
    public static volatile boolean isRunning = false;
    public static volatile boolean isPaused = false;
    public static volatile String outputFilePath = null;
    public static volatile long recordedDurationMs = 0;

    // Recording components
    private MediaProjection mediaProjection = null;
    private AudioRecord micRecorder = null;
    private AudioRecord internalRecorder = null;
    private MediaCodec encoder = null;
    private MediaMuxer muxer = null;
    private int audioTrackIndex = -1;
    private boolean muxerStarted = false;
    private long totalSamplesWritten = 0;

    // Threading
    private Thread captureThread = null;
    private final AtomicBoolean isCapturing = new AtomicBoolean(false);
    private final AtomicBoolean isPausedFlag = new AtomicBoolean(false);

    private PowerManager.WakeLock wakeLock = null;

    // ─────────────────────────── Lifecycle ───────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null)
            return START_NOT_STICKY;

        String action = intent.getAction();
        if (action == null)
            action = ACTION_START;

        switch (action) {
            case ACTION_STOP:
                stopCapture();
                return START_NOT_STICKY;

            case ACTION_PAUSE:
                isPausedFlag.set(true);
                isPaused = true;
                return START_STICKY;

            case ACTION_RESUME:
                isPausedFlag.set(false);
                isPaused = false;
                return START_STICKY;

            case ACTION_START:
            default:
                int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
                Intent resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
                startCapture(resultCode, resultData);
                return START_STICKY;
        }
    }

    @Override
    public void onDestroy() {
        stopCapture();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ─────────────────────────── Core Capture Logic ───────────────────────────

    private void startCapture(int resultCode, Intent resultData) {
        isRunning = true;
        isPaused = false;
        isCapturing.set(true);
        isPausedFlag.set(false);
        totalSamplesWritten = 0;
        recordedDurationMs = 0;

        // 1 — Foreground notification
        showForegroundNotification();

        // 2 — Wake lock
        acquireWakeLock();

        // 3 — Prepare output file
        File cacheDir = getCacheDir();
        String fileName = "native_rec_" + System.currentTimeMillis() + ".m4a";
        File outputFile = new File(cacheDir, fileName);
        outputFilePath = outputFile.getAbsolutePath();

        // 4 — Compute safe buffer sizes
        int minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_ENCODING);
        int bufferSizeBytes = Math.max(minBuf, 4096) * 2; // double for safety
        int frameSizeShorts = bufferSizeBytes / 2;

        // 5 — Mic AudioRecord
        try {
            micRecorder = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_ENCODING, bufferSizeBytes);
            if (micRecorder.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "Mic AudioRecord failed to initialize");
                micRecorder.release();
                micRecorder = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to create mic AudioRecord: " + e.getMessage());
            micRecorder = null;
        }

        // 6 — Internal (system) AudioRecord via AudioPlaybackCapture (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && resultData != null) {
            try {
                MediaProjectionManager projMgr = (MediaProjectionManager) getSystemService(
                        Context.MEDIA_PROJECTION_SERVICE);
                mediaProjection = projMgr.getMediaProjection(resultCode, resultData);

                if (mediaProjection != null) {
                    // Register callback for Android 14+ mandatory requirement
                    if (Build.VERSION.SDK_INT >= 34) {
                        mediaProjection.registerCallback(new MediaProjection.Callback() {
                            @Override
                            public void onStop() {
                                Log.i(TAG, "MediaProjection stopped by system");
                                // Internal capture gone — mic keeps recording
                                if (internalRecorder != null) {
                                    try {
                                        internalRecorder.stop();
                                    } catch (Exception ignored) {
                                    }
                                    try {
                                        internalRecorder.release();
                                    } catch (Exception ignored) {
                                    }
                                    internalRecorder = null;
                                }
                            }
                        }, new Handler(Looper.getMainLooper()));
                    }

                    AudioPlaybackCaptureConfiguration captureConfig = new AudioPlaybackCaptureConfiguration.Builder(
                            mediaProjection)
                            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                            .addMatchingUsage(AudioAttributes.USAGE_GAME)
                            .addMatchingUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                            .build();

                    internalRecorder = new AudioRecord.Builder()
                            .setAudioPlaybackCaptureConfig(captureConfig)
                            .setAudioFormat(new AudioFormat.Builder()
                                    .setEncoding(AUDIO_ENCODING)
                                    .setSampleRate(SAMPLE_RATE)
                                    .setChannelMask(CHANNEL_CONFIG)
                                    .build())
                            .setBufferSizeInBytes(bufferSizeBytes)
                            .build();

                    if (internalRecorder.getState() != AudioRecord.STATE_INITIALIZED) {
                        Log.w(TAG, "Internal AudioRecord did not initialize — mic-only fallback");
                        internalRecorder.release();
                        internalRecorder = null;
                    } else {
                        Log.i(TAG, "Internal audio capture initialized successfully");
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "AudioPlaybackCapture setup failed, mic-only fallback: " + e.getMessage());
                if (internalRecorder != null) {
                    try {
                        internalRecorder.release();
                    } catch (Exception ignored) {
                    }
                    internalRecorder = null;
                }
            }
        }

        // 7 — MediaCodec encoder + MediaMuxer
        try {
            setupEncoder(outputFile.getAbsolutePath());
        } catch (IOException e) {
            Log.e(TAG, "Encoder setup failed: " + e.getMessage());
            stopCapture();
            return;
        }

        // 8 — Start both recorders
        if (micRecorder != null)
            micRecorder.startRecording();
        if (internalRecorder != null)
            internalRecorder.startRecording();

        // 9 — Spin capture thread
        final int frameSize = frameSizeShorts;
        captureThread = new Thread(() -> captureLoop(frameSize), "NativeAudioCaptureThread");
        captureThread.setPriority(Thread.MAX_PRIORITY);
        captureThread.start();
    }

    /**
     * Single-threaded capture loop using non-blocking reads from both AudioRecord
     * sources. Mixes the PCM samples and feeds them to the AAC encoder in real
     * time.
     */
    private void captureLoop(int frameSize) {
        short[] micBuf = new short[frameSize];
        short[] intBuf = new short[frameSize];
        short[] mixBuf = new short[frameSize];

        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO);

        while (isCapturing.get()) {
            if (isPausedFlag.get()) {
                // Drain buffers while paused so they don't overflow
                if (micRecorder != null)
                    micRecorder.read(micBuf, 0, frameSize, AudioRecord.READ_NON_BLOCKING);
                if (internalRecorder != null)
                    internalRecorder.read(intBuf, 0, frameSize, AudioRecord.READ_NON_BLOCKING);
                SystemClock.sleep(50);
                continue;
            }

            // Non-blocking reads — neither source blocks the other
            int micRead = 0;
            if (micRecorder != null && micRecorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                micRead = micRecorder.read(micBuf, 0, frameSize, AudioRecord.READ_NON_BLOCKING);
                if (micRead < 0)
                    micRead = 0;
            }

            int intRead = 0;
            if (internalRecorder != null && internalRecorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                intRead = internalRecorder.read(intBuf, 0, frameSize, AudioRecord.READ_NON_BLOCKING);
                if (intRead < 0)
                    intRead = 0;
            }

            int maxSamples = Math.max(micRead, intRead);
            if (maxSamples <= 0) {
                SystemClock.sleep(5); // No data yet — tiny sleep to avoid busy-spin
                continue;
            }

            // Additive mix with 16-bit clipping guard
            for (int i = 0; i < maxSamples; i++) {
                int mic = (i < micRead) ? micBuf[i] : 0;
                int sys = (i < intRead) ? intBuf[i] : 0;
                int sum = mic + sys;
                if (sum > 32767)
                    sum = 32767;
                else if (sum < -32768)
                    sum = -32768;
                mixBuf[i] = (short) sum;
            }

            feedEncoder(mixBuf, maxSamples);
            totalSamplesWritten += maxSamples;
            recordedDurationMs = (totalSamplesWritten * 1000L) / SAMPLE_RATE;
        }
    }

    // ─────────────────────────── Encoder Pipeline ───────────────────────────

    private void setupEncoder(String outputPath) throws IOException {
        MediaFormat format = MediaFormat.createAudioFormat(
                MediaFormat.MIMETYPE_AUDIO_AAC, SAMPLE_RATE, 1);
        format.setInteger(MediaFormat.KEY_AAC_PROFILE,
                MediaCodecInfo.CodecProfileLevel.AACObjectLC);
        format.setInteger(MediaFormat.KEY_BIT_RATE, AAC_BIT_RATE);
        format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);

        encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
        encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        encoder.start();

        muxer = new MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        audioTrackIndex = -1;
        muxerStarted = false;
    }

    private void feedEncoder(short[] pcm, int sampleCount) {
        if (encoder == null)
            return;

        // Convert short[] → byte[] (little-endian PCM)
        byte[] byteData = new byte[sampleCount * 2];
        ByteBuffer.wrap(byteData).order(ByteOrder.LITTLE_ENDIAN)
                .asShortBuffer().put(pcm, 0, sampleCount);

        try {
            int inputIdx = encoder.dequeueInputBuffer(10_000);
            if (inputIdx >= 0) {
                ByteBuffer inputBuf = encoder.getInputBuffer(inputIdx);
                if (inputBuf != null) {
                    inputBuf.clear();
                    inputBuf.put(byteData, 0, byteData.length);
                }
                long pts = (totalSamplesWritten * 1_000_000L) / SAMPLE_RATE;
                encoder.queueInputBuffer(inputIdx, 0, byteData.length, pts, 0);
            }
        } catch (Exception e) {
            Log.w(TAG, "Encoder input error: " + e.getMessage());
        }

        drainEncoder(false);
    }

    private void drainEncoder(boolean endOfStream) {
        if (encoder == null || muxer == null)
            return;

        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        while (true) {
            int outIdx = encoder.dequeueOutputBuffer(info, endOfStream ? 10_000 : 0);

            if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                if (!muxerStarted) {
                    audioTrackIndex = muxer.addTrack(encoder.getOutputFormat());
                    muxer.start();
                    muxerStarted = true;
                }
            } else if (outIdx >= 0) {
                ByteBuffer outBuf = encoder.getOutputBuffer(outIdx);
                if (muxerStarted && info.size > 0 && outBuf != null) {
                    outBuf.position(info.offset);
                    outBuf.limit(info.offset + info.size);
                    muxer.writeSampleData(audioTrackIndex, outBuf, info);
                }
                encoder.releaseOutputBuffer(outIdx, false);
                if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0)
                    break;
            } else {
                break; // no more output available right now
            }
        }
    }

    // ─────────────────────────── Stop & Cleanup ───────────────────────────

    private void stopCapture() {
        isCapturing.set(false);
        isRunning = false;
        isPaused = false;

        // Wait for capture thread
        if (captureThread != null) {
            try {
                captureThread.join(3000);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            captureThread = null;
        }

        // Signal EOS to encoder and drain remaining data
        if (encoder != null) {
            try {
                int idx = encoder.dequeueInputBuffer(10_000);
                if (idx >= 0) {
                    encoder.queueInputBuffer(idx, 0, 0,
                            (totalSamplesWritten * 1_000_000L) / SAMPLE_RATE,
                            MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                }
                drainEncoder(true);
            } catch (Exception e) {
                Log.w(TAG, "Error signalling EOS: " + e.getMessage());
            }
        }

        // Release recorders
        releaseRecorder(micRecorder, "mic");
        micRecorder = null;
        releaseRecorder(internalRecorder, "internal");
        internalRecorder = null;

        // Release encoder
        if (encoder != null) {
            try {
                encoder.stop();
            } catch (Exception ignored) {
            }
            try {
                encoder.release();
            } catch (Exception ignored) {
            }
            encoder = null;
        }

        // Release muxer
        if (muxer != null) {
            try {
                muxer.stop();
            } catch (Exception ignored) {
            }
            try {
                muxer.release();
            } catch (Exception ignored) {
            }
            muxer = null;
        }

        // Release projection
        if (mediaProjection != null) {
            try {
                mediaProjection.stop();
            } catch (Exception ignored) {
            }
            mediaProjection = null;
        }

        // Release wake lock
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {
            }
            wakeLock = null;
        }

        // Remove foreground
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {
        }

        stopSelf();
    }

    private void releaseRecorder(AudioRecord recorder, String label) {
        if (recorder == null)
            return;
        try {
            recorder.stop();
        } catch (Exception e) {
            Log.w(TAG, label + " recorder stop error: " + e.getMessage());
        }
        try {
            recorder.release();
        } catch (Exception e) {
            Log.w(TAG, label + " recorder release error: " + e.getMessage());
        }
    }

    // ─────────────────────────── Helpers ───────────────────────────

    private void showForegroundNotification() {
        Intent notifIntent = new Intent(this, MainActivity.class);
        notifIntent.setAction(Intent.ACTION_MAIN);
        notifIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        notifIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, notifIntent, pendingFlags);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("🔴 Enhanced Recording — Taqyeed AI")
                .setContentText("Recording mic + system audio. Tap to return.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pi)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;
                }
                startForeground(NOTIFICATION_ID, notification, type);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed: " + e.getMessage());
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ignored) {
            }
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,
                        "taqyeedNotes:NativeAudioCaptureWakeLock");
                wakeLock.acquire(12 * 60 * 60 * 1000L); // 12-hour safety limit
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock acquire failed: " + e.getMessage());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Enhanced Audio Recording",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shows active enhanced (mic + system) recording status");
            channel.setShowBadge(false);

            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null)
                mgr.createNotificationChannel(channel);
        }
    }
}
