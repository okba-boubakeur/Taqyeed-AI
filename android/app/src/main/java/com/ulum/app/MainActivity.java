package com.ulum.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundAudioPlugin.class);
        super.onCreate(savedInstanceState);

        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebSettings webSettings = getBridge().getWebView().getSettings();
                webSettings.setMediaPlaybackRequiresUserGesture(false);
                webSettings.setDomStorageEnabled(true);
                webSettings.setDatabaseEnabled(true);
                webSettings.setAllowFileAccess(true);
                webSettings.setAllowContentAccess(true);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // If background audio recording service is running, keep WebView timers active
        if (AudioForegroundService.isRunning) {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().resumeTimers();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (AudioForegroundService.isRunning) {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().resumeTimers();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
