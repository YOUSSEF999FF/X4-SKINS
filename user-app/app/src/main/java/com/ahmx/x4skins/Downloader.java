package com.ahmx.x4skins;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.SparseArray;
import android.webkit.CookieManager;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Real downloads for the two site WebViews.
 * Files go to  Download/AHM X APP/  and every file name gets "AHM X" written next to it ("skin.zip" -> "skin AHM X.zip").
 * Android 10+ : MediaStore.Downloads (no permission needed).  Android 8-9 : public Download folder (storage permission).
 * Progress, real size and the real saved name are reported to the page through {@link Events}.
 */
final class Downloader {

    interface Events { void emit(JSONObject o); }

    static final String DIR = "AHM X APP";
    static final String MARK = "AHM X";

    private final Context ctx;
    private final Events events;
    private final ExecutorService pool = Executors.newFixedThreadPool(3);
    private final ExecutorService helper = Executors.newSingleThreadExecutor();
    private final AtomicInteger seq = new AtomicInteger();
    private final SparseArray<Task> active = new SparseArray<>();

    Downloader(Context ctx, Events events) {
        this.ctx = ctx.getApplicationContext();
        this.events = events;
    }

    /** Android 8 and 9 need the storage permission before writing into the public Download folder. */
    static boolean needsLegacyPermission() {
        return Build.VERSION.SDK_INT < 29;
    }

    Task create(String url, String ua, String contentDisposition, String mime, long length, String referer) {
        return new Task(seq.incrementAndGet(), url, ua, contentDisposition, mime, length, referer);
    }

    void start(Task t) {
        synchronized (active) { active.put(t.id, t); }
        pool.execute(t);
    }

    void cancel(final int id) {
        final Task t;
        synchronized (active) { t = active.get(id); }
        if (t == null) return;
        t.cancelled = true;
        helper.execute(t::abortConnection);          // closing a socket must not happen on the UI thread
    }

    void shutdown() {
        pool.shutdownNow();
        helper.shutdownNow();
    }

    // ------------------------------------------------------------------------------------------ naming

    private static final Pattern CD_STAR = Pattern.compile("filename\\*\\s*=\\s*([^';]*)'[^']*'([^;]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CD_PLAIN = Pattern.compile("filename\\s*=\\s*(\"([^\"]*)\"|[^;]+)", Pattern.CASE_INSENSITIVE);

    static String nameFromDisposition(String cd) {
        if (cd == null || cd.isEmpty()) return null;
        try {
            Matcher m = CD_STAR.matcher(cd);
            if (m.find()) {
                String cs = m.group(1).trim();
                return URLDecoder.decode(m.group(2).trim().replace("+", "%2B"), cs.isEmpty() ? "UTF-8" : cs);
            }
            m = CD_PLAIN.matcher(cd);
            if (m.find()) {
                String v = m.group(2) != null ? m.group(2) : m.group(1);
                return v == null ? null : v.trim();
            }
        } catch (Exception ignored) { }
        return null;
    }

    static String nameFromUrl(String url) {
        try {
            Uri u = Uri.parse(url);
            String seg = u.getLastPathSegment();
            if (seg == null) return null;
            seg = Uri.decode(seg);
            return seg.isEmpty() ? null : seg;
        } catch (Exception e) {
            return null;
        }
    }

    static String clean(String n) {
        if (n == null) return "file";
        n = n.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        while (n.startsWith(".")) n = n.substring(1);
        if (n.isEmpty()) n = "file";
        if (n.length() > 120) {                       // keep the extension when shortening
            int dot = n.lastIndexOf('.');
            String ext = (dot > 0 && n.length() - dot <= 8) ? n.substring(dot) : "";
            n = n.substring(0, 120 - ext.length()) + ext;
        }
        return n;
    }

    /** "skin.zip" -> "skin AHM X.zip"   ("README" -> "README AHM X") */
    static String watermark(String name) {
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        if (base.toLowerCase(Locale.ROOT).endsWith(MARK.toLowerCase(Locale.ROOT))) return name;
        return base + " " + MARK + ext;
    }

    private static String extOf(String name) {
        int dot = name.lastIndexOf('.');
        return (dot > 0 && dot < name.length() - 1) ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    }

    private static String mimeFor(String name, String serverMime) {
        String ext = extOf(name);
        String m = ext.isEmpty() ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        if (m != null) return m;
        if (serverMime != null && !serverMime.isEmpty() && !serverMime.startsWith("text/html")) return serverMime;
        return "application/octet-stream";
    }

    // ------------------------------------------------------------------------------------------ output

    /** Where the bytes go. Created only after the server answered, so a failed link never leaves an empty file behind. */
    private final class Sink {
        OutputStream os;
        Uri uri;
        File file;
        String name;
        String mime;

        void open(String fileName, String mimeType) throws IOException {
            mime = mimeType;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + DIR);
                cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
                ContentResolver r = ctx.getContentResolver();
                uri = r.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new IOException("perm");
                os = r.openOutputStream(uri);
                if (os == null) throw new IOException("perm");
                name = fileName;
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), DIR);
                if (!dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) throw new IOException("perm");
                File f = new File(dir, fileName);
                int i = 1;
                int dot = fileName.lastIndexOf('.');
                String base = dot > 0 ? fileName.substring(0, dot) : fileName;
                String ext = dot > 0 ? fileName.substring(dot) : "";
                while (f.exists()) f = new File(dir, base + " (" + (i++) + ")" + ext);
                os = new FileOutputStream(f);
                file = f;
                name = f.getName();
            }
        }

        /** Makes the file visible to the system and returns the name it really got. */
        String commit() throws IOException {
            os.flush();
            os.close();
            os = null;
            if (uri != null) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
                ContentResolver r = ctx.getContentResolver();
                r.update(uri, cv, null, null);
                Cursor c = null;
                try {
                    c = r.query(uri, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null);
                    if (c != null && c.moveToFirst()) name = c.getString(0);
                } catch (Exception ignored) {
                } finally {
                    if (c != null) c.close();
                }
            } else if (file != null) {
                MediaScannerConnection.scanFile(ctx, new String[]{file.getAbsolutePath()}, new String[]{mime}, null);
            }
            return name;
        }

        String ref() { return uri != null ? uri.toString() : (file != null ? file.getAbsolutePath() : ""); }

        void abort() {
            try { if (os != null) os.close(); } catch (IOException ignored) { }
            os = null;
            try {
                if (uri != null) ctx.getContentResolver().delete(uri, null, null);
                else if (file != null) //noinspection ResultOfMethodCallIgnored
                    file.delete();
            } catch (Exception ignored) { }
        }
    }

    // ------------------------------------------------------------------------------------------ one download

    private static final class Cancelled extends IOException {
        Cancelled() { super("cancelled"); }
    }

    final class Task implements Runnable {
        final int id;
        private String url;
        private final String ua, cd, referer;
        private String mime;
        private long total;
        volatile boolean cancelled;
        private volatile HttpURLConnection conn;
        private Sink sink;

        Task(int id, String url, String ua, String cd, String mime, long len, String referer) {
            this.id = id;
            this.url = url;
            this.ua = (ua == null || ua.isEmpty()) ? System.getProperty("http.agent", "Mozilla/5.0") : ua;
            this.cd = cd;
            this.mime = mime;
            this.total = len > 0 ? len : -1;
            this.referer = referer;
        }

        void abortConnection() {
            HttpURLConnection c = conn;
            if (c != null) { try { c.disconnect(); } catch (Exception ignored) { } }
        }

        private void send(String t, String key, Object val, String key2, Object val2) {
            try {
                JSONObject o = new JSONObject();
                o.put("t", t);
                o.put("id", id);
                if (key != null) o.put(key, val);
                if (key2 != null) o.put(key2, val2);
                events.emit(o);
            } catch (JSONException ignored) { }
        }

        @Override
        public void run() {
            try {
                JSONObject s = new JSONObject();
                String first = clean(nameFromDisposition(cd) != null ? nameFromDisposition(cd) : (nameFromUrl(url) != null ? nameFromUrl(url) : "file"));
                s.put("t", "start"); s.put("id", id); s.put("name", watermark(first)); s.put("total", total);
                events.emit(s);
                download();
            } catch (Cancelled c) {
                if (sink != null) sink.abort();
                send("cancel", null, null, null, null);
            } catch (Exception e) {
                if (sink != null) sink.abort();
                if (cancelled) { send("cancel", null, null, null, null); }
                else {
                    String why = String.valueOf(e.getMessage());
                    send("fail", "reason", why.equals("perm") ? "perm" : (e instanceof SecurityException ? "perm" : "net"), null, null);
                }
            } finally {
                abortConnection();
                synchronized (active) { active.remove(id); }
            }
        }

        private void download() throws Exception {
            InputStream in;
            String finalUrl = url;
            String respCd = null;
            if (url.startsWith("data:")) {
                int comma = url.indexOf(',');
                if (comma < 0) throw new IOException("bad data url");
                String meta = url.substring(5, comma), data = url.substring(comma + 1);
                byte[] bytes = meta.endsWith(";base64") ? Base64.decode(data, Base64.DEFAULT) : URLDecoder.decode(data, "UTF-8").getBytes("UTF-8");
                String mt = meta.split(";")[0];
                if (!mt.isEmpty()) mime = mt;
                total = bytes.length;
                in = new ByteArrayInputStream(bytes);
            } else {
                HttpURLConnection c = connect();
                conn = c;
                finalUrl = c.getURL().toString();
                respCd = c.getHeaderField("Content-Disposition");
                String ct = c.getContentType();
                if (ct != null) mime = ct.split(";")[0].trim();
                long len = c.getContentLengthLong();
                total = len > 0 ? len : -1;
                in = c.getInputStream();
            }

            String raw = nameFromDisposition(respCd);
            if (raw == null) raw = nameFromDisposition(cd);
            if (raw == null) raw = nameFromUrl(finalUrl);
            if (raw == null || raw.isEmpty()) raw = URLUtil.guessFileName(finalUrl, respCd, mime);
            raw = clean(raw);
            if (extOf(raw).isEmpty() && mime != null) {                    // no extension: take it from the content type
                String e = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
                if (e != null && !e.isEmpty()) raw = raw + "." + e;
            }
            String fileName = watermark(raw);
            String outMime = mimeFor(fileName, mime);

            send("meta", "name", fileName, "total", total);
            if (cancelled) throw new Cancelled();

            sink = new Sink();
            sink.open(fileName, outMime);
            try {
                byte[] buf = new byte[64 * 1024];
                long got = 0, lastEmit = 0;
                int n;
                while ((n = in.read(buf)) != -1) {
                    if (cancelled) throw new Cancelled();
                    sink.os.write(buf, 0, n);
                    got += n;
                    long now = SystemClock.elapsedRealtime();
                    if (now - lastEmit >= 150) {
                        lastEmit = now;
                        send("prog", "got", got, "total", total);
                    }
                }
                if (cancelled) throw new Cancelled();
                if (total > 0 && got < total) throw new IOException("incomplete");
                send("prog", "got", got, "total", got);
                String finalName = sink.commit();
                JSONObject d = new JSONObject();
                d.put("t", "done"); d.put("id", id); d.put("name", finalName); d.put("size", got);
                d.put("path", "Download/" + DIR); d.put("ref", sink.ref()); d.put("mime", outMime);
                sink = null;
                events.emit(d);
            } finally {
                try { in.close(); } catch (IOException ignored) { }
            }
        }

        /** GET with manual redirects (cookies and referer are carried along, http -> https hops included). */
        private HttpURLConnection connect() throws IOException {
            String cur = url;
            for (int hop = 0; hop < 8; hop++) {
                if (cancelled) throw new Cancelled();
                HttpURLConnection c = (HttpURLConnection) new URL(cur).openConnection();
                conn = c;
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setRequestProperty("User-Agent", ua);
                c.setRequestProperty("Accept", "*/*");
                c.setRequestProperty("Accept-Encoding", "identity");      // so Content-Length equals the real file size
                if (referer != null && !referer.isEmpty()) c.setRequestProperty("Referer", referer);
                String ck = CookieManager.getInstance().getCookie(cur);
                if (ck != null && !ck.isEmpty()) c.setRequestProperty("Cookie", ck);
                int code = c.getResponseCode();
                for (java.util.Map.Entry<String, java.util.List<String>> h : c.getHeaderFields().entrySet()) {
                    if (h.getKey() != null && h.getKey().equalsIgnoreCase("Set-Cookie")) {      // HTTP/2 sends it in lower case
                        for (String v : h.getValue()) CookieManager.getInstance().setCookie(cur, v);
                    }
                }
                if (code >= 300 && code < 400 && code != 304) {
                    String loc = c.getHeaderField("Location");
                    c.disconnect();
                    if (loc == null || loc.isEmpty()) throw new IOException("redirect");
                    cur = new URL(new URL(cur), loc).toString();
                    continue;
                }
                if (code != 200) {
                    c.disconnect();
                    throw new IOException("http " + code);
                }
                return c;
            }
            throw new IOException("redirects");
        }
    }
}
