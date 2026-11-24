package com.ahmx.x4skins;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.graphics.Rect;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.DisplayCutout;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;

/**
 * X4 SKINS 18 MAX - Android shell.
 * The whole interface (HTML/CSS/JS) lives in assets/www and is served from the virtual secure origin
 * https://appassets.androidplatform.net/ so it can use WebCrypto. This class only provides what a web page cannot do:
 *  - a REAL internet probe (HTTP status of Google generate_204 / our ping.txt) and connectivity callbacks,
 *  - opening links outside the app,
 *  - the installed version number, haptics, fullscreen, the Android back button,
 *  - streaming the background video (assets/www/assets/bg.mp4) with HTTP Range support,
 *  - PAGE 3: two real site WebViews (webview1 / webview2) UNDER our transparent interface WebView, real file downloads
 *    into Download/AHM X APP, and the "leaving the app" rule of webview2.
 */
public class MainActivity extends Activity {

    private static final String TAG = "X4";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/www/index.html";
    private static final int BG = 0xFF02040B;

    private static final int REQ_STORAGE = 77;

    private UiWebView web;                     // our interface (transparent while a site is open)
    private FrameLayout siteHost;              // holds webview1 / webview2, drawn below the interface
    private Site site1, site2, activeSite, pendingSite;
    private String pendingLeave;
    private Downloader downloader;
    private final List<Downloader.Task> waitingForPermission = new ArrayList<>();
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
        siteHost = new FrameLayout(this);                      // below: the sites
        root.addView(siteHost, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        web = new UiWebView(this);                             // above: our interface
        web.setBackgroundColor(Color.TRANSPARENT);             // the pages paint their own opaque background when no site is open
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        CookieManager.getInstance().setAcceptCookie(true);
        downloader = new Downloader(this, this::emitDl);

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
        setupInsets();
        web.loadUrl(START_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (activeSite != null) activeSite.wv.onResume();
        js("window.__native_onResume&&window.__native_onResume()");
    }

    @Override
    protected void onPause() {
        js("window.__native_onPause&&window.__native_onPause()");
        web.onPause();
        if (activeSite != null) activeSite.wv.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        try {
            if (cm != null && netCb != null) cm.unregisterNetworkCallback(netCb);
        } catch (Exception ignored) { }
        pool.shutdownNow();
        if (downloader != null) downloader.shutdown();
        closeSitesUi();
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

    private int lastTop = -1;

    /**
     * Tells the page how tall the keyboard is (CSS px) so dialogs stay above it, and keeps the site area clear of the
     * keyboard and of the camera cut-out (system bars are hidden, so the page would otherwise slide under both).
     */
    private void setupInsets() {
        final View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            decor.setOnApplyWindowInsetsListener((v, insets) -> {
                int top = 0;
                DisplayCutout dc = insets.getDisplayCutout();
                if (dc != null) top = dc.getSafeInsetTop();
                updateInsets(insets.getInsets(WindowInsets.Type.ime()).bottom, top);
                return insets;
            });
        } else {
            decor.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
                Rect r = new Rect();
                decor.getWindowVisibleDisplayFrame(r);
                int h = decor.getRootView().getHeight();
                int diff = h - r.bottom;
                int top = 0;
                if (Build.VERSION.SDK_INT >= 28) {
                    WindowInsets wi = decor.getRootWindowInsets();
                    DisplayCutout dc = wi == null ? null : wi.getDisplayCutout();
                    if (dc != null) top = dc.getSafeInsetTop();
                }
                updateInsets(diff > h * 0.15f ? diff : 0, top);
            });
        }
    }

    private void updateInsets(int kbPx, int topPx) {
        if (kbPx != lastKb) {
            lastKb = kbPx;
            float d = getResources().getDisplayMetrics().density;
            js("window.__native_onKeyboard&&window.__native_onKeyboard(" + Math.round(kbPx / d) + ")");
        }
        if (siteHost != null && (kbPx != siteHost.getPaddingBottom() || topPx != lastTop)) {
            lastTop = topPx;
            siteHost.setPadding(0, topPx, 0, kbPx);
        }
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

    /** Runs a short job on the UI thread and waits for its answer (used by the few bridge calls that must return a value). */
    private <T> T onUi(final Callable<T> job, T fallback) {
        try {
            if (Looper.myLooper() == Looper.getMainLooper()) return job.call();
            final FutureTask<T> f = new FutureTask<>(job);
            runOnUiThread(f);
            return f.get(1500, TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            return fallback;
        }
    }

    /** "https://www.Example.com:8080/x" -> "example.com" */
    private static String hostOf(String url) {
        try {
            String h = Uri.parse(url).getHost();
            if (h == null) return "";
            h = h.toLowerCase(Locale.ROOT);
            return h.startsWith("www.") ? h.substring(4) : h;
        } catch (Exception e) {
            return "";
        }
    }

    /** An entry of the "allowed" list in start.json: "cdn.site.com", "*.site.com" or a full link all become a bare host. */
    private static String cleanAllowed(String s) {
        String t = s.trim().toLowerCase(Locale.ROOT);
        int i = t.indexOf("://");
        if (i >= 0) t = t.substring(i + 3);
        int sl = t.indexOf('/');
        if (sl >= 0) t = t.substring(0, sl);
        int c = t.indexOf(':');
        if (c >= 0) t = t.substring(0, c);
        if (t.startsWith("*.")) t = t.substring(2);
        if (t.startsWith("www.")) t = t.substring(4);
        return t;
    }

    private static boolean externalScheme(String sc) {
        return sc.equals("tg") || sc.equals("whatsapp") || sc.equals("mailto") || sc.equals("market");
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
            if (!(sc.equals("http") || sc.equals("https") || externalScheme(sc))) return;
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "no app for " + url);
        } catch (Exception e) {
            Log.w(TAG, "openOutside: " + e);
        }
    }

    // ------------------------------------------------------------------ page 3 : the two site WebViews

    /** One site WebView (slot 1 = webview1, slot 2 = webview2) and what we know about the link opened in it. */
    private final class Site {
        final int slot;
        final WebView wv;
        String openedUrl = "";
        boolean loadedOnce;                   // the first load of the opened link has finished
        boolean shown;                        // the page was told this site is on screen
        long openedAt;
        final Set<String> hosts = new HashSet<>();   // hosts that count as "the opened site"

        Site(int slot, WebView wv) { this.slot = slot; this.wv = wv; }

        void reset(String url) {
            openedUrl = url;
            loadedOnce = false;
            shown = false;
            openedAt = SystemClock.elapsedRealtime();
            hosts.clear();
            hosts.add(hostOf(url));
        }

        void allow(String allowedJson) {
            try {
                JSONArray a = new JSONArray(allowedJson == null ? "[]" : allowedJson);
                for (int i = 0; i < a.length() && i < 64; i++) {
                    String h = cleanAllowed(a.optString(i, ""));
                    if (!h.isEmpty()) hosts.add(h);
                }
            } catch (Exception ignored) { }
        }

        boolean allows(String host) {
            if (host.isEmpty()) return false;
            for (String h : hosts) if (host.equals(h) || host.endsWith("." + h)) return true;
            return false;
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private Site makeSite(int slot) {
        final WebView w = new WebView(this);
        w.setBackgroundColor(Color.WHITE);                     // sites expect a white canvas
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));   // look like the phone's browser, not an embedded view
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
        w.setVisibility(View.INVISIBLE);
        final Site st = new Site(slot, w);
        w.setWebViewClient(new SiteClient(st));
        w.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int p) {
                if (p >= 70 && pendingSite == st && !st.shown) activate(st);
            }
        });
        w.setDownloadListener((url, ua, cd, mime, len) -> startDownload(st, url, ua, cd, mime, len));
        siteHost.addView(w, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        return st;
    }

    private void emitSite(String type, int slot) {
        try {
            JSONObject o = new JSONObject();
            o.put("t", type);
            o.put("slot", slot);
            js("window.__native_onSite&&window.__native_onSite(" + JSONObject.quote(o.toString()) + ")");
        } catch (Exception ignored) { }
    }

    /** Opens (or re-shows) a link in webview1 / webview2. The page is told "shown" when it is really visible. */
    private void openSiteUi(int slot, String url, String allowedJson) {
        if (!isHttp(url)) { emitSite("error", slot); return; }
        Site st = slot == 2 ? site2 : site1;
        if (st == null) {
            st = makeSite(slot);
            if (slot == 2) site2 = st; else site1 = st;
        }
        if (pendingSite != null && pendingSite != st) cancelOpenUi();
        pendingSite = st;
        if (url.equals(st.openedUrl) && st.loadedOnce) {       // same link already loaded here: keep its state
            st.allow(allowedJson);
            activate(st);
            return;
        }
        st.reset(url);
        st.allow(allowedJson);
        st.wv.loadUrl(url);
    }

    private void activate(Site st) {
        if (activeSite != null && activeSite != st) {
            activeSite.wv.setVisibility(View.INVISIBLE);
            activeSite.wv.onPause();
        }
        st.wv.setVisibility(View.VISIBLE);
        st.wv.onResume();
        st.wv.requestFocus();
        activeSite = st;
        if (pendingSite == st) pendingSite = null;
        st.shown = true;
        emitSite("shown", st.slot);
    }

    /** The user gave up while a link was still loading: drop that load, keep whatever was on screen. */
    private void cancelOpenUi() {
        Site p = pendingSite;
        pendingSite = null;
        if (p == null) return;
        p.wv.stopLoading();
        p.openedUrl = "";
        p.loadedOnce = false;
        if (p != activeSite) {
            siteHost.removeView(p.wv);
            p.wv.destroy();
            if (p == site1) site1 = null;
            if (p == site2) site2 = null;
        }
    }

    /** Leaving page 3: both sites are closed. Downloads are independent and keep going. */
    private void closeSitesUi() {
        pendingLeave = null;
        pendingSite = null;
        activeSite = null;
        for (Site s : new Site[]{site1, site2}) {
            if (s == null) continue;
            try {
                s.wv.stopLoading();
                if (siteHost != null) siteHost.removeView(s.wv);
                s.wv.destroy();
            } catch (Exception e) {
                Log.w(TAG, "closeSite: " + e);
            }
        }
        site1 = null;
        site2 = null;
    }

    private boolean siteBackUi() {
        Site s = activeSite;
        if (s != null && s.wv.canGoBack()) {
            s.wv.goBack();
            return true;
        }
        return false;
    }

    /** webview2: a link that leaves the opened site is held back and the page shows its 6-language notice first. */
    private void askLeave(String url) {
        if (url.equals(pendingLeave)) return;
        pendingLeave = url;
        js("window.__native_onLeave&&window.__native_onLeave(" + JSONObject.quote(url) + ")");
    }

    private final class SiteClient extends WebViewClient {
        private final Site st;

        SiteClient(Site st) { this.st = st; }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            if (!req.isForMainFrame()) return false;
            Uri u = req.getUrl();
            String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            if (sc.equals("about")) return false;
            if (sc.equals("http") || sc.equals("https")) {
                if (st.slot != 2) return false;                // webview1 browses freely
                String host = hostOf(u.toString());
                // redirects while the link first opens (and script redirects in its first seconds) are automatic: they do not count
                boolean automatic = !st.loadedOnce || (!req.hasGesture() && SystemClock.elapsedRealtime() - st.openedAt < 5000);
                if (automatic) {
                    if (!st.loadedOnce && !host.isEmpty()) st.hosts.add(host);
                    return false;
                }
                if (st.allows(host)) return false;
                askLeave(u.toString());
                return true;
            }
            if (externalScheme(sc)) { askLeave(u.toString()); return true; }
            return true;                                       // javascript:, file:, content:, intent: ... never run
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!st.loadedOnce && st.openedUrl.length() > 0) {
                st.loadedOnce = true;
                String h = hostOf(url == null ? "" : url);
                if (!h.isEmpty()) st.hosts.add(h);             // where redirects finally landed is "the opened site" too
            }
            if (pendingSite == st && !st.shown) activate(st);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (!req.isForMainFrame() || pendingSite != st) return;
            pendingSite = null;
            st.openedUrl = "";
            st.loadedOnce = false;
            emitSite("error", st.slot);
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            final int slot = st.slot;
            runOnUiThread(() -> { closeSitesUi(); emitSite("gone", slot); });
            return true;
        }
    }

    // ------------------------------------------------------------------ page 3 : downloads

    private void emitDl(JSONObject o) {
        js("window.__native_onDl&&window.__native_onDl(" + JSONObject.quote(o.toString()) + ")");
    }

    private void dlNote(String code) {
        try {
            JSONObject o = new JSONObject();
            o.put("t", "note");
            o.put("code", code);
            emitDl(o);
        } catch (Exception ignored) { }
    }

    private void startDownload(Site st, String url, String ua, String cd, String mime, long len) {
        if (url == null || !(isHttp(url) || url.startsWith("data:"))) { dlNote("unsupported"); return; }   // blob: and the like cannot be read from outside the page
        Downloader.Task t = downloader.create(url, ua, cd, mime, len, st.wv.getUrl());
        if (Downloader.needsLegacyPermission()
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            waitingForPermission.add(t);
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            return;
        }
        downloader.start(t);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code != REQ_STORAGE) return;
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        List<Downloader.Task> list = new ArrayList<>(waitingForPermission);
        waitingForPermission.clear();
        if (!ok) { dlNote("perm"); return; }
        for (Downloader.Task t : list) downloader.start(t);
    }

    /** Opens a finished download with whatever app can show it (an .apk goes to the system installer). */
    private boolean openDownloaded(String ref, String mime) {
        try {
            if (ref == null || ref.isEmpty()) return false;
            Uri uri = ref.startsWith("content://")
                    ? Uri.parse(ref)
                    : FileProvider.getUriForFile(this, getPackageName() + ".files", new File(ref));
            String type = mime;
            if (type == null || type.isEmpty() || type.equals("application/octet-stream")) {
                String ext = MimeTypeMap.getFileExtensionFromUrl(ref.replace(" ", "%20"));
                String g = (ext == null || ext.isEmpty()) ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase(Locale.ROOT));
                type = g != null ? g : "*/*";
            }
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, type);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        } catch (Exception e) {
            Log.w(TAG, "openDownloaded: " + e);
            return false;
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

        // ---------------------------------------------------------------- page 3

        /** Opens a link in webview1 (slot 1) or webview2 (slot 2). allowedJson = extra hosts that do not count as "leaving". */
        @JavascriptInterface
        public void openSite(final int slot, final String url, final String allowedJson) {
            runOnUiThread(() -> openSiteUi(slot == 2 ? 2 : 1, url, allowedJson));
        }

        @JavascriptInterface
        public void cancelOpen() {
            runOnUiThread(() -> cancelOpenUi());
        }

        @JavascriptInterface
        public void closeSite() {
            runOnUiThread(() -> closeSitesUi());
        }

        /** true = the site went one page back. */
        @JavascriptInterface
        public boolean siteBack() {
            return onUi(() -> siteBackUi(), Boolean.FALSE);
        }

        /** Which parts of the screen belong to our interface while a site is open: all, or a list of [l,t,r,b] in CSS px. */
        @JavascriptInterface
        public void setHit(final boolean all, final String rectsJson) {
            try {
                float d = getResources().getDisplayMetrics().density;
                JSONArray a = new JSONArray(rectsJson == null ? "[]" : rectsJson);
                int n = Math.min(a.length(), 64);
                int[] r = new int[n * 4];
                for (int i = 0; i < n; i++) {
                    JSONArray q = a.getJSONArray(i);
                    for (int k = 0; k < 4; k++) r[i * 4 + k] = Math.round((float) q.getDouble(k) * d);
                }
                if (web != null) {
                    web.rects = r;
                    web.hitAll = all;
                }
            } catch (Exception e) {
                if (web != null) web.hitAll = true;            // when in doubt our interface keeps the touch
            }
        }

        /** The user pressed OK on the notice: the held-back link opens in the phone's browser; this app stays alive. */
        @JavascriptInterface
        public void leaveTo(final String url) {
            runOnUiThread(() -> {
                String u = pendingLeave != null ? pendingLeave : url;
                pendingLeave = null;
                if (u != null && !u.isEmpty()) openOutside(u);
            });
        }

        @JavascriptInterface
        public void leaveCancel() {
            runOnUiThread(() -> pendingLeave = null);
        }

        @JavascriptInterface
        public void cancelDownload(int id) {
            if (downloader != null) downloader.cancel(id);
        }

        /** Opens a finished download; false = no app can open it. */
        @JavascriptInterface
        public boolean openFile(final String ref, final String mime) {
            return onUi(() -> openDownloaded(ref, mime), Boolean.FALSE);
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> finish());
        }
    }
}
