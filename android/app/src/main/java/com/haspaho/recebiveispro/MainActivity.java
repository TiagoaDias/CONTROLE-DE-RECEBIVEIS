package com.haspaho.recebiveispro;

import android.Manifest;
import android.app.Activity;
import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_RECORD_AUDIO_PERMISSION = 1001;
    private static final int REQUEST_SPEECH_RECOGNIZER = 1002;
    private PermissionRequest pendingWebPermissionRequest;
    private boolean pendingStartAfterPermission = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Request RECORD_AUDIO at startup if not yet granted so Android WebView getUserMedia works without blocking
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS},
                REQUEST_RECORD_AUDIO_PERMISSION
            );
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            final WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setSupportMultipleWindows(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Expose native bridge for on-demand microphone permission and native Android speech recognizer
            webView.addJavascriptInterface(new HaspahoNativeBridge(webView), "HaspahoNative");

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

            final WebChromeClient defaultChromeClient = webView.getWebChromeClient();

            // Support microphone permissions (getUserMedia), file chooser, and popup windows in Android WebView
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
                            try {
                                request.grant(request.getResources());
                            } catch (Exception ignored) {}
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
                public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                    if (defaultChromeClient != null) {
                        return defaultChromeClient.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                    }
                    return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
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
                            runOnUiThread(() -> {
                                try {
                                    request.grant(request.getResources());
                                } catch (Exception ignored) {}
                            });
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

    public class HaspahoNativeBridge {
        private final WebView webView;

        public HaspahoNativeBridge(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public boolean hasRecordAudioPermission() {
            return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestRecordAudioPermission() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    notifyPermissionResult(true, false);
                } else {
                    pendingStartAfterPermission = true;
                    ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS},
                        REQUEST_RECORD_AUDIO_PERMISSION
                    );
                }
            });
        }

        @JavascriptInterface
        public void startNativeVoiceRecognition() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR");
                    intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Fale seu comando para o Haspaho...");
                    MainActivity.this.startActivityForResult(intent, REQUEST_SPEECH_RECOGNIZER);
                } catch (ActivityNotFoundException e) {
                    notifySpeechError("Reconhecimento de voz nativo não disponível neste aparelho.");
                } catch (Exception e) {
                    notifySpeechError(e.getMessage() != null ? e.getMessage() : "Erro ao abrir microfone nativo.");
                }
            });
        }

        @JavascriptInterface
        public void openAppPermissionSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    Uri uri = Uri.fromParts("package", MainActivity.this.getPackageName(), null);
                    intent.setData(uri);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    MainActivity.this.startActivity(intent);
                } catch (Exception ignored) {}
            });
        }
    }

    private void notifyPermissionResult(final boolean granted, final boolean permanentlyDenied) {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            final WebView wv = this.bridge.getWebView();
            wv.post(() -> {
                String js = String.format(
                    "window.dispatchEvent(new CustomEvent('haspaho-mic-permission-result', { detail: { granted: %b, permanentlyDenied: %b } }));",
                    granted,
                    permanentlyDenied
                );
                wv.evaluateJavascript(js, null);
            });
        }
    }

    private void notifySpeechResult(final String text) {
        if (this.bridge != null && this.bridge.getWebView() != null && text != null) {
            final WebView wv = this.bridge.getWebView();
            final String escaped = text.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
            wv.post(() -> {
                String js = "window.dispatchEvent(new CustomEvent('haspaho-native-speech-result', { detail: { text: '" + escaped + "' } }));";
                wv.evaluateJavascript(js, null);
            });
        }
    }

    private void notifySpeechError(final String message) {
        if (this.bridge != null && this.bridge.getWebView() != null && message != null) {
            final WebView wv = this.bridge.getWebView();
            final String escaped = message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
            wv.post(() -> {
                String js = "window.dispatchEvent(new CustomEvent('haspaho-native-speech-error', { detail: { error: '" + escaped + "' } }));";
                wv.evaluateJavascript(js, null);
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_SPEECH_RECOGNIZER) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (results != null && !results.isEmpty() && results.get(0) != null) {
                    notifySpeechResult(results.get(0));
                }
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_RECORD_AUDIO_PERMISSION) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pendingWebPermissionRequest != null) {
                try {
                    if (granted) {
                        pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
                    } else {
                        pendingWebPermissionRequest.deny();
                    }
                } catch (Exception ignored) {}
                pendingWebPermissionRequest = null;
            }

            boolean permanentlyDenied = !granted && !ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.RECORD_AUDIO);
            if (pendingStartAfterPermission || granted) {
                pendingStartAfterPermission = false;
                notifyPermissionResult(granted, permanentlyDenied);
            }
        }
    }
}

