package com.haspaho.recebiveispro;

import android.app.Dialog;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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

            // Support popup windows (window.open) for Google OAuth popup in Android WebView
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    WebView newWebView = new WebView(view.getContext());
                    WebSettings newSettings = newWebView.getSettings();
                    newSettings.setJavaScriptEnabled(true);
                    newSettings.setDomStorageEnabled(true);
                    newSettings.setDatabaseEnabled(true);
                    newSettings.setSupportMultipleWindows(true);
                    newSettings.setJavaScriptCanOpenWindowsAutomatically(true);
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
}
