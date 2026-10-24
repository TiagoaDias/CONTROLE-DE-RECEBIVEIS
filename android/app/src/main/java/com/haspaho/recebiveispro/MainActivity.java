package com.haspaho.recebiveispro;

import android.Manifest;
import android.app.Dialog;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_RECORD_AUDIO_PERMISSION = 1001;
    private PermissionRequest pendingWebPermissionRequest;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setSupportMultipleWindows(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Allow cookies & third party cookies for Firebase OAuth authentication
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);

            // Normalize user agent so Google OAuth does not reject WebView with disallowed_useragent
            String ua = settings.getUserAgentString();
            final String cleanUa = (ua != null)
                ? ua.replace("; wv", "").replaceAll("Version/[0-9.]+\\s*", "")
                : null;
            if (cleanUa != null) {
                settings.setUserAgentString(cleanUa);
            }

            // Support microphone permissions (getUserMedia) and popup windows in Android WebView
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        boolean needsAudio = false;
                        for (String res : request.getResources()) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                needsAudio = true;
                                break;
                            }
                        }

                        if (!needsAudio || ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.getResources());
                        } else {
                            pendingWebPermissionRequest = request;
                            ActivityCompat.requestPermissions(
                                MainActivity.this,
                                new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS},
                                REQUEST_RECORD_AUDIO_PERMISSION
                            );
                        }
                    });
                }

                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    WebView newWebView = new WebView(view.getContext());
                    WebSettings newSettings = newWebView.getSettings();
                    newSettings.setJavaScriptEnabled(true);
                    newSettings.setDomStorageEnabled(true);
                    newSettings.setDatabaseEnabled(true);
                    newSettings.setSupportMultipleWindows(true);
                    newSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                    newSettings.setMediaPlaybackRequiresUserGesture(false);
                    if (cleanUa != null) {
                        newSettings.setUserAgentString(cleanUa);
                    }

                    CookieManager.getInstance().setAcceptCookie(true);
                    CookieManager.getInstance().setAcceptThirdPartyCookies(newWebView, true);

                    final Dialog dialog = new Dialog(view.getContext(), android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                    newWebView.setLayoutParams(new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    ));
                    dialog.setContentView(newWebView);

                    newWebView.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onPermissionRequest(final PermissionRequest request) {
                            runOnUiThread(() -> request.grant(request.getResources()));
                        }

                        @Override
                        public void onCloseWindow(WebView window) {
                            if (dialog.isShowing()) {
                                dialog.dismiss();
                            }
                        }
                    });

                    newWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView wv, WebResourceRequest request) {
                            wv.loadUrl(request.getUrl().toString());
                            return true;
                        }
                    });

                    dialog.show();

                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(newWebView);
                    resultMsg.sendToTarget();
                    return true;
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_RECORD_AUDIO_PERMISSION && pendingWebPermissionRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
            } else {
                pendingWebPermissionRequest.deny();
            }
            pendingWebPermissionRequest = null;
        }
    }
}
