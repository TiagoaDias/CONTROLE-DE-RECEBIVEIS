package com.haspaho.recebiveispro;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings settings = this.bridge.getWebView().getSettings();
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setSupportMultipleWindows(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);

            // Allow cookies & third party cookies for Firebase OAuth authentication
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(this.bridge.getWebView(), true);

            // Normalize user agent so Google OAuth does not reject WebView with disallowed_useragent
            String ua = settings.getUserAgentString();
            if (ua != null) {
                String cleanUa = ua.replace("; wv", "").replaceAll("Version/[0-9.]+\\s*", "");
                settings.setUserAgentString(cleanUa);
            }
        }
    }
}
