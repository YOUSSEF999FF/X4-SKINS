package com.ahmx.x4skins;

import android.content.Context;
import android.view.MotionEvent;
import android.webkit.WebView;

/**
 * The WebView that draws OUR interface (dialogs, floating 18 MAX button, download bubbles).
 * While a site (webview1 / webview2) is open it sits on top of it as a transparent layer, and a finger that lands outside
 * our own controls must reach the site below. The page tells us where its controls are (see hit.js):
 *   hitAll = true  -> the whole screen belongs to our interface (a dialog is open, or no site is open)
 *   hitAll = false -> only the rectangles in {@link #rects} do; anywhere else the touch falls through to the site.
 * Returning false from dispatchTouchEvent on ACTION_DOWN makes the parent offer the touch to the view underneath.
 */
final class UiWebView extends WebView {

    volatile boolean hitAll = true;
    volatile int[] rects = new int[0];            // left, top, right, bottom ... in device pixels
    private boolean owns = true;

    UiWebView(Context c) {
        super(c);
    }

    private boolean inside(int x, int y) {
        int[] r = rects;
        for (int i = 0; i + 3 < r.length; i += 4) {
            if (x >= r[i] && x <= r[i + 2] && y >= r[i + 1] && y <= r[i + 3]) return true;
        }
        return false;
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        if (ev.getActionMasked() == MotionEvent.ACTION_DOWN) {
            owns = hitAll || inside((int) ev.getX(), (int) ev.getY());
        }
        if (!owns) return false;
        return super.dispatchTouchEvent(ev);
    }
}
