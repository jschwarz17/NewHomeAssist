package com.homeassist.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private PermissionRequest pendingPermissionRequest;

    private final ActivityResultLauncher<String> micPermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            if (pendingPermissionRequest != null) {
                if (granted) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                } else {
                    pendingPermissionRequest.deny();
                }
                pendingPermissionRequest = null;
            }
        });

    private final ActivityResultLauncher<String> startupMicLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            // Permission result handled; nothing else needed on startup
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TaskerPlugin.class);
        registerPlugin(EaglePlugin.class);
        super.onCreate(savedInstanceState);

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            startupMicLauncher.launch(Manifest.permission.RECORD_AUDIO);
        }

        WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                for (String resource : request.getResources()) {
                    if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this,
                                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.getResources());
                        } else {
                            pendingPermissionRequest = request;
                            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO);
                        }
                        return;
                    }
                }
                request.grant(request.getResources());
            }
        });
    }
}
