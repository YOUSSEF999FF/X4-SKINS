package com.ahmx.x4skins;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.res.AssetFileDescriptor;
import android.graphics.Rect;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * X4 SKINS 18 MAX - Android shell.
 * The whole interface (HTML/CSS/JS) lives in assets/www and is served from the virtual secure origin
 * https://appassets.androidplatform.net/ so it can use WebCrypto. This class only provides what a web page cannot do:
 *  - a REAL internet probe (HTTP status of Google generate_204 / our ping.txt) and connectivity callbacks,
 *  - opening links outside the app,
 *  - the installed version number, haptics, fullscreen, the Android back button,
 *  - streaming the background video (assets/www/assets/bg.mp4) with HTTP Range support.
 */
public class MainActivity extends Activity {

    private static final String TAG = "X4";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/www/index.html";
    private static final int BG = 0xFF02040B;

    private WebView web;
    private WebViewAssetLoader loader;
    private ConnectivityManager cm;
    private ConnectivityManager.NetworkCallback netCb;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private long lastNetPing = 0;
    private int lastKb = -1;

    // ------------------------------------------------------------------ lifecycle

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prepareWindow();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // NOTE (phase 3): the bridge is exposed to every frame of this WebView. Pages that embed third-party
        // frames (YouTube) must either live in their own WebView or switch to WebViewCompat.addWebMessageListener.
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new AppClient());

        registerNetworkCallback();
        setupKeyboardReporting();
        web.loadUrl(START_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        js("window.__native_onResume&&window.__native_onResume()");
    }

    @Override
    protected void onPause() {
        js("window.__native_onPause&&window.__native_onPause()");
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        try {
            if (cm != null && netCb != null) cm.unregisterNetworkCallback(netCb);
        } catch (Exception ignored) { }
        pool.shutdownNow();
        if (web != null) {
            web.removeJavascriptInterface("AndroidBridge");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** The page decides what "back" means (close dialog / previous page); if it does not handle it, the app closes. */
    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript(
                "(function(){try{return !!(window.__native_onBack&&window.__native_onBack());}catch(e){return false;}})()",
                value -> { if (!"true".equals(value)) finish(); });
    }

    // ------------------------------------------------------------------ window / keyboard

    @SuppressWarnings("deprecation")
    private void prepareWindow() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);        // we place the dialogs ourselves when the keyboard opens
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    /** Tells the page how tall the keyboard is (CSS px) so it can keep the dialog above it. */
    private void setupKeyboardReporting() {
        final View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            decor.setOnApplyWindowInsetsListener((v, insets) -> {
                reportKeyboard(insets.getInsets(WindowInsets.Type.ime()).bottom);
                return insets;
            });
        } else {
            decor.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
                Rect r = new Rect();
                decor.getWindowVisibleDisplayFrame(r);
                int h = decor.getRootView().getHeight();
                int diff = h - r.bottom;
                reportKeyboard(diff > h * 0.15f ? diff : 0);
            });
        }
    }

    private void reportKeyboard(int px) {
        if (px == lastKb) return;
        lastKb = px;
        float d = getResources().getDisplayMetrics().density;
        js("window.__native_onKeyboard&&window.__native_onKeyboard(" + Math.round(px / d) + ")");
    }

    // ------------------------------------------------------------------ connectivity callbacks

    private void registerNetworkCallback() {
        cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return;
        netCb = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network n) { pingNet(true); }
            @Override public void onLost(Network n) { pingNet(true); }
            @Override public void onCapabilitiesChanged(Network n, NetworkCapabilities c) { pingNet(false); }
        };
        try {
            cm.registerDefaultNetworkCallback(netCb);
        } catch (Exception e) {
            Log.w(TAG, "network callback: " + e);
        }
    }

    /** Wakes the JS connectivity monitor immediately instead of waiting for its next scheduled probe. */
    private void pingNet(boolean force) {
        long now = System.currentTimeMillis();
        if (!force && now - lastNetPing < 1500) return;
        lastNetPing = now;
        js("window.__native_onNet&&window.__native_onNet()");
    }

    // ------------------------------------------------------------------ helpers

    private void js(final String code) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(code, null);
        });
    }

    private static boolean isHttp(String u) {
        return u != null && (u.startsWith("https://") || u.startsWith("http://"));
    }

    // ------------------------------------------------------------------ web client

    private final class AppClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().endsWith("/www/assets/bg.mp4")) {
                return serveVideo(request);
            }
            return loader.shouldInterceptRequest(u);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;          // our own pages
            openOutside(u.toString());                           // anything else leaves the app
            return true;
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            runOnUiThread(() -> recreate());
            return true;
        }
    }

    /** Serves assets/www/assets/bg.mp4 with Range support (needed for seeking/looping); 404 when the file is not there. */
    private WebResourceResponse serveVideo(WebResourceRequest req) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Accept-Ranges", "bytes");
        AssetFileDescriptor afd = null;
        try {
            afd = getAssets().openFd("www/assets/bg.mp4");
            long len = afd.getLength();
            long start = 0, end = len - 1;
            boolean partial = false;
            String range = req.getRequestHeaders() == null ? null : req.getRequestHeaders().get("Range");
            if (range == null && req.getRequestHeaders() != null) range = req.getRequestHeaders().get("range");
            if (range != null && range.startsWith("bytes=")) {
                String spec = range.substring(6).split(",")[0].trim();
                int dash = spec.indexOf('-');
                String a = dash > 0 ? spec.substring(0, dash).trim() : "";
                String b = dash >= 0 ? spec.substring(dash + 1).trim() : "";
                if (a.length() > 0) {
                    start = Long.parseLong(a);
                    if (b.length() > 0) end = Long.parseLong(b);
                } else if (b.length() > 0) {                      // "bytes=-N": the last N bytes
                    start = Math.max(0, len - Long.parseLong(b));
                }
                if (end >= len) end = len - 1;
                if (start > end || start >= len) {
                    h.put("Content-Range", "bytes */" + len);
                    afd.close();
                    return new WebResourceResponse("video/mp4", null, 416, "Range Not Satisfiable", h,
                            new ByteArrayInputStream(new byte[0]));
                }
                partial = true;
            }
            long count = end - start + 1;
            h.put("Content-Length", String.valueOf(count));
            if (partial) h.put("Content-Range", "bytes " + start + "-" + end + "/" + len);
            return new WebResourceResponse("video/mp4", null, partial ? 206 : 200, partial ? "Partial Content" : "OK", h,
                    new RangeStream(afd, start, count));
        } catch (Exception e) {                                   // file missing -> the page falls back to the animated background
            if (afd != null) { try { afd.close(); } catch (IOException ignored) { } }
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", h, new ByteArrayInputStream(new byte[0]));
        }
    }

    private static final class RangeStream extends InputStream {
        private final AssetFileDescriptor afd;
        private final FileInputStream fis;
        private long remaining;

        RangeStream(AssetFileDescriptor afd, long offset, long length) throws IOException {
            this.afd = afd;
            this.fis = new FileInputStream(afd.getFileDescriptor());
            this.fis.getChannel().position(afd.getStartOffset() + offset);
            this.remaining = length;
        }

        @Override public int read() throws IOException {
            byte[] one = new byte[1];
            int n = read(one, 0, 1);
            return n < 0 ? -1 : (one[0] & 0xff);
        }

        @Override public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) return -1;
            int n = fis.read(b, off, (int) Math.min(len, remaining));
            if (n > 0) remaining -= n;
            return n;
        }

        @Override public void close() throws IOException {
            try { fis.close(); } catch (IOException ignored) { }
            try { afd.close(); } catch (IOException ignored) { }
        }
    }

    // ------------------------------------------------------------------ links that leave the app

    private void openOutside(String url) {
        try {
            Uri u = Uri.parse(url);
            String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
            if (!(sc.equals("http") || sc.equals("https") || sc.equals("tg") || sc.equals("whatsapp") || sc.equals("mailto"))) return;
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "no app for " + url);
        } catch (Exception e) {
            Log.w(TAG, "openOutside: " + e);
        }
    }

    // ------------------------------------------------------------------ the bridge the page can call

    public final class Bridge {
        /** Real internet probe: status code (no redirects followed) + the first bytes of a 200 body. Answer comes back asynchronously. */
        @JavascriptInterface
        public void probe(final String id, final String url, final int timeoutMs) {
            if (!isHttp(url)) { answer(id, -1, ""); return; }
            final int to = Math.max(1000, Math.min(timeoutMs, 10000));
            pool.execute(() -> {
                HttpURLConnection c = null;
                int status = -1;
                String body = "";
                try {
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setUseCaches(false);
                    c.setConnectTimeout(to);
                    c.setReadTimeout(to);
                    c.setRequestMethod("GET");
                    c.setRequestProperty("Cache-Control", "no-cache");
                    c.setRequestProperty("User-Agent", "X4SKINS-net-check");
                    status = c.getResponseCode();
                    if (status == 200) {
                        InputStream in = c.getInputStream();
                        byte[] buf = new byte[64];
                        int n = in.read(buf);
                        if (n > 0) body = new String(buf, 0, n, "UTF-8");
                        in.close();
                    }
                } catch (Exception e) {
                    status = -1;
                } finally {
                    if (c != null) c.disconnect();
                }
                answer(id, status, body);
            });
        }

        private void answer(String id, int status, String body) {
            js("window.__native_onProbe&&window.__native_onProbe(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(body) + ")");
        }

        /** Opens a link in the phone's browser / the right app. Only web, Telegram, WhatsApp and mail links are allowed. */
        @JavascriptInterface
        public void openExternal(final String url) {
            runOnUiThread(() -> openOutside(url));
        }

        @JavascriptInterface
        public String getVersion() {
            try {
                String v = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                return v == null ? "0.0.0" : v;
            } catch (Exception e) {
                return "0.0.0";
            }
        }

        @JavascriptInterface
        public void haptic(int kind) {
            runOnUiThread(() -> {
                if (web != null) web.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
            });
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> finish());
        }
    }
}
